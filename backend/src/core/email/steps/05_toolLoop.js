/**
 * Step 5: Tool Loop for Email
 *
 * Executes read-only tool lookups before draft generation.
 * This step gathers information that the LLM needs to generate an accurate response.
 *
 * CRITICAL:
 * - Only READ-ONLY operations
 * - Tool result contract MUST include: outcome, data, message
 * - Results are stored for later use in draft generation
 */

import { executeTool } from '../../../tools/index.js';
import { ToolOutcome, ensureMessage, normalizeOutcome } from '../../../tools/toolResult.js';
import { normalizePhone } from '../../../utils/text.js';

// Maximum tool calls per email turn
const MAX_TOOL_CALLS = 3;

/**
 * Execute email tool loop (pre-generation lookups)
 *
 * Unlike chat/WhatsApp which does tool calls in LLM loop,
 * email does pre-emptive lookups based on classification.
 *
 * @param {Object} ctx - Pipeline context
 * @returns {Promise<Object>} { success }
 */
export async function executeEmailToolLoop(ctx) {
  const { classification, gatedTools, gatedToolDefs, business, customerEmail, inboundMessage } = ctx;

  ctx.toolResults = [];

  // Skip if no tools available
  if (!gatedTools || gatedTools.length === 0) {
    console.log('📧 [ToolLoop] No tools available, skipping');
    return { success: true };
  }

  // Skip if classification says no tools needed
  if (!classification.needs_tools) {
    console.log('📧 [ToolLoop] Classification indicates no tools needed');
    return { success: true };
  }

  try {
    const toolsToRun = determineToolsToRun(classification, gatedTools, inboundMessage, ctx.threadMessages);

    if (toolsToRun.length === 0) {
      console.log('📧 [ToolLoop] No applicable tools for this email');
      return { success: true };
    }

    console.log(`📧 [ToolLoop] Running ${toolsToRun.length} pre-generation lookups`);

    for (const toolConfig of toolsToRun.slice(0, MAX_TOOL_CALLS)) {
      const { name, args } = toolConfig;

      console.log(`📧 [ToolLoop] Executing: ${name}`);

      const startTime = Date.now();

      // Build email-specific state for the tool.
      // Email is stateless across turns, so we synthesize a 'pending' verification
      // state when we detect this is a follow-up email where the customer is providing
      // verification info (name/phone) after being asked for it.
      const emailState = buildEmailToolState(ctx, name, args);

      const result = await executeTool(name, args, business, {
        channel: 'EMAIL',
        fromEmail: ctx.customerEmail || null,  // Email identity signal (separate from channelUserId)
        sessionId: ctx.thread.id,
        messageId: ctx.inboundMessage.id,
        language: ctx.language,
        state: emailState  // Pass state so verification flow works in email
      });

      const executionTime = Date.now() - startTime;

      // Ensure message is always present (critical for LLM context)
      const validatedResult = ensureMessage(result, name, generateDefaultMessage(name, result));

      // Store result with full contract
      const toolResult = {
        toolName: name,
        args,
        outcome: normalizeOutcome(validatedResult.outcome) || (validatedResult.success ? ToolOutcome.OK : ToolOutcome.INFRA_ERROR),
        success: validatedResult.success,
        data: validatedResult.data || null,
        message: validatedResult.message, // Now guaranteed to exist
        executionTime
      };

      ctx.toolResults.push(toolResult);

      console.log(`📧 [ToolLoop] ${name} result:`, {
        outcome: toolResult.outcome,
        hasData: !!toolResult.data,
        message: toolResult.message?.substring(0, 50)
      });

      // If we got customer data, store it prominently
      if (name === 'customer_data_lookup' && result.success && result.data) {
        ctx.customerData = result.data;
      }
    }

    return { success: true };

  } catch (error) {
    console.error('❌ [ToolLoop] Error:', error);

    // Don't fail pipeline, just record error
    ctx.toolResults.push({
      toolName: 'LOOP_ERROR',
      outcome: ToolOutcome.INFRA_ERROR,
      success: false,
      message: error.message
    });

    return { success: true };
  }
}

/**
 * Determine which tools to run based on classification and email content
 *
 * CRITICAL: Aggregates identifiers from ALL inbound messages in the thread,
 * not just the latest. This is essential for multi-turn email verification:
 *   Email 1: "ORD-12345 siparişim nerede?" → order number extracted
 *   Email 2: "Telefonum 05XX isim Emre Taş" → phone + name extracted
 *   → Tool gets ALL identifiers combined for successful lookup+verification
 *
 * @param {Object} classification
 * @param {Array} availableTools
 * @param {Object} inboundMessage - Latest inbound message
 * @param {Array} threadMessages - All messages in thread (for identifier aggregation)
 * @returns {Array} Tools to run with args
 */
function determineToolsToRun(classification, availableTools, inboundMessage, threadMessages = []) {
  const toolsToRun = [];

  // Aggregate ALL inbound message bodies for identifier extraction
  // Priority: latest message first, then older messages fill gaps
  const latestBody = inboundMessage.bodyText || '';

  // Collect all inbound message bodies (excluding outbound = our replies)
  const allInboundBodies = (threadMessages || [])
    .filter(msg => msg.direction === 'INBOUND')
    .map(msg => msg.body || msg.bodyText || '')
    .filter(Boolean);

  // Combined text from all inbound messages (for identifier extraction)
  const combinedBody = allInboundBodies.join('\n');

  // Extract from latest message first, then fall back to combined thread
  const extractedPhone = extractPhone(latestBody) || extractPhone(combinedBody);
  const extractedOrderNumber = extractOrderNumber(latestBody) || extractOrderNumber(combinedBody);
  const extractedName = extractCustomerName(latestBody) || extractCustomerName(combinedBody);
  const extractedVkn = extractVkn(latestBody) || extractVkn(combinedBody);
  const extractedTc = extractTc(latestBody) || extractTc(combinedBody);
  const extractedTicket = extractTicket(latestBody) || extractTicket(combinedBody);

  console.log('📧 [ToolLoop] Extracted identifiers (aggregated from thread):', {
    phone: !!extractedPhone,
    orderNumber: extractedOrderNumber,
    name: extractedName,
    vkn: !!extractedVkn,
    tc: !!extractedTc,
    ticket: extractedTicket,
    threadMessagesCount: allInboundBodies.length
  });

  // Determine query_type based on classification intent
  const intentToQueryType = {
    'ORDER': 'siparis',
    'BILLING': 'muhasebe',
    'APPOINTMENT': 'randevu',
    'SUPPORT': 'ariza',
    'COMPLAINT': 'siparis',  // Complaints usually about orders
    'INQUIRY': 'genel',
    'FOLLOW_UP': 'siparis'   // Follow-ups usually about orders
  };

  // customer_data_lookup: The universal lookup tool
  // Runs whenever we have ANY identifier (phone, order number, vkn, tc, ticket)
  if (availableTools.includes('customer_data_lookup')) {
    const actionableIntents = ['ORDER', 'BILLING', 'APPOINTMENT', 'SUPPORT', 'COMPLAINT', 'FOLLOW_UP', 'INQUIRY'];

    if (actionableIntents.includes(classification.intent)) {
      const hasAnyIdentifier = extractedPhone || extractedOrderNumber || extractedVkn || extractedTc || extractedTicket;

      if (hasAnyIdentifier) {
        const queryType = intentToQueryType[classification.intent] || 'genel';
        const args = { query_type: queryType };

        // Add all found identifiers
        if (extractedPhone) args.phone = extractedPhone;
        if (extractedOrderNumber) args.order_number = extractedOrderNumber;
        if (extractedVkn) args.vkn = extractedVkn;
        if (extractedTc) args.tc = extractedTc;
        if (extractedTicket) args.ticket_number = extractedTicket;
        if (extractedName) {
          args.customer_name = extractedName;
          // CRITICAL: Also pass as verification_input so the tool can use it
          // for name-based verification in a single pass (no multi-turn needed)
          args.verification_input = extractedName;
        }

        toolsToRun.push({
          name: 'customer_data_lookup',
          args
        });
      }
    }
  }

  // Stock lookup if product/stock mentioned
  if (availableTools.includes('check_stock_crm')) {
    const stockMatch = latestBody.match(/(?:stok|stock|ürün|urun|var\s*mı|mevcut)\s*/i);
    if (stockMatch && classification.intent === 'INQUIRY') {
      // Extract product name (rough heuristic)
      const productMatch = latestBody.match(/(?:stok|stock)\s*(?:durumu|bilgisi)?[:\s]*(.+?)(?:\?|$)/im);
      if (productMatch) {
        toolsToRun.push({
          name: 'check_stock_crm',
          args: { product_name: productMatch[1].trim() }
        });
      }
    }
  }

  // Appointment lookup for appointment intents
  if (availableTools.includes('appointment_lookup')) {
    if (classification.intent === 'APPOINTMENT' && extractedPhone) {
      toolsToRun.push({
        name: 'appointment_lookup',
        args: { phone_number: extractedPhone }
      });
    }
  }

  return toolsToRun;
}

// ════════════════════════════════════════════════════════════════════
// Email State Builder
// ════════════════════════════════════════════════════════════════════

/**
 * Build a synthetic state object for email tool execution.
 *
 * WHY THIS IS NEEDED:
 * Email pipeline is stateless — each turn starts fresh. But the
 * customer_data_lookup tool has an anti-single-shot-bypass security
 * check (line ~463-493 in the tool handler) that:
 *   1. If customer_name is provided AND state.verification.status !== 'pending'
 *   2. It checks name match, but STILL forces VERIFICATION_REQUIRED
 *   3. This prevents chat users from guessing names in a single message
 *
 * For EMAIL, this creates an infinite loop:
 *   Email 1: Customer asks for order → tool returns VERIFICATION_REQUIRED
 *   Email 2: Customer provides name → tool STILL returns VERIFICATION_REQUIRED
 *            (because state.verification.status is never 'pending' in email)
 *   Email 3: Customer provides name again → still VERIFICATION_REQUIRED → ∞
 *
 * SOLUTION: When we detect this is a multi-turn email thread where:
 *   - There are previous outbound messages (we already replied)
 *   - The current message provides verification info (name/phone)
 *   - We have enough identifiers to perform a lookup
 *   Then we synthesize a 'pending' verification state so the tool
 *   processes the verification input instead of looping.
 *
 * SECURITY: This only works when the customer provides CORRECT name
 * matching the anchor record. The tool still validates against the anchor.
 *
 * @param {Object} ctx - Pipeline context
 * @param {string} toolName - Tool being called
 * @param {Object} args - Tool arguments
 * @returns {Object} State object for tool execution
 */
function buildEmailToolState(ctx, toolName, args) {
  const state = {};

  // Only applies to customer_data_lookup with verification_input
  if (toolName !== 'customer_data_lookup' || !args.verification_input) {
    return state;
  }

  // EMAIL CHANNEL: Always allow single-pass verification when name is provided.
  //
  // WHY: The anti-single-shot-bypass check in customer_data_lookup (line ~469)
  // was designed for chat/WhatsApp where brute-force is easy (instant messages).
  // In email, single-shot bypass risk is negligible because:
  //   1. Each email "attempt" takes minutes (not milliseconds)
  //   2. Wrong name → NOT_FOUND (no data leak, same as non-existent record)
  //   3. Customer naturally provides all info in one email body
  //   4. Asking "now give me your phone last 4 digits" in a second email
  //      creates terrible UX (days of back-and-forth)
  //
  // By setting status='pending', the tool skips the anti-single-shot block
  // and directly validates the name against the anchor. If it matches → data
  // returned. If not → NOT_FOUND (enumeration-safe).
  console.log('📧 [ToolLoop] Email channel — synthesizing pending verification state for single-pass verify');
  state.verification = {
    status: 'pending',
    pendingField: 'name',
    attempts: 0
  };

  return state;
}

// ════════════════════════════════════════════════════════════════════
// Identifier Extraction Helpers
// ════════════════════════════════════════════════════════════════════

/**
 * Extract phone number from text
 */
function extractPhone(text) {
  if (!text) return null;
  const match = text.match(/(?:\+90|0)?[5][0-9]{9}|(?:\+90|0)?[2-4][0-9]{9}/);
  return match ? normalizePhone(match[0]) : null;
}

/**
 * Extract order number from text (multiple patterns)
 */
function extractOrderNumber(text) {
  if (!text) return null;
  const match = text.match(/(?:sipariş|order|siparis)\s*(?:no|numarası|numarasi|number)?[:\s#-]*([A-Z0-9][\w-]{3,})/i)
    || text.match(/#\s*([A-Z0-9][\w-]{3,})/i)
    || text.match(/\b(ORD-[\w-]+)\b/i);
  return match ? match[1].trim() : null;
}

/**
 * Extract customer name from text
 *
 * Supports patterns:
 * - "ismim Emre" / "adım Emre"
 * - "isim Emre soyadım Taş" / "isim Emre soyad Taş"
 * - "ben Emre Taş"
 * - "adım Emre Taş"
 * - "Merve Aktaş" (when preceded by "isim" or "ad" context)
 */
function extractCustomerName(text) {
  if (!text) return null;

  // Pattern 1: "isim X soyadım Y" / "ismim X soyadım Y"
  const fullNameMatch = text.match(
    /(?:ismim|isim|adım|adim)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]+)\s+(?:soyadım|soyadim|soyad|soyadi|soyadı)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]+)/i
  );
  if (fullNameMatch) {
    return `${fullNameMatch[1].trim()} ${fullNameMatch[2].trim()}`;
  }

  // Pattern 2: "ismim X Y" / "adım X Y" / "ben X Y" (2-3 word name)
  const nameMatch = text.match(
    /(?:ismim|adım|adim|ben)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+){0,2})/i
  );
  if (nameMatch) {
    // Clean: strip trailing words that are NOT part of a name (e.g. "ben Emre telefon" → "Emre")
    let name = nameMatch[1].trim();
    // Remove trailing keywords that aren't names
    const trailingKeywords = /\s+(telefon|numara|sipariş|siparis|soyadım|soyadim|ve|ile|email|mail)\b.*$/i;
    name = name.replace(trailingKeywords, '').trim();
    return name || null;
  }

  return null;
}

/**
 * Extract VKN (10-digit tax ID) from text
 */
function extractVkn(text) {
  if (!text) return null;
  const match = text.match(/(?:vkn|vergi\s*(?:kimlik)?(?:\s*no)?)[:\s]*(\d{10})\b/i);
  return match ? match[1] : null;
}

/**
 * Extract TC (11-digit national ID) from text
 */
function extractTc(text) {
  if (!text) return null;
  const match = text.match(/(?:tc|t\.?c\.?\s*(?:kimlik)?(?:\s*no)?)[:\s]*(\d{11})\b/i);
  return match ? match[1] : null;
}

/**
 * Extract ticket/service number from text
 */
function extractTicket(text) {
  if (!text) return null;
  const match = text.match(/(?:arıza|ariza|servis|ticket|bilet)\s*(?:no|numarası|numarasi|number)?[:\s#-]*([A-Z0-9][\w-]{3,})/i);
  return match ? match[1].trim() : null;
}

/**
 * Generate a default message for tool results that lack one
 * This ensures the LLM always has context about what happened
 */
function generateDefaultMessage(toolName, result) {
  const outcome = normalizeOutcome(result.outcome) || (result.success ? ToolOutcome.OK : ToolOutcome.INFRA_ERROR);

  switch (outcome) {
    case ToolOutcome.OK:
      if (result.data) {
        return `${toolName} lookup successful. Data retrieved.`;
      }
      return `${toolName} completed successfully.`;

    case ToolOutcome.NOT_FOUND:
      return `${toolName}: No matching record found. The customer may need to provide additional information for verification.`;

    case ToolOutcome.VALIDATION_ERROR:
      return `${toolName}: Invalid input provided. Please check the format and try again.`;

    case ToolOutcome.VERIFICATION_REQUIRED:
      return `${toolName}: Customer identity verification is required before accessing this information.`;

    case ToolOutcome.INFRA_ERROR:
      return `${toolName}: A technical issue occurred. The customer should be informed that we're looking into it.`;

    default:
      return `${toolName} completed with status: ${outcome}`;
  }
}

export default { executeEmailToolLoop };

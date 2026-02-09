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
    const toolsToRun = determineToolsToRun(classification, gatedTools, inboundMessage);

    if (toolsToRun.length === 0) {
      console.log('📧 [ToolLoop] No applicable tools for this email');
      return { success: true };
    }

    console.log(`📧 [ToolLoop] Running ${toolsToRun.length} pre-generation lookups`);

    for (const toolConfig of toolsToRun.slice(0, MAX_TOOL_CALLS)) {
      const { name, args } = toolConfig;

      console.log(`📧 [ToolLoop] Executing: ${name}`);

      const startTime = Date.now();

      const result = await executeTool(name, args, business, {
        channel: 'EMAIL',
        fromEmail: ctx.customerEmail || null,  // Email identity signal (separate from channelUserId)
        sessionId: ctx.thread.id,
        messageId: ctx.inboundMessage.id,
        language: ctx.language
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
 * @param {Object} classification
 * @param {Array} availableTools
 * @param {Object} inboundMessage
 * @returns {Array} Tools to run with args
 */
function determineToolsToRun(classification, availableTools, inboundMessage) {
  const toolsToRun = [];
  const body = inboundMessage.bodyText || '';

  // Extract potential identifiers from email body
  const phoneMatch = body.match(/(?:\+90|0)?[5][0-9]{9}|(?:\+90|0)?[2-4][0-9]{9}/);
  const extractedPhone = phoneMatch ? normalizePhone(phoneMatch[0]) : null;

  // Extract order number (multiple patterns)
  const orderMatch = body.match(/(?:sipariş|order|siparis)\s*(?:no|numarası|numarasi|number)?[:\s#-]*([A-Z0-9][\w-]{3,})/i)
    || body.match(/#\s*([A-Z0-9][\w-]{3,})/i)
    || body.match(/\b(ORD-[\w-]+)\b/i);
  const extractedOrderNumber = orderMatch ? orderMatch[1].trim() : null;

  // Extract customer name from "ismim X" or "adım X" or "ben X" patterns
  const nameMatch = body.match(/(?:ismim|adım|adim|ben)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+){0,2})/i);
  const extractedName = nameMatch ? nameMatch[1].trim() : null;

  // Extract VKN (10 digit) or TC (11 digit)
  const vknMatch = body.match(/(?:vkn|vergi\s*(?:kimlik)?(?:\s*no)?)[:\s]*(\d{10})\b/i);
  const tcMatch = body.match(/(?:tc|t\.?c\.?\s*(?:kimlik)?(?:\s*no)?)[:\s]*(\d{11})\b/i);
  const extractedVkn = vknMatch ? vknMatch[1] : null;
  const extractedTc = tcMatch ? tcMatch[1] : null;

  // Extract ticket/service number
  const ticketMatch = body.match(/(?:arıza|ariza|servis|ticket|bilet)\s*(?:no|numarası|numarasi|number)?[:\s#-]*([A-Z0-9][\w-]{3,})/i);
  const extractedTicket = ticketMatch ? ticketMatch[1].trim() : null;

  console.log('📧 [ToolLoop] Extracted identifiers:', {
    phone: !!extractedPhone,
    orderNumber: extractedOrderNumber,
    name: extractedName,
    vkn: !!extractedVkn,
    tc: !!extractedTc,
    ticket: extractedTicket
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
        if (extractedName) args.customer_name = extractedName;

        toolsToRun.push({
          name: 'customer_data_lookup',
          args
        });
      }
    }
  }

  // Stock lookup if product/stock mentioned
  if (availableTools.includes('check_stock_crm')) {
    const stockMatch = body.match(/(?:stok|stock|ürün|urun|var\s*mı|mevcut)\s*/i);
    if (stockMatch && classification.intent === 'INQUIRY') {
      // Extract product name (rough heuristic)
      const productMatch = body.match(/(?:stok|stock)\s*(?:durumu|bilgisi)?[:\s]*(.+?)(?:\?|$)/im);
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

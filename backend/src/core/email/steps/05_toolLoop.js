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
import { ToolOutcome, ensureMessage } from '../../../tools/toolResult.js';
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
        outcome: validatedResult.outcome || (validatedResult.success ? ToolOutcome.OK : ToolOutcome.SYSTEM_ERROR),
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
      outcome: ToolOutcome.SYSTEM_ERROR,
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

  // Extract potential phone number for customer lookup
  const phoneMatch = body.match(/(?:\+90|0)?[5][0-9]{9}|(?:\+90|0)?[2-4][0-9]{9}/);
  const extractedPhone = phoneMatch ? normalizePhone(phoneMatch[0]) : null;

  // Customer lookup for order/billing/appointment intents
  if (availableTools.includes('customer_data_lookup')) {
    if (['ORDER', 'BILLING', 'APPOINTMENT', 'SUPPORT', 'COMPLAINT'].includes(classification.intent)) {
      if (extractedPhone) {
        toolsToRun.push({
          name: 'customer_data_lookup',
          args: { phone_number: extractedPhone }
        });
      }
    }
  }

  // Order lookup if order number mentioned
  if (availableTools.includes('order_status')) {
    const orderMatch = body.match(/(?:sipariş|order|#)\s*(?:no|numarası|number)?:?\s*([A-Z0-9-]+)/i);
    if (orderMatch) {
      toolsToRun.push({
        name: 'order_status',
        args: { order_id: orderMatch[1] }
      });
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
  const outcome = result.outcome || (result.success ? 'OK' : 'ERROR');

  switch (outcome) {
    case 'OK':
      if (result.data) {
        return `${toolName} lookup successful. Data retrieved.`;
      }
      return `${toolName} completed successfully.`;

    case 'NOT_FOUND':
      return `${toolName}: No matching record found. The customer may need to provide additional information for verification.`;

    case 'VALIDATION_ERROR':
      return `${toolName}: Invalid input provided. Please check the format and try again.`;

    case 'VERIFICATION_REQUIRED':
      return `${toolName}: Customer identity verification is required before accessing this information.`;

    case 'SYSTEM_ERROR':
      return `${toolName}: A technical issue occurred. The customer should be informed that we're looking into it.`;

    default:
      return `${toolName} completed with status: ${outcome}`;
  }
}

export default { executeEmailToolLoop };

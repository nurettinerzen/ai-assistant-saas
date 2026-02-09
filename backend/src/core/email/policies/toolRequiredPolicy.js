/**
 * Tool Required Policy
 *
 * Forces tool lookup before draft generation for certain intents.
 * Prevents AI from making up order statuses, appointment times, etc.
 *
 * Policy: If intent requires data and tool didn't run or failed,
 * draft MUST ask for verification info instead of guessing.
 */
import { ToolOutcome, normalizeOutcome } from '../../../tools/toolResult.js';
import { getMessageVariant } from '../../../messages/messageCatalog.js';

/**
 * Intents that REQUIRE tool data before responding
 * If tool fails or no data, draft must ask for verification
 *
 * EXPANDED: Now covers all factual intents (tracking, pricing, stock, returns, etc.)
 */
// NOTE: requiredFields use CANONICAL tool schema names (via fieldNormalizer.js).
// order_number (not order_id), phone (not phone_number), etc.
const TOOL_REQUIRED_INTENTS = {
  ORDER: {
    tools: ['customer_data_lookup', 'check_order_status_crm'],
    fallbackBehavior: 'ASK_VERIFICATION',
    requiredFields: ['order_number', 'phone'],
    messageKey: 'EMAIL_TOOL_REQUIRED_ORDER'
  },
  BILLING: {
    tools: ['customer_data_lookup'],
    fallbackBehavior: 'ASK_VERIFICATION',
    requiredFields: ['phone', 'invoice_number'],
    messageKey: 'EMAIL_TOOL_REQUIRED_BILLING'
  },
  APPOINTMENT: {
    tools: ['customer_data_lookup', 'appointment_lookup'],
    fallbackBehavior: 'ASK_VERIFICATION',
    requiredFields: ['phone'],
    messageKey: 'EMAIL_TOOL_REQUIRED_APPOINTMENT'
  },
  COMPLAINT: {
    tools: ['customer_data_lookup'],
    fallbackBehavior: 'ASK_VERIFICATION',
    requiredFields: ['phone', 'order_number'],
    messageKey: 'EMAIL_TOOL_REQUIRED_COMPLAINT'
  },
  TRACKING: {
    tools: ['customer_data_lookup', 'check_order_status_crm'],
    fallbackBehavior: 'ASK_VERIFICATION',
    requiredFields: ['tracking_number', 'order_number'],
    messageKey: 'EMAIL_TOOL_REQUIRED_TRACKING'
  },
  PRICING: {
    tools: ['get_product_stock', 'check_stock_crm'],
    fallbackBehavior: 'ASK_VERIFICATION',
    requiredFields: ['product_id', 'product_name'],
    messageKey: 'EMAIL_TOOL_REQUIRED_PRICING'
  },
  STOCK: {
    tools: ['get_product_stock', 'check_stock_crm'],
    fallbackBehavior: 'ASK_VERIFICATION',
    requiredFields: ['product_id', 'sku'],
    messageKey: 'EMAIL_TOOL_REQUIRED_STOCK'
  },
  RETURN: {
    tools: ['customer_data_lookup', 'check_order_status_crm'],
    fallbackBehavior: 'ASK_VERIFICATION',
    requiredFields: ['order_number', 'return_number'],
    messageKey: 'EMAIL_TOOL_REQUIRED_RETURN'
  },
  REFUND: {
    tools: ['customer_data_lookup'],
    fallbackBehavior: 'ASK_VERIFICATION',
    requiredFields: ['order_number', 'phone'],
    messageKey: 'EMAIL_TOOL_REQUIRED_REFUND'
  },
  ACCOUNT: {
    tools: ['customer_data_lookup'],
    fallbackBehavior: 'ASK_VERIFICATION',
    requiredFields: ['phone', 'email'],
    messageKey: 'EMAIL_TOOL_REQUIRED_ACCOUNT'
  }
};

/**
 * Intents that do NOT require tool data
 * AI can respond based on knowledge base alone
 */
const TOOL_OPTIONAL_INTENTS = [
  'INQUIRY',
  'GENERAL',
  'THANK_YOU',
  'CONFIRMATION',
  'FOLLOW_UP'
];

/**
 * Enforce tool required policy
 *
 * @param {Object} params
 * @param {Object} params.classification - Email classification
 * @param {Array} params.toolResults - Tool execution results
 * @param {string} params.language - Language code (TR/EN)
 * @returns {Object} { enforced, action, message? }
 */
export function enforceToolRequiredPolicy({ classification, toolResults, language }) {
  const intent = classification?.intent;

  // Check if this intent requires tools
  const policy = TOOL_REQUIRED_INTENTS[intent];

  if (!policy) {
    // Intent doesn't require tools
    return {
      enforced: false,
      action: 'PROCEED'
    };
  }

  // Check if required tools were called
  const toolsCalled = toolResults?.map(r => r.toolName) || [];
  const requiredTools = policy.tools;
  const calledRequiredTools = requiredTools.filter(t => toolsCalled.includes(t));

  if (calledRequiredTools.length === 0) {
    // No required tools were called
    console.warn(`⚠️ [ToolRequired] Intent ${intent} requires tools but none were called`);

    return {
      enforced: true,
      action: policy.fallbackBehavior,
      message: getMessageVariant(policy.messageKey, {
        language,
        directiveType: 'ASK_VERIFICATION',
        severity: 'info',
        intent
      }).text,
      requiredFields: policy.requiredFields,
      reason: 'NO_TOOLS_CALLED'
    };
  }

  // Check if any required tool succeeded
  const successfulTools = toolResults?.filter(r =>
    requiredTools.includes(r.toolName) && normalizeOutcome(r.outcome) === ToolOutcome.OK
  ) || [];

  if (successfulTools.length === 0) {
    // Tools were called but none succeeded
    const failedOutcomes = toolResults
      ?.filter(r => requiredTools.includes(r.toolName))
      ?.map(r => ({ tool: r.toolName, outcome: normalizeOutcome(r.outcome) })) || [];

    // Check specific outcomes
    const hasNotFound = failedOutcomes.some(r => r.outcome === ToolOutcome.NOT_FOUND);
    const hasVerificationRequired = failedOutcomes.some(r => r.outcome === ToolOutcome.VERIFICATION_REQUIRED);
    const hasSystemError = failedOutcomes.some(r => r.outcome === ToolOutcome.INFRA_ERROR);

    if (hasSystemError) {
      // System error - use special message
      return {
        enforced: true,
        action: 'SYSTEM_ERROR_FALLBACK',
        message: getMessageVariant('EMAIL_SYSTEM_ERROR_FALLBACK', {
          language,
          directiveType: 'SYSTEM_FALLBACK',
          severity: 'warning',
          intent
        }).text,
        reason: 'SYSTEM_ERROR'
      };
    }

    if (hasVerificationRequired) {
      // Need verification
      return {
        enforced: true,
        action: 'ASK_VERIFICATION',
        message: getMessageVariant(policy.messageKey, {
          language,
          directiveType: 'ASK_VERIFICATION',
          severity: 'info',
          intent
        }).text,
        requiredFields: policy.requiredFields,
        reason: 'VERIFICATION_REQUIRED'
      };
    }

    if (hasNotFound) {
      // Data not found - ask for more info
      return {
        enforced: true,
        action: 'ASK_VERIFICATION',
        message: getMessageVariant('EMAIL_NOT_FOUND_GENERIC', {
          language,
          directiveType: 'ASK_VERIFICATION',
          severity: 'info',
          intent,
          variables: {
            fields: language === 'TR'
              ? policy.requiredFields.join(' veya ')
              : policy.requiredFields.join(' or ')
          }
        }).text,
        requiredFields: policy.requiredFields,
        reason: 'NOT_FOUND'
      };
    }
  }

  // At least one required tool succeeded
  return {
    enforced: false,
    action: 'PROCEED',
    successfulTools: successfulTools.map(t => t.toolName)
  };
}

/**
 * Get tool requirement for an intent
 */
export function getToolRequirement(intent) {
  return TOOL_REQUIRED_INTENTS[intent] || null;
}

/**
 * Check if intent requires tool data
 */
export function intentRequiresTool(intent) {
  return intent in TOOL_REQUIRED_INTENTS;
}

/**
 * RAG Fact Grounding Policy
 *
 * Even with RAG examples, tool-required intents MUST have tool data.
 * RAG provides STYLE guidance, NOT factual data.
 *
 * @param {Object} params
 * @param {Object} params.classification
 * @param {Array} params.toolResults
 * @param {Array} params.ragExamples
 * @returns {Object} { allowRAG, mustUseVerification, reason }
 */
export function enforceFactGrounding({ classification, toolResults, ragExamples }) {
  const intent = classification?.intent;

  // If intent requires tools
  if (intentRequiresTool(intent)) {
    const hasSuccessfulTool = toolResults?.some(r => r.outcome === ToolOutcome.OK);

    if (!hasSuccessfulTool) {
      // Even with RAG, we CANNOT use factual claims
      // RAG examples are for STYLE only, not for order/billing data
      return {
        allowRAG: true,  // Can use for style
        mustUseVerification: true,  // But MUST ask for verification
        ragUsage: 'STYLE_ONLY',  // Instruction to LLM
        reason: 'TOOL_DATA_REQUIRED_FOR_FACTS'
      };
    }
  }

  // Tool data available or not required
  return {
    allowRAG: true,
    mustUseVerification: false,
    ragUsage: 'FULL',
    reason: null
  };
}

/**
 * Get fact grounding instructions for LLM prompt
 */
export function getFactGroundingInstructions(factGrounding, language) {
  if (!factGrounding?.mustUseVerification) {
    return '';
  }

  const instructions = language === 'TR'
    ? `
### FACT GROUNDING (ZORUNLU)
- Sipariş/fatura/randevu bilgisi için TOOL DATA GEREKLİ
- RAG örnekleri SADECE ÜSLUP için kullanılabilir
- Somut veri (sipariş durumu, fiyat, tarih) UYDURMA
- Müşteriden doğrulama bilgisi iste`
    : `
### FACT GROUNDING (REQUIRED)
- Tool data REQUIRED for order/billing/appointment info
- RAG examples are for STYLE ONLY
- Do NOT fabricate specific data (order status, prices, dates)
- Ask customer for verification info`;

  return instructions;
}

export default {
  enforceToolRequiredPolicy,
  getToolRequirement,
  intentRequiresTool,
  enforceFactGrounding,
  getFactGroundingInstructions,
  TOOL_REQUIRED_INTENTS,
  TOOL_OPTIONAL_INTENTS
};

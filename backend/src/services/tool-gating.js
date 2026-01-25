/**
 * Tool Gating Based on Confidence & Flow Context
 *
 * CRITICAL: High-impact tools only available with high confidence + correct flow
 */

/**
 * Get allowed tools based on confidence and context
 *
 * @param {number} confidence - Classifier confidence (0-1)
 * @param {string} activeFlow - Current flow (ORDER_STATUS, COMPLAINT, etc.)
 * @param {Array<string>} flowTools - Tools allowed by flow definition
 * @returns {Array<string>} Filtered tool list
 */
export function getGatedTools(confidence, activeFlow, flowTools = []) {
  // LOW CONFIDENCE (<0.6): No tools, conversation only
  if (confidence < 0.6) {
    console.log(`🚫 [ToolGating] Confidence ${confidence.toFixed(2)} < 0.6 → No tools allowed`);
    return [];
  }

  // MEDIUM CONFIDENCE (0.6-0.8): Only safe read-only tools
  if (confidence >= 0.6 && confidence < 0.8) {
    const safeMediumTools = ['customer_data_lookup']; // Read-only lookup
    const allowedTools = flowTools.filter(tool => safeMediumTools.includes(tool));
    console.log(`⚠️ [ToolGating] Confidence ${confidence.toFixed(2)} (medium) → Safe tools only:`, allowedTools);
    return allowedTools;
  }

  // HIGH CONFIDENCE (≥0.8): Flow-specific gating for high-impact tools
  const gatedTools = applyFlowSpecificGating(flowTools, activeFlow, confidence);
  console.log(`✅ [ToolGating] Confidence ${confidence.toFixed(2)} (high) → Flow-gated tools:`, gatedTools);
  return gatedTools;
}

/**
 * Apply flow-specific gating for high-impact tools
 */
function applyFlowSpecificGating(flowTools, activeFlow, confidence) {
  // High-impact tools that need special gating
  const highImpactTools = {
    'create_callback': {
      allowedFlows: ['COMPLAINT', 'GENERAL', 'CALLBACK_REQUEST'], // Callback, complaint, or general
      minConfidence: 0.8 // Lowered from 0.85 for better UX
    },
    'calendly_book': {
      allowedFlows: ['APPOINTMENT'],
      minConfidence: 0.8
    },
    'opentable_reserve': {
      allowedFlows: ['RESERVATION'],
      minConfidence: 0.8
    }
  };

  return flowTools.filter(tool => {
    const gating = highImpactTools[tool];

    if (!gating) {
      // Not a high-impact tool, allow it
      return true;
    }

    // Check flow match
    if (!gating.allowedFlows.includes(activeFlow)) {
      console.log(`🚫 [ToolGating] ${tool} blocked: wrong flow (${activeFlow} not in ${gating.allowedFlows})`);
      return false;
    }

    // Check confidence threshold
    if (confidence < gating.minConfidence) {
      console.log(`🚫 [ToolGating] ${tool} blocked: confidence ${confidence.toFixed(2)} < ${gating.minConfidence}`);
      return false;
    }

    return true;
  });
}

/**
 * Check if tool execution should be allowed at runtime
 *
 * @param {string} toolName - Tool being executed
 * @param {Object} context - Execution context
 * @returns {Object} { allowed: boolean, reason?: string }
 */
export function canExecuteTool(toolName, context) {
  const { confidence, activeFlow, verificationStatus } = context;

  // Always block if confidence too low
  if (confidence < 0.6) {
    return {
      allowed: false,
      reason: `Confidence ${confidence.toFixed(2)} too low for tool execution`
    };
  }

  // Verification-required tools
  const verificationRequired = ['customer_data_lookup'];
  if (verificationRequired.includes(toolName) && verificationStatus !== 'verified') {
    return {
      allowed: false,
      reason: `${toolName} requires customer verification`
    };
  }

  // High-impact tools need high confidence
  const highImpactMinConfidence = {
    'create_callback': 0.85,
    'calendly_book': 0.8,
    'opentable_reserve': 0.8
  };

  const minConf = highImpactMinConfidence[toolName];
  if (minConf && confidence < minConf) {
    return {
      allowed: false,
      reason: `${toolName} requires confidence ≥ ${minConf}, got ${confidence.toFixed(2)}`
    };
  }

  return { allowed: true };
}

export default {
  getGatedTools,
  canExecuteTool
};

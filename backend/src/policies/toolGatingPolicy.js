/**
 * Tool Gating Policy
 *
 * Determines which tools are allowed based on:
 * - Classifier confidence
 * - Active flow context
 * - Verification status
 */

import { getGatedTools, canExecuteTool } from '../services/tool-gating.js';

/**
 * Apply tool gating policy
 *
 * @param {Object} params
 * @returns {Array<string>} Gated tool list
 */
export function applyToolGatingPolicy(params) {
  const { confidence, activeFlow, allowedTools, verificationStatus, metrics } = params;

  const gatedTools = getGatedTools(confidence, activeFlow, allowedTools);

  // Log to metrics
  if (metrics) {
    metrics.toolGating = {
      originalCount: allowedTools.length,
      gatedCount: gatedTools.length,
      confidence,
      removed: allowedTools.filter(t => !gatedTools.includes(t))
    };
  }

  return gatedTools;
}

export default { applyToolGatingPolicy };

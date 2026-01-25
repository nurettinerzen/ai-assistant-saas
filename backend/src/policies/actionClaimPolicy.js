/**
 * Action Claim Policy
 *
 * Prevents LLM from claiming actions without tool execution.
 * Two-layer enforcement:
 * 1. CRITICAL: Hard block if tool failed but LLM claims action
 * 2. SOFT: Correction prompt if tool called but LLM uses wrong verbs
 */

import { validateResponseAfterToolFail } from '../services/tool-fail-handler.js';
import { validateActionClaim } from '../services/action-claim-validator.js';
import { logViolation } from '../services/routing-metrics.js';
import { isFeatureEnabled } from '../config/feature-flags.js';

/**
 * Apply action claim policy
 *
 * @param {Object} params
 * @returns {string} Final validated response text
 */
export async function applyActionClaimPolicy(params) {
  const { responseText, hadToolSuccess, hadToolCalls, language, sessionId, chat, metrics } = params;

  let text = responseText;

  // LAYER 1: CRITICAL - Tool fail validation (HARD BLOCK)
  const toolFailValidation = validateResponseAfterToolFail(text, hadToolSuccess, language);

  if (!toolFailValidation.valid) {
    console.error('🚨 [ActionClaimPolicy] CRITICAL - LLM made action claim after tool failure!');

    // Log critical violation
    logViolation('ACTION_CLAIM_AFTER_TOOL_FAIL', {
      sessionId,
      details: {
        originalText: text?.substring(0, 200),
        violationType: toolFailValidation.violationType,
        hadToolSuccess
      }
    });

    // HARD BLOCK: Use forced response
    text = toolFailValidation.forcedResponse;

    if (metrics) {
      metrics.actionClaimBlocked = true;
      metrics.blockType = 'CRITICAL';
    }

    return text;
  }

  // LAYER 2: SOFT - Action claim validation (CORRECTION)
  if (isFeatureEnabled('ENFORCE_ACTION_CLAIMS') && hadToolCalls) {
    const actionValidation = validateActionClaim(text, hadToolCalls, language);

    if (!actionValidation.valid) {
      console.warn('⚠️ [ActionClaimPolicy] Action claim violation, attempting correction');

      // Log violation
      logViolation('ACTION_CLAIM', {
        sessionId,
        details: {
          originalText: text?.substring(0, 200),
          error: actionValidation.error,
          claimedAction: actionValidation.claimedAction
        },
        resolved: false
      });

      // Try correction via LLM
      try {
        if (chat) {
          const correctionResult = await chat.sendMessage(actionValidation.correctionPrompt);
          const correctedText = correctionResult.response.text();

          console.log('✅ [ActionClaimPolicy] Response corrected');

          // Log resolution
          logViolation('ACTION_CLAIM', {
            sessionId,
            details: { correctedText: correctedText?.substring(0, 200) },
            resolved: true
          });

          text = correctedText;

          if (metrics) {
            metrics.actionClaimCorrected = true;
          }
        }
      } catch (error) {
        console.error('❌ [ActionClaimPolicy] Correction failed:', error.message);
        // Keep original text if correction fails
      }
    }
  }

  return text;
}

export default { applyActionClaimPolicy };

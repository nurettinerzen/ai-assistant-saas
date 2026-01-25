/**
 * Step 7: Guardrails
 *
 * - Applies all guardrail policies in sequence
 * - Action claim validation (CRITICAL + SOFT)
 * - Returns final validated response text
 */

import { applyActionClaimPolicy } from '../../../policies/actionClaimPolicy.js';

export async function applyGuardrails(params) {
  const {
    responseText,
    hadToolSuccess,
    toolsCalled,
    chat,
    language,
    sessionId,
    metrics
  } = params;

  console.log('🛡️ [Guardrails] Applying policies...');

  // POLICY 1: Action Claim Validation (CRITICAL + SOFT)
  const finalText = await applyActionClaimPolicy({
    responseText,
    hadToolSuccess,
    hadToolCalls: toolsCalled.length > 0,
    language,
    sessionId,
    chat,
    metrics
  });

  // POLICY 2: Content Safety (future)
  // const safeText = await applyContentSafetyPolicy({ text: finalText, language });

  // POLICY 3: PII Redaction (future)
  // const redactedText = await applyPIIRedactionPolicy({ text: finalText, language });

  console.log('✅ [Guardrails] All policies applied');

  return {
    finalResponse: finalText,
    guardrailsApplied: ['ACTION_CLAIM']
  };
}

export default { applyGuardrails };

/**
 * Step 7: Guardrails
 *
 * - Applies all guardrail policies in sequence
 * - Action claim validation (CRITICAL + SOFT)
 * - PII leak prevention (CRITICAL)
 * - Returns final validated response text
 */

import { applyActionClaimPolicy } from '../../../policies/actionClaimPolicy.js';
import { scanForPII } from '../../email/policies/piiPreventionPolicy.js';
import { lockSession, getLockMessage } from '../../../services/session-lock.js';

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

  // POLICY 1: PII Leak Prevention (CRITICAL - must run first!)
  const piiScan = scanForPII(responseText);
  if (piiScan.hasCritical) {
    console.error('🚨 [Guardrails] CRITICAL PII DETECTED in assistant output!', piiScan.findings);

    // Lock session immediately (1 hour)
    await lockSession(sessionId, 'PII_RISK', 60 * 60 * 1000); // 1 hour

    // Return safe error message instead of leaking PII
    const safeMessage = getLockMessage('PII_RISK', language);

    return {
      finalResponse: safeMessage,
      guardrailsApplied: ['PII_PREVENTION'],
      blocked: true,
      lockReason: 'PII_RISK',
      piiFindings: piiScan.findings.map(f => ({ type: f.type, severity: f.severity }))
    };
  }

  // Log PII warnings (non-critical)
  if (piiScan.hasHigh) {
    console.warn('⚠️ [Guardrails] HIGH-severity PII detected (not blocked):', piiScan.findings);
    metrics.piiWarnings = piiScan.findings.filter(f => f.severity === 'HIGH').map(f => f.type);
  }

  // POLICY 2: Action Claim Validation (CRITICAL + SOFT)
  const finalText = await applyActionClaimPolicy({
    responseText,
    hadToolSuccess,
    hadToolCalls: toolsCalled.length > 0,
    language,
    sessionId,
    chat,
    metrics
  });

  // POLICY 3: Content Safety (future)
  // const safeText = await applyContentSafetyPolicy({ text: finalText, language });

  console.log('✅ [Guardrails] All policies applied');

  return {
    finalResponse: finalText,
    guardrailsApplied: piiScan.hasHigh
      ? ['PII_PREVENTION (WARN)', 'ACTION_CLAIM']
      : ['PII_PREVENTION', 'ACTION_CLAIM']
  };
}

export default { applyGuardrails };

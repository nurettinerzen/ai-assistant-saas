/**
 * Step 7: Guardrails
 *
 * - Applies all guardrail policies in sequence
 * - Response firewall (JSON/HTML/Prompt disclosure) (P0 SECURITY)
 * - PII leak prevention (CRITICAL)
 * - Action claim validation (CRITICAL + SOFT)
 * - Returns final validated response text
 */

import { applyActionClaimPolicy } from '../../../policies/actionClaimPolicy.js';
import { scanForPII } from '../../email/policies/piiPreventionPolicy.js';
import { lockSession, getLockMessage } from '../../../services/session-lock.js';
import { sanitizeResponse, logFirewallViolation } from '../../../utils/response-firewall.js';

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

  // POLICY 0: Response Firewall (P0 SECURITY - must run FIRST!)
  // Blocks: JSON dumps, HTML, system prompt disclosure, internal metadata
  const firewallResult = sanitizeResponse(responseText, language);

  if (!firewallResult.safe) {
    console.error('🚨 [FIREWALL] Response blocked!', firewallResult.violations);

    // Log violation for monitoring
    await logFirewallViolation({
      violations: firewallResult.violations,
      original: firewallResult.original,
      sessionId,
      timestamp: new Date().toISOString()
    }, null, chat?.businessId);

    // Lock session temporarily (10 minutes) to prevent abuse
    await lockSession(sessionId, 'FIREWALL_VIOLATION', 10 * 60 * 1000);

    // Return sanitized fallback response
    return {
      finalResponse: firewallResult.sanitized,
      guardrailsApplied: ['RESPONSE_FIREWALL'],
      blocked: true,
      lockReason: 'FIREWALL_VIOLATION',
      violations: firewallResult.violations
    };
  }

  console.log('✅ [Firewall] Response passed security checks');

  // POLICY 1: PII Leak Prevention (CRITICAL)
  const piiScan = scanForPII(responseText);
  if (piiScan.hasCritical) {
    console.error('🚨 [Guardrails] CRITICAL PII DETECTED in assistant output!', piiScan.findings);

    // P0: Log PII leak attempt to SecurityEvent
    try {
      const { logPIILeakBlock } = await import('../../../middleware/securityEventLogger.js');
      const piiTypes = piiScan.findings.map(f => f.type);

      const mockReq = {
        ip: 'system',
        headers: { 'user-agent': 'internal' },
        path: '/chat',
        method: 'POST'
      };

      await logPIILeakBlock(mockReq, piiTypes, chat?.businessId);
    } catch (error) {
      console.error('Failed to log PII leak to SecurityEvent:', error);
    }

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

  const appliedPolicies = ['RESPONSE_FIREWALL', 'PII_PREVENTION', 'ACTION_CLAIM'];
  if (piiScan.hasHigh) {
    appliedPolicies[1] = 'PII_PREVENTION (WARN)';
  }

  return {
    finalResponse: finalText,
    guardrailsApplied: appliedPolicies
  };
}

export default { applyGuardrails };

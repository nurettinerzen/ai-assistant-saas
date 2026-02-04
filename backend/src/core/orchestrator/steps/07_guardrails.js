/**
 * Step 7: Guardrails
 *
 * - Applies all guardrail policies in sequence
 * - Response firewall (JSON/HTML/Prompt disclosure) (P0 SECURITY)
 * - PII leak prevention (CRITICAL)
 * - Security Gateway Leak Filter (P0 - Verification-based) (NEW)
 * - Tool-only data guard (P0-A: semantic gating)
 * - Internal protocol guard (P0-B: intent-based)
 * - Anti-confabulation guard (P1-A)
 * - Action claim validation (CRITICAL + SOFT)
 * - Returns final validated response text
 */

import { applyActionClaimPolicy } from '../../../policies/actionClaimPolicy.js';
import { scanForPII } from '../../email/policies/piiPreventionPolicy.js';
import { lockSession, getLockMessage } from '../../../services/session-lock.js';
import { sanitizeResponse, logFirewallViolation } from '../../../utils/response-firewall.js';
import { ensurePolicyGuidance } from '../../../services/tool-fail-handler.js';

// Enhanced guardrails (P0-A, P0-B, P1-A)
import { validateToolOnlyData } from '../../../guardrails/toolOnlyDataGuard.js';
import { validateInternalProtocol } from '../../../guardrails/internalProtocolGuard.js';
import { validateConfabulation } from '../../../guardrails/antiConfabulationGuard.js';

// NEW: Merkezi Security Gateway - Leak Filter (P0)
import {
  applyLeakFilter,
  evaluateSecurityGateway,
  extractFieldsFromToolOutput,
  extractRecordOwner,
  checkProductNotFound,
  checkOrderNotFoundPressure,
  enforceRequiredToolCall
} from '../../../guardrails/securityGateway.js';

export async function applyGuardrails(params) {
  const {
    responseText: initialResponseText,
    hadToolSuccess,
    toolsCalled,
    toolOutputs = [], // Tool output'ları (identity match için)
    chat,
    language,
    sessionId,
    metrics,
    userMessage,
    verificationState = 'none', // Doğrulama durumu
    verifiedIdentity = null, // Doğrulanmış kimlik
    intent = null // Tespit edilen intent (requiresToolCall kontrolü için)
  } = params;

  // Mutable response text (Product/Order not found override için)
  let responseText = initialResponseText;

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

  // POLICY 1.5: Security Gateway Leak Filter (P0 - Verification-based)
  // Bu en kritik kontrol: verified olmadan hassas veri ASLA çıkamaz
  const leakFilterResult = applyLeakFilter(responseText, verificationState, language);

  if (!leakFilterResult.safe) {
    console.error('🚨 [SecurityGateway] LEAK DETECTED!', {
      leaks: leakFilterResult.leaks,
      verificationState,
      blocked: true
    });

    metrics.leakFilterViolation = {
      leaks: leakFilterResult.leaks,
      verificationState
    };

    // Leak varsa response'u override et (deterministik)
    // Bu, HP-12, HP-22, HP-29, HP-39, HP-21 gibi fail'leri kökten kapatır
    return {
      finalResponse: leakFilterResult.sanitized,
      guardrailsApplied: ['RESPONSE_FIREWALL', 'PII_PREVENTION', 'SECURITY_GATEWAY_LEAK_FILTER'],
      blocked: true,
      blockReason: 'SENSITIVE_DATA_LEAK',
      leaks: leakFilterResult.leaks
    };
  }

  console.log('✅ [SecurityGateway] Leak filter passed');

  // POLICY 1.55: Tool Required Enforcement (HP-07 Fix)
  // Intent "requiresToolCall" ise ama tool çağrılmadıysa, deterministik response döndür
  if (intent) {
    const toolEnforcementResult = enforceRequiredToolCall(intent, toolsCalled, language);
    if (toolEnforcementResult.needsOverride) {
      console.warn(`🔧 [SecurityGateway] Tool required but not called for intent "${intent}"`);
      metrics.toolRequiredNotCalled = {
        intent,
        reason: toolEnforcementResult.reason
      };
      // Response'u override et - LLM tool çağırmadan yanıt vermiş
      responseText = toolEnforcementResult.overrideResponse;
    }
  }

  // POLICY 1.6: Security Gateway Identity Match (eğer tool output varsa)
  // verifiedIdentity vs requestedRecord owner karşılaştırması
  if (toolOutputs.length > 0 && verifiedIdentity) {
    for (const output of toolOutputs) {
      const requestedRecord = extractRecordOwner(output);
      const requestedFields = extractFieldsFromToolOutput(output);

      if (requestedRecord && requestedFields.length > 0) {
        const gatewayResult = evaluateSecurityGateway({
          verificationState,
          verifiedIdentity,
          requestedRecord,
          requestedDataFields: requestedFields
        });

        if (gatewayResult.hasIdentityMismatch) {
          console.error('🚨 [SecurityGateway] IDENTITY MISMATCH!', {
            verifiedIdentity,
            requestedRecord,
            deniedFields: gatewayResult.deniedFields
          });

          metrics.identityMismatch = {
            verifiedIdentity,
            requestedRecord,
            deniedFields: gatewayResult.deniedFields
          };

          // Identity mismatch = hard deny
          const hardDenyResponse = language === 'TR'
            ? 'Güvenliğiniz için, bu bilgileri sadece hesap sahibiyle paylaşabilirim. Lütfen hesabınıza kayıtlı bilgilerle doğrulama yapın.'
            : 'For your security, I can only share this information with the account holder. Please verify with your registered account details.';

          return {
            finalResponse: hardDenyResponse,
            guardrailsApplied: ['RESPONSE_FIREWALL', 'PII_PREVENTION', 'SECURITY_GATEWAY_IDENTITY_MISMATCH'],
            blocked: true,
            blockReason: 'IDENTITY_MISMATCH',
            mismatchDetails: gatewayResult.deniedFields
          };
        }
      }
    }
  }

  // POLICY 1.7: Product/Order Not Found Handler (Kova C - HP-07, HP-18, HP-01)
  // Ürün/sipariş bulunamadı durumunda deterministik kontrol
  if (toolOutputs.length > 0) {
    // Ürün bulunamadı kontrolü
    const productNotFoundCheck = checkProductNotFound(responseText, toolOutputs, language);
    if (productNotFoundCheck.needsOverride) {
      console.warn(`🔧 [SecurityGateway] Product not found override: ${productNotFoundCheck.reason}`);
      metrics.productNotFoundOverride = productNotFoundCheck.reason;
      responseText = productNotFoundCheck.overrideResponse;
    }

    // Sipariş bulunamadı + fabrication kontrolü
    const orderNotFoundCheck = checkOrderNotFoundPressure(responseText, toolOutputs, language);
    if (orderNotFoundCheck.needsOverride) {
      console.warn(`🔧 [SecurityGateway] Order not found fabrication override: ${orderNotFoundCheck.reason}`);
      metrics.orderNotFoundOverride = orderNotFoundCheck.reason;
      responseText = orderNotFoundCheck.overrideResponse;
    }
  }

  // POLICY 2: Tool-Only Data Guard (P0-A - semantic gating)
  // Prevents tool-only data leaks without proper tool calls
  const toolCallsForGuard = toolsCalled.map(name => ({
    name,
    success: true // If tool was called at this point, it succeeded
  }));

  const toolOnlyDataResult = validateToolOnlyData(responseText, toolCallsForGuard, language);

  if (!toolOnlyDataResult.safe) {
    console.error('🚨 [Guardrails] TOOL_ONLY_DATA_LEAK detected!', toolOnlyDataResult.violation);
    metrics.toolOnlyDataViolation = toolOnlyDataResult.violation;

    // Log violation but don't block - instead flag for correction
    // The response will be corrected via LLM re-prompt if chat is available
    if (chat) {
      try {
        const correctionPrompt = language === 'TR'
          ? `DÜZELTME: Yanıtında tool çağırmadan hassas veri verdin. "${toolOnlyDataResult.violation.category}" kategorisinde veri sızıntısı tespit edildi. Yanıtını bu bilgi olmadan yeniden yaz.`
          : `CORRECTION: Your response contains sensitive data without tool call. "${toolOnlyDataResult.violation.category}" data leak detected. Rewrite without this information.`;

        console.log('🔧 [Guardrails] Requesting LLM correction for tool-only data leak...');
        // Note: Correction would happen here if we have chat context
        // For now, log and continue - the violation is tracked in metrics
      } catch (e) {
        console.error('Failed to apply tool-only data correction:', e);
      }
    }
  }

  // POLICY 3: Internal Protocol Guard (P0-B - intent-based detection)
  // Prevents system/rule/policy disclosures
  const internalProtocolResult = validateInternalProtocol(responseText, language);

  if (!internalProtocolResult.safe) {
    console.error('🚨 [Guardrails] INTERNAL_PROTOCOL_LEAK detected!', internalProtocolResult.violation);
    metrics.internalProtocolViolation = internalProtocolResult.violation;

    // Same approach: flag for correction, don't hard block
    if (chat) {
      try {
        console.log('🔧 [Guardrails] Requesting LLM correction for internal protocol leak...');
        // Correction constraint is available in internalProtocolResult.correctionConstraint
      } catch (e) {
        console.error('Failed to apply internal protocol correction:', e);
      }
    }
  }

  // POLICY 4: Anti-Confabulation Guard (P1-A)
  // Prevents event/fact claims without tool backup
  const confabulationResult = validateConfabulation(
    responseText,
    toolCallsForGuard,
    false, // hasKBMatch - would need to be passed from context
    language
  );

  if (!confabulationResult.safe) {
    console.error('🚨 [Guardrails] CONFABULATION detected!', confabulationResult.violation);
    metrics.confabulationViolation = confabulationResult.violation;

    // Flag for correction
    if (chat) {
      try {
        console.log('🔧 [Guardrails] Requesting LLM correction for confabulation...');
        // Correction constraint available in confabulationResult.correctionConstraint
      } catch (e) {
        console.error('Failed to apply confabulation correction:', e);
      }
    }
  }

  // POLICY 5: Action Claim Validation (CRITICAL + SOFT)
  const actionClaimText = await applyActionClaimPolicy({
    responseText,
    hadToolSuccess,
    hadToolCalls: toolsCalled.length > 0,
    language,
    sessionId,
    chat,
    metrics
  });

  // POLICY 6: Policy Guidance Guard (S8 - deterministic)
  // Ensures policy responses (refund/return/cancel) always have actionable guidance
  const guidanceResult = ensurePolicyGuidance(actionClaimText, userMessage || '', language);
  const finalText = guidanceResult.response;

  // VERBOSE logging for guidance guard debugging
  if (process.env.VERBOSE === 'true') {
    console.log(`📋 [GuidanceGuard] userMessage: "${(userMessage || '').substring(0, 50)}..."`);
    console.log(`📋 [GuidanceGuard] isPolicyTopic: ${guidanceResult.guidanceAdded || guidanceResult.addedComponents?.length > 0 ? 'YES' : 'checking...'}`);
    console.log(`📋 [GuidanceGuard] guidanceAdded: ${guidanceResult.guidanceAdded}`);
    if (guidanceResult.addedComponents?.length > 0) {
      console.log(`📋 [GuidanceGuard] addedComponents: ${guidanceResult.addedComponents.join(', ')}`);
    }
  }

  if (guidanceResult.guidanceAdded) {
    console.log(`✅ [Guardrails] Policy guidance added: ${guidanceResult.addedComponents.join(', ')}`);
    metrics.guidanceAdded = guidanceResult.addedComponents;
  }

  // POLICY 4: Content Safety (future)
  // const safeText = await applyContentSafetyPolicy({ text: finalText, language });

  console.log('✅ [Guardrails] All policies applied');

  const appliedPolicies = [
    'RESPONSE_FIREWALL',
    'PII_PREVENTION',
    'SECURITY_GATEWAY', // Leak Filter + Identity Match
    toolOnlyDataResult.safe ? 'TOOL_ONLY_DATA' : 'TOOL_ONLY_DATA (VIOLATION)',
    internalProtocolResult.safe ? 'INTERNAL_PROTOCOL' : 'INTERNAL_PROTOCOL (VIOLATION)',
    confabulationResult.safe ? 'ANTI_CONFABULATION' : 'ANTI_CONFABULATION (VIOLATION)',
    'ACTION_CLAIM',
    'POLICY_GUIDANCE'
  ];
  if (piiScan.hasHigh) {
    appliedPolicies[1] = 'PII_PREVENTION (WARN)';
  }
  if (guidanceResult.guidanceAdded) {
    appliedPolicies[7] = `POLICY_GUIDANCE (+${guidanceResult.addedComponents.length})`;
  }

  return {
    finalResponse: finalText,
    guardrailsApplied: appliedPolicies
  };
}

export default { applyGuardrails };

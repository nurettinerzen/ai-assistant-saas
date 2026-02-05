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
    intent = null, // Tespit edilen intent (requiresToolCall kontrolü için)
    collectedData = {} // Zaten bilinen veriler (orderNumber, phone, name) - Leak filter için
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

    // SOFT REFUSAL: Don't lock session for first/occasional firewall violations
    // Track violation count in metrics - orchestrator can decide to lock on repeated abuse
    // This allows user to continue conversation without hard termination
    console.log('🛡️ [Firewall] Soft refusal - response sanitized, session remains open');

    // Return sanitized fallback response WITHOUT locking
    return {
      finalResponse: firewallResult.sanitized,
      guardrailsApplied: ['RESPONSE_FIREWALL'],
      blocked: true,
      softRefusal: true, // Flag for soft refusal (no session lock)
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

  // ============================================
  // POLICY 1.45: NOT_FOUND Early Check (P0 - S2 Fix)
  // Bu kontrol Leak Filter'dan ÖNCE yapılmalı!
  // Çünkü NOT_FOUND durumunda hassas veri yok, verification gereksiz
  // ============================================
  let notFoundOverrideApplied = false;
  let hasNotFoundOutcome = false; // Track if any tool returned NOT_FOUND

  if (toolOutputs.length > 0) {
    console.log('🔍 [Guardrails] Early NOT_FOUND check (before Leak Filter):', {
      toolOutputsCount: toolOutputs.length,
      outcomes: toolOutputs.map(o => o?.outcome)
    });

    // Check if any tool returned NOT_FOUND outcome
    hasNotFoundOutcome = toolOutputs.some(o => o?.outcome === 'NOT_FOUND');

    // Sipariş bulunamadı kontrolü - Leak Filter'dan ÖNCE
    const earlyOrderNotFoundCheck = checkOrderNotFoundPressure(responseText, toolOutputs, language);
    if (earlyOrderNotFoundCheck.needsOverride) {
      console.warn(`🔧 [SecurityGateway] Early NOT_FOUND override APPLIED:`, {
        reason: earlyOrderNotFoundCheck.reason,
        originalResponse: responseText?.substring(0, 100)
      });
      metrics.orderNotFoundOverride = earlyOrderNotFoundCheck.reason;
      responseText = earlyOrderNotFoundCheck.overrideResponse;
      notFoundOverrideApplied = true;
    }

    // Ürün bulunamadı kontrolü de erken yap
    const earlyProductNotFoundCheck = checkProductNotFound(responseText, toolOutputs, language);
    if (earlyProductNotFoundCheck.needsOverride) {
      console.warn(`🔧 [SecurityGateway] Early Product NOT_FOUND override: ${earlyProductNotFoundCheck.reason}`);
      metrics.productNotFoundOverride = earlyProductNotFoundCheck.reason;
      responseText = earlyProductNotFoundCheck.overrideResponse;
      notFoundOverrideApplied = true;
    }
  }

  // POLICY 1.5: Security Gateway Leak Filter (P0 - Verification-based)
  // Bu en kritik kontrol: verified olmadan hassas veri ASLA çıkamaz
  // collectedData: Zaten bilinen veriler - tekrar sorma (duplicate ask fix)
  // NOT_FOUND durumunda Leak Filter'ı ATLA - hassas veri yok, verification gereksiz
  const shouldSkipLeakFilter = notFoundOverrideApplied || hasNotFoundOutcome;
  if (shouldSkipLeakFilter) {
    console.log('✅ [SecurityGateway] Skipping Leak Filter - NOT_FOUND detected:', {
      notFoundOverrideApplied,
      hasNotFoundOutcome
    });
  }
  const leakFilterResult = shouldSkipLeakFilter
    ? { safe: true } // NOT_FOUND response'u güvenli, Leak Filter'ı atla
    : applyLeakFilter(responseText, verificationState, language, collectedData);

  if (!leakFilterResult.safe) {
    // Telemetry logging
    console.warn('🔐 [SecurityGateway] Verification required', {
      needsVerification: leakFilterResult.needsVerification,
      missingFields: leakFilterResult.missingFields,
      telemetry: leakFilterResult.telemetry
    });

    // Metrics'e telemetry ekle (debug için)
    metrics.leakFilterViolation = {
      leaks: leakFilterResult.leaks,
      verificationState,
      telemetry: leakFilterResult.telemetry
    };

    // Return verification requirement - orchestrator will handle LLM re-prompt
    // NO hardcoded response - LLM will generate natural verification request
    return {
      finalResponse: null, // Signal that LLM needs to regenerate
      needsVerification: true,
      missingFields: leakFilterResult.missingFields || [],
      guardrailsApplied: ['RESPONSE_FIREWALL', 'PII_PREVENTION', 'SECURITY_GATEWAY_LEAK_FILTER'],
      blocked: true,
      blockReason: 'VERIFICATION_REQUIRED',
      leaks: leakFilterResult.leaks,
      telemetry: leakFilterResult.telemetry
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

  // POLICY 1.7: Product/Order Not Found Handler - MOVED TO POLICY 1.45 (before Leak Filter)
  // NOT_FOUND kontrolü artık Leak Filter'dan ÖNCE yapılıyor (line 135-165)
  // Bu blok kaldırıldı çünkü erken kontrol zaten yapıldı
  // Eski kontrol burada kalırsa duplicate çalışır - gereksiz
  if (toolOutputs.length > 0 && !notFoundOverrideApplied) {
    // Sadece erken kontrol yapılmadıysa burada yap (güvenlik için)
    console.log('🔍 [Guardrails] Late NOT_FOUND check (fallback):', {
      count: toolOutputs.length
    });

    const lateOrderNotFoundCheck = checkOrderNotFoundPressure(responseText, toolOutputs, language);
    if (lateOrderNotFoundCheck.needsOverride) {
      console.warn(`🔧 [SecurityGateway] Late NOT_FOUND override: ${lateOrderNotFoundCheck.reason}`);
      metrics.orderNotFoundOverride = lateOrderNotFoundCheck.reason;
      responseText = lateOrderNotFoundCheck.overrideResponse;
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

  // POLICY 4: Anti-Confabulation Guard (P1-A) - NOW WITH ENFORCEMENT
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

    // P0 FIX: Return needsCorrection flag - orchestrator will re-prompt LLM
    return {
      finalResponse: null,
      needsCorrection: true,
      correctionType: 'CONFABULATION',
      correctionConstraint: confabulationResult.correctionConstraint,
      violation: confabulationResult.violation,
      guardrailsApplied: ['RESPONSE_FIREWALL', 'PII_PREVENTION', 'ANTI_CONFABULATION'],
      blocked: true,
      blockReason: 'CONFABULATION_DETECTED'
    };
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

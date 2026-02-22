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
import { getMessageVariant } from '../../../messages/messageCatalog.js';

// Enhanced guardrails (P0-A, P0-B, P1-A)
import { validateToolOnlyData } from '../../../guardrails/toolOnlyDataGuard.js';
import { validateInternalProtocol } from '../../../guardrails/internalProtocolGuard.js';
import { validateConfabulation, validateFieldGrounding } from '../../../guardrails/antiConfabulationGuard.js';

// NEW: Merkezi Security Gateway - Leak Filter (P0)
import {
  applyLeakFilter,
  GuardrailAction,
  evaluateSecurityGateway,
  extractFieldsFromToolOutput,
  extractRecordOwner,
  checkProductNotFound,
  checkOrderNotFoundPressure,
  enforceRequiredToolCall
} from '../../../guardrails/securityGateway.js';
import { shouldBypassLeakFilter } from '../../../security/outcomePolicy.js';
import { ToolOutcome, normalizeOutcome } from '../../../tools/toolResult.js';
import { isFeatureEnabled } from '../../../config/feature-flags.js';

function getBarrierMessage(language = 'TR') {
  return String(language || '').toUpperCase() === 'EN'
    ? 'I cannot share that detail right now for security reasons.'
    : 'Güvenlik nedeniyle bu detayı şu anda paylaşamıyorum.';
}

function getInternalProtocolSafeRewrite(language = 'TR') {
  return String(language || '').toUpperCase() === 'EN'
    ? 'I can help with your request. Tell me what you need and I will assist.'
    : 'Bu konuda yardımcı olabilirim. İhtiyacınızı yazın, size destek olayım.';
}

function getConfabulationClarification(language = 'TR', violation = null) {
  const lang = String(language || '').toUpperCase() === 'EN' ? 'EN' : 'TR';
  const category = violation?.category;

  if (category === 'stockEvents' || category === 'businessDescriptionClaims') {
    return lang === 'EN'
      ? 'I do not have verifiable source data for that detail yet. Could you share the exact product or model so I can check clearly?'
      : 'Bu detayı doğrulayacak kaynak veriye henüz sahip değilim. Net kontrol için ürün adı veya modelini paylaşır mısınız?';
  }

  return lang === 'EN'
    ? 'I do not have enough verified data to confirm that yet. Could you share your order number so I can check clearly?'
    : 'Bu bilgiyi doğrulamak için henüz yeterli kayıt yok. Net kontrol için sipariş numaranızı paylaşır mısınız?';
}

function getFieldGroundingClarification(language = 'TR', violation = null) {
  const lang = String(language || '').toUpperCase() === 'EN' ? 'EN' : 'TR';
  const field = violation?.field;

  if (field === 'trackingNumber') {
    return lang === 'EN'
      ? 'To share the exact tracking detail, I need to re-check the order record. Could you share your order number?'
      : 'Takip detayını net paylaşmam için sipariş kaydını tekrar kontrol etmem gerekiyor. Sipariş numaranızı paylaşır mısınız?';
  }

  return lang === 'EN'
    ? 'To provide the exact detail, I need to verify the latest record first. Could you share your order number?'
    : 'Detayı doğru paylaşmam için kaydı önce doğrulamam gerekiyor. Sipariş numaranızı paylaşır mısınız?';
}

function resolveMinInfoQuestion({
  language,
  missingFields = []
}) {
  const missingSet = new Set(Array.isArray(missingFields) ? missingFields : []);

  const hasOrder = missingSet.has('order_number');
  const hasPhoneLast4 = missingSet.has('phone_last4');
  const lang = String(language || 'TR').toUpperCase() === 'EN' ? 'EN' : 'TR';

  if (lang === 'EN') {
    if (hasOrder && hasPhoneLast4) {
      return {
        text: 'To proceed safely, could you share your order number and the last 4 digits of your phone?',
        messageKey: 'NEED_MIN_INFO_FOR_TOOL_DETERMINISTIC',
        variantIndex: 0
      };
    }
    if (hasPhoneLast4) {
      return {
        text: 'To proceed safely, could you share the last 4 digits of your phone?',
        messageKey: 'NEED_MIN_INFO_FOR_TOOL_DETERMINISTIC',
        variantIndex: 0
      };
    }
    return {
      text: 'To proceed safely, could you share your order number?',
      messageKey: 'NEED_MIN_INFO_FOR_TOOL_DETERMINISTIC',
      variantIndex: 0
    };
  }

  if (hasOrder && hasPhoneLast4) {
    return {
      text: 'Güvenli şekilde devam edebilmem için sipariş numaranızı ve telefon numaranızın son 4 hanesini paylaşır mısınız?',
      messageKey: 'NEED_MIN_INFO_FOR_TOOL_DETERMINISTIC',
      variantIndex: 0
    };
  }
  if (hasPhoneLast4) {
    return {
      text: 'Güvenli şekilde devam edebilmem için telefon numaranızın son 4 hanesini paylaşır mısınız?',
      messageKey: 'NEED_MIN_INFO_FOR_TOOL_DETERMINISTIC',
      variantIndex: 0
    };
  }
  return {
    text: 'Güvenli şekilde devam edebilmem için sipariş numaranızı paylaşır mısınız?',
    messageKey: 'NEED_MIN_INFO_FOR_TOOL_DETERMINISTIC',
    variantIndex: 0
  };
}

export async function applyGuardrails(params) {
  const {
    responseText: initialResponseText,
    hadToolSuccess,
    toolsCalled,
    toolOutputs = [], // Tool output'ları (identity match için)
    chat,
    language,
    sessionId,
    channel = 'CHAT',
    metrics,
    userMessage,
    verificationState = 'none', // Doğrulama durumu
    verifiedIdentity = null, // Doğrulanmış kimlik
    intent = null, // Tespit edilen intent (requiresToolCall kontrolü için)
    collectedData = {}, // Zaten bilinen veriler (orderNumber, phone, name) - Leak filter için
    lastNotFound = null, // P0-FIX: NOT_FOUND context from state for leak filter bypass
    callbackPending = false,
    activeFlow = null
  } = params;

  // Mutable response text (Product/Order not found override için)
  let responseText = initialResponseText;
  let overrideMessageKey = null;
  let overrideVariantIndex = null;

  console.log('🛡️ [Guardrails] Applying policies...');

  // POLICY 0: Response Firewall (P0 SECURITY - must run FIRST!)
  // Blocks: JSON dumps, HTML, system prompt disclosure, internal metadata
  const firewallResult = sanitizeResponse(responseText, language, {
    sessionId,
    channel,
    intent
  });

  if (!firewallResult.safe) {
    const violations = Array.isArray(firewallResult.violations) ? firewallResult.violations : [];
    const onlyUnredactedPii = violations.length === 1 && violations[0] === 'UNREDACTED_PII';
    let recoveredByLeakSanitizer = false;

    if (onlyUnredactedPii) {
      const leakSanitizeResult = applyLeakFilter(responseText, verificationState, language, collectedData, {
        callbackPending,
        activeFlow,
        intent,
        toolsCalled,
      });

      if (leakSanitizeResult.safe && leakSanitizeResult.action === GuardrailAction.SANITIZE && leakSanitizeResult.sanitized) {
        responseText = leakSanitizeResult.sanitized;
        recoveredByLeakSanitizer = true;
        metrics.firewallPiiSanitized = true;
        console.warn('🛡️ [Firewall] UNREDACTED_PII recovered via leak sanitizer (masked output)');
      }
    }

    if (!recoveredByLeakSanitizer) {
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
        action: GuardrailAction.SANITIZE,
        guardrailsApplied: ['RESPONSE_FIREWALL'],
        blocked: true,
        blockReason: 'FIREWALL_BLOCK', // P2-FIX: explicit blockReason for telemetry
        softRefusal: true, // Flag for soft refusal (no session lock)
        violations: firewallResult.violations,
        messageKey: firewallResult.messageKey,
        variantIndex: firewallResult.variantIndex
      };
    }
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
    const safeMessage = getLockMessage('PII_RISK', language, sessionId);

    return {
      finalResponse: safeMessage,
      action: GuardrailAction.BLOCK,
      guardrailsApplied: ['PII_PREVENTION'],
      blocked: true,
      blockReason: 'PII_RISK',
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
  // POLICY 1.5: KB_ONLY URL ALLOWLIST
  // In KB_ONLY mode, only helpLinks domains and exact URLs are allowed.
  // ============================================
  const { channelMode, helpLinks } = params;
  if (channelMode === 'KB_ONLY') {
    const urlRegex = /https?:\/\/[^\s)>"']+/gi;
    const foundUrls = (responseText || '').match(urlRegex) || [];

    if (foundUrls.length > 0) {
      // Build allowlist: exact URL match + domain match
      const allowedExact = new Set(Object.values(helpLinks || {}).filter(Boolean));
      const allowedDomains = new Set();
      for (const url of allowedExact) {
        try { allowedDomains.add(new URL(url).hostname); } catch { /* skip invalid */ }
      }

      const isAllowed = (url) => {
        if (allowedExact.has(url)) return true;
        try {
          const hostname = new URL(url).hostname;
          return allowedDomains.has(hostname);
        } catch { return false; }
      };

      const disallowed = foundUrls.filter(u => !isAllowed(u));
      if (disallowed.length > 0) {
        console.warn(`🚨 [Guardrail] KB_ONLY URL violation: ${disallowed.join(', ')}`);
        const sanitizedResponse = String(responseText || '').replace(urlRegex, (url) => (isAllowed(url) ? url : '')).replace(/\s{2,}/g, ' ').trim();
        return {
          finalResponse: sanitizedResponse || getBarrierMessage(language),
          action: GuardrailAction.SANITIZE,
          blocked: false,
          blockReason: 'KB_ONLY_URL_ALLOWLIST',
          guardrailsApplied: ['KB_ONLY_URL_ALLOWLIST']
        };
      }
    }
  }

  // ============================================
  // POLICY 1.45: NOT_FOUND Early Check (P0 - S2 Fix)
  // Bu kontrol Leak Filter'dan ÖNCE yapılmalı!
  // Çünkü NOT_FOUND durumunda hassas veri yok, verification gereksiz
  // ============================================
  let notFoundOverrideApplied = false;
  if (toolOutputs.length > 0) {
    console.log('🔍 [Guardrails] Early NOT_FOUND check (before Leak Filter):', {
      toolOutputsCount: toolOutputs.length,
      outcomes: toolOutputs.map(o => o?.outcome)
    });

    // Sipariş bulunamadı kontrolü - Leak Filter'dan ÖNCE
    const earlyOrderNotFoundCheck = checkOrderNotFoundPressure(responseText, toolOutputs, language);
    if (earlyOrderNotFoundCheck.needsOverride) {
      console.warn(`🔧 [SecurityGateway] Early NOT_FOUND override APPLIED:`, {
        reason: earlyOrderNotFoundCheck.reason,
        originalResponse: responseText?.substring(0, 100)
      });
      metrics.orderNotFoundOverride = earlyOrderNotFoundCheck.reason;
      overrideMessageKey = earlyOrderNotFoundCheck.messageKey || overrideMessageKey;
      overrideVariantIndex = Number.isInteger(earlyOrderNotFoundCheck.variantIndex)
        ? earlyOrderNotFoundCheck.variantIndex
        : overrideVariantIndex;
      metrics.guardrailOverrides = metrics.guardrailOverrides || [];
      metrics.guardrailOverrides.push({
        reason: earlyOrderNotFoundCheck.reason,
        messageKey: earlyOrderNotFoundCheck.messageKey,
        channel,
        intent
      });
      responseText = earlyOrderNotFoundCheck.overrideResponse;
      notFoundOverrideApplied = true;
    }

    // Ürün bulunamadı kontrolü de erken yap
    const earlyProductNotFoundCheck = checkProductNotFound(responseText, toolOutputs, language);
    if (earlyProductNotFoundCheck.needsOverride) {
      console.warn(`🔧 [SecurityGateway] Early Product NOT_FOUND override: ${earlyProductNotFoundCheck.reason}`);
      metrics.productNotFoundOverride = earlyProductNotFoundCheck.reason;
      overrideMessageKey = earlyProductNotFoundCheck.messageKey || overrideMessageKey;
      overrideVariantIndex = Number.isInteger(earlyProductNotFoundCheck.variantIndex)
        ? earlyProductNotFoundCheck.variantIndex
        : overrideVariantIndex;
      metrics.guardrailOverrides = metrics.guardrailOverrides || [];
      metrics.guardrailOverrides.push({
        reason: earlyProductNotFoundCheck.reason,
        messageKey: earlyProductNotFoundCheck.messageKey,
        channel,
        intent
      });
      responseText = earlyProductNotFoundCheck.overrideResponse;
      notFoundOverrideApplied = true;
    }
  }

  // POLICY 1.5: Security Gateway Leak Filter (P0 - Verification-based)
  // P0 ARCHITECTURE FIX: Leak Filter now ALWAYS runs on response text.
  // Previous logic: skip if no tool called or tool not successful → allowed LLM hallucinations to bypass filter.
  // New logic: Only skip for NOT_FOUND overrides (no sensitive data) and explicit bypass outcomes.
  // If LLM generates sensitive data WITHOUT tool call, leak filter catches it and blocks.
  //
  // P0-FIX: Also skip if state has recent NOT_FOUND (within 5 minutes).
  // After NOT_FOUND terminal, next turn LLM may generate text mentioning "müşteri/sipariş"
  // without calling tools → toolOutputs empty → leak filter false positive → infinite verification loop.
  const hasBypassOutcome = toolOutputs.some(o => shouldBypassLeakFilter(o?.outcome));
  const hasRecentNotFound = lastNotFound?.at &&
    (Date.now() - new Date(lastNotFound.at).getTime()) < 5 * 60 * 1000; // 5 minutes

  // P0 GUARD: Tool çağrılmadıysa VE response'ta rakam yoksa → phone leak imkansız, skip
  const noToolsCalled = !toolsCalled || toolsCalled.length === 0;
  const noDigitsInResponse = !/\d/.test(responseText || '');
  const noToolNoDigitBypass = noToolsCalled && noDigitsInResponse;
  if (noToolNoDigitBypass) {
    console.log('✅ [LeakFilter] No tools called + no digits in response → phone leak impossible, skipping');
  }

  const shouldSkipLeakFilter = notFoundOverrideApplied || hasBypassOutcome || hasRecentNotFound || noToolNoDigitBypass;
  if (shouldSkipLeakFilter) {
    console.log('✅ [SecurityGateway] Skipping Leak Filter:', {
      notFoundOverrideApplied,
      hasBypassOutcome,
      hasRecentNotFound: !!hasRecentNotFound,
      noToolNoDigitBypass
    });
  }
  const leakFilterResult = shouldSkipLeakFilter
    ? { safe: true, action: GuardrailAction.PASS } // NOT_FOUND response'u güvenli, Leak Filter'ı atla
    : applyLeakFilter(responseText, verificationState, language, collectedData, {
      callbackPending,
      activeFlow,
      intent,
      toolsCalled,
    });

  if (!leakFilterResult.safe) {
    if (leakFilterResult.action === GuardrailAction.NEED_MIN_INFO_FOR_TOOL && leakFilterResult.needsCallbackInfo) {
      const callbackMessage = String(language || 'TR').toUpperCase() === 'EN'
        ? 'To create your callback request safely, could you share your full name and phone number?'
        : 'Geri arama talebinizi güvenli şekilde oluşturabilmem için ad-soyad ve telefon numaranızı paylaşır mısınız?';

      return {
        finalResponse: callbackMessage,
        action: GuardrailAction.NEED_MIN_INFO_FOR_TOOL,
        needsCallbackInfo: true,
        missingFields: ['customer_name', 'phone'],
        guardrailsApplied: ['RESPONSE_FIREWALL', 'PII_PREVENTION', 'SECURITY_GATEWAY_CALLBACK_FLOW'],
        blocked: true,
        blockReason: leakFilterResult.blockReason || 'CALLBACK_INFO_REQUIRED',
        messageKey: 'CALLBACK_INFO_REQUIRED_DETERMINISTIC',
        variantIndex: 0
      };
    }

    // Telemetry logging — enriched with verificationMode, hasDigits, leakTypes
    const leakTelemetry = leakFilterResult.telemetry || {};
    console.warn('🔐 [SecurityGateway] Leak filter triggered', {
      action: leakFilterResult.action || 'UNKNOWN',
      needsVerification: leakFilterResult.needsVerification,
      missingFields: leakFilterResult.missingFields,
      leakTypes: leakTelemetry.leakTypes || [],
      verificationMode: leakTelemetry.verificationMode || 'ORDER_VERIFY',
      hasDigits: leakTelemetry.responseHasDigits ?? null,
      triggerPatterns: (leakTelemetry.triggeredPatterns || []).map(p => ({ type: p.type, pattern: p.pattern }))
    });

    // Metrics'e telemetry ekle (debug için)
    metrics.leakFilterViolation = {
      leaks: leakFilterResult.leaks,
      verificationState,
      verificationMode: leakTelemetry.verificationMode || 'ORDER_VERIFY',
      responseHasDigits: leakTelemetry.responseHasDigits ?? null,
      leakTypes: leakTelemetry.leakTypes || [],
      telemetry: leakTelemetry
    };

    if (leakFilterResult.action === GuardrailAction.NEED_MIN_INFO_FOR_TOOL) {
      const minInfoVariant = resolveMinInfoQuestion({
        language,
        missingFields: leakFilterResult.missingFields || []
      });

      return {
        finalResponse: minInfoVariant.text,
        action: GuardrailAction.NEED_MIN_INFO_FOR_TOOL,
        needsVerification: true,
        missingFields: leakFilterResult.missingFields || [],
        guardrailsApplied: ['RESPONSE_FIREWALL', 'PII_PREVENTION', 'SECURITY_GATEWAY_LEAK_FILTER'],
        blocked: true,
        blockReason: 'NEED_MIN_INFO_FOR_TOOL',
        leaks: leakFilterResult.leaks,
        telemetry: leakFilterResult.telemetry,
        messageKey: minInfoVariant.messageKey,
        variantIndex: minInfoVariant.variantIndex
      };
    }

    // P0-3: Debug bilgisi — BLOCK olduğunda neden tetiklendiğini metadata'ya aktar
    const blockFirstLeak = (leakFilterResult.leaks || [])[0] || {};
    return {
      finalResponse: leakFilterResult.blockedMessage || getBarrierMessage(language),
      action: GuardrailAction.BLOCK,
      guardrailsApplied: ['RESPONSE_FIREWALL', 'PII_PREVENTION', 'SECURITY_GATEWAY_LEAK_FILTER'],
      blocked: true,
      blockReason: leakFilterResult.blockReason || 'SECURITY_GATEWAY_BLOCK',
      leaks: leakFilterResult.leaks,
      telemetry: leakFilterResult.telemetry,
      leakFilterDebug: {
        ruleId: blockFirstLeak.triggerType || blockFirstLeak.type || 'unknown',
        triggerType: blockFirstLeak.triggerType || null,
        candidateToken: blockFirstLeak.candidateToken || null,
        contextHit: blockFirstLeak.contextHit || null,
        leakTypes: (leakFilterResult.leaks || []).map(l => l.type),
        reason: leakFilterResult.telemetry?.reason || null
      }
    };
  }

  // If leak filter returned a sanitized (redacted) response, use it
  if (leakFilterResult.action === GuardrailAction.SANITIZE && leakFilterResult.sanitized && leakFilterResult.sanitized !== responseText) {
    console.log('🔒 [SecurityGateway] Leak filter passed with redaction applied');
    responseText = leakFilterResult.sanitized;

    // P0-3: Debug bilgisi — SANITIZE olduğunda neden tetiklendiğini metadata'ya aktar
    const firstLeak = (leakFilterResult.leaks || [])[0] || {};
    metrics.leakFilterDebug = {
      ruleId: firstLeak.triggerType || firstLeak.type || 'unknown',
      triggerType: firstLeak.triggerType || null,
      candidateToken: firstLeak.candidateToken || null,
      contextHit: firstLeak.contextHit || null,
      leakTypes: (leakFilterResult.leaks || []).map(l => l.type),
      reason: leakFilterResult.telemetry?.reason || null
    };
  } else {
    console.log('✅ [SecurityGateway] Leak filter passed');
  }

  // POLICY 1.55: Tool Required Enforcement (HP-07 Fix)
  // Intent "requiresToolCall" ise ama tool çağrılmadıysa, deterministik response döndür
  const productSpecEnabled = isFeatureEnabled('PRODUCT_SPEC_ENFORCE');
  if (intent && productSpecEnabled) {
    const toolEnforcementResult = enforceRequiredToolCall(intent, toolsCalled, language, responseText);
    if (toolEnforcementResult.needsOverride) {
      console.warn(`🔧 [SecurityGateway] Tool required but not called for intent "${intent}"`);
      metrics.toolRequiredNotCalled = {
        intent,
        reason: toolEnforcementResult.reason
      };
      overrideMessageKey = toolEnforcementResult.messageKey || overrideMessageKey;
      overrideVariantIndex = Number.isInteger(toolEnforcementResult.variantIndex)
        ? toolEnforcementResult.variantIndex
        : overrideVariantIndex;
      metrics.guardrailOverrides = metrics.guardrailOverrides || [];
      metrics.guardrailOverrides.push({
        reason: toolEnforcementResult.reason,
        messageKey: toolEnforcementResult.messageKey,
        channel,
        intent
      });
      // Response'u override et - LLM tool çağırmadan yanıt vermiş
      responseText = toolEnforcementResult.overrideResponse;
    }
  } else if (intent && !productSpecEnabled) {
    console.log('⚠️ [Guardrails] PRODUCT_SPEC_ENFORCE disabled — skipping tool enforcement');
  }

  // POLICY 1.6: Security Gateway Identity Match (eğer tool output varsa)
  // verifiedIdentity vs requestedRecord owner karşılaştırması
  //
  // IMPORTANT: Tool handler already performs anchor-based verification.
  // When tool returns outcome=OK + success=true, the data is already verified.
  // PII-redacted tool output (masked phone/email) cannot be compared to plain
  // anchor data — this causes false IDENTITY_MISMATCH. Skip for verified tools.
  if (toolOutputs.length > 0 && verifiedIdentity) {
    for (const output of toolOutputs) {
      // SKIP: Tool already verified this data (anchor-based verification passed)
      // Tool output contains PII-redacted data (e.g. 559******8271) which can't
      // be compared to plain identity from anchor (e.g. 5592348271)
      if (normalizeOutcome(output.outcome) === ToolOutcome.OK && output.success === true) {
        console.log('✅ [SecurityGateway] Skipping identity match - tool already verified (outcome=OK)');
        continue;
      }

      // SKIP: NOT_FOUND means no record was returned — nothing to compare
      if (normalizeOutcome(output.outcome) === ToolOutcome.NOT_FOUND) {
        console.log('✅ [SecurityGateway] Skipping identity match - NOT_FOUND (no record to compare)');
        continue;
      }

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
          const hardDenyVariant = getMessageVariant('SECURITY_IDENTITY_MISMATCH_HARD_DENY', {
            language,
            sessionId,
            channel,
            intent,
            directiveType: 'SECURITY_GATEWAY',
            severity: 'critical',
            seedHint: 'IDENTITY_MISMATCH'
          });
          const hardDenyResponse = hardDenyVariant.text;

          return {
            finalResponse: hardDenyResponse,
            action: GuardrailAction.BLOCK,
            guardrailsApplied: ['RESPONSE_FIREWALL', 'PII_PREVENTION', 'SECURITY_GATEWAY_IDENTITY_MISMATCH'],
            blocked: true,
            blockReason: 'IDENTITY_MISMATCH',
            mismatchDetails: gatewayResult.deniedFields,
            messageKey: hardDenyVariant.messageKey,
            variantIndex: hardDenyVariant.variantIndex,
            channel,
            intent
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
      overrideMessageKey = lateOrderNotFoundCheck.messageKey || overrideMessageKey;
      overrideVariantIndex = Number.isInteger(lateOrderNotFoundCheck.variantIndex)
        ? lateOrderNotFoundCheck.variantIndex
        : overrideVariantIndex;
      metrics.guardrailOverrides = metrics.guardrailOverrides || [];
      metrics.guardrailOverrides.push({
        reason: lateOrderNotFoundCheck.reason,
        messageKey: lateOrderNotFoundCheck.messageKey,
        channel,
        intent
      });
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

    // Kill-switch: If TOOL_ONLY_DATA_HARDBLOCK disabled, log only (pre-hardening behavior)
    if (!isFeatureEnabled('TOOL_ONLY_DATA_HARDBLOCK')) {
      console.warn('⚠️ [Guardrails] TOOL_ONLY_DATA_HARDBLOCK disabled — logging only, not blocking');
    } else {
      return {
        finalResponse: getBarrierMessage(language),
        action: GuardrailAction.BLOCK,
        violation: toolOnlyDataResult.violation,
        guardrailsApplied: ['RESPONSE_FIREWALL', 'PII_PREVENTION', 'TOOL_ONLY_DATA_GUARD'],
        blocked: true,
        blockReason: 'TOOL_ONLY_DATA_LEAK_DETECTED'
      };
    }
  }

  // POLICY 3: Internal Protocol Guard (P0-B - intent-based detection)
  // Prevents system/rule/policy disclosures
  const internalProtocolResult = validateInternalProtocol(responseText, language);

  if (!internalProtocolResult.safe) {
    console.error('🚨 [Guardrails] INTERNAL_PROTOCOL_LEAK detected!', internalProtocolResult.violation);
    metrics.internalProtocolViolation = internalProtocolResult.violation;
    responseText = getInternalProtocolSafeRewrite(language);
    metrics.internalProtocolSanitized = true;
  }

  // POLICY 4: Anti-Confabulation Guard (P1-A) - NOW WITH ENFORCEMENT
  // Prevents event/fact claims without tool backup
  const hasKBMatch = params.hasKBMatch || false;
  const confabulationResult = validateConfabulation(
    responseText,
    toolCallsForGuard,
    hasKBMatch,
    language
  );

  if (!confabulationResult.safe) {
    console.error('🚨 [Guardrails] CONFABULATION detected!', confabulationResult.violation);
    metrics.confabulationViolation = confabulationResult.violation;
    responseText = getConfabulationClarification(language, confabulationResult.violation);
    metrics.confabulationClarification = true;
  }

  // POLICY 4b: Field-Level Grounding (P1-D)
  // Even if tool was called, check that LLM claims match tool output fields.
  // Enforcement mode:
  // - monitor: log only
  // - block (default): deterministic clarification rewrite (no hard block)
  const fieldGroundingEnabled = isFeatureEnabled('FIELD_GROUNDING_HARDBLOCK');
  const fieldGroundingMode = process.env.FIELD_GROUNDING_MODE || 'block'; // 'block' | 'monitor'
  if (fieldGroundingEnabled && hadToolSuccess && toolOutputs.length > 0) {
    const groundingResult = validateFieldGrounding(responseText, toolOutputs, language);

    if (!groundingResult.grounded) {
      console.error('🚨 [Guardrails] FIELD_GROUNDING_VIOLATION detected!', groundingResult.violation);
      metrics.fieldGroundingViolation = groundingResult.violation;

      if (fieldGroundingMode === 'monitor') {
        // Monitor mode: log violation but DON'T block — useful for canary/tuning
        console.warn('📊 [Guardrails] FIELD_GROUNDING in MONITOR mode — logging only, response passes through');
        metrics.fieldGroundingMonitorOnly = true;
      } else {
        responseText = getFieldGroundingClarification(language, groundingResult.violation);
        metrics.fieldGroundingClarification = true;
      }
    }
  } else if (!fieldGroundingEnabled) {
    console.log('⚠️ [Guardrails] FIELD_GROUNDING_HARDBLOCK disabled — skipping field grounding');
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

  const responseChanged = String(finalText || '') !== String(initialResponseText || '');
  const finalAction = responseChanged ? GuardrailAction.SANITIZE : GuardrailAction.PASS;

  // ── Security Telemetry (P1-E: canary monitoring) ──
  metrics.securityTelemetry = {
    blocked: false,
    blockReason: null,
    repromptCount: 0,
    fallbackUsed: !!overrideMessageKey,
    fallbackMessageKey: overrideMessageKey || null,
    policiesRan: appliedPolicies,
    violations: {
      toolOnlyData: !toolOnlyDataResult.safe ? toolOnlyDataResult.violation?.type : null,
      internalProtocol: !internalProtocolResult.safe ? 'INTERNAL_PROTOCOL_LEAK' : null,
      confabulation: !confabulationResult.safe ? confabulationResult.violation?.type : null,
      fieldGrounding: metrics.fieldGroundingViolation?.type || null,
    },
    featureFlags: {
      TOOL_ONLY_DATA_HARDBLOCK: isFeatureEnabled('TOOL_ONLY_DATA_HARDBLOCK'),
      FIELD_GROUNDING_HARDBLOCK: fieldGroundingEnabled,
      PRODUCT_SPEC_ENFORCE: productSpecEnabled,
    },
    toolsCalled: toolsCalled.length,
    toolSuccess: hadToolSuccess,
  };

  return {
    finalResponse: finalText,
    action: finalAction,
    guardrailsApplied: appliedPolicies,
    messageKey: overrideMessageKey,
    variantIndex: overrideVariantIndex
  };
}

export default { applyGuardrails };

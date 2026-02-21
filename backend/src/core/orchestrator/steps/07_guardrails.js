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
      blockReason: 'FIREWALL_BLOCK', // P2-FIX: explicit blockReason for telemetry
      softRefusal: true, // Flag for soft refusal (no session lock)
      violations: firewallResult.violations,
      messageKey: firewallResult.messageKey,
      variantIndex: firewallResult.variantIndex
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
    const safeMessage = getLockMessage('PII_RISK', language, sessionId);

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
        return {
          finalResponse: null,
          needsCorrection: true,
          correctionType: 'KB_ONLY_URL_VIOLATION',
          correctionConstraint: language === 'EN'
            ? `REMOVE all URLs from your response. Only these domains are allowed: ${Array.from(allowedDomains).join(', ') || 'none'}. Do not invent links.`
            : `Yanıtından TÜM URL'leri kaldır. Sadece şu domainler izinli: ${Array.from(allowedDomains).join(', ') || 'yok'}. Link uydurma.`,
          blocked: true,
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
    ? { safe: true } // NOT_FOUND response'u güvenli, Leak Filter'ı atla
    : applyLeakFilter(responseText, verificationState, language, collectedData, {
      callbackPending,
      activeFlow,
      intent
    });

  if (!leakFilterResult.safe) {
    if (leakFilterResult.needsCallbackInfo) {
      const callbackVariant = getMessageVariant('CALLBACK_INFO_REQUIRED', {
        language,
        sessionId,
        channel,
        intent,
        directiveType: 'ASK_CALLBACK_INFO',
        severity: 'info',
        seedHint: 'callback_info_required',
        variables: {
          fields: language === 'TR'
            ? 'ad-soyad ve telefon numaranızı'
            : 'full name and phone number'
        }
      });

      return {
        finalResponse: callbackVariant.text,
        needsCallbackInfo: true,
        missingFields: ['customer_name', 'phone'],
        guardrailsApplied: ['RESPONSE_FIREWALL', 'PII_PREVENTION', 'SECURITY_GATEWAY_CALLBACK_FLOW'],
        blocked: true,
        blockReason: 'CALLBACK_INFO_REQUIRED',
        messageKey: callbackVariant.messageKey,
        variantIndex: callbackVariant.variantIndex
      };
    }

    // Telemetry logging — enriched with verificationMode, hasDigits, leakTypes
    const leakTelemetry = leakFilterResult.telemetry || {};
    console.warn('🔐 [SecurityGateway] Verification required', {
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

  // If leak filter returned a sanitized (redacted) response, use it
  if (leakFilterResult.sanitized && leakFilterResult.sanitized !== responseText) {
    console.log('🔒 [SecurityGateway] Leak filter passed with redaction applied');
    responseText = leakFilterResult.sanitized;
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
      // P0-B FIX: Hard block — tool-only data without tool call is a data leak
      const correctionConstraint = language === 'TR'
        ? `Yanıtında tool çağırmadan "${toolOnlyDataResult.violation.category}" kategorisinde hassas veri verdin. Bu bilgiyi KESINLIKLE verme. Sistemi sorgulamadan "kargoda", "teslim edildi", "adresiniz" gibi bilgiler paylaşma. Bilmediğini kabul et.`
        : `Your response contains "${toolOnlyDataResult.violation.category}" data without a tool call. Do NOT share this information. Never claim delivery status, address, or PII without querying the system. Admit you don't have the information.`;

      return {
        finalResponse: null,
        needsCorrection: true,
        correctionType: 'TOOL_ONLY_DATA_LEAK',
        correctionConstraint,
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

    console.log('🔧 [Guardrails] Requesting LLM correction for internal protocol leak...');
    return {
      finalResponse: null,
      needsCorrection: true,
      correctionType: 'INTERNAL_PROTOCOL_LEAK',
      correctionConstraint: internalProtocolResult.correctionConstraint,
      violation: internalProtocolResult.violation,
      guardrailsApplied: ['RESPONSE_FIREWALL', 'PII_PREVENTION', 'INTERNAL_PROTOCOL_GUARD'],
      blocked: true,
      blockReason: 'INTERNAL_PROTOCOL_LEAK',
      repromptCount: 1
    };
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

  // POLICY 4b: Field-Level Grounding (P1-D)
  // Even if tool was called, check that LLM claims match tool output fields
  // Mode: FEATURE_FIELD_GROUNDING_HARDBLOCK=true → block | false → skip
  // FIELD_GROUNDING_MODE env: 'block' (default) or 'monitor' (log only, don't block)
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
        // Block mode: hard block and re-prompt LLM
        const groundingConstraint = language === 'TR'
          ? `Yanıtında tool sonucuyla uyuşmayan bilgi verdin. Alan: "${groundingResult.violation.field}", tool sonucu: "${groundingResult.violation.expected || 'yok'}", sen iddia ettin: "${groundingResult.violation.claimed}". Yanıtını SADECE tool sonucundaki bilgilere dayandırarak yeniden yaz.`
          : `Your response contains information inconsistent with tool output. Field: "${groundingResult.violation.field}", tool result: "${groundingResult.violation.expected || 'none'}", you claimed: "${groundingResult.violation.claimed}". Rewrite based ONLY on tool output data.`;

        return {
          finalResponse: null,
          needsCorrection: true,
          correctionType: 'FIELD_GROUNDING',
          correctionConstraint: groundingConstraint,
          violation: groundingResult.violation,
          guardrailsApplied: ['RESPONSE_FIREWALL', 'PII_PREVENTION', 'FIELD_GROUNDING'],
          blocked: true,
          blockReason: 'FIELD_GROUNDING_VIOLATION'
        };
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

  // ── Security Telemetry (P1-E: canary monitoring) ──
  metrics.securityTelemetry = {
    blocked: false,
    blockReason: null,
    repromptCount: 0, // Set by orchestrator when regenerateWithGuidance is called
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
    guardrailsApplied: appliedPolicies,
    messageKey: overrideMessageKey,
    variantIndex: overrideVariantIndex
  };
}

export default { applyGuardrails };

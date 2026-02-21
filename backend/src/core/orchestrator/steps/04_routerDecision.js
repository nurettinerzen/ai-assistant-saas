/**
 * Step 4: Router Decision
 *
 * ARCHITECTURE CHANGE (LLM Authority Refactor):
 * - Backend NO LONGER classifies user input (no regex, no looksLikeSlotInput)
 * - Backend NO LONGER returns directResponse templates
 * - Backend NO LONGER uses forceToolCall
 * - LLM handles: intent detection, entity extraction, natural conversation
 * - Backend handles: state tracking, security, tool gating
 *
 * Determines action based on classification:
 * - RUN_INTENT_ROUTER: New intent → LLM handles with tools
 * - HANDLE_DISPUTE: User disputes result → LLM handles with context
 * - ACKNOWLEDGE_CHATTER: Emotional/greeting → LLM responds naturally
 * - PROCESS_SLOT: (SIMPLIFIED) Only format validation, not input classification
 */

import { routeMessage } from '../../../services/message-router.js';
import { buildChatterDirective, isPureChatter } from '../../../services/chatter-response.js';
import { hasAccountHint, classifyRedirectCategory, buildKbOnlyRedirectVariables } from '../../../config/channelMode.js';

/**
 * Unified chatter handler (LLM-first).
 * Called from both the early regex path and the ACKNOWLEDGE_CHATTER action path.
 */
function handleChatter({ userMessage, state, language, sessionId, messageRouting, detectedBy }) {
  const chatterDirective = buildChatterDirective({ userMessage, state, language, sessionId });

  // Update chatter state for anti-repeat tracking
  const previousRecent = Array.isArray(state?.chatter?.recent) ? state.chatter.recent : [];
  const nextRecent = [
    ...previousRecent,
    { messageKey: chatterDirective.messageKey, variantIndex: chatterDirective.variantIndex }
  ].slice(-2);

  state.chatter = {
    lastMessageKey: chatterDirective.messageKey,
    lastVariantIndex: chatterDirective.variantIndex,
    lastAt: new Date().toISOString(),
    recent: nextRecent
  };

  const chatterRouting = {
    ...messageRouting,
    routing: {
      ...messageRouting.routing,
      action: 'ACKNOWLEDGE_CHATTER',
      reason: `Chatter detected (${detectedBy}) — LLM directive mode`,
      nextAction: 'llm-directive'
    }
  };

  console.log(`💬 [RouterDecision] Chatter (${detectedBy}) — LLM directive mode, directResponse=false`);

  return {
    directResponse: false,
    routing: chatterRouting,
    isChatter: true,
    chatterDirective: chatterDirective.directive,
    metadata: {
      messageKey: chatterDirective.messageKey,
      variantIndex: chatterDirective.variantIndex,
      detectedBy,
      mode: 'llm_directive'
    }
  };
}

// ════════════════════════════════════════════════════════════════════
// TWO-LAYER CALLBACK DETECTION
// Layer A: Cheap stem-based hint (no word boundaries, normalized text)
// Layer B: Mini LLM classifier confirms when hint fires
// ════════════════════════════════════════════════════════════════════

// Layer A stems — just enough to filter candidates, NOT to decide.
// Turkish stems have no suffix/boundary — agglutinative language.
const CALLBACK_HINT_STEMS_TR = [
  'yetkili', 'temsilci', 'insan', 'canli destek', 'canlı destek',
  'geri ara', 'arayin', 'arayın', 'arama', 'konusmak istiyorum',
  'konuşmak istiyorum', 'gorusmek', 'görüşmek', 'musteri hizmet',
  'müşteri hizmet', 'bağla', 'bagla', 'yonlendirin', 'yönlendirin',
  'birine bagla', 'birine bağla', 'yetkiliye', 'operatör', 'operator'
];
const CALLBACK_HINT_STEMS_EN = [
  'agent', 'representative', 'human', 'call me', 'callback',
  'call back', 'live agent', 'live support', 'speak to', 'talk to',
  'transfer me', 'connect me', 'real person', 'supervisor'
];

/**
 * Layer A: Cheap deterministic hint.
 * Normalizes input and checks stem inclusion (no regex word boundaries).
 * Returns true if message is a callback *candidate* — NOT a final decision.
 */
function hasCallbackHint(message = '') {
  const text = String(message || '')
    .toLowerCase()
    .replace(/[İI]/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .normalize('NFC');

  // Normalize stems the same way and check inclusion
  const allStems = [...CALLBACK_HINT_STEMS_TR, ...CALLBACK_HINT_STEMS_EN];
  for (const stem of allStems) {
    const normalizedStem = stem
      .toLowerCase()
      .replace(/[İI]/g, 'i')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .normalize('NFC');

    if (text.includes(normalizedStem)) {
      return true;
    }
  }
  return false;
}

/**
 * Layer B: Mini LLM classifier — confirms callback intent.
 * Only called when Layer A hint fires.
 * Uses gemini-2.0-flash-lite for speed (~200ms).
 * Returns { isCallback: boolean, confidence: number }
 */
async function classifyCallbackIntent(message = '', language = 'TR') {
  try {
    const { getGeminiClient } = await import('../../../services/gemini-utils.js');
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 30,
        responseMimeType: 'application/json'
      }
    });

    const prompt = language === 'TR'
      ? `Kullanıcı mesajı bir geri arama / yetkili / temsilci / canlı destek talebi mi?
Mesaj: "${message}"
Sadece JSON döndür: {"cb":true} veya {"cb":false}`
      : `Is this user message a callback / agent / representative / live support request?
Message: "${message}"
Return only JSON: {"cb":true} or {"cb":false}`;

    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3000))
    ]);

    const raw = result.response?.text()?.trim();
    const parsed = JSON.parse(raw);
    console.log(`🤖 [CallbackClassifier] "${message}" → ${JSON.stringify(parsed)}`);
    return { isCallback: !!parsed.cb, confidence: parsed.cb ? 0.95 : 0.1 };
  } catch (err) {
    // Fail-OPEN: If classifier fails, trust the hint (Layer A already fired)
    console.warn(`⚠️ [CallbackClassifier] Error: ${err.message} — fail-open, trusting hint`);
    return { isCallback: true, confidence: 0.7 };
  }
}

/**
 * Combined two-layer callback detection.
 * Layer A (hint) → if true → Layer B (classifier) → final decision.
 * If callbackFlow.pending is already true, skip both layers.
 */
async function detectCallbackIntent(message = '', language = 'TR') {
  const hint = hasCallbackHint(message);
  if (!hint) {
    return { isCallback: false, confidence: 0, source: 'hint_negative' };
  }

  console.log(`🔎 [CallbackDetect] Hint fired for: "${message}" — calling mini classifier`);
  const classifierResult = await classifyCallbackIntent(message, language);
  return {
    ...classifierResult,
    source: classifierResult.isCallback ? 'classifier_confirmed' : 'classifier_rejected'
  };
}

// Legacy alias — used by extractNameCandidate to filter out callback stems from name candidates
function hasCallbackIntent(message = '') {
  return hasCallbackHint(message);
}

const CALLBACK_NAME_INTRO_PATTERN = /\b(ad[ıi]m|ad\s*soyad[ıi]m|ismim|isim|ben(?:im)?\s*ad[ıi]m|my\s+name\s+is|i\s+am)\b/i;
const CALLBACK_PLACEHOLDER_NAMES = new Set(['customer', 'unknown', 'anonymous', 'test', 'user', 'n/a', 'na', '-']);

function normalizePhoneCandidate(rawPhone) {
  if (!rawPhone) return null;
  const compact = String(rawPhone).replace(/[^\d+]/g, '');
  const digits = compact.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return null;
  return compact.startsWith('+') ? `+${digits}` : digits;
}

function extractPhoneCandidate(message = '') {
  const match = String(message || '').match(/(\+?\d[\d\s\-()]{8,}\d)/);
  return normalizePhoneCandidate(match?.[1] || null);
}

function looksLikePlaceholderName(name) {
  if (!name) return true;
  return CALLBACK_PLACEHOLDER_NAMES.has(String(name).trim().toLowerCase());
}

function extractNameCandidate(message = '', { allowLoose = false } = {}) {
  const text = String(message || '').replace(/(\+?\d[\d\s\-()]{8,}\d)/g, ' ').trim();
  if (!text) return null;

  const hasIntro = CALLBACK_NAME_INTRO_PATTERN.test(text);
  if (!allowLoose && !hasIntro) {
    return null;
  }

  const introMatch = text.match(/(?:ad[ıi]m|ad\s*soyad[ıi]m|ismim|isim|ben(?:im)?\s*ad[ıi]m|my\s+name\s+is|i\s+am)\s*[:\-]?\s*([A-Za-zÇĞİÖŞÜçğıöşü]+(?:\s+[A-Za-zÇĞİÖŞÜçğıöşü]+){1,2})/i);
  let candidate = introMatch?.[1] || null;

  if (!candidate) {
    const tokens = text.match(/[A-Za-zÇĞİÖŞÜçğıöşü]{2,}/g) || [];
    if (tokens.length < 2 || tokens.length > 3) return null;
    candidate = tokens.join(' ');
  }

  if (!candidate) return null;
  if (hasCallbackIntent(candidate)) return null;
  if (looksLikePlaceholderName(candidate)) return null;
  return candidate.trim();
}

function upsertCallbackContext({ state, userMessage, callbackIntentDetected }) {
  const existingName = state.callbackFlow?.customerName || state.extractedSlots?.customer_name || null;
  const existingPhone = state.callbackFlow?.customerPhone || state.extractedSlots?.phone || null;

  const extractedPhone = extractPhoneCandidate(userMessage);
  const extractedName = extractNameCandidate(userMessage, { allowLoose: !callbackIntentDetected });

  const customerName = extractedName || existingName || null;
  const customerPhone = extractedPhone || existingPhone || null;

  state.callbackFlow = {
    ...(state.callbackFlow || {}),
    pending: true,
    customerName,
    customerPhone,
    updatedAt: new Date().toISOString()
  };

  state.extractedSlots = state.extractedSlots || {};
  if (customerName) state.extractedSlots.customer_name = customerName;
  if (customerPhone) state.extractedSlots.phone = customerPhone;

  return { customerName, customerPhone };
}

export async function makeRoutingDecision(params) {
  const { classification, state, userMessage, conversationHistory, language, business, sessionId = '' } = params;

  // ========================================
  // KB_ONLY MODE: Intercept account-specific queries BEFORE routing
  // Flow:
  //   1. KB hit → LLM answers from KB (tools already stripped in Step 2)
  //   2. No KB hit + regex hint fires → LLM redirect classifier (strict JSON)
  //   3. Classifier confidence >= 0.7 + category != GENERAL → LLM redirect guidance
  //   4. Else → safe fallback via LLM (tools stripped, KB_ONLY prompt active)
  // ========================================
  if (params.channelMode === 'KB_ONLY' && !params.hasKBMatch && hasAccountHint(userMessage)) {
    // Regex hint fired — invoke LLM classifier for precise categorization
    const classifierResult = await classifyRedirectCategory(userMessage);

    if (classifierResult && classifierResult.confidence >= 0.7 && classifierResult.category !== 'GENERAL') {
      const category = classifierResult.category;
      const variables = buildKbOnlyRedirectVariables(category, params.helpLinks || {}, language);

      console.log(`🔒 [RouterDecision] KB_ONLY redirect — category=${category}, confidence=${classifierResult.confidence.toFixed(2)}`);

      return {
        directResponse: false,
        routing: { routing: { action: 'KB_ONLY_REDIRECT', reason: `KB_ONLY classifier: category=${category}, confidence=${classifierResult.confidence}` } },
        isKbOnlyRedirect: true,
        kbOnlyRedirect: {
          category,
          variables
        },
        metadata: {
          mode: 'kb_only_redirect',
          category,
          classifierConfidence: classifierResult.confidence
        }
      };
    }

    // Classifier said GENERAL or low confidence → fall through to LLM (tools stripped, KB_ONLY prompt)
    console.log(`🔒 [RouterDecision] KB_ONLY hint fired but classifier said ${classifierResult?.category || 'null'} (${(classifierResult?.confidence || 0).toFixed(2)}) — falling through to LLM`);
  }

  // ════════════════════════════════════════════════════════════════════
  // TWO-LAYER CALLBACK INTERCEPT
  // Layer A (hint) + Layer B (mini classifier) → deterministic flow
  // If callbackFlow.pending is already true, skip detection (already in flow).
  // ════════════════════════════════════════════════════════════════════
  const callbackPending = state.callbackFlow?.pending === true;
  let callbackIntentDetected = false;

  if (!callbackPending) {
    const detection = await detectCallbackIntent(userMessage, language);
    callbackIntentDetected = detection.isCallback;
    if (detection.isCallback) {
      console.log(`✅ [RouterDecision] Callback intent confirmed (source=${detection.source}, confidence=${detection.confidence})`);
    } else if (detection.source === 'classifier_rejected') {
      console.log(`🔎 [RouterDecision] Hint fired but classifier rejected — not callback`);
    }
  }

  if (callbackPending || callbackIntentDetected) {
    const { customerName, customerPhone } = upsertCallbackContext({
      state,
      userMessage,
      callbackIntentDetected
    });

    const missingFields = [];
    if (looksLikePlaceholderName(customerName)) missingFields.push('customer_name');
    if (!customerPhone) missingFields.push('phone');

    state.activeFlow = 'CALLBACK_REQUEST';
    state.flowStatus = 'in_progress';
    state.callbackFlow.pending = true;
    state.callbackFlow.missingFields = missingFields;

    const callbackRouting = {
      messageType: {
        type: 'CALLBACK_REQUEST',
        confidence: 1,
        reason: 'deterministic_callback_intercept'
      },
      routing: {
        action: 'RUN_INTENT_ROUTER',
        reason: 'Callback intent intercepted deterministically',
        suggestedFlow: 'CALLBACK_REQUEST',
        intent: 'callback_request'
      }
    };

    return {
      directResponse: false,
      routing: callbackRouting,
      callbackRequest: true,
      metadata: {
        mode: 'callback_intercept',
        missingFields
      }
    };
  }

  // Get last assistant message
  const lastAssistantMessage = conversationHistory
    .slice().reverse()
    .find(msg => msg.role === 'assistant')?.content || '';

  // Route message — pass Step 3 classification to AVOID double Gemini call
  const messageRouting = await routeMessage(
    userMessage,
    state,
    lastAssistantMessage,
    language,
    business,
    classification  // ← Reuse Step 3 classifier result
  );

  const { routing } = messageRouting;
  const action = routing.action;

  console.log('🧭 [RouterDecision]:', {
    action,
    suggestedFlow: routing.suggestedFlow,
    triggerRule: classification.triggerRule,
    verificationStatus: state.verification?.status
  });

  // ========================================
  // EARLY CHATTER DETECTION (classifier-independent)
  // ========================================
  // Pure chatter still goes through LLM with short-response directive.
  // During active tasks (flow/verification), user input can carry task data.
  const hasActiveTask =
    state.verification?.status === 'pending' ||
    state.flowStatus === 'in_progress' ||
    state.flowStatus === 'post_result' ||
    Boolean(state.activeFlow);

  if (!hasActiveTask && isPureChatter(userMessage)) {
    return handleChatter({ userMessage, state, language, sessionId, messageRouting, detectedBy: 'regex_early' });
  }

  // ========================================
  // VERIFICATION PENDING: Pass context to LLM, don't classify input
  // ========================================
  // ARCHITECTURE CHANGE: When verification is pending, we add context to state
  // so the LLM knows it needs verification, but we DON'T:
  //   ❌ Use regex to decide if input is name/phone/OOD
  //   ❌ Return directResponse templates
  //   ❌ Force tool calls
  // LLM sees the conversation history and understands what the user is providing.
  // Only apply verification flow for intents that actually need it.
  // Stock follow-ups should never trigger verification.
  const NON_VERIFICATION_FLOWS = ['STOCK_CHECK', 'PRODUCT_INQUIRY'];
  // Also check lastStockContext — after post-result reset, activeFlow is null
  // but we still shouldn't inject verification for stock follow-ups.
  const hasRecentStockContext = !!state.lastStockContext || state.anchor?.type === 'STOCK';
  const isNonVerificationFlow = hasRecentStockContext ||
    NON_VERIFICATION_FLOWS.includes(state.activeFlow) ||
    NON_VERIFICATION_FLOWS.includes(classification?.suggestedFlow);

  if (state.verification?.status === 'pending' && state.verification?.anchor && !isNonVerificationFlow) {
    console.log('🔐 [Verification] Pending verification — LLM will handle input interpretation');

    // Add verification context for LLM's system prompt
    state.verificationContext = {
      status: 'pending',
      pendingField: state.verification.pendingField || 'name',
      attempts: state.verification.attempts || 0,
      anchorType: state.verification.anchor.type,
      // SECURITY: Don't leak anchor details to LLM — just the context
    };

    // Let LLM handle — it will call customer_data_lookup with verification_input
    return {
      directResponse: false,
      routing: messageRouting,
      verificationPending: true
    };
  }

  // ========================================
  // CALLBACK_REQUEST: Let LLM collect info naturally
  // ========================================
  // ARCHITECTURE CHANGE: No more backend-driven slot collection templates.
  // LLM knows from conversation what info is needed for callbacks.
  if (classification.type === 'CALLBACK_REQUEST') {
    console.log('📞 [CALLBACK] Detected — LLM will handle slot collection naturally');

    // Just flag the intent, let LLM manage the conversation
    return {
      directResponse: false,
      routing: messageRouting,
      callbackRequest: true
    };
  }

  // Handle different actions
  switch (action) {
    case 'PROCESS_SLOT': {
      // ARCHITECTURE CHANGE: Simplified.
      // Backend no longer validates slot content — LLM extracted slots in Step 3.
      // We just pass through to LLM with the routing context.
      console.log('📝 [RouterDecision] Slot processing — LLM handles interpretation');

      return {
        directResponse: false,
        routing: messageRouting,
        slotProcessed: true
      };
    }

    case 'HANDLE_DISPUTE': {
      // Handle user dispute — let LLM respond with anchor context
      // ARCHITECTURE CHANGE: No more directResponse templates for disputes.
      // LLM sees anchor data (last tool result) and generates natural response.
      console.log('⚠️ [RouterDecision] Dispute detected — LLM will handle with anchor context');

      // Add dispute context for LLM
      if (state.anchor?.truth) {
        state.disputeContext = {
          originalFlow: state.anchor.lastFlowType,
          hasTrackingInfo: !!(state.anchor.truth?.order?.trackingNumber),
          lastResult: state.anchor.truth
        };
      }

      return {
        directResponse: false,
        routing: messageRouting,
        disputeHandled: true
      };
    }

    case 'RUN_INTENT_ROUTER': {
      // New intent detected — will be handled by LLM with tools
      if (routing.suggestedFlow) {
        state.activeFlow = routing.suggestedFlow;
        state.flowStatus = 'in_progress';

        // Clear stale verification from previous flows when starting a new flow.
        // Without this, verification.status='pending' from an old order/debt flow
        // bleeds into unrelated flows (e.g. stock queries).
        if (state.verification?.status === 'pending') {
          console.log(`🧹 [RouterDecision] Clearing stale verification (was pending) — new flow: ${routing.suggestedFlow}`);
          state.verification = { status: 'none' };
        }
      }

      return {
        directResponse: false,
        routing: messageRouting,
        newIntentDetected: true
      };
    }

    case 'CONTINUE_FLOW': {
      // Continue with current flow
      return {
        directResponse: false,
        routing: messageRouting,
        continueFlow: true
      };
    }

    case 'ACKNOWLEDGE_CHATTER': {
      return handleChatter({ userMessage, state, language, sessionId, messageRouting, detectedBy: 'action_route' });
    }

    default: {
      console.warn(`⚠️ [RouterDecision] Unknown action: ${action}`);
      return {
        directResponse: false,
        routing: messageRouting
      };
    }
  }
}

export default { makeRoutingDecision };

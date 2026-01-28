/**
 * Message Type Classifier - Gemini Flash Edition
 *
 * SOLUTION: Use Gemini Flash to classify message type + extract slots
 * No more keyword hell! AI understands context naturally.
 *
 * Message Types:
 * - SLOT_ANSWER: User is providing requested data (order number, name, phone, etc.)
 * - FOLLOWUP_DISPUTE: User disputes/contradicts assistant's previous response
 * - NEW_INTENT: User asks about a completely different topic
 * - CHATTER: Emotional response (anger, thanks, etc.) without actionable intent
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Classify message type using Gemini Flash
 *
 * @param {Object} state - Current conversation state
 * @param {string} lastAssistantMessage - Last message from assistant
 * @param {string} userMessage - Current user message
 * @param {string} language - Language code
 * @param {Object} options - Optional config (channel, timeoutMs)
 * @returns {Promise<Object>} { type, confidence, reason, suggestedFlow?, extractedSlots? }
 */
export async function classifyMessageType(state, lastAssistantMessage, userMessage, language = 'TR', options = {}) {
  // Build context for classifier
  const context = {
    flowStatus: state.flowStatus, // idle | in_progress | resolved | post_result
    activeFlow: state.activeFlow, // ORDER_STATUS | DEBT_INQUIRY | COMPLAINT | etc.
    expectedSlot: state.expectedSlot, // order_number | phone | customer_name | etc.
    lastAssistantMessage: lastAssistantMessage?.substring(0, 200) || null,
    anchor: state.anchor?.truth ? {
      dataType: state.anchor.truth.dataType,
      // Include truth summary for contradiction detection
      orderStatus: state.anchor.truth.order?.status,
      hasDebt: state.anchor.truth.debt?.hasDebt
    } : null
  };

  const prompt = buildClassifierPrompt(userMessage, context, language);

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent classification
        responseMimeType: 'application/json'
      }
    });

    // CRITICAL: Add timeout (fail-closed policy)
    // All channels get reasonable timeout to avoid false timeout failures
    const CLASSIFIER_TIMEOUT_MS_WIDGET = 5000; // 5s max for CHAT widget
    const CLASSIFIER_TIMEOUT_MS_DEFAULT = 8000; // 8s max for other channels

    const channel = options.channel || state.channel || 'CHAT';
    const isWidget = channel === 'CHAT';
    const timeoutMs = options.timeoutMs || (isWidget ? CLASSIFIER_TIMEOUT_MS_WIDGET : CLASSIFIER_TIMEOUT_MS_DEFAULT);

    const classificationPromise = model.generateContent(prompt);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Classifier timeout')), timeoutMs)
    );

    console.log(`⏱️  [Classifier] Timeout: ${timeoutMs}ms (channel: ${channel})`);

    const result = await Promise.race([classificationPromise, timeoutPromise]);
    const responseText = result.response.text();
    const classification = JSON.parse(responseText);

    console.log('🤖 [Classifier] Gemini Flash result:', classification);

    return {
      type: classification.message_type,
      confidence: classification.confidence,
      reason: classification.reason,
      suggestedFlow: classification.suggested_flow || null,
      extractedSlots: classification.extracted_slots || {},
      triggerRule: classification.trigger_rule || null // For FOLLOWUP_DISPUTE metrics
    };

  } catch (error) {
    console.error('❌ [Classifier] Gemini Flash error:', error.message);

    // FAIL-CLOSED: Return safe mode (no tools, low confidence)
    const isTimeout = error.message?.includes('timeout');
    console.error(`🚨 [Classifier] ${isTimeout ? 'TIMEOUT' : 'ERROR'} - Falling back to safe mode (no tools)`);

    // Fallback to simple heuristic with REDUCED confidence
    const fallback = fallbackClassifier(state, userMessage, language);

    // CRITICAL: Cap fallback confidence at 0.5 to disable tools
    return {
      ...fallback,
      confidence: Math.min(fallback.confidence, 0.5),
      reason: `${isTimeout ? 'Timeout' : 'Error'}: ${fallback.reason}`,
      hadClassifierFailure: true,
      failureType: isTimeout ? 'timeout' : 'error'
    };
  }
}

/**
 * Build classification prompt for Gemini Flash
 */
function buildClassifierPrompt(userMessage, context, language) {
  const languageName = language === 'TR' ? 'Turkish' : 'English';

  return `You are a message type classifier for a customer service chatbot.

**Current Context:**
- Flow Status: ${context.flowStatus}
- Active Flow: ${context.activeFlow || 'none'}
- Expected Slot: ${context.expectedSlot || 'none'}
- Last Assistant Message: "${context.lastAssistantMessage || 'none'}"
${context.anchor ? `- Truth Anchor: orderStatus="${context.anchor.orderStatus}", hasDebt=${context.anchor.hasDebt}` : ''}

**User Message:**
"${userMessage}"

**Task:** Classify the message into one of these types:

1. **SLOT_ANSWER**: User is providing the requested slot data
   - Example: Assistant asks "Sipariş numaranız?" → User: "SP001"
   - Example: Assistant asks "Telefon numaranız?" → User: "5551234567"

2. **FOLLOWUP_DISPUTE**: User disputes/contradicts assistant's result AFTER flow completed
   - Example: Assistant: "Siparişiniz teslim edildi" → User: "Bu ne saçma iş ya hala elimde değil"
   - Example: Assistant: "Borcunuz yok" → User: "Yanlış bilgi veriyorsunuz, borcum var"
   - IMPORTANT: Check if truth anchor contradicts user's claim!
   - If orderStatus="delivered" but user says "gelmedi/didn't arrive" → FOLLOWUP_DISPUTE
   - Set trigger_rule: "contradiction" | "keyword" | "both"

3. **NEW_INTENT**: User asks about a different topic or starts new conversation
   - Example: User: "Siparişim nerede?" (new topic: order tracking)
   - Example: User: "Borcum var mı?" (new topic: debt inquiry)
   - Example: User: "Hızlandırır mısın şu işi?" → suggested_flow: COMPLAINT
   - Can happen even when expecting slot (topic switch)

4. **CHATTER**: Emotional response without actionable intent
   - Example: User: "Teşekkürler" (gratitude)
   - Example: User: "Bu ne saçma sistem ya" when expecting slot (anger, not slot data)
   - Example: User: "Anladım tamam" (acknowledgment)

**Slot Extraction:**
If message contains slot data, extract it:
- order_number: SP001, ORD-123456, etc.
- phone: 5551234567, 905551234567, etc.
- customer_name: "Ali Yılmaz", etc.
- complaint_details: extracted text if complaint intent

**Response Format (JSON):**
{
  "message_type": "SLOT_ANSWER" | "FOLLOWUP_DISPUTE" | "NEW_INTENT" | "CHATTER",
  "confidence": 0.0-1.0,
  "reason": "Brief explanation in ${languageName}",
  "suggested_flow": "ORDER_STATUS" | "DEBT_INQUIRY" | "COMPLAINT" | null,
  "extracted_slots": {
    "slot_name": "value"
  },
  "trigger_rule": "contradiction" | "keyword" | "both" | null
}

**Rules:**
- High confidence (>0.9) if clear pattern
- Medium confidence (0.7-0.85) if somewhat ambiguous
- Low confidence (<0.7) if very unclear
- Always prioritize context over keywords
- If expecting slot but message is emotional/angry → CHATTER, not SLOT_ANSWER
- If flowStatus="post_result" and user contradicts → FOLLOWUP_DISPUTE`;
}

/**
 * Fallback classifier (simple heuristics when Gemini fails)
 */
function fallbackClassifier(state, userMessage, language) {
  console.warn('⚠️ [Classifier] Using fallback heuristics');

  const userLower = userMessage.toLowerCase();

  // If expecting slot and message is very short → likely slot answer
  if (state.expectedSlot && userMessage.trim().length < 30) {
    // Check for basic slot patterns
    const slotPatterns = {
      order_number: /^[A-Z]{2,4}[-_]?\d{4,10}$|^\d{6,12}$/i,
      phone: /^(\+?90|0)?[5]\d{9}$/
    };

    const pattern = slotPatterns[state.expectedSlot];
    if (pattern && pattern.test(userMessage.trim())) {
      return {
        type: 'SLOT_ANSWER',
        confidence: 0.8,
        reason: 'Fallback: matches slot pattern',
        extractedSlots: { [state.expectedSlot]: userMessage.trim() }
      };
    }
  }

  // If flowStatus is post_result → might be chatter or dispute
  if (state.flowStatus === 'post_result' || state.flowStatus === 'resolved') {
    const thankWords = language === 'TR'
      ? ['teşekkür', 'sağol', 'tamam']
      : ['thanks', 'thank you', 'ok'];

    if (thankWords.some(w => userLower.includes(w))) {
      return {
        type: 'CHATTER',
        confidence: 0.7,
        reason: 'Fallback: gratitude/acknowledgment'
      };
    }
  }

  // Default: NEW_INTENT with low confidence
  return {
    type: 'NEW_INTENT',
    confidence: 0.5,
    reason: 'Fallback: unclear, defaulting to new intent'
  };
}

/**
 * Enhanced classifier with LLM fallback (for backwards compatibility)
 */
export async function classifyMessageTypeWithLLM(state, lastAssistantMessage, userMessage, language) {
  // Now this just calls the main function (already uses LLM)
  return classifyMessageType(state, lastAssistantMessage, userMessage, language);
}

export default {
  classifyMessageType,
  classifyMessageTypeWithLLM
};

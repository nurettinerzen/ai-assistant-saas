import { getMessageVariant } from '../messages/messageCatalog.js';

const GREETING_PATTERNS = [
  /\b(selam|selamlar|merhaba|günaydın|iyi akşamlar|iyi günler)\b/i,
  /\b(naber|napıyorsun|nasılsın|nasıl gidiyor|ne haber|nbr|nbrr|nasilsin|nasil gidiyor)\b/i,
  /\b(iyi misin|iyimisin|naapıyosun|n['']?aber|ne var ne yok)\b/i,
  /\b(her ?şey.{0,5}(yolunda|iyi)|olunda)\b/i,
  /\b(hi|hello|hey|good morning|good evening|howdy|what'?s up|sup)\b/i,
  /\b(how are you|how'?s it going|how do you do)\b/i
];

const THANKS_PATTERNS = [
  /\b(teşekkür|teşekkürler|sağ ol|sağol)\b/i,
  /\b(thanks|thank you|thx)\b/i
];

export function isGreeting(text) {
  return GREETING_PATTERNS.some(pattern => pattern.test(text));
}

export function isThanks(text) {
  return THANKS_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Quick check: is this a pure chatter message (greeting, thanks, or very short filler)?
 * Used by routerDecision for classifier-independent early detection.
 *
 * IMPORTANT: "merhaba siparişimi sorgulayabilir misiniz" is NOT pure chatter.
 * Only short messages (≤3 words) that are entirely greeting/thanks qualify.
 */
export function isPureChatter(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;

  const words = trimmed.split(/\s+/);

  // Business-relevant keywords — if any present, message is NOT pure chatter
  const businessKeywords = /\b(sipariş|siparişim|kargo|ürün|fiyat|iade|stok|borç|ödeme|teslimat|takip|nerede|durum|order|price|product|delivery|refund|stock|payment|tracking|where)\b/i;

  // Short messages (≤3 words): greeting or thanks → chatter (unless has business keywords)
  if (words.length <= 3 && (isGreeting(trimmed) || isThanks(trimmed))) {
    if (!businessKeywords.test(trimmed)) return true;
  }

  // Extended greetings (4-5 words): ONLY if it matches greeting pattern AND
  // contains no business-relevant keywords (sipariş, kargo, ürün, fiyat, etc.)
  if (words.length <= 5 && isGreeting(trimmed)) {
    if (!businessKeywords.test(trimmed)) return true;
  }

  // Very short filler messages (1-2 words)
  if (words.length <= 2) {
    const fillerPatterns = /^(ok|tamam|tamamdır|anladım|evet|peki|olur|iyi|güzel|süper|harika|eyvallah|sağ ol|hay hay)$/i;
    if (fillerPatterns.test(trimmed)) return true;
  }

  return false;
}

function hasActiveTask(state = {}) {
  if (!state) return false;
  if (state.verification?.status === 'pending') return true;
  if (state.activeFlow) return true;
  if (state.flowStatus === 'in_progress' || state.flowStatus === 'post_result') return true;
  return false;
}

function getGreetingResponseOptions(language = 'TR', activeTask = false) {
  const lang = String(language || 'TR').toUpperCase() === 'EN' ? 'EN' : 'TR';

  if (lang === 'EN') {
    return activeTask
      ? [
          'Hey, let us pick up where we left off.',
          'Hi again, we can continue the open request.',
          'Hello, I can help you finish this step.',
          'Hey there, we are still on this task and can continue now.',
          'Hi, ready when you are to continue this flow.'
        ]
      : [
          'Hey! How can I help today?',
          'Hi there! What would you like to check?',
          'Hello! I can help right away, what do you need?',
          'Hey, tell me what you need and I will jump in.',
          'Hi! I am here, what should we start with?'
        ];
  }

  return activeTask
    ? [
        'Selam, kaldığımız yerden devam edelim.',
        'Merhaba tekrar, açık olan işlemi birlikte tamamlayalım.',
        'Selam, sonraki adımı beraber bitirebiliriz.',
        'Tekrar merhaba, mevcut konudan devam edebilirim.',
        'Selam, hazırsa devam edelim.'
      ]
    : [
        'Selam! Nasıl yardımcı olayım?',
        'Merhaba! Ne için buradayız, birlikte bakalım.',
        'Selam! Neye bakmamı istersin?',
        'Merhaba, hazırım. Ne yapmak istersin?',
        'Selamlar! Hangi konuda destek istersin?'
      ];
}

export function buildChatterResponse({ userMessage = '', state = {}, language = 'TR', sessionId = '' } = {}) {
  const text = String(userMessage || '').trim();
  const activeTask = hasActiveTask(state);

  let messageKey = null;
  if (isGreeting(text)) {
    messageKey = activeTask ? 'CHATTER_GREETING_ACTIVE' : 'CHATTER_GREETING_IDLE';
  } else if (isThanks(text)) {
    messageKey = activeTask ? 'CHATTER_THANKS_ACTIVE' : 'CHATTER_THANKS_IDLE';
  } else {
    messageKey = activeTask ? 'CHATTER_GENERIC_ACTIVE' : 'CHATTER_GENERIC_IDLE';
  }

  const lastKey = state?.chatter?.lastMessageKey || null;
  const lastVariant = state?.chatter?.lastVariantIndex;
  const avoidVariantIndex = lastKey === messageKey && Number.isInteger(lastVariant)
    ? lastVariant
    : null;
  const recent = Array.isArray(state?.chatter?.recent) ? state.chatter.recent : [];
  const avoidVariantIndexes = recent
    .filter(item => item?.messageKey === messageKey && Number.isInteger(item?.variantIndex))
    .map(item => item.variantIndex);

  const variant = getMessageVariant(messageKey, {
    language,
    sessionId,
    directiveType: 'CHATTER',
    severity: 'info',
    intent: state?.activeFlow || '',
    seedHint: text,
    avoidVariantIndex,
    avoidVariantIndexes
  });

  return variant;
}

/**
 * Build a chatter directive for LLM-based greeting mode.
 * Instead of returning final text, returns structured directive fields
 * that get injected into the LLM prompt (Step 5).
 * Catalog response is kept as fallback only.
 */
export function buildChatterDirective({ userMessage = '', state = {}, language = 'TR', sessionId = '' } = {}) {
  const text = String(userMessage || '').trim();
  const activeTask = hasActiveTask(state);

  let kind = 'generic';
  if (isGreeting(text)) kind = 'greeting';
  else if (isThanks(text)) kind = 'thanks';

  // Build the catalog fallback (used if LLM fails/times out)
  const catalogFallback = buildChatterResponse({ userMessage, state, language, sessionId });
  const responseOptions = kind === 'greeting'
    ? getGreetingResponseOptions(language, activeTask)
    : [];
  const responseSeed = [
    sessionId,
    kind,
    catalogFallback.messageKey,
    catalogFallback.variantIndex,
    text.toLowerCase()
  ]
    .filter(Boolean)
    .join('|');

  // Collect last assistant messages for anti-repetition context
  const lastAssistantUtterances = [];
  if (state?.chatter?.lastMessageKey) {
    lastAssistantUtterances.push(catalogFallback.text); // approximate
  }

  return {
    directive: {
      kind,
      activeTask,
      flowStatus: state.flowStatus || 'idle',
      verificationPending: state.verification?.status === 'pending',
      activeFlow: state.activeFlow || null,
      expectedSlot: state.expectedSlot || null,
      avoidRepeatingHelpPhrase: true,
      maxSentences: 2,
      continueTaskIfAny: activeTask,
      responseOptions,
      responseSeed,
      avoidExactPhrases: kind === 'greeting'
        ? (String(language || 'TR').toUpperCase() === 'EN'
            ? ['Hello, welcome.']
            : ['Merhaba, hoş geldiniz.'])
        : []
    },
    catalogFallback,
    messageKey: catalogFallback.messageKey,
    variantIndex: catalogFallback.variantIndex
  };
}

export default { buildChatterResponse, buildChatterDirective };

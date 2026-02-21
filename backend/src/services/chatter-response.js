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
 * Returns structured directive fields that are injected into the LLM prompt.
 * This module must never produce user-facing final text for runtime responses.
 */
export function buildChatterDirective({ userMessage = '', state = {}, language = 'TR', sessionId = '' } = {}) {
  const text = String(userMessage || '').trim();
  const activeTask = hasActiveTask(state);

  let kind = 'generic';
  if (isGreeting(text)) kind = 'greeting';
  else if (isThanks(text)) kind = 'thanks';

  // Keep only structured metadata for anti-repeat tracking.
  const catalogVariant = buildChatterResponse({ userMessage, state, language, sessionId });
  const responseSeed = [
    sessionId,
    kind,
    catalogVariant.messageKey,
    catalogVariant.variantIndex,
    text.toLowerCase()
  ]
    .filter(Boolean)
    .join('|');

  return {
    directive: {
      kind,
      activeTask,
      flowStatus: state.flowStatus || 'idle',
      verificationPending: state.verification?.status === 'pending',
      activeFlow: state.activeFlow || null,
      expectedSlot: state.expectedSlot || null,
      avoidRepeatingHelpPhrase: true,
      maxSentences: 1,
      continueTaskIfAny: activeTask,
      responseSeed,
      brevity: 'ONE_SENTENCE_SHORT_NO_REPEAT'
    },
    messageKey: catalogVariant.messageKey,
    variantIndex: catalogVariant.variantIndex
  };
}

export default { buildChatterResponse, buildChatterDirective };

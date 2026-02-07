import { getMessageVariant } from '../messages/messageCatalog.js';

const GREETING_PATTERNS = [
  /\b(selam|selamlar|merhaba|günaydın|iyi akşamlar|iyi günler)\b/i,
  /\b(hi|hello|hey|good morning|good evening)\b/i
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

  // Only short messages qualify as pure chatter (max 3 words)
  // "merhaba siparişimi sorgulayabilir misiniz" = 4 words → NOT chatter
  if (words.length > 3) return false;

  // Pure greeting or thanks (1-3 words)
  if (isGreeting(trimmed) || isThanks(trimmed)) return true;

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

export default { buildChatterResponse };

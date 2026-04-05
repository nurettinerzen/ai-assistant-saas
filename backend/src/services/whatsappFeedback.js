import { isFeatureEnabled } from '../config/feature-flags.js';

export const WHATSAPP_FEEDBACK_BUTTON_IDS = Object.freeze({
  POSITIVE: 'wa_feedback_positive',
  NEGATIVE: 'wa_feedback_negative',
});

const MIN_ASSISTANT_TURNS = 2;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeAssistantTurns(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.trunc(numeric));
}

export function isWhatsAppFeedbackEnabled() {
  return isFeatureEnabled('WHATSAPP_FEEDBACK_V1') || isFeatureEnabled('WHATSAPP_LIVE_HANDOFF_V2');
}

export function getNormalizedWhatsAppFeedbackState(state = {}) {
  const feedback = isPlainObject(state?.whatsappFeedback) ? state.whatsappFeedback : {};

  return {
    assistantTurns: normalizeAssistantTurns(feedback.assistantTurns),
    promptSentAt: feedback.promptSentAt || null,
    promptMessageId: feedback.promptMessageId || null,
    responseTraceId: feedback.responseTraceId || null,
    submittedAt: feedback.submittedAt || null,
    submittedMessageId: feedback.submittedMessageId || null,
    sentiment: feedback.sentiment || null,
  };
}

export function registerAssistantReplyForWhatsAppFeedback(state = {}, { traceId = null } = {}) {
  const current = getNormalizedWhatsAppFeedbackState(state);

  return {
    ...state,
    whatsappFeedback: {
      ...current,
      assistantTurns: current.assistantTurns + 1,
      responseTraceId: traceId || current.responseTraceId || null,
    },
  };
}

export function shouldPromptWhatsAppFeedback({
  state = {},
  handoffMode = 'AI',
  supportRoutingPending = false,
  callbackPending = false,
}) {
  const feedback = getNormalizedWhatsAppFeedbackState(state);
  if (feedback.submittedAt || feedback.promptSentAt) return false;
  if (feedback.assistantTurns < MIN_ASSISTANT_TURNS) return false;
  if (handoffMode !== 'AI') return false;
  if (supportRoutingPending || callbackPending) return false;
  return true;
}

export function markWhatsAppFeedbackPromptSent(
  state = {},
  { traceId = null, promptMessageId = null, now = new Date().toISOString() } = {}
) {
  const current = getNormalizedWhatsAppFeedbackState(state);

  return {
    ...state,
    whatsappFeedback: {
      ...current,
      promptSentAt: now,
      promptMessageId: promptMessageId || current.promptMessageId || null,
      responseTraceId: traceId || current.responseTraceId || null,
    },
  };
}

export function markWhatsAppFeedbackSubmitted(
  state = {},
  { sentiment = 'positive', messageId = null, now = new Date().toISOString() } = {}
) {
  const current = getNormalizedWhatsAppFeedbackState(state);
  const normalizedSentiment = String(sentiment || '').toLowerCase() === 'negative'
    ? 'negative'
    : 'positive';

  return {
    ...state,
    whatsappFeedback: {
      ...current,
      submittedAt: now,
      submittedMessageId: messageId || current.submittedMessageId || null,
      sentiment: normalizedSentiment,
    },
  };
}

export function getWhatsAppFeedbackPrompt(language = 'TR') {
  if (String(language || 'TR').toUpperCase() === 'EN') {
    return {
      bodyText: 'How was this conversation?',
      footerText: 'Your feedback helps us improve.',
      buttons: [
        { id: WHATSAPP_FEEDBACK_BUTTON_IDS.POSITIVE, title: 'Helpful' },
        { id: WHATSAPP_FEEDBACK_BUTTON_IDS.NEGATIVE, title: 'Not helpful' },
      ],
    };
  }

  return {
    bodyText: 'Bu görüşme sizin için nasıldı?',
    footerText: 'Geri bildiriminiz hizmetimizi geliştirmemize yardımcı olur.',
    buttons: [
      { id: WHATSAPP_FEEDBACK_BUTTON_IDS.POSITIVE, title: 'Yardımcı oldu' },
      { id: WHATSAPP_FEEDBACK_BUTTON_IDS.NEGATIVE, title: 'Yardımcı olmadı' },
    ],
  };
}

export function getWhatsAppFeedbackThankYouMessage(language = 'TR', sentiment = 'positive') {
  const negative = String(sentiment || '').toLowerCase() === 'negative';

  if (String(language || 'TR').toUpperCase() === 'EN') {
    return negative
      ? 'Thanks for the feedback. We will use it to improve the experience.'
      : 'Thanks for the feedback. We are glad this conversation was helpful.';
  }

  return negative
    ? 'Geri bildiriminiz için teşekkürler. Deneyimi geliştirmek için bunu değerlendireceğiz.'
    : 'Geri bildiriminiz için teşekkürler. Bu görüşmenin yardımcı olmasına sevindik.';
}

export function parseWhatsAppFeedbackSelection(interactiveReply = null) {
  const reply = isPlainObject(interactiveReply) ? interactiveReply : {};
  const id = String(reply.id || '').trim();
  const title = String(reply.title || '').trim() || null;

  if (!id) return null;
  if (id === WHATSAPP_FEEDBACK_BUTTON_IDS.POSITIVE) {
    return { sentiment: 'positive', id, title };
  }
  if (id === WHATSAPP_FEEDBACK_BUTTON_IDS.NEGATIVE) {
    return { sentiment: 'negative', id, title };
  }
  return null;
}

export default {
  WHATSAPP_FEEDBACK_BUTTON_IDS,
  getNormalizedWhatsAppFeedbackState,
  getWhatsAppFeedbackPrompt,
  getWhatsAppFeedbackThankYouMessage,
  isWhatsAppFeedbackEnabled,
  markWhatsAppFeedbackPromptSent,
  markWhatsAppFeedbackSubmitted,
  parseWhatsAppFeedbackSelection,
  registerAssistantReplyForWhatsAppFeedback,
  shouldPromptWhatsAppFeedback,
};

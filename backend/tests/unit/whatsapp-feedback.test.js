import { describe, expect, it } from '@jest/globals';

const {
  WHATSAPP_FEEDBACK_BUTTON_IDS,
  getNormalizedWhatsAppFeedbackState,
  getWhatsAppFeedbackPrompt,
  getWhatsAppFeedbackThankYouMessage,
  markWhatsAppFeedbackPromptSent,
  markWhatsAppFeedbackSubmitted,
  parseWhatsAppFeedbackSelection,
  registerAssistantReplyForWhatsAppFeedback,
  shouldPromptWhatsAppFeedback,
} = await import('../../src/services/whatsappFeedback.js');

describe('whatsappFeedback service', () => {
  it('increments assistant turn count and stores trace id', () => {
    const next = registerAssistantReplyForWhatsAppFeedback({}, { traceId: 'trace_123' });

    expect(getNormalizedWhatsAppFeedbackState(next)).toMatchObject({
      assistantTurns: 1,
      responseTraceId: 'trace_123',
      promptSentAt: null,
      submittedAt: null,
    });
  });

  it('prompts only after enough assistant turns and only once', () => {
    const oneTurn = registerAssistantReplyForWhatsAppFeedback({}, { traceId: 'trace_1' });
    expect(shouldPromptWhatsAppFeedback({ state: oneTurn })).toBe(false);

    const twoTurns = registerAssistantReplyForWhatsAppFeedback(oneTurn, { traceId: 'trace_2' });
    expect(shouldPromptWhatsAppFeedback({ state: twoTurns })).toBe(true);

    const prompted = markWhatsAppFeedbackPromptSent(twoTurns, {
      traceId: 'trace_2',
      promptMessageId: 'feedback-prompt:sess_1:2',
      now: '2026-04-05T12:00:00.000Z',
    });
    expect(shouldPromptWhatsAppFeedback({ state: prompted })).toBe(false);
  });

  it('does not prompt while a live handoff or callback flow is active', () => {
    const base = registerAssistantReplyForWhatsAppFeedback(
      registerAssistantReplyForWhatsAppFeedback({}, { traceId: 'trace_1' }),
      { traceId: 'trace_2' }
    );

    expect(shouldPromptWhatsAppFeedback({ state: base, handoffMode: 'ACTIVE' })).toBe(false);
    expect(shouldPromptWhatsAppFeedback({ state: base, supportRoutingPending: true })).toBe(false);
    expect(shouldPromptWhatsAppFeedback({ state: base, callbackPending: true })).toBe(false);
  });

  it('parses positive and negative interactive button selections', () => {
    expect(parseWhatsAppFeedbackSelection({
      id: WHATSAPP_FEEDBACK_BUTTON_IDS.POSITIVE,
      title: 'Helpful',
    })).toMatchObject({ sentiment: 'positive' });

    expect(parseWhatsAppFeedbackSelection({
      id: WHATSAPP_FEEDBACK_BUTTON_IDS.NEGATIVE,
      title: 'Not helpful',
    })).toMatchObject({ sentiment: 'negative' });

    expect(parseWhatsAppFeedbackSelection({
      id: 'something_else',
      title: 'Ignore me',
    })).toBeNull();
  });

  it('marks submission and returns localized prompt/thank-you copy', () => {
    const prompted = markWhatsAppFeedbackPromptSent({}, {
      traceId: 'trace_9',
      promptMessageId: 'feedback-prompt:sess_2:2',
      now: '2026-04-05T12:00:00.000Z',
    });
    const submitted = markWhatsAppFeedbackSubmitted(prompted, {
      sentiment: 'negative',
      messageId: 'wamid.feedback',
      now: '2026-04-05T12:01:00.000Z',
    });

    expect(getNormalizedWhatsAppFeedbackState(submitted)).toMatchObject({
      submittedAt: '2026-04-05T12:01:00.000Z',
      submittedMessageId: 'wamid.feedback',
      sentiment: 'negative',
    });

    expect(getWhatsAppFeedbackPrompt('TR').buttons).toHaveLength(2);
    expect(getWhatsAppFeedbackThankYouMessage('EN', 'positive')).toContain('Thanks');
    expect(getWhatsAppFeedbackThankYouMessage('TR', 'negative')).toContain('teşekkür');
  });
});

import { applyGuardrails } from '../../src/core/orchestrator/steps/07_guardrails.js';

describe('INTERNAL_PROTOCOL_LEAK correction flow', () => {
  it('returns correction request and reprompt metadata', async () => {
    const result = await applyGuardrails({
      responseText: 'Ben bir yapay zeka asistanıyım, bu bilgiye erişemiyorum.',
      hadToolSuccess: false,
      toolsCalled: [],
      toolOutputs: [],
      chat: null,
      language: 'TR',
      sessionId: 'test-session',
      channel: 'CHAT',
      metrics: {},
      userMessage: 'Neden yapamıyorsun?',
      verificationState: 'none',
      verifiedIdentity: null,
      intent: null,
      collectedData: {},
      channelMode: 'NORMAL',
      helpLinks: {}
    });

    expect(result.needsCorrection).toBe(true);
    expect(result.correctionType).toBe('INTERNAL_PROTOCOL_LEAK');
    expect(result.blocked).toBe(true);
    expect(result.repromptCount).toBe(1);
    expect(result.finalResponse).toBeNull();
  });
});

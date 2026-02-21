import { applyGuardrails } from '../../src/core/orchestrator/steps/07_guardrails.js';

describe('INTERNAL_PROTOCOL_LEAK correction flow', () => {
  it('returns deterministic sanitize action without hard block', async () => {
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

    expect(result.action).toBe('SANITIZE');
    expect(result.blocked).not.toBe(true);
    expect(result.blockReason).toBeUndefined();
    expect(typeof result.finalResponse).toBe('string');
    expect(result.finalResponse.length).toBeGreaterThan(0);
    expect(result.finalResponse.toLowerCase()).not.toContain('yapay zeka');
    expect(result.finalResponse.toLowerCase()).not.toContain('erişim');
  });
});

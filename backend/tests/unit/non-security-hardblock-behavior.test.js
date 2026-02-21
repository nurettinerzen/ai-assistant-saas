import { describe, it, expect } from 'vitest';
import { applyGuardrails } from '../../src/core/orchestrator/steps/07_guardrails.js';

describe('Non-security guardrail violations should not hard block', () => {
  const baseParams = {
    hadToolSuccess: false,
    toolsCalled: [],
    toolOutputs: [],
    chat: null,
    language: 'TR',
    sessionId: 'non-security-hardblock-test',
    channel: 'CHAT',
    metrics: {},
    userMessage: '',
    verificationState: 'none',
    verifiedIdentity: null,
    intent: null,
    collectedData: {},
    channelMode: 'FULL',
    helpLinks: {}
  };

  it('confabulation violation should become clarification/sanitize, not block', async () => {
    const result = await applyGuardrails({
      ...baseParams,
      userMessage: 'Stok var mı?',
      responseText: 'Bu ürün stokta var.'
    });

    expect(result.action).toBe('SANITIZE');
    expect(result.blocked).not.toBe(true);
    expect(result.finalResponse).toContain('?');
  });

  it('field grounding violation should become clarification/sanitize, not block', async () => {
    const result = await applyGuardrails({
      ...baseParams,
      hadToolSuccess: true,
      toolsCalled: ['check_order_status'],
      toolOutputs: [
        {
          name: 'check_order_status',
          success: true,
          outcome: 'OK',
          output: {
            order: { status: 'hazırlanıyor' }
          }
        }
      ],
      userMessage: 'Siparişim nerede?',
      responseText: 'Siparişiniz teslim edildi.'
    });

    expect(result.action).toBe('SANITIZE');
    expect(result.blocked).not.toBe(true);
    expect(result.finalResponse).toContain('?');
  });
});

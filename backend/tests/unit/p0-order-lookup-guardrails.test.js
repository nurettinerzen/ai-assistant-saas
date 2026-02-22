import { describe, expect, it } from '@jest/globals';
import { ToolOutcome } from '../../src/tools/toolResult.js';
import { applyGuardrails } from '../../src/core/orchestrator/steps/07_guardrails.js';

describe('P0 order lookup guardrail contracts', () => {
  const baseParams = {
    hadToolSuccess: false,
    toolsCalled: [],
    toolOutputs: [],
    chat: null,
    language: 'TR',
    sessionId: 'order-guardrail-test',
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

  it('enforces single-field clarification when order intent is detected but no tool was called', async () => {
    const result = await applyGuardrails({
      ...baseParams,
      userMessage: 'siparisim nerde kaldi',
      responseText: 'Siparişinizi kontrol etmem için sipariş numarası veya telefon numarası ve isim/soyisim paylaşır mısınız?'
    });

    expect(result.action).toBe('NEED_MIN_INFO_FOR_TOOL');
    expect(result.blockReason).toBe('TOOL_REQUIRED_NOT_CALLED');
    expect(result.finalResponse).toContain('sipariş numaranızı');
    expect(result.finalResponse.toLowerCase()).not.toContain('telefon');
    expect(result.finalResponse.toLowerCase()).not.toContain('isim');
  });

  it('returns context-aware clarification for NOT_FOUND with ambiguous 10-11 digit input', async () => {
    const result = await applyGuardrails({
      ...baseParams,
      hadToolSuccess: true,
      toolsCalled: ['customer_data_lookup'],
      toolOutputs: [
        {
          name: 'customer_data_lookup',
          success: true,
          outcome: ToolOutcome.NOT_FOUND,
          output: null
        }
      ],
      userMessage: '4245275089',
      responseText: 'Bu bilgilerle eşleşen kayıt bulunamadı.'
    });

    expect(result.action).toBe('NEED_MIN_INFO_FOR_TOOL');
    expect(result.blockReason).toBe('TOOL_NOT_FOUND');
    expect(result.finalResponse).toContain('telefon numarası mı yoksa sipariş numarası mı');
  });
});

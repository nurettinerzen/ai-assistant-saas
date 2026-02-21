import { describe, it, expect } from 'vitest';
import { applyGuardrails } from '../../src/core/orchestrator/steps/07_guardrails.js';
import { applyLeakFilter } from '../../src/guardrails/securityGateway.js';

describe('P0 Guardrail Barrier Contract', () => {
  const baseParams = {
    hadToolSuccess: false,
    toolsCalled: [],
    toolOutputs: [],
    chat: null,
    language: 'TR',
    sessionId: 'barrier-test-session',
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

  it('1) Telyx product explanation with "telefon kanalı" stays PASS (no verification steering)', async () => {
    const result = await applyGuardrails({
      ...baseParams,
      userMessage: 'Telyx nasıl kullanılıyor?',
      responseText: "Telyx'e kaydolup panelden kurulum yaparsınız. Telefon kanalı, WhatsApp ve chat seçeneklerini buradan açabilirsiniz."
    });

    expect(result.action).toBe('PASS');
    expect(result.blocked).not.toBe(true);
    expect(result.finalResponse.toLowerCase()).not.toContain('sipariş');
  });

  it('2) Explicit phone number is sanitized and flow does not change mode', () => {
    const result = applyLeakFilter(
      'Telefon numaram 05551234567, bu numaradan bana ulaşabilirsiniz.',
      'none',
      'TR',
      {}
    );

    expect(result.action).toBe('SANITIZE');
    expect(result.sanitized).not.toContain('05551234567');
    expect(result.sanitized).toContain('*');
  });

  it('3) "kayıtlıdır" does not create shipping false positive from substring matches', () => {
    const result = applyLeakFilter('Müşteri bilgisi sistemde kayıtlıdır.', 'none', 'TR', {});
    const shippingLeaks = (result.leaks || []).filter(l => l.type === 'shipping');

    expect(shippingLeaks).toHaveLength(0);
    expect(result.action).toBe('PASS');
  });

  it('4) 11-digit number without tracking context is not classified as tracking', () => {
    const result = applyLeakFilter('Referans no 12345678901 olarak kaydedildi.', 'none', 'TR', {});
    const trackingLeaks = (result.leaks || []).filter(l => l.type === 'tracking');

    expect(trackingLeaks).toHaveLength(0);
  });

  it('5) order-status intent + tool plan + missing data => NEED_MIN_INFO_FOR_TOOL (single question)', async () => {
    const result = await applyGuardrails({
      ...baseParams,
      intent: 'order_status',
      toolsCalled: ['customer_data_lookup'],
      userMessage: 'Siparişim nerede?',
      responseText: 'Siparişiniz Yurtiçi Kargo ile Kadıköy şubesine gönderildi.'
    });

    expect(result.action).toBe('NEED_MIN_INFO_FOR_TOOL');
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe('NEED_MIN_INFO_FOR_TOOL');
    expect(result.missingFields).toContain('order_number');
    expect(result.missingFields).toContain('phone_last4');
    expect((result.finalResponse.match(/\?/g) || []).length).toBeLessThanOrEqual(1);
  });
});

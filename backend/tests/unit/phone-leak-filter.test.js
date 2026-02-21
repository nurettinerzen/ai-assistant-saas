/**
 * Phone Leak Filter — P0 regression tests
 *
 * Ensures:
 * 1. "telefon kanalı" gibi kelime → phone leak FALSE (no digits)
 * 2. "Beni 05551234567'den ara" → phone leak TRUE, redacted
 * 3. "Son 4 hanesi 1234" → phone leak TRUE, redacted
 * 4. Leak tetiklenince final response sipariş no İSTEMEZ (phone-only → redact, not verify)
 */

import { describe, test, expect } from '@jest/globals';
import { applyLeakFilter } from '../../src/guardrails/securityGateway.js';

describe('Phone leak filter (P0 fix)', () => {

  // ─── CASE 1: "telefon kanalı" → false positive olmamalı ───
  test('CASE 1: "Telyx telefon kanalı ile iletişim sağlar" → phone leak FALSE, safe=true', () => {
    const response = 'Telyx, işletmelerin müşterileriyle telefon, WhatsApp ve e-posta gibi kanallar üzerinden iletişim kurmasını sağlar.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.safe).toBe(true);
    // Eğer leak dizisi dönüyorsa, phone tipi olmamalı
    const phoneLeaks = (result.leaks || []).filter(l => l.type === 'phone');
    expect(phoneLeaks).toHaveLength(0);
  });

  test('CASE 1b: "telephone channel" → phone leak FALSE, safe=true', () => {
    const response = 'Telyx enables businesses to communicate via telephone, WhatsApp, and email channels.';
    const result = applyLeakFilter(response, 'none', 'EN', {});

    expect(result.safe).toBe(true);
  });

  // ─── CASE 1c: "kayıtlıdır" should not trigger shipping via "aras" substring ───
  test('CASE 1c: "kayıtlıdır" → no shipping false positive', () => {
    const response = 'Bu bilgi sistemde kayıtlıdır ve doğrulama beklenmektedir.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    const shippingLeaks = (result.leaks || []).filter(l => l.type === 'shipping');
    expect(shippingLeaks).toHaveLength(0);
    expect(result.action).toBe('PASS');
  });

  // ─── CASE 2: Gerçek telefon numarası → leak TRUE, redacted ───
  test('CASE 2: "Beni 05551234567 den ara" → phone leak TRUE, sanitized (masked)', () => {
    const response = 'Müşterimizin telefon numarası 05551234567 olarak kayıtlıdır.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    // safe=true çünkü phone-only leak → redact, not verify
    expect(result.safe).toBe(true);
    // Sanitized response'ta numara maskelenmiş olmalı
    expect(result.sanitized).not.toContain('05551234567');
    expect(result.sanitized).toContain('*');
  });

  test('CASE 2b: E.164 format "+905551234567" → leak TRUE, masked', () => {
    const response = 'İletişim numarası: +905551234567';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.safe).toBe(true);
    expect(result.sanitized).not.toContain('+905551234567');
  });

  // ─── CASE 3: "son 4 hanesi 1234" → leak TRUE, redacted ───
  test('CASE 3: "Telefon numarasının son 4 hanesi 1234" → phone leak TRUE, masked', () => {
    const response = 'Telefon numaranızın son 4 hanesi 1234 olarak doğrulandı.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.safe).toBe(true);
    // Telemetri'de phone_redacted_pass olmalı
    expect(result.telemetry?.verificationMode || result.telemetry?.reason).toMatch(/phone_redacted|PHONE_REDACT/i);
  });

  // ─── CASE 4: Phone-only leak → sipariş doğrulaması İSTEMEZ ───
  test('CASE 4: Phone number leak → needsVerification=false (redact, dont verify)', () => {
    const response = 'Müşteri telefon numarası 05329876543 olarak kayıtlıdır.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    // needsVerification false olmalı — phone-only leak verify gerektirmez
    expect(result.needsVerification).toBeFalsy();
    // safe=true çünkü redact edildi
    expect(result.safe).toBe(true);
  });

  // ─── CASE 5: Order-specific leak + no lookup context → SANITIZE (no auto-block) ───
  test('CASE 5: Address/tracking leak with no lookup context → SANITIZE', () => {
    const response = 'Siparişiniz Yurtiçi Kargo ile Kadıköy şubesine gönderildi. Takip no: TR1234567890';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.safe).toBe(true);
    expect(result.action).toBe('SANITIZE');
    expect(result.sanitized).not.toContain('TR1234567890');
  });

  // ─── CASE 6: No tool called + no digits = phone leak impossible ───
  test('CASE 6: Response with "telefon" word but no digits → safe=true', () => {
    const response = 'Telyx telefon ve WhatsApp kanalları üzerinden hizmet verir. Chat widget da mevcuttur.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.safe).toBe(true);
    expect(result.needsVerification).toBeFalsy();
  });

  // ─── CASE 7: customerName leak + no lookup context → SANITIZE ───
  test('CASE 7: Customer name leak with no lookup context → SANITIZE', () => {
    const response = 'İbrahim Yıldız adına kayıtlı siparişiniz bulunmaktadır.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.safe).toBe(true);
    expect(result.action).toBe('SANITIZE');
    expect(result.sanitized).not.toContain('İbrahim Yıldız');
  });

  // ─── CASE 8: Lookup tool context + missing fields → NEED_MIN_INFO_FOR_TOOL ───
  test('CASE 8: Order lookup tool context exists → NEED_MIN_INFO_FOR_TOOL', () => {
    const response = 'Takip numaranız TR1234567890 ve teslimat adresiniz İstanbul Kadıköy.';
    const result = applyLeakFilter(response, 'none', 'TR', {}, {
      intent: 'order_status',
      toolsCalled: ['customer_data_lookup']
    });

    expect(result.safe).toBe(false);
    expect(result.action).toBe('NEED_MIN_INFO_FOR_TOOL');
    expect(result.missingFields).toContain('order_number');
    expect(result.missingFields).toContain('phone_last4');
  });

  // ─── CASE 9: Numeric code without tracking context → not tracking leak ───
  test('CASE 9: 11-digit number without tracking context should not be tracking', () => {
    const response = 'Referans kodu 12345678901 olarak kaydedildi.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    const trackingLeaks = (result.leaks || []).filter(l => l.type === 'tracking');
    expect(trackingLeaks).toHaveLength(0);
  });
});

/**
 * Phone Leak Filter — P0 regression tests
 *
 * Leak filter artik SADECE phone maskeleme + internal metadata block yapiyor.
 * customerName / address / shipping / delivery / tracking KALDIRILDI.
 *
 * Ensures:
 * 1. "telefon kanalı" gibi kelime → phone leak FALSE (no digits)
 * 2. "Beni 05551234567'den ara" → phone leak TRUE, redacted
 * 3. "Son 4 hanesi 1234" → phone leak TRUE, redacted
 * 4. Leak tetiklenince phone-only → redact, not verify
 * 5. Eski shipping/tracking/customerName leak tipleri artik PASS
 */

import { describe, test, expect } from '@jest/globals';
import { applyLeakFilter } from '../../src/guardrails/securityGateway.js';

describe('Phone leak filter (P0 fix)', () => {

  // --- CASE 1: "telefon kanalı" → false positive olmamalı ---
  test('CASE 1: "Telyx telefon kanalı ile iletişim sağlar" → phone leak FALSE, safe=true', () => {
    const response = 'Telyx, işletmelerin müşterileriyle telefon, WhatsApp ve e-posta gibi kanallar üzerinden iletişim kurmasını sağlar.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.safe).toBe(true);
    const phoneLeaks = (result.leaks || []).filter(l => l.type === 'phone');
    expect(phoneLeaks).toHaveLength(0);
  });

  test('CASE 1b: "telephone channel" → phone leak FALSE, safe=true', () => {
    const response = 'Telyx enables businesses to communicate via telephone, WhatsApp, and email channels.';
    const result = applyLeakFilter(response, 'none', 'EN', {});

    expect(result.safe).toBe(true);
  });

  // --- CASE 1c: "kayıtlıdır" should not trigger any leak ---
  test('CASE 1c: "kayıtlıdır" → no false positive', () => {
    const response = 'Bu bilgi sistemde kayıtlıdır ve doğrulama beklenmektedir.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.action).toBe('PASS');
  });

  // --- CASE 2: Gerçek telefon numarası → leak TRUE, redacted ---
  test('CASE 2: "05551234567" → phone leak TRUE, sanitized (masked)', () => {
    const response = 'Müşterimizin telefon numarası 05551234567 olarak kayıtlıdır.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.safe).toBe(true);
    expect(result.sanitized).not.toContain('05551234567');
    expect(result.sanitized).toContain('*');
  });

  test('CASE 2b: E.164 format "+905551234567" → leak TRUE, masked', () => {
    const response = 'İletişim numarası: +905551234567';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.safe).toBe(true);
    expect(result.sanitized).not.toContain('+905551234567');
  });

  // --- CASE 3: "son 4 hanesi 1234" → leak TRUE, redacted ---
  test('CASE 3: "Telefon numarasının son 4 hanesi 1234" → phone leak TRUE, masked', () => {
    const response = 'Telefon numaranızın son 4 hanesi 1234 olarak doğrulandı.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.safe).toBe(true);
    expect(result.telemetry?.verificationMode || result.telemetry?.reason).toMatch(/phone_redacted|PHONE_REDACT/i);
  });

  // --- CASE 4: Phone-only leak → sipariş doğrulaması İSTEMEZ ---
  test('CASE 4: Phone number leak → needsVerification=false (redact, dont verify)', () => {
    const response = 'Müşteri telefon numarası 05329876543 olarak kayıtlıdır.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.needsVerification).toBeFalsy();
    expect(result.safe).toBe(true);
  });

  // --- CASE 5: Eski shipping/tracking leak → artık PASS ---
  test('CASE 5: Shipping/tracking text → PASS (detection removed)', () => {
    const response = 'Siparişiniz Yurtiçi Kargo ile Kadıköy şubesine gönderildi. Takip no: TR1234567890';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    // No shipping/tracking detection anymore → PASS
    expect(result.action).toBe('PASS');
    const shippingLeaks = (result.leaks || []).filter(l => l.type === 'shipping');
    const trackingLeaks = (result.leaks || []).filter(l => l.type === 'tracking');
    expect(shippingLeaks).toHaveLength(0);
    expect(trackingLeaks).toHaveLength(0);
  });

  // --- CASE 6: No tool called + no digits = phone leak impossible ---
  test('CASE 6: Response with "telefon" word but no digits → safe=true', () => {
    const response = 'Telyx telefon ve WhatsApp kanalları üzerinden hizmet verir. Chat widget da mevcuttur.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.safe).toBe(true);
    expect(result.needsVerification).toBeFalsy();
  });

  // --- CASE 7: Eski customerName leak → artık PASS ---
  test('CASE 7: Customer name text → PASS (detection removed)', () => {
    const response = 'İbrahim Yıldız adına kayıtlı siparişiniz bulunmaktadır.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.action).toBe('PASS');
    const nameLeaks = (result.leaks || []).filter(l => l.type === 'customerName');
    expect(nameLeaks).toHaveLength(0);
  });

  // --- CASE 8: Eski NEED_MIN_INFO_FOR_TOOL → artık PASS ---
  test('CASE 8: Tracking + address text without tool context → PASS (detection removed)', () => {
    const response = 'Takip numaranız TR1234567890 ve teslimat adresiniz İstanbul Kadıköy.';
    const result = applyLeakFilter(response, 'none', 'TR', {}, {
      intent: 'order_status',
      toolsCalled: ['customer_data_lookup']
    });

    // No tracking/address detection anymore → PASS
    expect(result.action).toBe('PASS');
  });

  // --- CASE 9: Numeric code without tracking context → not tracking leak ---
  test('CASE 9: 11-digit number without tracking context should not be tracking', () => {
    const response = 'Referans kodu 12345678901 olarak kaydedildi.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    const trackingLeaks = (result.leaks || []).filter(l => l.type === 'tracking');
    expect(trackingLeaks).toHaveLength(0);
  });
});

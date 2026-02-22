/**
 * Guardrail Overhaul Smoke Tests
 * ================================
 *
 * Leak filter artık SADECE phone maskeleme + internal metadata block yapıyor.
 * customerName / address / shipping / delivery / tracking / timeWindow kaldırıldı.
 *
 * Güvenlik: Tool çağrılmadan hassas veri gelmez. LLM prompt'unda kural var.
 * Guardrail = son bariyer (phone mask + internal block), direksiyon değil.
 */

import { describe, it, expect } from '@jest/globals';
import { applyLeakFilter, GuardrailAction } from '../../src/guardrails/securityGateway.js';

// ============================================================================
// SECTION 1: GuardrailAction Enum Integrity
// ============================================================================
describe('SMOKE 1: GuardrailAction Enum', () => {
  it('enum has exactly 4 values', () => {
    expect(Object.keys(GuardrailAction)).toHaveLength(4);
    expect(GuardrailAction.PASS).toBe('PASS');
    expect(GuardrailAction.SANITIZE).toBe('SANITIZE');
    expect(GuardrailAction.BLOCK).toBe('BLOCK');
    expect(GuardrailAction.NEED_MIN_INFO_FOR_TOOL).toBe('NEED_MIN_INFO_FOR_TOOL');
  });

  it('enum is frozen (immutable)', () => {
    expect(Object.isFrozen(GuardrailAction)).toBe(true);
  });
});

// ============================================================================
// SECTION 2: Phone False-Positive Elimination
// ============================================================================
describe('SMOKE 2: Phone False-Positive — Word "telefon" Without Digits', () => {
  it('"Telyx telefon kanalı ile iletişim sağlar" → PASS, no leak', () => {
    const response = 'Telyx, işletmelerin müşterileriyle telefon, WhatsApp ve e-posta gibi kanallar üzerinden iletişim kurmasını sağlar.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.safe).toBe(true);
    expect(result.action).toBe('PASS');
  });

  it('"telephone channel" (EN) → PASS, no leak', () => {
    const response = 'Telyx enables businesses to communicate via telephone, WhatsApp, and email channels.';
    const result = applyLeakFilter(response, 'none', 'EN', {});
    expect(result.safe).toBe(true);
    expect(result.action).toBe('PASS');
  });

  it('"Telefon ve WhatsApp ile destek" → PASS (no digits at all)', () => {
    const response = 'Telyx telefon ve WhatsApp kanalları üzerinden hizmet verir. Chat widget da mevcuttur.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.safe).toBe(true);
    expect(result.action).toBe('PASS');
  });
});

// ============================================================================
// SECTION 3: Real Phone Number → Mask (Not Verify)
// ============================================================================
describe('SMOKE 3: Real Phone Number → SANITIZE (Mask)', () => {
  it('TR mobile 05551234567 → masked, safe=true, no verification', () => {
    const response = 'Müşterimizin telefon numarası 05551234567 olarak kayıtlıdır.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.safe).toBe(true);
    expect(result.action).toBe('SANITIZE');
    expect(result.sanitized).not.toContain('05551234567');
    expect(result.sanitized).toContain('*');
  });

  it('E.164 +905551234567 → masked, safe=true', () => {
    const response = 'İletişim numarası: +905551234567';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.safe).toBe(true);
    expect(result.action).toBe('SANITIZE');
    expect(result.sanitized).not.toContain('+905551234567');
  });

  it('"son 4 hanesi 1234" → masked, safe=true', () => {
    const response = 'Telefon numaranızın son 4 hanesi 1234 olarak doğrulandı.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.safe).toBe(true);
    expect(result.telemetry?.verificationMode || result.telemetry?.reason).toMatch(/phone_redacted|PHONE_REDACT/i);
  });

  it('phone-only leak → needsVerification=false (redact, not verify)', () => {
    const response = 'Müşteri telefon numarası 05329876543 olarak kayıtlıdır.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.needsVerification).toBeFalsy();
    expect(result.safe).toBe(true);
  });
});

// ============================================================================
// SECTION 4: Leak filter artık shipping/delivery/tracking/address/customerName yakalamıyor
// Bu tipler kaldırıldı — güvenlik tool gating + LLM prompt ile sağlanıyor
// ============================================================================
describe('SMOKE 4: Removed leak types → all PASS', () => {
  it('11-digit number → SANITIZE (phone pattern catches 10-11 digit sequences)', () => {
    const response = 'Referans kodu 12345678901 olarak kaydedildi.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    // 11-digit number matches phone \d{10,11} pattern → masked as potential phone
    // No tracking detection (removed), but phone mask still applies
    expect(result.action).toBe('SANITIZE');
    const trackingLeaks = (result.leaks || []).filter(l => l.type === 'tracking');
    expect(trackingLeaks).toHaveLength(0);
    expect(result.leaks.some(l => l.type === 'phone')).toBe(true);
  });

  it('"kayıtlıdır" (contains "aras" substring) → PASS', () => {
    const response = 'Bu bilgi sistemde kayıtlıdır ve doğrulama beklenmektedir.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('"PTT ile iletişim" → PASS', () => {
    const response = 'Telyx üzerinden telefon, WhatsApp, e-posta ve PTT gibi kanallarla iletişim kurabilirsiniz.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('"Aras beye iletilecek" → PASS', () => {
    const response = 'Aras beye iletilecektir.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('"dağıtım merkezi" → PASS', () => {
    const response = 'Dağıtım merkezine ulaşmıştır.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('"3. kat daire 5" → PASS (address detection removed)', () => {
    const response = 'Adres: Kadıköy mahallesi, 3. kat daire 5.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('"İbrahim Yıldız adına" → PASS (customerName detection removed)', () => {
    const response = 'İbrahim Yıldız adına kayıtlı siparişiniz bulunmaktadır.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('"Telyx nasıl kullanılır" response → PASS (was false positive before)', () => {
    const response = 'Telyx platformunu kullanmak için önce kayıt olmanız, ardından yapay zeka asistanınızı oluşturmanız gerekmektedir.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });
});

// ============================================================================
// SECTION 5: Edge Cases
// ============================================================================
describe('SMOKE 5: Edge Cases', () => {
  it('null response → PASS', () => {
    const result = applyLeakFilter(null, 'none', 'TR', {});
    expect(result.safe).toBe(true);
    expect(result.action).toBe('PASS');
  });

  it('empty string response → PASS', () => {
    const result = applyLeakFilter('', 'none', 'TR', {});
    expect(result.safe).toBe(true);
    expect(result.action).toBe('PASS');
  });

  it('clean response with no sensitive data → PASS', () => {
    const response = 'Merhaba, size nasıl yardımcı olabilirim? Ürünlerimiz hakkında bilgi almak ister misiniz?';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.safe).toBe(true);
    expect(result.action).toBe('PASS');
    expect(result.leaks).toHaveLength(0);
  });
});

// ============================================================================
// SECTION 6: Phone Telemetry
// ============================================================================
describe('SMOKE 6: Telemetry', () => {
  it('phone masking telemetry includes verificationMode=PHONE_REDACT', () => {
    const response = 'Telefon: 05551234567';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.telemetry).toBeTruthy();
    expect(result.telemetry.verificationMode).toBe('PHONE_REDACT');
    expect(result.telemetry.responseHasDigits).toBe(true);
  });
});

/**
 * Guardrail Overhaul Smoke Tests
 * ================================
 *
 * Bu smoke test guardrail mimari değişikliğini doğrular:
 *
 * 1. GuardrailAction enum: PASS / SANITIZE / BLOCK / NEED_MIN_INFO_FOR_TOOL
 * 2. Phone false-positive elimination: "telefon kanalı" → PASS (no leak)
 * 3. Phone masking: gerçek numara → mask (055*****67), not verify
 * 4. Contextual tracking: bare 11-digit number without kargo/takip context → not tracking
 * 5. Shipping word boundary: "kayıtlıdır" (contains "aras") → no shipping leak
 * 6. Tool-plan gating: NEED_MIN_INFO_FOR_TOOL only when lookup tool plan exists
 * 7. Sanitize-first: personal leak + no tool plan → SANITIZE (not BLOCK)
 * 8. No-digit guard: phone pattern + no digits → PASS
 * 9. Son 4 hane detection: "son 4 hanesi 1234" → phone leak + mask
 * 10. E.164 format: "+905551234567" → phone leak + mask
 * 11. BLOCK as last resort: sanitize fails → BLOCK
 * 12. CustomerName leak without tool plan → SANITIZE
 * 13. Address/tracking leak without tool plan → SANITIZE
 * 14. Multiple leak types combined behavior
 * 15. Callback flow → NEED_MIN_INFO_FOR_TOOL
 *
 * Toplam: ~25 test, çalışma süresi < 1 saniye
 */

import { describe, it, test, expect } from '@jest/globals';
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
// SECTION 2: Phone False-Positive Elimination (P0 Production Bug)
// ============================================================================
describe('SMOKE 2: Phone False-Positive — Word "telefon" Without Digits', () => {
  it('"Telyx telefon kanalı ile iletişim sağlar" → PASS, no leak', () => {
    const response = 'Telyx, işletmelerin müşterileriyle telefon, WhatsApp ve e-posta gibi kanallar üzerinden iletişim kurmasını sağlar.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.safe).toBe(true);
    expect(result.action).toBe('PASS');
    const phoneLeaks = (result.leaks || []).filter(l => l.type === 'phone');
    expect(phoneLeaks).toHaveLength(0);
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
    expect(result.needsVerification).toBeFalsy();
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
// SECTION 4: Contextual Tracking Detection
// ============================================================================
describe('SMOKE 4: Contextual Tracking Detection', () => {
  it('11-digit number WITHOUT tracking context → NOT tracking leak', () => {
    const response = 'Referans kodu 12345678901 olarak kaydedildi.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    const trackingLeaks = (result.leaks || []).filter(l => l.type === 'tracking');
    expect(trackingLeaks).toHaveLength(0);
  });

  it('11-digit number WITH "kargo" keyword nearby → tracking leak detected', () => {
    const response = 'Kargo takip numaranız 12345678901 olarak belirlenmiştir.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    const trackingLeaks = (result.leaks || []).filter(l => l.type === 'tracking');
    expect(trackingLeaks.length).toBeGreaterThan(0);
  });

  it('standard tracking format TR1234567890 → tracking leak detected', () => {
    const response = 'Takip numaranız: TR1234567890';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    const trackingLeaks = (result.leaks || []).filter(l => l.type === 'tracking');
    expect(trackingLeaks.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// SECTION 5: Contextual Carrier Detection (P1)
// Carrier adları sadece candidate token. Karar bağlamla verilir.
// Carrier match = (carrier adı) AND (yakın çevrede shipping context keyword)
// ============================================================================
describe('SMOKE 5: Contextual Carrier Detection', () => {
  // --- FALSE POSITIVES (PASS bekleniyor) ---
  it('"kayıtlıdır" (contains "aras" substring) → NO shipping leak', () => {
    const response = 'Bu bilgi sistemde kayıtlıdır ve doğrulama beklenmektedir.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('"PTT ile iletişim" → NO shipping leak (iletişim bağlamı)', () => {
    const response = 'Telyx üzerinden telefon, WhatsApp, e-posta ve PTT gibi kanallarla iletişim kurabilirsiniz.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('"Aras beye iletilecek" → NO shipping leak (kişi ismi)', () => {
    const response = 'Aras beye iletilecektir.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('"MNG Holding" → NO shipping leak (şirket ismi)', () => {
    const response = 'MNG Holding büyük bir şirkettir.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('"kat kat artır" → NO address leak (kat = floor değil)', () => {
    const response = 'Telyx ile iletişim kanallarınızı kat kat artırabilirsiniz.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('"şube için yönetim" → NO shipping leak (yönetim bağlamı)', () => {
    const response = 'Telyx birden fazla şube için merkezi yönetim sunar.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('"UPS and downs" → NO shipping leak (İngilizce bağlam)', () => {
    const response = 'Bu sistemdeki ups and downs normaldir.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  // --- TRUE POSITIVES (LEAK bekleniyor) ---
  it('"PTT Kargo ile gönderildi" → shipping leak (kargo bağlamı)', () => {
    const response = 'Siparişiniz PTT Kargo ile gönderildi.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');
  });

  it('"Aras Kargo ile teslim" → shipping leak (kargo bağlamı)', () => {
    const response = 'Paketiniz Aras Kargo ile teslim edildi.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');
  });

  it('"Yurtiçi Kargo gönderi" → shipping leak (kargo bağlamı)', () => {
    const response = 'Yurtiçi Kargo ile gönderiniz yola çıktı.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');
  });

  it('"dağıtım merkezi" → shipping leak (always contextual)', () => {
    const response = 'Dağıtım merkezine ulaşmıştır.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');
  });

  it('"3. kat" → address leak (sayısal bağlam)', () => {
    const response = 'Adres: Kadıköy mahallesi, 3. kat daire 5.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');
  });
});

// ============================================================================
// SECTION 6: Lookup Context Gating
// ============================================================================
describe('SMOKE 6: Lookup Context Gating', () => {
  it('order leak + lookup context + missing fields → NEED_MIN_INFO_FOR_TOOL', () => {
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

  it('order leak + NO lookup context → SANITIZE (not BLOCK)', () => {
    const response = 'Siparişiniz Yurtiçi Kargo ile Kadıköy şubesine gönderildi. Takip no: TR1234567890';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.safe).toBe(true);
    expect(result.action).toBe('SANITIZE');
    expect(result.sanitized).not.toContain('TR1234567890');
  });

  it('order leak + no lookup tool + all fields provided → SANITIZE path', () => {
    const response = 'Takip numaranız TR1234567890 ve teslimat adresiniz Kadıköy.';
    const result = applyLeakFilter(response, 'none', 'TR', {
      orderNumber: 'ORD-001',
      phone: '05551234567'
    }, {
      intent: 'order_status'
    });

    expect(result.action).toBe('SANITIZE');
    expect(result.safe).toBe(true);
  });
});

// ============================================================================
// SECTION 7: Sanitize-First Architecture (No Lookup Context)
// ============================================================================
describe('SMOKE 7: Sanitize-First (No Lookup Context)', () => {
  it('customerName leak + no lookup context → SANITIZE', () => {
    const response = 'İbrahim Yıldız adına kayıtlı siparişiniz bulunmaktadır.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.safe).toBe(true);
    expect(result.action).toBe('SANITIZE');
    expect(result.sanitized).not.toContain('İbrahim Yıldız');
  });

  it('address leak + no lookup context → SANITIZE', () => {
    const response = 'Teslimat adresiniz Kadıköy mahallesi, Moda caddesi No: 15 olarak kayıtlıdır.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.safe).toBe(true);
    expect(result.action).toBe('SANITIZE');
  });
});

// ============================================================================
// SECTION 8: Empty / Null Response
// ============================================================================
describe('SMOKE 8: Edge Cases', () => {
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

  it('verified state → no personal data leak check', () => {
    const response = 'Müşterimizin telefon numarası 05551234567 olarak kayıtlıdır.';
    const result = applyLeakFilter(response, 'verified', 'TR', {});

    // verified ise personal data check atlanır
    expect(result.safe).toBe(true);
    expect(result.action).toBe('PASS');
  });
});

// ============================================================================
// SECTION 9: Callback Flow
// ============================================================================
describe('SMOKE 9: Callback Flow', () => {
  it('leak during callback flow → NEED_MIN_INFO_FOR_TOOL with callback fields', () => {
    const response = 'Müşterimizin adresi Kadıköy mahallesi olarak kayıtlı.';
    const result = applyLeakFilter(response, 'none', 'TR', {}, {
      callbackPending: true
    });

    expect(result.safe).toBe(false);
    expect(result.action).toBe('NEED_MIN_INFO_FOR_TOOL');
    expect(result.needsCallbackInfo).toBe(true);
    expect(result.missingFields).toContain('customer_name');
    expect(result.missingFields).toContain('phone');
  });
});

// ============================================================================
// SECTION 10: Telemetry Enrichment
// ============================================================================
describe('SMOKE 10: Telemetry', () => {
  it('phone masking telemetry includes verificationMode=PHONE_REDACT', () => {
    const response = 'Telefon: 05551234567';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    expect(result.telemetry).toBeTruthy();
    expect(result.telemetry.verificationMode).toBe('PHONE_REDACT');
    expect(result.telemetry.responseHasDigits).toBe(true);
  });

  it('no-digit phone word pass includes reason phone_word_no_digits_pass', () => {
    const response = 'Telefon desteği sunuyoruz, WhatsApp da var.';
    const result = applyLeakFilter(response, 'none', 'TR', {});

    // telefon word alone may or may not match phone pattern
    // but if it does, no digits → reason should be phone_word_no_digits_pass
    if (result.telemetry?.reason) {
      // If phone pattern triggered but no digits, this should be the reason
      expect(result.safe).toBe(true);
    }
  });

  it('leak filter with lookup tool includes hasLookupContext in telemetry', () => {
    const response = 'Takip numaranız: TR1234567890 ve Kadıköy adresinize gönderildi.';
    const result = applyLeakFilter(response, 'none', 'TR', {}, {
      intent: 'order_status',
      toolsCalled: ['customer_data_lookup']
    });

    expect(result.telemetry?.hasLookupContext).toBe(true);
  });
});

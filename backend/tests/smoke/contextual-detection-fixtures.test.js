/**
 * Contextual Detection Fixture Tests
 * ====================================
 *
 * Contextual detection (carrier, delivery, shipping, tracking, customerName)
 * KALDIRILDI. Artik leak filter sadece phone mask + internal block yapiyor.
 *
 * Bu test dosyasi:
 * - runContextualDetection stub'inin bos array dondurdugunu dogrular
 * - Eski "true positive" senaryolarin artik PASS dondurdugunu dogrular
 * - False positive'lerin zaten PASS oldugunu dogrular
 *
 * Guvenlik: Tool gating + LLM prompt ile saglaniyor, regex ile degil.
 */

import { describe, it, expect } from '@jest/globals';
import { applyLeakFilter, runContextualDetection } from '../../src/guardrails/securityGateway.js';

// ============================================================================
// runContextualDetection stub — always returns []
// ============================================================================
describe('runContextualDetection stub', () => {
  it('always returns empty array (contextual detection removed)', () => {
    const hits = runContextualDetection('Paketiniz Aras Kargo ile gönderildi.');
    expect(hits).toEqual([]);
  });

  it('returns empty array for delivery context', () => {
    const hits = runContextualDetection('Kargonuz kapıcıya teslim edildi.');
    expect(hits).toEqual([]);
  });

  it('returns empty array for tracking context', () => {
    const hits = runContextualDetection('Takip numaranız: TR1234567890');
    expect(hits).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    const hits = runContextualDetection('');
    expect(hits).toEqual([]);
  });

  it('returns empty array for no argument', () => {
    const hits = runContextualDetection();
    expect(hits).toEqual([]);
  });
});

// ============================================================================
// Eski FALSE POSITIVES — hala PASS (degismedi)
// ============================================================================
describe('Former false positives: still PASS', () => {
  it('FP-01: "veri güvenliği sağlar" → PASS', () => {
    const result = applyLeakFilter('Telyx, müşteri verilerinizin güvenliğini en üst düzeyde sağlar.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('FP-02: "yapay zeka imzalı deneyim" → PASS', () => {
    const result = applyLeakFilter('Telyx ile yapay zeka imzalı bir müşteri deneyimi yaşayın.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('FP-03: "gelişmeleri takip edin" → PASS', () => {
    const result = applyLeakFilter('Yeni özelliklerimizi takip edin ve gelişmelerden haberdar olun.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('FP-04: "PTT ile iletişim kurabilirsiniz" → PASS', () => {
    const result = applyLeakFilter('Müşterilerinize PTT, telefon ve WhatsApp gibi kanallarla ulaşabilirsiniz.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('FP-05: "Aras beye iletilecek" → PASS', () => {
    const result = applyLeakFilter('Aras beye iletilecektir.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('FP-06: "güvenlik önlemleri alınmıştır" → PASS', () => {
    const result = applyLeakFilter('Platformumuzda çeşitli güvenlik önlemleri alınmıştır.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('FP-07: "resepsiyon hizmeti sunuyoruz" → PASS', () => {
    const result = applyLeakFilter('Otelimizde 7/24 resepsiyon hizmeti sunuyoruz.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('FP-08: "komşu ülkelere hizmet" → PASS', () => {
    const result = applyLeakFilter('Telyx, Türkiye ve komşu ülkelere hizmet vermektedir.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('FP-09: "MNG Holding büyük şirket" → PASS', () => {
    const result = applyLeakFilter('MNG Holding, Türkiye\'nin en büyük holdinglerinden biridir.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('FP-10: "anlaşmayı imzaladık" → PASS', () => {
    const result = applyLeakFilter('Yeni iş ortağımızla anlaşmayı imzaladık ve çalışmaya başlıyoruz.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });
});

// ============================================================================
// Eski TRUE POSITIVES — artik hepsi PASS (contextual detection kaldirildi)
// Guvenlik: tool gating + LLM prompt ile saglaniyor
// ============================================================================
describe('Former true positives: now PASS (detection removed)', () => {
  it('TP-01: "kapıcıya teslim edildi" → PASS', () => {
    const result = applyLeakFilter('Paketiniz kapıcıya teslim edildi.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('TP-02: "güvenliğe bırakıldı" → PASS', () => {
    const result = applyLeakFilter('Kargonuz güvenliğe bırakıldı.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('TP-03: "imza ile teslim alındı" → PASS', () => {
    const result = applyLeakFilter('Paketiniz imza ile teslim alındı.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('TP-04: "Aras Kargo ile gönderildi" → PASS', () => {
    const result = applyLeakFilter('Siparişiniz Aras Kargo ile gönderildi.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('TP-05: "Takip numaranız: TR1234567890" → PASS (no tracking detection)', () => {
    const result = applyLeakFilter('Takip numaranız: TR1234567890', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('TP-06: "dağıtım merkezine ulaştı" → PASS', () => {
    const result = applyLeakFilter('Gönderiniz dağıtım merkezine ulaştı.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('TP-07: "komşunuza teslim edildi" → PASS', () => {
    const result = applyLeakFilter('Kargonuz komşunuza teslim edildi.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('TP-08: "resepsiyona bırakıldı" → PASS', () => {
    const result = applyLeakFilter('Paketiniz resepsiyona bırakıldı.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  it('TP-09: "kargo takip no 12345678901" → no tracking leak (phone mask may apply)', () => {
    const result = applyLeakFilter('Kargo takip numaranız 12345678901 olarak belirlenmiştir.', 'none', 'TR', {});
    // 11-digit number will match phone pattern → SANITIZE (phone masking)
    // But it won't be tracking detection
    const trackingLeaks = (result.leaks || []).filter(l => l.type === 'tracking');
    expect(trackingLeaks).toHaveLength(0);
  });

  it('TP-10: "Yurtiçi Kargo ile teslimat" → PASS', () => {
    const result = applyLeakFilter('Yurtiçi Kargo ile teslimat yapılacaktır.', 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });
});

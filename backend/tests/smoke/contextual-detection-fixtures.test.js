/**
 * Contextual Detection Fixture Tests
 * ====================================
 *
 * 20 fixture test — candidate + ±80 char context window modelini doğrular.
 *
 * Kural: Candidate token tek başına ASLA SANITIZE/BLOCK üretmez.
 *        Candidate + context keyword birlikte olmalı.
 *
 * Gruplar:
 *   FP-01..FP-10 : FALSE POSITIVE — PASS bekleniyor (genel bağlam)
 *   TP-01..TP-10 : TRUE POSITIVE  — leak bekleniyor (shipping/delivery bağlamı)
 */

import { describe, it, expect } from '@jest/globals';
import { applyLeakFilter, runContextualDetection } from '../../src/guardrails/securityGateway.js';

// ============================================================================
// FALSE POSITIVES — PASS bekleniyor
// Candidate token var ama shipping/delivery/tracking bağlamı YOK
// ============================================================================
describe('Contextual Detection: FALSE POSITIVES (PASS)', () => {

  // FP-01: "veri güvenliği" — güvenlik kelimesi genel bağlamda
  it('FP-01: "veri güvenliği sağlar" → PASS (güvenlik = security, not delivery)', () => {
    const response = 'Telyx, müşteri verilerinizin güvenliğini en üst düzeyde sağlar.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
    // contextual detection should return empty for delivery
    const hits = runContextualDetection(response);
    const deliveryHits = hits.filter(h => h.type === 'delivery');
    expect(deliveryHits).toHaveLength(0);
  });

  // FP-02: "yapay zeka imzalı" — imza kelimesi genel bağlamda
  it('FP-02: "yapay zeka imzalı deneyim" → PASS (imza = signature metaphor)', () => {
    const response = 'Telyx ile yapay zeka imzalı bir müşteri deneyimi yaşayın.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
    const hits = runContextualDetection(response);
    const deliveryHits = hits.filter(h => h.type === 'delivery');
    expect(deliveryHits).toHaveLength(0);
  });

  // FP-03: "takip edin" — takip kelimesi fiil olarak
  it('FP-03: "gelişmeleri takip edin" → PASS (takip = follow, not tracking)', () => {
    const response = 'Yeni özelliklerimizi takip edin ve gelişmelerden haberdar olun.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  // FP-04: "PTT ile iletişim" — PTT iletişim kanalı olarak
  it('FP-04: "PTT ile iletişim kurabilirsiniz" → PASS (communication channel)', () => {
    const response = 'Müşterilerinize PTT, telefon ve WhatsApp gibi kanallarla ulaşabilirsiniz.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  // FP-05: "Aras bey" — kişi ismi
  it('FP-05: "Aras beye iletilecek" → PASS (person name, no shipping context)', () => {
    const response = 'Aras beye iletilecektir.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  // FP-06: "güvenlik önlemleri" — güvenlik = genel güvenlik
  it('FP-06: "güvenlik önlemleri alınmıştır" → PASS (security measures)', () => {
    const response = 'Platformumuzda çeşitli güvenlik önlemleri alınmıştır.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  // FP-07: "resepsiyon hizmeti" — resepsiyon otel/ofis bağlamında
  it('FP-07: "resepsiyon hizmeti sunuyoruz" → PASS (reception service)', () => {
    const response = 'Otelimizde 7/24 resepsiyon hizmeti sunuyoruz.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  // FP-08: "komşu ülkeler" — komşu genel bağlam
  it('FP-08: "komşu ülkelere hizmet" → PASS (neighbor countries)', () => {
    const response = 'Telyx, Türkiye ve komşu ülkelere hizmet vermektedir.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  // FP-09: "kapıcı yok" — kapıcı kelimesi ama teslimat bağlamı yok
  it('FP-09: "MNG Holding büyük şirket" → PASS (company reference)', () => {
    const response = 'MNG Holding, Türkiye\'nin en büyük holdinglerinden biridir.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });

  // FP-10: "imzaladık" — imza kelimesi anlaşma bağlamında
  it('FP-10: "anlaşmayı imzaladık" → PASS (signed agreement, not delivery)', () => {
    const response = 'Yeni iş ortağımızla anlaşmayı imzaladık ve çalışmaya başlıyoruz.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).toBe('PASS');
  });
});

// ============================================================================
// TRUE POSITIVES — Leak bekleniyor (SANITIZE veya BLOCK)
// Candidate token + context keyword birlikte var
// ============================================================================
describe('Contextual Detection: TRUE POSITIVES (leak detected)', () => {

  // TP-01: "kapıcıya teslim edildi" — delivery context
  it('TP-01: "kapıcıya teslim edildi" → NOT PASS (delivery leak)', () => {
    const response = 'Paketiniz kapıcıya teslim edildi.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');
    const hits = runContextualDetection(response);
    const deliveryHits = hits.filter(h => h.type === 'delivery');
    expect(deliveryHits.length).toBeGreaterThan(0);
    expect(deliveryHits[0].triggerType).toBe('delivery_context');
    expect(deliveryHits[0].candidateToken).toMatch(/kapıcı/i);
  });

  // TP-02: "güvenliğe bırakıldı" — delivery context
  it('TP-02: "güvenliğe bırakıldı" → NOT PASS (delivery leak)', () => {
    const response = 'Kargonuz güvenliğe bırakıldı.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');
    const hits = runContextualDetection(response);
    const deliveryHits = hits.filter(h => h.type === 'delivery');
    expect(deliveryHits.length).toBeGreaterThan(0);
  });

  // TP-03: "imza ile teslim alındı" — delivery context
  it('TP-03: "imza ile teslim alındı" → NOT PASS (delivery leak)', () => {
    const response = 'Paketiniz imza ile teslim alındı.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');
    const hits = runContextualDetection(response);
    const deliveryHits = hits.filter(h => h.type === 'delivery');
    expect(deliveryHits.length).toBeGreaterThan(0);
  });

  // TP-04: "Aras Kargo ile gönderildi" — carrier + shipping context
  it('TP-04: "Aras Kargo ile gönderildi" → NOT PASS (shipping leak)', () => {
    const response = 'Siparişiniz Aras Kargo ile gönderildi.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');
    const hits = runContextualDetection(response);
    const shippingHits = hits.filter(h => h.type === 'shipping');
    expect(shippingHits.length).toBeGreaterThan(0);
    expect(shippingHits[0].triggerType).toBe('carrier_context');
  });

  // TP-05: "kargo takip numarası TR1234567890" — tracking code format
  it('TP-05: "Takip numaranız: TR1234567890" → NOT PASS (tracking leak)', () => {
    const response = 'Takip numaranız: TR1234567890';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');
    const hits = runContextualDetection(response);
    const trackingHits = hits.filter(h => h.type === 'tracking');
    expect(trackingHits.length).toBeGreaterThan(0);
  });

  // TP-06: "dağıtım merkezine ulaştı" — self-contextual shipping
  it('TP-06: "dağıtım merkezine ulaştı" → NOT PASS (shipping leak)', () => {
    const response = 'Gönderiniz dağıtım merkezine ulaştı.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');
    const hits = runContextualDetection(response);
    const shippingHits = hits.filter(h => h.type === 'shipping');
    expect(shippingHits.length).toBeGreaterThan(0);
    expect(shippingHits[0].triggerType).toBe('shipping_self_contextual');
  });

  // TP-07: "komşunuza teslim edildi" — komşu + delivery context
  it('TP-07: "komşunuza teslim edildi" → NOT PASS (delivery leak)', () => {
    const response = 'Kargonuz komşunuza teslim edildi.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');
  });

  // TP-08: "resepsiyona bırakıldı" — resepsiyon + delivery context
  it('TP-08: "resepsiyona bırakıldı" → NOT PASS (delivery leak)', () => {
    const response = 'Paketiniz resepsiyona bırakıldı.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');
    const hits = runContextualDetection(response);
    const deliveryHits = hits.filter(h => h.type === 'delivery');
    expect(deliveryHits.length).toBeGreaterThan(0);
  });

  // TP-09: numeric tracking with kargo context
  it('TP-09: "kargo takip no 12345678901" → NOT PASS (numeric tracking)', () => {
    const response = 'Kargo takip numaranız 12345678901 olarak belirlenmiştir.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');
  });

  // TP-10: "Yurtiçi Kargo ile teslimat" — carrier + shipping context
  it('TP-10: "Yurtiçi Kargo ile teslimat" → NOT PASS (carrier shipping)', () => {
    const response = 'Yurtiçi Kargo ile teslimat yapılacaktır.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');
    const hits = runContextualDetection(response);
    const shippingHits = hits.filter(h => h.type === 'shipping');
    expect(shippingHits.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TELEMETRY — contextual hits include triggerType, candidateToken, contextHit
// ============================================================================
describe('Contextual Detection: Telemetry Fields', () => {
  it('carrier hit telemetry has triggerType, candidateToken, contextHit', () => {
    const response = 'Paketiniz Aras Kargo ile gönderildi.';
    const hits = runContextualDetection(response);
    const carrier = hits.find(h => h.triggerType === 'carrier_context');
    expect(carrier).toBeTruthy();
    expect(carrier.triggerType).toBe('carrier_context');
    expect(carrier.candidateToken).toMatch(/aras/i);
    expect(carrier.contextHit).toBeTruthy();
  });

  it('delivery hit telemetry has triggerType, candidateToken, contextHit', () => {
    const response = 'Kargonuz kapıcıya teslim edildi.';
    const hits = runContextualDetection(response);
    const delivery = hits.find(h => h.triggerType === 'delivery_context');
    expect(delivery).toBeTruthy();
    expect(delivery.triggerType).toBe('delivery_context');
    expect(delivery.candidateToken).toMatch(/kapıcı/i);
    expect(delivery.contextHit).toBeTruthy();
  });

  it('leak filter propagates contextual telemetry to triggeredPatterns', () => {
    const response = 'Siparişiniz PTT Kargo ile gönderildi.';
    const result = applyLeakFilter(response, 'none', 'TR', {});
    expect(result.action).not.toBe('PASS');

    const ctxLeak = (result.leaks || []).find(l => l.triggerType);
    expect(ctxLeak).toBeTruthy();
    expect(ctxLeak.triggerType).toBeTruthy();
    expect(ctxLeak.candidateToken).toBeTruthy();
    expect(ctxLeak.contextHit).toBeTruthy();
  });
});

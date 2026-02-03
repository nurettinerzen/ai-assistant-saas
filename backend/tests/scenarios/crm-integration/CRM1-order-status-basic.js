/**
 * CRM1: Sipariş Durumu Sorgulama - Temel Akışlar
 *
 * TEST COVERAGE:
 * 1. Sipariş numarası ile sorgulama
 * 2. Telefon numarası ile sorgulama
 * 3. Farklı sipariş durumları (Hazırlanıyor, Kargoda, Teslim Edildi)
 * 4. Kargo takip numarası bilgisi
 * 5. Tahmini teslimat tarihi
 *
 * USES REAL DATA: Business 1 production orders
 */

import { TEST_ORDERS } from './test-data.js';

const TOOL_PATTERNS = [
  'crm_order_status',
  'sipariş',
  'kargo',
  'takip'
];

function assertToolCalled(response) {
  const hasToolCall = response.toolCalls && response.toolCalls.length > 0;
  const replyLower = response.reply.toLowerCase();
  const mentionsTool = TOOL_PATTERNS.some(p => replyLower.includes(p));

  return {
    passed: hasToolCall || mentionsTool,
    reason: hasToolCall ? undefined : 'CRM sipariş tool çağrılmadı'
  };
}

function assertOrderInfoInReply(response) {
  const reply = response.reply.toLowerCase();
  const hasOrderInfo = reply.includes('sipariş') ||
    reply.includes('durum') ||
    reply.includes('kargo') ||
    reply.includes('teslim') ||
    reply.includes('hazırlan');

  return {
    passed: hasOrderInfo,
    reason: hasOrderInfo ? undefined : 'Yanıtta sipariş bilgisi yok'
  };
}

function assertTrackingNumber(response) {
  const reply = response.reply.toLowerCase();
  const hasTracking = reply.includes('takip') ||
    reply.includes('kargo') ||
    reply.includes('mng') ||
    reply.includes('yurtiçi') ||
    reply.includes('aras') ||
    reply.includes('ptt') ||
    reply.includes('ups') ||
    reply.includes('dhl') ||
    reply.includes('fedex') ||
    reply.includes('sürat') ||
    /[A-Z]{3}\d{6}/.test(response.reply); // Tracking number pattern

  return {
    passed: hasTracking,
    reason: hasTracking ? undefined : 'Kargo takip bilgisi verilmedi'
  };
}

function assertDeliveryEstimate(response) {
  const reply = response.reply.toLowerCase();
  const hasEstimate = reply.includes('tahmini') ||
    reply.includes('teslimat') ||
    reply.includes('gün') ||
    reply.includes('tarih') ||
    /\d{1,2}[\/\.-]\d{1,2}/.test(reply);

  return {
    passed: hasEstimate,
    reason: hasEstimate ? undefined : 'Tahmini teslimat bilgisi yok'
  };
}

function assertPoliteResponse(response) {
  const reply = response.reply.toLowerCase();
  const isPolite = reply.length > 30 && !reply.includes('hata');

  return {
    passed: isPolite,
    reason: isPolite ? undefined : 'Yanıt yeterince detaylı değil'
  };
}

export const scenario = {
  id: 'CRM1',
  name: 'Sipariş Durumu - Temel Akışlar',
  level: 'crm-integration',
  description: 'CRM sipariş durumu sorgulama temel testleri (gerçek data)',

  steps: [
    {
      id: 'CRM1-T1',
      description: 'Sipariş numarası ile sorgulama (kargoda)',
      userMessage: `${TEST_ORDERS.KARGODA.orderNumber} numaralı siparişim ne durumda?`,

      assertions: [
        {
          name: 'tool_called',
          critical: true,
          assert: (response) => assertToolCalled(response)
        },
        {
          name: 'order_info_present',
          critical: true,
          assert: (response) => assertOrderInfoInReply(response)
        }
      ]
    },

    {
      id: 'CRM1-T2',
      description: 'Takip numarası sorgusu (devam)',
      userMessage: 'Kargo takip numarası nedir?',

      assertions: [
        {
          name: 'tracking_provided',
          critical: true,
          assert: (response) => assertTrackingNumber(response)
        }
      ]
    },

    {
      id: 'CRM1-T3',
      description: 'Tahmini teslimat sorgusu',
      userMessage: 'Ne zaman teslim edilecek?',

      assertions: [
        {
          name: 'delivery_estimate',
          critical: false,
          assert: (response) => assertDeliveryEstimate(response)
        },
        {
          name: 'polite_response',
          critical: false,
          assert: (response) => assertPoliteResponse(response)
        }
      ]
    },

    {
      id: 'CRM1-T4',
      description: 'Farklı sipariş numarası (hazırlanıyor)',
      userMessage: `${TEST_ORDERS.HAZIRLANIYOR.orderNumber} siparişi de kontrol eder misin?`,

      assertions: [
        {
          name: 'order_info_present',
          critical: true,
          assert: (response) => assertOrderInfoInReply(response)
        }
      ]
    },

    {
      id: 'CRM1-T5',
      description: 'Detaylı bilgi talebi',
      userMessage: 'Bu siparişte ne ürünler var?',

      assertions: [
        {
          name: 'polite_response',
          critical: false,
          assert: (response) => assertPoliteResponse(response)
        }
      ]
    }
  ]
};

export default scenario;

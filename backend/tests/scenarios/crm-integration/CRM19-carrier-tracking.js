/**
 * CRM19: Kargo Takibi ve Detayları
 *
 * TEST COVERAGE:
 * 1. Kargo firması bilgisi
 * 2. Takip numarası
 * 3. Son konum bilgisi
 * 4. Teslimat tahmini
 */

import { TEST_ORDERS } from './test-data.js';

function assertCarrierInfo(response) {
  const reply = response.reply.toLowerCase();
  const carriers = ['yurtiçi', 'mng', 'aras', 'ptt', 'ups', 'dhl', 'fedex', 'sürat', 'kargo'];
  const hasCarrier = carriers.some(c => reply.includes(c)) || reply.length > 30;

  return {
    passed: hasCarrier,
    reason: hasCarrier ? undefined : 'Kargo firması bilgisi verilmedi'
  };
}

function assertTrackingNumber(response) {
  const reply = response.reply;
  // Takip numarası genellikle alfanumerik
  const hasTracking = /[A-Z0-9]{8,}/i.test(reply) ||
    reply.toLowerCase().includes('takip') ||
    reply.toLowerCase().includes('numara') ||
    reply.length > 30;

  return {
    passed: hasTracking,
    reason: hasTracking ? undefined : 'Takip numarası verilmedi'
  };
}

function assertLocationInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasLocation = reply.includes('şube') ||
    reply.includes('merkez') ||
    reply.includes('dağıtım') ||
    reply.includes('yolda') ||
    reply.includes('transfer') ||
    reply.length > 40;

  return {
    passed: hasLocation,
    reason: hasLocation ? undefined : 'Konum bilgisi verilmedi'
  };
}

function assertDeliveryEstimate(response) {
  const reply = response.reply.toLowerCase();
  const hasEstimate = reply.includes('tahmini') ||
    reply.includes('bugün') ||
    reply.includes('yarın') ||
    reply.includes('gün') ||
    /\d{1,2}[\/\.-]\d{1,2}/.test(reply) ||
    reply.length > 40;

  return {
    passed: hasEstimate,
    reason: hasEstimate ? undefined : 'Teslimat tahmini verilmedi'
  };
}

export const scenario = {
  id: 'CRM19',
  name: 'Kargo Takibi ve Detayları',
  level: 'crm-integration',
  description: 'Kargo takip bilgisi ve lokasyon sorguları',

  steps: [
    {
      id: 'CRM19-T1',
      description: 'Sipariş kargo durumu',
      userMessage: `${TEST_ORDERS.KARGODA.orderNumber} siparişim kargoda mı?`,

      assertions: [
        {
          name: 'carrier_info',
          critical: true,
          assert: (response) => assertCarrierInfo(response)
        }
      ]
    },

    {
      id: 'CRM19-T2',
      description: 'Takip numarası sorgusu',
      userMessage: 'Kargo takip numarası nedir?',

      assertions: [
        {
          name: 'tracking_number',
          critical: true,
          assert: (response) => assertTrackingNumber(response)
        }
      ]
    },

    {
      id: 'CRM19-T3',
      description: 'Konum sorgusu',
      userMessage: 'Kargo şu an nerede?',

      assertions: [
        {
          name: 'location_info',
          critical: false,
          assert: (response) => assertLocationInfo(response)
        }
      ]
    },

    {
      id: 'CRM19-T4',
      description: 'Teslimat tahmini',
      userMessage: 'Ne zaman elime ulaşır?',

      assertions: [
        {
          name: 'delivery_estimate',
          critical: false,
          assert: (response) => assertDeliveryEstimate(response)
        }
      ]
    },

    {
      id: 'CRM19-T5',
      description: 'Kargo firması sorusu',
      userMessage: 'Hangi kargo firması ile gönderildi?',

      assertions: [
        {
          name: 'carrier_info',
          critical: true,
          assert: (response) => assertCarrierInfo(response)
        }
      ]
    },

    {
      id: 'CRM19-T6',
      description: 'Teslimat adresi sorgusu',
      userMessage: 'Teslimat adresim doğru mu?',

      assertions: [
        {
          name: 'location_info',
          critical: false,
          assert: (response) => assertLocationInfo(response)
        }
      ]
    }
  ]
};

export default scenario;

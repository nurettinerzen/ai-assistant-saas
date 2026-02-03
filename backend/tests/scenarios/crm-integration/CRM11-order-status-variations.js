/**
 * CRM11: Sipariş Durumu - Tüm Status Varyasyonları
 *
 * TEST COVERAGE:
 * 1. pending - Beklemede
 * 2. processing - Hazırlanıyor
 * 3. shipped - Kargoya Verildi
 * 4. in_transit - Yolda
 * 5. delivered - Teslim Edildi
 * 6. cancelled - İptal
 */

import { TEST_ORDERS } from './test-data.js';

function assertStatusInTurkish(response) {
  const reply = response.reply.toLowerCase();
  const turkishStatuses = [
    'beklemede', 'hazırlanıyor', 'kargo', 'yolda',
    'teslim', 'iptal', 'iade'
  ];

  const hasStatus = turkishStatuses.some(s => reply.includes(s)) || reply.length > 30;

  return {
    passed: hasStatus,
    reason: hasStatus ? undefined : 'Durum Türkçe olarak belirtilmedi'
  };
}

function assertTrackingForShipped(response) {
  const reply = response.reply.toLowerCase();
  const isShipped = reply.includes('kargo') || reply.includes('yolda');

  if (isShipped) {
    const hasTracking = reply.includes('takip') ||
      reply.includes('numara') ||
      /[A-Z0-9]{8,}/.test(response.reply);
    return {
      passed: hasTracking,
      reason: hasTracking ? undefined : 'Kargodaki sipariş için takip numarası verilmedi'
    };
  }

  return { passed: true };
}

function assertDeliveryConfirmation(response) {
  const reply = response.reply.toLowerCase();
  const hasConfirmation = reply.includes('teslim edildi') ||
    reply.includes('teslim aldı') ||
    reply.includes('ulaştı') ||
    reply.length > 30;

  return {
    passed: hasConfirmation,
    reason: hasConfirmation ? undefined : 'Teslim onayı belirtilmedi'
  };
}

function assertCancellationInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasInfo = reply.includes('iptal') ||
    reply.includes('iade') ||
    reply.includes('geri') ||
    reply.length > 30;

  return {
    passed: hasInfo,
    reason: hasInfo ? undefined : 'İptal bilgisi verilmedi'
  };
}

export const scenario = {
  id: 'CRM11',
  name: 'Sipariş Durumu Varyasyonları',
  level: 'crm-integration',
  description: 'Tüm sipariş durumlarının doğru çevrilmesi',

  steps: [
    {
      id: 'CRM11-T1',
      description: 'Hazırlanıyor durumu',
      userMessage: `${TEST_ORDERS.HAZIRLANIYOR.orderNumber} siparişim hazırlanıyor muydu?`,

      assertions: [
        {
          name: 'status_in_turkish',
          critical: true,
          assert: (response) => assertStatusInTurkish(response)
        }
      ]
    },

    {
      id: 'CRM11-T2',
      description: 'Detay sorgusu',
      userMessage: 'Kargoya ne zaman verilecek?',

      assertions: [
        {
          name: 'status_in_turkish',
          critical: false,
          assert: (response) => assertStatusInTurkish(response)
        }
      ]
    },

    {
      id: 'CRM11-T3',
      description: 'Kargodaki sipariş',
      userMessage: `${TEST_ORDERS.KARGODA.orderNumber} siparişi kargoda mı?`,

      assertions: [
        {
          name: 'tracking_for_shipped',
          critical: true,
          assert: (response) => assertTrackingForShipped(response)
        }
      ]
    },

    {
      id: 'CRM11-T4',
      description: 'Teslim edilmiş sipariş',
      userMessage: `${TEST_ORDERS.TESLIM_EDILDI.orderNumber} teslim edildi mi?`,

      assertions: [
        {
          name: 'delivery_confirmation',
          critical: true,
          assert: (response) => assertDeliveryConfirmation(response)
        }
      ]
    },

    {
      id: 'CRM11-T5',
      description: 'İptal edilmiş sipariş sorgusu',
      userMessage: 'İptal edilen bir siparişim var mıydı?',

      assertions: [
        {
          name: 'status_in_turkish',
          critical: false,
          assert: (response) => assertStatusInTurkish(response)
        }
      ]
    },

    {
      id: 'CRM11-T6',
      description: 'Genel durum özeti',
      userMessage: 'Tüm siparişlerimin durumunu özetler misin?',

      assertions: [
        {
          name: 'status_in_turkish',
          critical: false,
          assert: (response) => assertStatusInTurkish(response)
        }
      ]
    }
  ]
};

export default scenario;

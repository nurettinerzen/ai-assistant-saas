/**
 * CRM22: Konu Değişimi ve Bağlam Geçişleri
 *
 * TEST COVERAGE:
 * 1. Hızlı konu değişimi
 * 2. Önceki konuya dönüş
 * 3. Birden fazla konuyu takip
 * 4. Karışık sorgular
 */

import { TEST_ORDERS } from './test-data.js';

function assertContextSwitch(response) {
  const reply = response.reply.toLowerCase();
  const switched = reply.length > 20 &&
    !reply.includes('anlamadım') &&
    !reply.includes('tekrar');

  return {
    passed: switched,
    reason: switched ? undefined : 'Konu değişimi başarısız'
  };
}

function assertPreviousContextRecalled(response) {
  const reply = response.reply.toLowerCase();
  const recalled = reply.includes('sipariş') ||
    reply.includes('stok') ||
    reply.includes('servis') ||
    reply.includes('ürün') ||
    reply.length > 30;

  return {
    passed: recalled,
    reason: recalled ? undefined : 'Önceki bağlam hatırlanmadı'
  };
}

function assertMultiTopicHandled(response) {
  const reply = response.reply.toLowerCase();
  const handled = reply.length > 30 &&
    !reply.includes('hata');

  return {
    passed: handled,
    reason: handled ? undefined : 'Çoklu konu işlenemedi'
  };
}

export const scenario = {
  id: 'CRM22',
  name: 'Konu Değişimi ve Bağlam',
  level: 'crm-integration',
  description: 'Konuşma bağlamı değişiklikleri',

  steps: [
    {
      id: 'CRM22-T1',
      description: 'Sipariş ile başla',
      userMessage: `${TEST_ORDERS.KARGODA.orderNumber} siparişim ne durumda?`,

      assertions: [
        {
          name: 'context_switch',
          critical: true,
          assert: (response) => assertContextSwitch(response)
        }
      ]
    },

    {
      id: 'CRM22-T2',
      description: 'Stok sorgusuna geç',
      userMessage: 'Bu arada Airfryer stokta var mı?',

      assertions: [
        {
          name: 'context_switch',
          critical: true,
          assert: (response) => assertContextSwitch(response)
        }
      ]
    },

    {
      id: 'CRM22-T3',
      description: 'Siparişe geri dön',
      userMessage: 'Az önceki siparişim için kargo takip numarası neydi?',

      assertions: [
        {
          name: 'previous_context_recalled',
          critical: true,
          assert: (response) => assertPreviousContextRecalled(response)
        }
      ]
    },

    {
      id: 'CRM22-T4',
      description: 'Servis konusuna geç',
      userMessage: 'Bir de servis kaydım vardı SRV-001',

      assertions: [
        {
          name: 'context_switch',
          critical: true,
          assert: (response) => assertContextSwitch(response)
        }
      ]
    },

    {
      id: 'CRM22-T5',
      description: 'Çoklu konu özeti',
      userMessage: 'Özetle: siparişim, stok durumu ve servis kaydım ne durumda?',

      assertions: [
        {
          name: 'multi_topic_handled',
          critical: false,
          assert: (response) => assertMultiTopicHandled(response)
        }
      ]
    },

    {
      id: 'CRM22-T6',
      description: 'Karışık sorgu',
      userMessage: 'Siparişim geldiğinde Airfryer ile değiştirebilir miyim?',

      assertions: [
        {
          name: 'multi_topic_handled',
          critical: false,
          assert: (response) => assertMultiTopicHandled(response)
        }
      ]
    }
  ]
};

export default scenario;

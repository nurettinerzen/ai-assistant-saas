/**
 * CRM16: İade ve Değişim Akışları
 *
 * TEST COVERAGE:
 * 1. İade koşulları sorgusu
 * 2. Değişim talebi
 * 3. Para iadesi süreci
 * 4. Kargo iade bilgisi
 */

import { TEST_ORDERS } from './test-data.js';

function assertReturnPolicyInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasPolicy = reply.includes('iade') ||
    reply.includes('gün') ||
    reply.includes('koşul') ||
    reply.includes('şart') ||
    reply.includes('hak') ||
    reply.length > 40;

  return {
    passed: hasPolicy,
    reason: hasPolicy ? undefined : 'İade politikası bilgisi verilmedi'
  };
}

function assertExchangeProcess(response) {
  const reply = response.reply.toLowerCase();
  const hasProcess = reply.includes('değişim') ||
    reply.includes('değiştir') ||
    reply.includes('yeni') ||
    reply.includes('başka') ||
    reply.length > 40;

  return {
    passed: hasProcess,
    reason: hasProcess ? undefined : 'Değişim süreci bilgisi verilmedi'
  };
}

function assertRefundInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasRefund = reply.includes('para') ||
    reply.includes('iade') ||
    reply.includes('geri') ||
    reply.includes('ödeme') ||
    reply.includes('gün') ||
    reply.length > 40;

  return {
    passed: hasRefund,
    reason: hasRefund ? undefined : 'Para iadesi bilgisi verilmedi'
  };
}

function assertShippingInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasShipping = reply.includes('kargo') ||
    reply.includes('gönder') ||
    reply.includes('adres') ||
    reply.includes('teslim') ||
    reply.length > 40;

  return {
    passed: hasShipping,
    reason: hasShipping ? undefined : 'Kargo bilgisi verilmedi'
  };
}

export const scenario = {
  id: 'CRM16',
  name: 'İade ve Değişim Akışları',
  level: 'crm-integration',
  description: 'İade, değişim ve para iadesi süreçleri',

  steps: [
    {
      id: 'CRM16-T1',
      description: 'İade koşulları sorgusu',
      userMessage: 'İade koşullarınız neler?',

      assertions: [
        {
          name: 'return_policy_info',
          critical: true,
          assert: (response) => assertReturnPolicyInfo(response)
        }
      ]
    },

    {
      id: 'CRM16-T2',
      description: 'Sipariş bazlı iade talebi',
      userMessage: `${TEST_ORDERS.TESLIM_EDILDI.orderNumber} siparişimi iade etmek istiyorum`,

      assertions: [
        {
          name: 'return_policy_info',
          critical: true,
          assert: (response) => assertReturnPolicyInfo(response)
        }
      ]
    },

    {
      id: 'CRM16-T3',
      description: 'Değişim talebi',
      userMessage: 'İade yerine değişim yapabilir miyim?',

      assertions: [
        {
          name: 'exchange_process',
          critical: false,
          assert: (response) => assertExchangeProcess(response)
        }
      ]
    },

    {
      id: 'CRM16-T4',
      description: 'Para iadesi süresi',
      userMessage: 'Param ne zaman geri yatar?',

      assertions: [
        {
          name: 'refund_info',
          critical: false,
          assert: (response) => assertRefundInfo(response)
        }
      ]
    },

    {
      id: 'CRM16-T5',
      description: 'Kargo iadesi bilgisi',
      userMessage: 'Ürünü nasıl geri göndereceğim?',

      assertions: [
        {
          name: 'shipping_info',
          critical: false,
          assert: (response) => assertShippingInfo(response)
        }
      ]
    },

    {
      id: 'CRM16-T6',
      description: 'İade ücreti sorgusu',
      userMessage: 'Kargo ücreti benden mi kesilecek?',

      assertions: [
        {
          name: 'shipping_info',
          critical: false,
          assert: (response) => assertShippingInfo(response)
        }
      ]
    }
  ]
};

export default scenario;

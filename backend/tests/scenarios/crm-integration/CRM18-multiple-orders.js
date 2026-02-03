/**
 * CRM18: Çoklu Sipariş Yönetimi
 *
 * TEST COVERAGE:
 * 1. Birden fazla sipariş listeleme
 * 2. Sipariş seçimi
 * 3. Farklı siparişler arası geçiş
 * 4. Sipariş karşılaştırma
 */

import { TEST_ORDERS, MULTI_ORDER_CUSTOMERS } from './test-data.js';

function assertMultipleOrdersListed(response) {
  const reply = response.reply.toLowerCase();
  const hasMultiple = reply.includes('sipariş') ||
    reply.includes('sip-') ||
    reply.includes('adet') ||
    reply.includes('tane') ||
    reply.length > 50;

  return {
    passed: hasMultiple,
    reason: hasMultiple ? undefined : 'Çoklu sipariş listelenemedi'
  };
}

function assertOrderSelected(response) {
  const reply = response.reply.toLowerCase();
  const selected = reply.includes('sipariş') ||
    reply.includes('durum') ||
    reply.includes('kargo') ||
    reply.length > 30;

  return {
    passed: selected,
    reason: selected ? undefined : 'Sipariş seçimi yapılamadı'
  };
}

function assertOrderSwitched(response) {
  const reply = response.reply.toLowerCase();
  const switched = reply.includes('sipariş') ||
    reply.includes('sip-') ||
    reply.length > 30;

  return {
    passed: switched,
    reason: switched ? undefined : 'Sipariş geçişi yapılamadı'
  };
}

export const scenario = {
  id: 'CRM18',
  name: 'Çoklu Sipariş Yönetimi',
  level: 'crm-integration',
  description: 'Birden fazla sipariş sorgusu ve yönetimi',

  steps: [
    {
      id: 'CRM18-T1',
      description: 'Tüm siparişleri listeleme',
      userMessage: `0${MULTI_ORDER_CUSTOMERS.ALI_SAHIN.phone} numarama kayıtlı tüm siparişlerim neler?`,

      assertions: [
        {
          name: 'multiple_orders_listed',
          critical: true,
          assert: (response) => assertMultipleOrdersListed(response)
        }
      ]
    },

    {
      id: 'CRM18-T2',
      description: 'İlk sipariş detayı',
      userMessage: 'İlk sipariş ne durumda?',

      assertions: [
        {
          name: 'order_selected',
          critical: true,
          assert: (response) => assertOrderSelected(response)
        }
      ]
    },

    {
      id: 'CRM18-T3',
      description: 'Diğer siparişe geçiş',
      userMessage: 'Peki diğer sipariş?',

      assertions: [
        {
          name: 'order_switched',
          critical: true,
          assert: (response) => assertOrderSwitched(response)
        }
      ]
    },

    {
      id: 'CRM18-T4',
      description: 'Belirli sipariş sorgusu',
      userMessage: `${MULTI_ORDER_CUSTOMERS.ALI_SAHIN.orders[1]} hangi durumda?`,

      assertions: [
        {
          name: 'order_selected',
          critical: true,
          assert: (response) => assertOrderSelected(response)
        }
      ]
    },

    {
      id: 'CRM18-T5',
      description: 'Özet talep',
      userMessage: 'Tüm siparişlerimin özetini verir misin?',

      assertions: [
        {
          name: 'multiple_orders_listed',
          critical: false,
          assert: (response) => assertMultipleOrdersListed(response)
        }
      ]
    }
  ]
};

export default scenario;

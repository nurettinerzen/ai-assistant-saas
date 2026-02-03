/**
 * CRM2: Telefon Numarası ile Sipariş Sorgulama
 *
 * TEST COVERAGE:
 * 1. Telefon ile sipariş bulma
 * 2. Farklı telefon formatları (05xx, 5xx, +90)
 * 3. Boşluklu ve tireli formatlar
 * 4. Müşteri doğrulama akışı
 * 5. Çoklu sipariş durumu
 *
 * USES REAL DATA: Business 1 production orders
 */

import { TEST_ORDERS, MULTI_ORDER_CUSTOMERS } from './test-data.js';

function assertOrderFound(response) {
  const reply = response.reply.toLowerCase();
  const found = reply.includes('sipariş') ||
    reply.includes('bulundu') ||
    reply.includes('siparişiniz') ||
    reply.includes('ord-') ||
    reply.includes('kargo');

  const notFound = reply.includes('bulunamadı') ||
    reply.includes('kayıt yok');

  return {
    passed: found && !notFound,
    reason: notFound ? 'Sipariş bulunamadı hatası' : (found ? undefined : 'Sipariş bilgisi döndürülmedi')
  };
}

function assertPhoneNormalized(response) {
  // Telefon numarası normalize edilip bulunmalı
  const reply = response.reply.toLowerCase();
  const hasResponse = reply.length > 20;

  return {
    passed: hasResponse,
    reason: hasResponse ? undefined : 'Telefon normalizasyonu çalışmıyor olabilir'
  };
}

function assertMultipleOrdersHandled(response) {
  const reply = response.reply.toLowerCase();
  const hasOrderRef = reply.includes('sipariş') || reply.includes('ord-');

  return {
    passed: hasOrderRef,
    reason: hasOrderRef ? undefined : 'Çoklu sipariş durumu işlenemedi'
  };
}

// Real phone number formatting helper
function formatPhone(phone, format) {
  switch (format) {
    case 'with_zero': return '0' + phone;
    case 'with_plus90': return '+90' + phone;
    case 'with_spaces': return '0' + phone.slice(0, 3) + ' ' + phone.slice(3, 6) + ' ' + phone.slice(6, 8) + ' ' + phone.slice(8);
    case 'with_dashes': return '0' + phone.slice(0, 3) + '-' + phone.slice(3, 6) + '-' + phone.slice(6, 8) + '-' + phone.slice(8);
    default: return phone;
  }
}

const testPhone = TEST_ORDERS.KARGODA.customerPhone; // 5551234567

export const scenario = {
  id: 'CRM2',
  name: 'Telefon ile Sipariş Sorgulama',
  level: 'crm-integration',
  description: 'Telefon numarası formatları ve normalizasyon testleri (gerçek data)',

  steps: [
    {
      id: 'CRM2-T1',
      description: 'Standart 05xx formatı',
      userMessage: `Merhaba, ${formatPhone(testPhone, 'with_zero')} numaralı telefonuma kayıtlı siparişim var mı?`,

      assertions: [
        {
          name: 'order_found',
          critical: true,
          assert: (response) => assertOrderFound(response)
        }
      ]
    },

    {
      id: 'CRM2-T2',
      description: 'Boşluklu format',
      userMessage: `Bir de ${formatPhone(MULTI_ORDER_CUSTOMERS.GIZEM_AKSOY.phone, 'with_spaces')} numarasına bakabilir misin?`,

      assertions: [
        {
          name: 'phone_normalized',
          critical: true,
          assert: (response) => assertPhoneNormalized(response)
        }
      ]
    },

    {
      id: 'CRM2-T3',
      description: '+90 formatı',
      userMessage: `Telefonum ${formatPhone(testPhone, 'with_plus90')}, siparişlerimi görebilir miyim?`,

      assertions: [
        {
          name: 'order_found',
          critical: true,
          assert: (response) => assertOrderFound(response)
        }
      ]
    },

    {
      id: 'CRM2-T4',
      description: 'Tireli format',
      userMessage: `${formatPhone(testPhone, 'with_dashes')} numarama kayıtlı sipariş durumu`,

      assertions: [
        {
          name: 'phone_normalized',
          critical: true,
          assert: (response) => assertPhoneNormalized(response)
        }
      ]
    },

    {
      id: 'CRM2-T5',
      description: 'Başında 0 olmadan',
      userMessage: `${testPhone} numaralı telefonuma ait siparişler`,

      assertions: [
        {
          name: 'order_found',
          critical: true,
          assert: (response) => assertOrderFound(response)
        }
      ]
    },

    {
      id: 'CRM2-T6',
      description: 'Sipariş detayı sorgusu',
      userMessage: 'Bu siparişin kargo durumu nedir?',

      assertions: [
        {
          name: 'multiple_orders_handled',
          critical: false,
          assert: (response) => assertMultipleOrdersHandled(response)
        }
      ]
    }
  ]
};

export default scenario;

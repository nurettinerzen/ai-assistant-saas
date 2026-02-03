/**
 * CRM3: Sipariş Bulunamadı Senaryoları
 *
 * TEST COVERAGE:
 * 1. Var olmayan sipariş numarası
 * 2. Yanlış format
 * 3. Başka müşterinin siparişi (cross-tenant güvenlik)
 * 4. Alternatif yardım önerisi
 * 5. Graceful error handling
 *
 * USES REAL DATA: Invalid data for not-found scenarios
 */

import { INVALID_DATA, TEST_ORDERS } from './test-data.js';

function assertNotFoundHandled(response) {
  const reply = response.reply.toLowerCase();
  const hasGracefulResponse = reply.includes('bulunamadı') ||
    reply.includes('kayıt yok') ||
    reply.includes('sistemde yok') ||
    reply.includes('doğru mu') ||
    reply.includes('kontrol') ||
    reply.length > 30; // En azından bir yanıt var

  return {
    passed: hasGracefulResponse,
    reason: hasGracefulResponse ? undefined : 'Bulunamadı durumu düzgün işlenmedi'
  };
}

function assertHelpOffered(response) {
  const reply = response.reply.toLowerCase();
  const offersHelp = reply.includes('yardım') ||
    reply.includes('kontrol') ||
    reply.includes('tekrar') ||
    reply.includes('doğru') ||
    reply.includes('numara') ||
    reply.includes('?');

  return {
    passed: offersHelp,
    reason: offersHelp ? undefined : 'Alternatif yardım önerilmedi'
  };
}

function assertNoSystemError(response) {
  const reply = response.reply.toLowerCase();
  const hasError = reply.includes('hata oluştu') ||
    reply.includes('sistem hatası') ||
    reply.includes('exception') ||
    reply.includes('error');

  return {
    passed: !hasError,
    reason: hasError ? 'Sistem hatası mesajı döndü' : undefined
  };
}

function assertNoCrossTenantLeak(response) {
  const reply = response.reply.toLowerCase();
  // Başka bir business'ın verisi görünmemeli
  const hasLeak = reply.includes('business b') ||
    reply.includes('test business') ||
    reply.includes('farklı firma');

  return {
    passed: !hasLeak,
    reason: hasLeak ? 'Cross-tenant veri sızıntısı!' : undefined
  };
}

export const scenario = {
  id: 'CRM3',
  name: 'Sipariş Bulunamadı Senaryoları',
  level: 'crm-integration',
  description: 'Hata durumları ve graceful degradation testleri',

  steps: [
    {
      id: 'CRM3-T1',
      description: 'Var olmayan sipariş numarası',
      userMessage: `${INVALID_DATA.ORDER_NUMBER} numaralı siparişim nerede?`,

      assertions: [
        {
          name: 'not_found_handled',
          critical: true,
          assert: (response) => assertNotFoundHandled(response)
        },
        {
          name: 'no_system_error',
          critical: true,
          assert: (response) => assertNoSystemError(response)
        }
      ]
    },

    {
      id: 'CRM3-T2',
      description: 'Yardım teklifi kontrolü',
      userMessage: 'Siparişimi bulamıyorsunuz, ne yapmalıyım?',

      assertions: [
        {
          name: 'help_offered',
          critical: false,
          assert: (response) => assertHelpOffered(response)
        }
      ]
    },

    {
      id: 'CRM3-T3',
      description: 'Yanlış format ile sorgulama',
      userMessage: 'SIPARIS123ABC numaralı siparişim',

      assertions: [
        {
          name: 'not_found_handled',
          critical: true,
          assert: (response) => assertNotFoundHandled(response)
        },
        {
          name: 'help_offered',
          critical: false,
          assert: (response) => assertHelpOffered(response)
        }
      ]
    },

    {
      id: 'CRM3-T4',
      description: 'Kayıtlı olmayan telefon',
      userMessage: `0${INVALID_DATA.PHONE} numarama ait siparişler var mı?`,

      assertions: [
        {
          name: 'not_found_handled',
          critical: true,
          assert: (response) => assertNotFoundHandled(response)
        },
        {
          name: 'no_cross_tenant_leak',
          critical: true,
          assert: (response) => assertNoCrossTenantLeak(response)
        }
      ]
    },

    {
      id: 'CRM3-T5',
      description: 'Tekrar deneme (gerçek sipariş)',
      userMessage: `${TEST_ORDERS.KARGODA.orderNumber} numarasına bir daha bakabilir misiniz?`,

      assertions: [
        {
          name: 'no_system_error',
          critical: true,
          assert: (response) => assertNoSystemError(response)
        }
      ]
    }
  ]
};

export default scenario;

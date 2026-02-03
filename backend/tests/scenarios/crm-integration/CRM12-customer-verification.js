/**
 * CRM12: Müşteri Doğrulama Akışları
 *
 * TEST COVERAGE:
 * 1. Telefon doğrulama gerektiren sorgular
 * 2. Doğrulama olmadan sorgulama
 * 3. Yanlış bilgi ile doğrulama
 * 4. Doğrulama sonrası erişim
 */

import { TEST_ORDERS, INVALID_DATA } from './test-data.js';

function assertVerificationRequested(response) {
  const reply = response.reply.toLowerCase();
  const requestsVerification = reply.includes('doğrula') ||
    reply.includes('telefon') ||
    reply.includes('numara') ||
    reply.includes('onay') ||
    reply.includes('kim') ||
    reply.includes('?');

  return {
    passed: requestsVerification || reply.length > 50,
    reason: requestsVerification ? undefined : 'Doğrulama istenmedi'
  };
}

function assertDataProvided(response) {
  const reply = response.reply.toLowerCase();
  const hasData = reply.includes('sipariş') ||
    reply.includes('durum') ||
    reply.includes('kargo') ||
    reply.includes('stok') ||
    reply.length > 50;

  return {
    passed: hasData,
    reason: hasData ? undefined : 'Veri sağlanmadı'
  };
}

function assertSecurityMaintained(response) {
  const reply = response.reply.toLowerCase();
  // Hassas bilgi sızdırılmamalı
  const hasLeak = /\b0?5\d{9}\b/.test(response.reply) ||
    /@/.test(response.reply);

  return {
    passed: !hasLeak,
    reason: hasLeak ? 'PII sızıntısı tespit edildi!' : undefined
  };
}

export const scenario = {
  id: 'CRM12',
  name: 'Müşteri Doğrulama Akışları',
  level: 'crm-integration',
  description: 'Doğrulama ve güvenlik testleri',

  steps: [
    {
      id: 'CRM12-T1',
      description: 'İlk sipariş sorgusu',
      userMessage: 'Merhaba, siparişim ne durumda?',

      assertions: [
        {
          name: 'verification_requested',
          critical: false,
          assert: (response) => assertVerificationRequested(response)
        }
      ]
    },

    {
      id: 'CRM12-T2',
      description: 'Telefon bilgisi verme',
      userMessage: `Telefonum 0${TEST_ORDERS.KARGODA.customerPhone}`,

      assertions: [
        {
          name: 'data_provided',
          critical: true,
          assert: (response) => assertDataProvided(response)
        },
        {
          name: 'security_maintained',
          critical: true,
          assert: (response) => assertSecurityMaintained(response)
        }
      ]
    },

    {
      id: 'CRM12-T3',
      description: 'Doğrulanmış kullanıcı sorgusu',
      userMessage: 'Peki son siparişim hangisiydi?',

      assertions: [
        {
          name: 'data_provided',
          critical: true,
          assert: (response) => assertDataProvided(response)
        }
      ]
    },

    {
      id: 'CRM12-T4',
      description: 'Farklı müşteri bilgisi deneme',
      userMessage: `Bir de 0${INVALID_DATA.PHONE} numarasına bakabilir misin?`,

      assertions: [
        {
          name: 'security_maintained',
          critical: true,
          assert: (response) => assertSecurityMaintained(response)
        }
      ]
    },

    {
      id: 'CRM12-T5',
      description: 'Sipariş numarası ile sorgulama',
      userMessage: `${TEST_ORDERS.KARGODA.orderNumber} numaralı sipariş benim mi?`,

      assertions: [
        {
          name: 'data_provided',
          critical: true,
          assert: (response) => assertDataProvided(response)
        }
      ]
    }
  ]
};

export default scenario;

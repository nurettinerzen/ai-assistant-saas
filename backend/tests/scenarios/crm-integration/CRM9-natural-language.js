/**
 * CRM9: Doğal Dil Sorguları
 *
 * TEST COVERAGE:
 * 1. Resmi olmayan dil ile sorgulama
 * 2. Kısa ve eksik cümleler
 * 3. Argo/günlük dil
 * 4. Emojili mesajlar
 * 5. Yazım hataları
 */

import { TEST_ORDERS } from './test-data.js';

function assertUnderstood(response) {
  const reply = response.reply.toLowerCase();
  const understood = reply.includes('sipariş') ||
    reply.includes('stok') ||
    reply.includes('servis') ||
    reply.includes('yardım') ||
    reply.includes('durum') ||
    reply.length > 30;

  const notUnderstood = reply.includes('anlamadım') ||
    reply.includes('açıklar mısın') ||
    (reply.includes('ne demek') && reply.length < 50);

  return {
    passed: understood && !notUnderstood,
    reason: notUnderstood ? 'Doğal dil anlaşılamadı' : undefined
  };
}

function assertHelpful(response) {
  const reply = response.reply.toLowerCase();
  const isHelpful = reply.length > 20 &&
    (reply.includes('?') || reply.includes('.'));

  return {
    passed: isHelpful,
    reason: isHelpful ? undefined : 'Yanıt yeterince yardımcı değil'
  };
}

function assertTypoTolerant(response) {
  const reply = response.reply.toLowerCase();
  // Yazım hatası olsa bile anlamalı
  const handled = reply.length > 30 || reply.includes('sipariş') || reply.includes('stok');

  return {
    passed: handled,
    reason: handled ? undefined : 'Yazım hatası tolere edilmedi'
  };
}

export const scenario = {
  id: 'CRM9',
  name: 'Doğal Dil Sorguları',
  level: 'crm-integration',
  description: 'Günlük dil ve resmi olmayan sorgular',

  steps: [
    {
      id: 'CRM9-T1',
      description: 'Kısa ve öz soru',
      userMessage: 'siparişim nerde?',

      assertions: [
        {
          name: 'understood',
          critical: true,
          assert: (response) => assertUnderstood(response)
        }
      ]
    },

    {
      id: 'CRM9-T2',
      description: 'Emojili mesaj',
      userMessage: 'kargom gelmedi hala 😤 noldu?',

      assertions: [
        {
          name: 'understood',
          critical: true,
          assert: (response) => assertUnderstood(response)
        },
        {
          name: 'helpful',
          critical: false,
          assert: (response) => assertHelpful(response)
        }
      ]
    },

    {
      id: 'CRM9-T3',
      description: 'Yazım hatalı sipariş',
      userMessage: `${TEST_ORDERS.KARGODA.orderNumber} siparsim ne oldu`,

      assertions: [
        {
          name: 'typo_tolerant',
          critical: true,
          assert: (response) => assertTypoTolerant(response)
        }
      ]
    },

    {
      id: 'CRM9-T4',
      description: 'Argo dil',
      userMessage: 'bi baksana kargomu naptınız ya',

      assertions: [
        {
          name: 'understood',
          critical: true,
          assert: (response) => assertUnderstood(response)
        }
      ]
    },

    {
      id: 'CRM9-T5',
      description: 'Stok sorgusu - kısa',
      userMessage: 'kulaklık var mı',

      assertions: [
        {
          name: 'understood',
          critical: true,
          assert: (response) => assertUnderstood(response)
        }
      ]
    },

    {
      id: 'CRM9-T6',
      description: 'Karmaşık cümle',
      userMessage: 'ya hani ben bi sipariş vermiştim ya o ne oldu acaba bi bakabilir misin lütfen',

      assertions: [
        {
          name: 'understood',
          critical: true,
          assert: (response) => assertUnderstood(response)
        },
        {
          name: 'helpful',
          critical: false,
          assert: (response) => assertHelpful(response)
        }
      ]
    }
  ]
};

export default scenario;

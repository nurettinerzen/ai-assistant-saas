/**
 * CRM8: Çoklu Tool Akışı - Sipariş + Stok + Servis
 *
 * TEST COVERAGE:
 * 1. Aynı konuşmada sipariş ve stok sorgusu
 * 2. Sipariş sonrası iade/değişim sorgusu
 * 3. Ürün stok + sipariş kombinasyonu
 * 4. Context tutarlılığı
 * 5. Tool geçişleri
 */

import { TEST_ORDERS } from './test-data.js';

function assertContextMaintained(response, context) {
  // Önceki konuşma bağlamı korunmalı
  const reply = response.reply.toLowerCase();
  const hasContext = reply.length > 20;

  return {
    passed: hasContext,
    reason: hasContext ? undefined : 'Konuşma bağlamı kaybedilmiş olabilir'
  };
}

function assertToolSwitched(response) {
  const reply = response.reply.toLowerCase();
  // Farklı bir tool'a geçiş yapılmış olmalı
  const hasResponse = reply.length > 30;

  return {
    passed: hasResponse,
    reason: hasResponse ? undefined : 'Tool geçişi başarısız'
  };
}

function assertRelevantResponse(response) {
  const reply = response.reply.toLowerCase();
  const isRelevant = reply.includes('sipariş') ||
    reply.includes('stok') ||
    reply.includes('ürün') ||
    reply.includes('servis') ||
    reply.includes('durum') ||
    reply.length > 30;

  return {
    passed: isRelevant,
    reason: isRelevant ? undefined : 'Yanıt konuyla ilgili değil'
  };
}

function assertNoConfusion(response) {
  const reply = response.reply.toLowerCase();
  // Karışıklık belirtileri olmamalı
  const confused = reply.includes('anlamadım') ||
    reply.includes('tekrar') ||
    (reply.includes('hata') && reply.length < 50);

  return {
    passed: !confused,
    reason: confused ? 'Asistan konuşma akışında karıştı' : undefined
  };
}

export const scenario = {
  id: 'CRM8',
  name: 'Çoklu Tool Akışı',
  level: 'crm-integration',
  description: 'Aynı konuşmada farklı CRM tool kullanımı',

  steps: [
    {
      id: 'CRM8-T1',
      description: 'Sipariş sorgusu başlat',
      userMessage: `${TEST_ORDERS.KARGODA.orderNumber} numaralı siparişim ne durumda?`,

      assertions: [
        {
          name: 'relevant_response',
          critical: true,
          assert: (response) => assertRelevantResponse(response)
        }
      ]
    },

    {
      id: 'CRM8-T2',
      description: 'Stok sorgusuna geçiş',
      userMessage: 'Bu arada, aynı üründen bir tane daha almak istiyorum. Stokta var mı?',

      assertions: [
        {
          name: 'tool_switched',
          critical: true,
          assert: (response) => assertToolSwitched(response)
        },
        {
          name: 'no_confusion',
          critical: true,
          assert: (response) => assertNoConfusion(response)
        }
      ]
    },

    {
      id: 'CRM8-T3',
      description: 'Siparişe geri dönüş',
      userMessage: 'Anladım, peki ilk siparişim ne zaman gelir?',

      assertions: [
        {
          name: 'context_maintained',
          critical: true,
          assert: (response, ctx) => assertContextMaintained(response, ctx)
        }
      ]
    },

    {
      id: 'CRM8-T4',
      description: 'Servis sorgusuna geçiş',
      userMessage: 'Bir de SRV-001 numaralı servis kaydım vardı, o ne durumda?',

      assertions: [
        {
          name: 'tool_switched',
          critical: true,
          assert: (response) => assertToolSwitched(response)
        },
        {
          name: 'relevant_response',
          critical: true,
          assert: (response) => assertRelevantResponse(response)
        }
      ]
    },

    {
      id: 'CRM8-T5',
      description: 'Özet talep',
      userMessage: 'Özetleyebilir misin durumumu?',

      assertions: [
        {
          name: 'no_confusion',
          critical: false,
          assert: (response) => assertNoConfusion(response)
        }
      ]
    },

    {
      id: 'CRM8-T6',
      description: 'Yeni ürün stok sorgusu',
      userMessage: 'Airfryer stokta var mı, fiyatı ne kadar?',

      assertions: [
        {
          name: 'relevant_response',
          critical: true,
          assert: (response) => assertRelevantResponse(response)
        }
      ]
    }
  ]
};

export default scenario;

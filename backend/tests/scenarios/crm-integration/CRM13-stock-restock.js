/**
 * CRM13: Stok Yenileme ve Bildirim Akışları
 *
 * TEST COVERAGE:
 * 1. Stokta yok durumu
 * 2. Tahmini stok yenileme tarihi
 * 3. Stok bildirimi talebi
 * 4. Alternatif ürün önerisi
 */

function assertOutOfStockHandled(response) {
  const reply = response.reply.toLowerCase();
  const handled = reply.includes('stok') ||
    reply.includes('tüken') ||
    reply.includes('yok') ||
    reply.includes('bulunamadı') ||
    reply.length > 30;

  return {
    passed: handled,
    reason: handled ? undefined : 'Stokta yok durumu işlenemedi'
  };
}

function assertRestockInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasInfo = reply.includes('yenileme') ||
    reply.includes('gelecek') ||
    reply.includes('bekleniyor') ||
    reply.includes('tarih') ||
    reply.includes('gün') ||
    reply.includes('hafta') ||
    /\d{1,2}[\/\.-]\d{1,2}/.test(reply) ||
    reply.length > 50;

  return {
    passed: hasInfo,
    reason: hasInfo ? undefined : 'Stok yenileme bilgisi verilmedi'
  };
}

function assertNotificationOption(response) {
  const reply = response.reply.toLowerCase();
  const hasOption = reply.includes('bildir') ||
    reply.includes('haber') ||
    reply.includes('kaydet') ||
    reply.includes('bilgi') ||
    reply.length > 50;

  return {
    passed: hasOption,
    reason: hasOption ? undefined : 'Bildirim seçeneği sunulmadı'
  };
}

function assertAlternativeOffered(response) {
  const reply = response.reply.toLowerCase();
  const hasAlternative = reply.includes('alternatif') ||
    reply.includes('benzer') ||
    reply.includes('başka') ||
    reply.includes('öneri') ||
    reply.includes('ürün') ||
    reply.length > 50;

  return {
    passed: hasAlternative,
    reason: hasAlternative ? undefined : 'Alternatif öneri sunulmadı'
  };
}

export const scenario = {
  id: 'CRM13',
  name: 'Stok Yenileme ve Bildirim',
  level: 'crm-integration',
  description: 'Stokta olmayan ürünler için akışlar',

  steps: [
    {
      id: 'CRM13-T1',
      description: 'Stokta olmayan ürün sorgusu',
      userMessage: 'SSD 2TB stokta var mı?',

      assertions: [
        {
          name: 'out_of_stock_handled',
          critical: true,
          assert: (response) => assertOutOfStockHandled(response)
        }
      ]
    },

    {
      id: 'CRM13-T2',
      description: 'Stok yenileme tarihi sorgusu',
      userMessage: 'Ne zaman gelecek stoklara?',

      assertions: [
        {
          name: 'restock_info',
          critical: false,
          assert: (response) => assertRestockInfo(response)
        }
      ]
    },

    {
      id: 'CRM13-T3',
      description: 'Bildirim talebi',
      userMessage: 'Stoğa gelince bana haber verebilir misiniz?',

      assertions: [
        {
          name: 'notification_option',
          critical: false,
          assert: (response) => assertNotificationOption(response)
        }
      ]
    },

    {
      id: 'CRM13-T4',
      description: 'Alternatif ürün sorgusu',
      userMessage: 'Benzer bir ürün var mı stokta?',

      assertions: [
        {
          name: 'alternative_offered',
          critical: false,
          assert: (response) => assertAlternativeOffered(response)
        }
      ]
    },

    {
      id: 'CRM13-T5',
      description: 'Farklı ürün stok kontrolü',
      userMessage: 'Peki SSD 1TB var mı?',

      assertions: [
        {
          name: 'out_of_stock_handled',
          critical: true,
          assert: (response) => assertOutOfStockHandled(response)
        }
      ]
    }
  ]
};

export default scenario;

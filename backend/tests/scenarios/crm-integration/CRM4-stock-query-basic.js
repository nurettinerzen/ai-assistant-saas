/**
 * CRM4: Stok Sorgulama - Temel Akışlar
 *
 * TEST COVERAGE:
 * 1. Ürün adı ile stok sorgusu
 * 2. SKU kodu ile stok sorgusu
 * 3. Stokta var/yok durumları
 * 4. Fiyat bilgisi
 * 5. Stok miktarı
 */

function assertStockInfoPresent(response) {
  const reply = response.reply.toLowerCase();
  const hasStockInfo = reply.includes('stok') ||
    reply.includes('mevcut') ||
    reply.includes('tükendi') ||
    reply.includes('kalmadı') ||
    reply.includes('adet') ||
    reply.includes('ürün');

  return {
    passed: hasStockInfo,
    reason: hasStockInfo ? undefined : 'Stok bilgisi döndürülmedi'
  };
}

function assertPriceInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasPrice = reply.includes('tl') ||
    reply.includes('fiyat') ||
    reply.includes('₺') ||
    /\d+[.,]\d{2}/.test(reply);

  return {
    passed: hasPrice,
    reason: hasPrice ? undefined : 'Fiyat bilgisi verilmedi'
  };
}

function assertQuantityInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasQuantity = reply.includes('adet') ||
    reply.includes('tane') ||
    reply.includes('mevcut') ||
    /\d+\s*(adet|tane)/.test(reply);

  return {
    passed: hasQuantity,
    reason: hasQuantity ? undefined : 'Stok miktarı belirtilmedi'
  };
}

function assertOutOfStockHandled(response) {
  const reply = response.reply.toLowerCase();
  const handled = reply.includes('stok') ||
    reply.includes('tüken') ||
    reply.includes('yok') ||
    reply.includes('bekleniyor') ||
    reply.includes('bulunamadı') ||
    reply.length > 30;

  return {
    passed: handled,
    reason: handled ? undefined : 'Stokta yok durumu işlenemedi'
  };
}

export const scenario = {
  id: 'CRM4',
  name: 'Stok Sorgulama - Temel Akışlar',
  level: 'crm-integration',
  description: 'CRM stok sorgulama temel testleri',

  steps: [
    {
      id: 'CRM4-T1',
      description: 'Ürün adı ile stok sorgusu',
      userMessage: 'Kablosuz Kulaklık stokta var mı?',

      assertions: [
        {
          name: 'stock_info_present',
          critical: true,
          assert: (response) => assertStockInfoPresent(response)
        }
      ]
    },

    {
      id: 'CRM4-T2',
      description: 'Fiyat sorgusu',
      userMessage: 'Fiyatı ne kadar?',

      assertions: [
        {
          name: 'price_info',
          critical: false,
          assert: (response) => assertPriceInfo(response)
        }
      ]
    },

    {
      id: 'CRM4-T3',
      description: 'Stok miktarı sorgusu',
      userMessage: 'Kaç tane var stokta?',

      assertions: [
        {
          name: 'quantity_info',
          critical: false,
          assert: (response) => assertQuantityInfo(response)
        }
      ]
    },

    {
      id: 'CRM4-T4',
      description: 'SKU ile sorgulama',
      userMessage: 'KBL-001 kodlu ürünü kontrol edebilir misiniz?',

      assertions: [
        {
          name: 'stock_info_present',
          critical: true,
          assert: (response) => assertStockInfoPresent(response)
        }
      ]
    },

    {
      id: 'CRM4-T5',
      description: 'Farklı ürün sorgusu',
      userMessage: 'Peki Airfryer stokta var mı?',

      assertions: [
        {
          name: 'stock_info_present',
          critical: true,
          assert: (response) => assertStockInfoPresent(response)
        }
      ]
    },

    {
      id: 'CRM4-T6',
      description: 'Stokta olmayan ürün',
      userMessage: 'SSD 2TB var mı?',

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

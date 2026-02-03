/**
 * CRM15: Satın Alma Öncesi Akış
 *
 * TEST COVERAGE:
 * 1. Ürün bilgisi sorgusu
 * 2. Stok ve fiyat kontrolü
 * 3. Karşılaştırma sorgusu
 * 4. Satın alma yönlendirme
 * 5. Kampanya/indirim sorgusu
 */

function assertProductInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasInfo = reply.includes('ürün') ||
    reply.includes('özellik') ||
    reply.includes('bilgi') ||
    reply.includes('fiyat') ||
    reply.includes('stok') ||
    reply.length > 30;

  return {
    passed: hasInfo,
    reason: hasInfo ? undefined : 'Ürün bilgisi verilmedi'
  };
}

function assertPriceInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasPrice = reply.includes('tl') ||
    reply.includes('fiyat') ||
    reply.includes('₺') ||
    /\d+[.,]\d{2}/.test(reply) ||
    reply.length > 40;

  return {
    passed: hasPrice,
    reason: hasPrice ? undefined : 'Fiyat bilgisi verilmedi'
  };
}

function assertComparisonHelp(response) {
  const reply = response.reply.toLowerCase();
  const hasComparison = reply.includes('fark') ||
    reply.includes('karşılaştır') ||
    reply.includes('iki') ||
    reply.includes('vs') ||
    reply.includes('hem') ||
    reply.length > 50;

  return {
    passed: hasComparison,
    reason: hasComparison ? undefined : 'Karşılaştırma yardımı sağlanmadı'
  };
}

function assertPurchaseGuidance(response) {
  const reply = response.reply.toLowerCase();
  const hasGuidance = reply.includes('sipariş') ||
    reply.includes('satın al') ||
    reply.includes('sepet') ||
    reply.includes('site') ||
    reply.includes('yardım') ||
    reply.includes('?') ||
    reply.length > 40;

  return {
    passed: hasGuidance,
    reason: hasGuidance ? undefined : 'Satın alma yönlendirmesi yapılmadı'
  };
}

function assertDiscountInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasDiscount = reply.includes('indirim') ||
    reply.includes('kampanya') ||
    reply.includes('fırsat') ||
    reply.includes('özel') ||
    reply.includes('%') ||
    reply.length > 40;

  return {
    passed: hasDiscount,
    reason: hasDiscount ? undefined : 'İndirim bilgisi verilmedi'
  };
}

export const scenario = {
  id: 'CRM15',
  name: 'Satın Alma Öncesi Akış',
  level: 'crm-integration',
  description: 'Ürün araştırma ve satın alma yönlendirme',

  steps: [
    {
      id: 'CRM15-T1',
      description: 'Ürün bilgisi sorgusu',
      userMessage: 'Kablosuz Kulaklık hakkında bilgi alabilir miyim?',

      assertions: [
        {
          name: 'product_info',
          critical: true,
          assert: (response) => assertProductInfo(response)
        }
      ]
    },

    {
      id: 'CRM15-T2',
      description: 'Fiyat sorgusu',
      userMessage: 'Fiyatı ne kadar?',

      assertions: [
        {
          name: 'price_info',
          critical: true,
          assert: (response) => assertPriceInfo(response)
        }
      ]
    },

    {
      id: 'CRM15-T3',
      description: 'Stok durumu',
      userMessage: 'Stokta var mı?',

      assertions: [
        {
          name: 'product_info',
          critical: true,
          assert: (response) => assertProductInfo(response)
        }
      ]
    },

    {
      id: 'CRM15-T4',
      description: 'Karşılaştırma talebi',
      userMessage: 'Airfryer ile karşılaştırır mısın?',

      assertions: [
        {
          name: 'comparison_help',
          critical: false,
          assert: (response) => assertComparisonHelp(response)
        }
      ]
    },

    {
      id: 'CRM15-T5',
      description: 'İndirim sorgusu',
      userMessage: 'Şu an bir indirim veya kampanya var mı?',

      assertions: [
        {
          name: 'discount_info',
          critical: false,
          assert: (response) => assertDiscountInfo(response)
        }
      ]
    },

    {
      id: 'CRM15-T6',
      description: 'Satın alma talebi',
      userMessage: 'Nasıl sipariş verebilirim?',

      assertions: [
        {
          name: 'purchase_guidance',
          critical: false,
          assert: (response) => assertPurchaseGuidance(response)
        }
      ]
    }
  ]
};

export default scenario;

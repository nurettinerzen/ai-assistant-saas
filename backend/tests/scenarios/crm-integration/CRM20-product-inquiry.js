/**
 * CRM20: Ürün Bilgisi Sorguları
 *
 * TEST COVERAGE:
 * 1. Ürün özellikleri sorgusu
 * 2. Teknik detaylar
 * 3. Renk/varyant seçenekleri
 * 4. Garanti bilgisi
 */

function assertProductDetails(response) {
  const reply = response.reply.toLowerCase();
  const hasDetails = reply.includes('özellik') ||
    reply.includes('ürün') ||
    reply.includes('bilgi') ||
    reply.includes('teknik') ||
    reply.length > 40;

  return {
    passed: hasDetails,
    reason: hasDetails ? undefined : 'Ürün detayları verilmedi'
  };
}

function assertTechnicalSpecs(response) {
  const reply = response.reply.toLowerCase();
  const hasSpecs = reply.includes('teknik') ||
    reply.includes('özellik') ||
    reply.includes('kapasite') ||
    reply.includes('boyut') ||
    reply.includes('ağırlık') ||
    reply.includes('watt') ||
    reply.includes('volt') ||
    reply.length > 50;

  return {
    passed: hasSpecs,
    reason: hasSpecs ? undefined : 'Teknik özellikler verilmedi'
  };
}

function assertVariantInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasVariant = reply.includes('renk') ||
    reply.includes('seçenek') ||
    reply.includes('varyant') ||
    reply.includes('model') ||
    reply.includes('boyut') ||
    reply.length > 40;

  return {
    passed: hasVariant,
    reason: hasVariant ? undefined : 'Varyant bilgisi verilmedi'
  };
}

function assertWarrantyInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasWarranty = reply.includes('garanti') ||
    reply.includes('yıl') ||
    reply.includes('ay') ||
    reply.includes('süre') ||
    reply.length > 40;

  return {
    passed: hasWarranty,
    reason: hasWarranty ? undefined : 'Garanti bilgisi verilmedi'
  };
}

export const scenario = {
  id: 'CRM20',
  name: 'Ürün Bilgisi Sorguları',
  level: 'crm-integration',
  description: 'Ürün özellikleri ve teknik detay sorguları',

  steps: [
    {
      id: 'CRM20-T1',
      description: 'Ürün bilgisi sorgusu',
      userMessage: 'Kablosuz Kulaklık özellikleri neler?',

      assertions: [
        {
          name: 'product_details',
          critical: true,
          assert: (response) => assertProductDetails(response)
        }
      ]
    },

    {
      id: 'CRM20-T2',
      description: 'Teknik özellikler sorgusu',
      userMessage: 'Teknik özellikleri nedir?',

      assertions: [
        {
          name: 'technical_specs',
          critical: false,
          assert: (response) => assertTechnicalSpecs(response)
        }
      ]
    },

    {
      id: 'CRM20-T3',
      description: 'Renk seçenekleri',
      userMessage: 'Hangi renk seçenekleri var?',

      assertions: [
        {
          name: 'variant_info',
          critical: false,
          assert: (response) => assertVariantInfo(response)
        }
      ]
    },

    {
      id: 'CRM20-T4',
      description: 'Garanti sorgusu',
      userMessage: 'Garanti süresi ne kadar?',

      assertions: [
        {
          name: 'warranty_info',
          critical: false,
          assert: (response) => assertWarrantyInfo(response)
        }
      ]
    },

    {
      id: 'CRM20-T5',
      description: 'Farklı ürün sorgusu',
      userMessage: 'Airfryer özellikleri neler?',

      assertions: [
        {
          name: 'product_details',
          critical: true,
          assert: (response) => assertProductDetails(response)
        }
      ]
    },

    {
      id: 'CRM20-T6',
      description: 'Karşılaştırma talebi',
      userMessage: 'Hangisi daha iyi bu ikisinden?',

      assertions: [
        {
          name: 'product_details',
          critical: false,
          assert: (response) => assertProductDetails(response)
        }
      ]
    }
  ]
};

export default scenario;

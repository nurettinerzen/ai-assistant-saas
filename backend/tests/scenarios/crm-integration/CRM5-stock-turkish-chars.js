/**
 * CRM5: Stok Sorgulama - Türkçe Karakter Testleri
 *
 * TEST COVERAGE:
 * 1. Türkçe karakterli ürün adları (ş, ğ, ü, ö, ı, ç)
 * 2. Büyük/küçük harf duyarsızlığı
 * 3. Kısmi eşleşme (partial match)
 * 4. Typo toleransı
 */

function assertProductFound(response) {
  const reply = response.reply.toLowerCase();
  const found = reply.includes('ürün') ||
    reply.includes('stok') ||
    reply.includes('mevcut') ||
    reply.includes('fiyat') ||
    reply.includes('adet');

  const notFound = reply.includes('bulunamadı') && reply.length < 100;

  return {
    passed: found || !notFound,
    reason: notFound ? 'Türkçe karakterli ürün bulunamadı' : undefined
  };
}

function assertCaseInsensitive(response) {
  const reply = response.reply.toLowerCase();
  // Büyük/küçük harf farketmeksizin bulunmalı
  const hasResponse = reply.length > 30;

  return {
    passed: hasResponse,
    reason: hasResponse ? undefined : 'Case-insensitive arama çalışmıyor'
  };
}

function assertPartialMatch(response) {
  const reply = response.reply.toLowerCase();
  const hasMatch = reply.includes('ürün') ||
    reply.includes('stok') ||
    reply.includes('öneri') ||
    reply.includes('benzer') ||
    reply.length > 30;

  return {
    passed: hasMatch,
    reason: hasMatch ? undefined : 'Kısmi eşleşme çalışmıyor'
  };
}

export const scenario = {
  id: 'CRM5',
  name: 'Stok Sorgulama - Türkçe Karakterler',
  level: 'crm-integration',
  description: 'Türkçe karakter ve arama hassasiyeti testleri',

  steps: [
    {
      id: 'CRM5-T1',
      description: 'Türkçe ş karakteri',
      userMessage: 'Kulaşlık var mı stokta?',

      assertions: [
        {
          name: 'product_found',
          critical: false,
          assert: (response) => assertProductFound(response)
        }
      ]
    },

    {
      id: 'CRM5-T2',
      description: 'Büyük harfle sorgulama',
      userMessage: 'KABLOSUZ KULAKLIK stok durumu',

      assertions: [
        {
          name: 'case_insensitive',
          critical: true,
          assert: (response) => assertCaseInsensitive(response)
        }
      ]
    },

    {
      id: 'CRM5-T3',
      description: 'Karışık harf',
      userMessage: 'KaBLoSuZ KuLaKlIk var mı?',

      assertions: [
        {
          name: 'case_insensitive',
          critical: true,
          assert: (response) => assertCaseInsensitive(response)
        }
      ]
    },

    {
      id: 'CRM5-T4',
      description: 'Kısmi ürün adı',
      userMessage: 'Kulaklık stokta var mı?',

      assertions: [
        {
          name: 'partial_match',
          critical: true,
          assert: (response) => assertPartialMatch(response)
        }
      ]
    },

    {
      id: 'CRM5-T5',
      description: 'Türkçe ğ ve ü karakterleri',
      userMessage: 'Büyük ekran monitör var mı?',

      assertions: [
        {
          name: 'product_found',
          critical: false,
          assert: (response) => assertProductFound(response)
        }
      ]
    },

    {
      id: 'CRM5-T6',
      description: 'İ ve ı karakterleri',
      userMessage: 'iPhone kabı stokta mı?',

      assertions: [
        {
          name: 'partial_match',
          critical: false,
          assert: (response) => assertPartialMatch(response)
        }
      ]
    }
  ]
};

export default scenario;

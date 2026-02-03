/**
 * CRM6: Servis/Tamir Takibi - Temel Akışlar
 *
 * TEST COVERAGE:
 * 1. Servis numarası ile sorgulama
 * 2. Telefon ile servis kaydı bulma
 * 3. Farklı servis durumları
 * 4. Tahmini tamamlanma tarihi
 * 5. Maliyet bilgisi
 */

function assertTicketInfoPresent(response) {
  const reply = response.reply.toLowerCase();
  const hasTicketInfo = reply.includes('servis') ||
    reply.includes('tamir') ||
    reply.includes('arıza') ||
    reply.includes('durum') ||
    reply.includes('kayıt') ||
    reply.includes('ticket');

  return {
    passed: hasTicketInfo,
    reason: hasTicketInfo ? undefined : 'Servis bilgisi döndürülmedi'
  };
}

function assertStatusInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasStatus = reply.includes('beklemede') ||
    reply.includes('inceleniyor') ||
    reply.includes('tamir ediliyor') ||
    reply.includes('tamamlandı') ||
    reply.includes('hazır') ||
    reply.includes('teslim') ||
    reply.includes('parça bekleniyor') ||
    reply.includes('durum');

  return {
    passed: hasStatus,
    reason: hasStatus ? undefined : 'Servis durumu belirtilmedi'
  };
}

function assertEstimatedCompletion(response) {
  const reply = response.reply.toLowerCase();
  const hasEstimate = reply.includes('tahmini') ||
    reply.includes('tamamlan') ||
    reply.includes('hazır olacak') ||
    reply.includes('gün') ||
    reply.includes('tarih') ||
    /\d{1,2}[\/\.-]\d{1,2}/.test(reply);

  return {
    passed: hasEstimate,
    reason: hasEstimate ? undefined : 'Tahmini tamamlanma bilgisi yok'
  };
}

function assertCostInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasCost = reply.includes('maliyet') ||
    reply.includes('ücret') ||
    reply.includes('fiyat') ||
    reply.includes('tl') ||
    reply.includes('₺');

  return {
    passed: hasCost,
    reason: hasCost ? undefined : 'Maliyet bilgisi verilmedi'
  };
}

function assertProductInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasProduct = reply.includes('ürün') ||
    reply.includes('cihaz') ||
    reply.includes('telefon') ||
    reply.includes('laptop') ||
    reply.includes('bilgisayar');

  return {
    passed: hasProduct,
    reason: hasProduct ? undefined : 'Ürün bilgisi verilmedi'
  };
}

export const scenario = {
  id: 'CRM6',
  name: 'Servis Takibi - Temel Akışlar',
  level: 'crm-integration',
  description: 'CRM servis/tamir kaydı sorgulama testleri',

  steps: [
    {
      id: 'CRM6-T1',
      description: 'Servis numarası ile sorgulama',
      userMessage: 'SRV-001 numaralı servis kaydım ne durumda?',

      assertions: [
        {
          name: 'ticket_info_present',
          critical: true,
          assert: (response) => assertTicketInfoPresent(response)
        },
        {
          name: 'status_info',
          critical: true,
          assert: (response) => assertStatusInfo(response)
        }
      ]
    },

    {
      id: 'CRM6-T2',
      description: 'Hangi ürün sorgusu',
      userMessage: 'Bu hangi cihazımın tamiri?',

      assertions: [
        {
          name: 'product_info',
          critical: false,
          assert: (response) => assertProductInfo(response)
        }
      ]
    },

    {
      id: 'CRM6-T3',
      description: 'Tahmini süre sorgusu',
      userMessage: 'Ne zaman hazır olur?',

      assertions: [
        {
          name: 'estimated_completion',
          critical: false,
          assert: (response) => assertEstimatedCompletion(response)
        }
      ]
    },

    {
      id: 'CRM6-T4',
      description: 'Maliyet sorgusu',
      userMessage: 'Tamir ücreti ne kadar olacak?',

      assertions: [
        {
          name: 'cost_info',
          critical: false,
          assert: (response) => assertCostInfo(response)
        }
      ]
    },

    {
      id: 'CRM6-T5',
      description: 'Telefon ile servis sorgusu',
      userMessage: '05309876543 numarama kayıtlı servis kaydı var mı?',

      assertions: [
        {
          name: 'ticket_info_present',
          critical: true,
          assert: (response) => assertTicketInfoPresent(response)
        }
      ]
    },

    {
      id: 'CRM6-T6',
      description: 'Detaylı durum bilgisi',
      userMessage: 'Tamirde şu an ne aşamada?',

      assertions: [
        {
          name: 'status_info',
          critical: false,
          assert: (response) => assertStatusInfo(response)
        }
      ]
    }
  ]
};

export default scenario;

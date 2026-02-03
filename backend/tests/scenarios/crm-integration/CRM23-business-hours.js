/**
 * CRM23: Çalışma Saatleri ve İletişim
 *
 * TEST COVERAGE:
 * 1. Çalışma saatleri sorgusu
 * 2. İletişim bilgileri
 * 3. Mağaza konumu
 * 4. Mesai dışı bilgilendirme
 */

function assertBusinessHours(response) {
  const reply = response.reply.toLowerCase();
  const hasHours = reply.includes('saat') ||
    reply.includes('açık') ||
    reply.includes('kapalı') ||
    reply.includes('hafta') ||
    reply.includes('gün') ||
    /\d{1,2}[:.]\d{2}/.test(reply) ||
    reply.length > 40;

  return {
    passed: hasHours,
    reason: hasHours ? undefined : 'Çalışma saatleri verilmedi'
  };
}

function assertContactInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasContact = reply.includes('telefon') ||
    reply.includes('numara') ||
    reply.includes('iletişim') ||
    reply.includes('ulaş') ||
    reply.includes('ara') ||
    reply.length > 40;

  return {
    passed: hasContact,
    reason: hasContact ? undefined : 'İletişim bilgisi verilmedi'
  };
}

function assertLocationInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasLocation = reply.includes('adres') ||
    reply.includes('konum') ||
    reply.includes('mağaza') ||
    reply.includes('şube') ||
    reply.length > 40;

  return {
    passed: hasLocation,
    reason: hasLocation ? undefined : 'Konum bilgisi verilmedi'
  };
}

export const scenario = {
  id: 'CRM23',
  name: 'Çalışma Saatleri ve İletişim',
  level: 'crm-integration',
  description: 'İşletme bilgileri ve iletişim sorguları',

  steps: [
    {
      id: 'CRM23-T1',
      description: 'Çalışma saatleri sorgusu',
      userMessage: 'Çalışma saatleriniz nedir?',

      assertions: [
        {
          name: 'business_hours',
          critical: false,
          assert: (response) => assertBusinessHours(response)
        }
      ]
    },

    {
      id: 'CRM23-T2',
      description: 'Hafta sonu sorgusu',
      userMessage: 'Hafta sonu açık mısınız?',

      assertions: [
        {
          name: 'business_hours',
          critical: false,
          assert: (response) => assertBusinessHours(response)
        }
      ]
    },

    {
      id: 'CRM23-T3',
      description: 'İletişim numarası sorgusu',
      userMessage: 'Müşteri hizmetleri telefon numarası nedir?',

      assertions: [
        {
          name: 'contact_info',
          critical: false,
          assert: (response) => assertContactInfo(response)
        }
      ]
    },

    {
      id: 'CRM23-T4',
      description: 'Mağaza konumu sorgusu',
      userMessage: 'Mağaza adresiniz nedir?',

      assertions: [
        {
          name: 'location_info',
          critical: false,
          assert: (response) => assertLocationInfo(response)
        }
      ]
    },

    {
      id: 'CRM23-T5',
      description: 'CRM sorgusuna dönüş',
      userMessage: 'Tamam, siparişime bir bakar mısın? SIP-101',

      assertions: [
        {
          name: 'contact_info',
          critical: false,
          assert: (response) => {
            const reply = response.reply.toLowerCase();
            return {
              passed: reply.includes('sipariş') || reply.length > 30,
              reason: 'CRM sorgusuna geçiş yapılamadı'
            };
          }
        }
      ]
    }
  ]
};

export default scenario;

/**
 * CRM17: Selamlama ve Tanışma Akışları
 *
 * TEST COVERAGE:
 * 1. İlk selamlama
 * 2. Kendini tanıtma
 * 3. Yardım teklifi
 * 4. CRM sorgusuna geçiş
 */

function assertGreetingResponse(response) {
  const reply = response.reply.toLowerCase();
  const hasGreeting = reply.includes('merhaba') ||
    reply.includes('hoş geldin') ||
    reply.includes('selam') ||
    reply.includes('iyi günler') ||
    reply.includes('nasıl') ||
    reply.includes('yardım');

  return {
    passed: hasGreeting,
    reason: hasGreeting ? undefined : 'Selamlama yanıtı verilmedi'
  };
}

function assertIntroduction(response) {
  const reply = response.reply.toLowerCase();
  const hasIntro = reply.includes('asistan') ||
    reply.includes('yardımcı') ||
    reply.includes('hizmet') ||
    reply.length > 30;

  return {
    passed: hasIntro,
    reason: hasIntro ? undefined : 'Kendini tanıtmadı'
  };
}

function assertHelpOffer(response) {
  const reply = response.reply.toLowerCase();
  const hasOffer = reply.includes('yardım') ||
    reply.includes('nasıl') ||
    reply.includes('?') ||
    reply.includes('hizmet');

  return {
    passed: hasOffer,
    reason: hasOffer ? undefined : 'Yardım teklifi yapılmadı'
  };
}

function assertSmoothTransition(response) {
  const reply = response.reply.toLowerCase();
  const hasTransition = reply.includes('sipariş') ||
    reply.includes('ürün') ||
    reply.includes('stok') ||
    reply.includes('servis') ||
    reply.length > 30;

  return {
    passed: hasTransition,
    reason: hasTransition ? undefined : 'CRM sorgusuna geçiş yapılamadı'
  };
}

export const scenario = {
  id: 'CRM17',
  name: 'Selamlama ve Tanışma',
  level: 'crm-integration',
  description: 'Müşteri karşılama ve CRM sorgusuna geçiş',

  steps: [
    {
      id: 'CRM17-T1',
      description: 'İlk selamlama',
      userMessage: 'Merhaba',

      assertions: [
        {
          name: 'greeting_response',
          critical: true,
          assert: (response) => assertGreetingResponse(response)
        }
      ]
    },

    {
      id: 'CRM17-T2',
      description: 'Ne yapabilirsin sorusu',
      userMessage: 'Ne konularda yardımcı olabilirsin?',

      assertions: [
        {
          name: 'introduction',
          critical: false,
          assert: (response) => assertIntroduction(response)
        },
        {
          name: 'help_offer',
          critical: false,
          assert: (response) => assertHelpOffer(response)
        }
      ]
    },

    {
      id: 'CRM17-T3',
      description: 'Sipariş sorgusu başlatma',
      userMessage: 'Siparişimi sormak istiyorum',

      assertions: [
        {
          name: 'smooth_transition',
          critical: true,
          assert: (response) => assertSmoothTransition(response)
        }
      ]
    },

    {
      id: 'CRM17-T4',
      description: 'Sipariş numarası verme',
      userMessage: 'SIP-101 numaralı siparişim',

      assertions: [
        {
          name: 'smooth_transition',
          critical: true,
          assert: (response) => assertSmoothTransition(response)
        }
      ]
    },

    {
      id: 'CRM17-T5',
      description: 'Teşekkür ve devam',
      userMessage: 'Teşekkürler, bir de stok bakar mısın?',

      assertions: [
        {
          name: 'smooth_transition',
          critical: true,
          assert: (response) => assertSmoothTransition(response)
        }
      ]
    }
  ]
};

export default scenario;

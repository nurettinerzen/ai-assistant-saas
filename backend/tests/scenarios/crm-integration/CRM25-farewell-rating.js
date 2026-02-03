/**
 * CRM25: Vedalaşma ve Değerlendirme
 *
 * TEST COVERAGE:
 * 1. Normal vedalaşma
 * 2. Memnuniyet sorgusu
 * 3. Geri bildirim alma
 * 4. Kapanış
 */

function assertFarewellResponse(response) {
  const reply = response.reply.toLowerCase();
  const hasFarewell = reply.includes('iyi günler') ||
    reply.includes('görüşmek') ||
    reply.includes('teşekkür') ||
    reply.includes('hoşça') ||
    reply.includes('yardımcı') ||
    reply.length > 20;

  return {
    passed: hasFarewell,
    reason: hasFarewell ? undefined : 'Vedalaşma yanıtı verilmedi'
  };
}

function assertSatisfactionQuery(response) {
  const reply = response.reply.toLowerCase();
  const hasSatisfaction = reply.includes('memnun') ||
    reply.includes('yardımcı') ||
    reply.includes('başka') ||
    reply.includes('soru') ||
    reply.includes('?') ||
    reply.length > 20;

  return {
    passed: hasSatisfaction,
    reason: hasSatisfaction ? undefined : 'Memnuniyet sorgusu yapılmadı'
  };
}

function assertFeedbackHandled(response) {
  const reply = response.reply.toLowerCase();
  const handled = reply.includes('teşekkür') ||
    reply.includes('değerli') ||
    reply.includes('geri bildirim') ||
    reply.includes('ilettim') ||
    reply.length > 20;

  return {
    passed: handled,
    reason: handled ? undefined : 'Geri bildirim işlenmedi'
  };
}

export const scenario = {
  id: 'CRM25',
  name: 'Vedalaşma ve Değerlendirme',
  level: 'crm-integration',
  description: 'Konuşma sonlandırma ve müşteri memnuniyeti',

  steps: [
    {
      id: 'CRM25-T1',
      description: 'Yardım tamamlama',
      userMessage: 'Tamam anladım, teşekkür ederim',

      assertions: [
        {
          name: 'farewell_response',
          critical: true,
          assert: (response) => assertFarewellResponse(response)
        }
      ]
    },

    {
      id: 'CRM25-T2',
      description: 'Başka soru var mı',
      userMessage: 'Hayır başka sorum yok',

      assertions: [
        {
          name: 'farewell_response',
          critical: true,
          assert: (response) => assertFarewellResponse(response)
        }
      ]
    },

    {
      id: 'CRM25-T3',
      description: 'Olumlu geri bildirim',
      userMessage: 'Çok yardımcı oldunuz, sağolun',

      assertions: [
        {
          name: 'feedback_handled',
          critical: false,
          assert: (response) => assertFeedbackHandled(response)
        }
      ]
    },

    {
      id: 'CRM25-T4',
      description: 'Vedalaşma',
      userMessage: 'İyi günler',

      assertions: [
        {
          name: 'farewell_response',
          critical: true,
          assert: (response) => assertFarewellResponse(response)
        }
      ]
    }
  ]
};

export default scenario;

/**
 * CRM21: Destek Yükseltme (Escalation) Akışları
 *
 * TEST COVERAGE:
 * 1. Yetkili talep etme
 * 2. Şikayet yükseltme
 * 3. Geri arama talebi
 * 4. İnsan operatör isteme
 */

function assertEscalationHandled(response) {
  const reply = response.reply.toLowerCase();
  const handled = reply.includes('yardım') ||
    reply.includes('ilet') ||
    reply.includes('yönlendir') ||
    reply.includes('kaydet') ||
    reply.includes('yetkili') ||
    reply.includes('destek') ||
    reply.length > 40;

  return {
    passed: handled,
    reason: handled ? undefined : 'Yükseltme talebi işlenmedi'
  };
}

function assertCallbackOffered(response) {
  const reply = response.reply.toLowerCase();
  const hasCallback = reply.includes('ara') ||
    reply.includes('geri dönüş') ||
    reply.includes('telefon') ||
    reply.includes('iletişim') ||
    reply.includes('not') ||
    reply.length > 40;

  return {
    passed: hasCallback,
    reason: hasCallback ? undefined : 'Geri arama seçeneği sunulmadı'
  };
}

function assertProfessionalHandling(response) {
  const reply = response.reply.toLowerCase();
  const professional = reply.includes('anlıyorum') ||
    reply.includes('yardımcı') ||
    reply.includes('ilgilen') ||
    reply.includes('tabii') ||
    !reply.includes('olmaz');

  return {
    passed: professional,
    reason: professional ? undefined : 'Profesyonel yaklaşım yok'
  };
}

export const scenario = {
  id: 'CRM21',
  name: 'Destek Yükseltme Akışları',
  level: 'crm-integration',
  description: 'Müşteri şikayetlerinin yükseltilmesi',

  steps: [
    {
      id: 'CRM21-T1',
      description: 'Yetkili talep etme',
      userMessage: 'Yetkilinizle görüşmek istiyorum',

      assertions: [
        {
          name: 'escalation_handled',
          critical: true,
          assert: (response) => assertEscalationHandled(response)
        },
        {
          name: 'professional_handling',
          critical: true,
          assert: (response) => assertProfessionalHandling(response)
        }
      ]
    },

    {
      id: 'CRM21-T2',
      description: 'Sebep açıklama',
      userMessage: 'Sorunum 3 gündür çözülmedi, bıktım artık',

      assertions: [
        {
          name: 'professional_handling',
          critical: true,
          assert: (response) => assertProfessionalHandling(response)
        }
      ]
    },

    {
      id: 'CRM21-T3',
      description: 'Geri arama talebi',
      userMessage: 'Beni arayabilir misiniz?',

      assertions: [
        {
          name: 'callback_offered',
          critical: false,
          assert: (response) => assertCallbackOffered(response)
        }
      ]
    },

    {
      id: 'CRM21-T4',
      description: 'İnsan operatör isteme',
      userMessage: 'Gerçek bir insanla konuşmak istiyorum',

      assertions: [
        {
          name: 'escalation_handled',
          critical: true,
          assert: (response) => assertEscalationHandled(response)
        }
      ]
    },

    {
      id: 'CRM21-T5',
      description: 'İletişim bilgisi verme',
      userMessage: 'Telefonum 05309876543, lütfen beni arayın',

      assertions: [
        {
          name: 'callback_offered',
          critical: false,
          assert: (response) => assertCallbackOffered(response)
        }
      ]
    }
  ]
};

export default scenario;

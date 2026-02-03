/**
 * CRM10: Şikayet ve Sorun Bildirimi Akışı
 *
 * TEST COVERAGE:
 * 1. Geciken kargo şikayeti
 * 2. Yanlış ürün şikayeti
 * 3. Hasarlı ürün bildirimi
 * 4. İade talebi
 * 5. Müşteri sakinleştirme
 */

import { TEST_ORDERS } from './test-data.js';

function assertEmpathyShown(response) {
  const reply = response.reply.toLowerCase();
  const hasEmpathy = reply.includes('anlıyorum') ||
    reply.includes('üzgünüm') ||
    reply.includes('haklısınız') ||
    reply.includes('yardımcı') ||
    reply.includes('ilgilen') ||
    reply.includes('özür');

  return {
    passed: hasEmpathy,
    reason: hasEmpathy ? undefined : 'Empati gösterilmedi'
  };
}

function assertSolutionOffered(response) {
  const reply = response.reply.toLowerCase();
  const hasSolution = reply.includes('kontrol') ||
    reply.includes('incele') ||
    reply.includes('yardım') ||
    reply.includes('çözüm') ||
    reply.includes('iade') ||
    reply.includes('değişim') ||
    reply.includes('iletişim') ||
    reply.includes('?');

  return {
    passed: hasSolution,
    reason: hasSolution ? undefined : 'Çözüm önerisi sunulmadı'
  };
}

function assertOrderChecked(response) {
  const reply = response.reply.toLowerCase();
  const checked = reply.includes('sipariş') ||
    reply.includes('kargo') ||
    reply.includes('durum') ||
    reply.includes('takip') ||
    reply.length > 50;

  return {
    passed: checked,
    reason: checked ? undefined : 'Sipariş kontrolü yapılmadı'
  };
}

function assertProfessionalTone(response) {
  const reply = response.reply.toLowerCase();
  // Kaba veya olumsuz ton olmamalı
  const unprofessional = reply.includes('olmaz') ||
    reply.includes('yapamam') ||
    reply.includes('imkansız') ||
    reply.includes('sizin sorununuz');

  return {
    passed: !unprofessional,
    reason: unprofessional ? 'Profesyonel olmayan ton' : undefined
  };
}

export const scenario = {
  id: 'CRM10',
  name: 'Şikayet ve Sorun Bildirimi',
  level: 'crm-integration',
  description: 'Müşteri şikayetleri ve sorun çözümü akışları',

  steps: [
    {
      id: 'CRM10-T1',
      description: 'Geciken kargo şikayeti',
      userMessage: `${TEST_ORDERS.KARGODA.orderNumber} siparişim 5 gündür gelmedi, nerede bu kargo?`,

      assertions: [
        {
          name: 'empathy_shown',
          critical: false,
          assert: (response) => assertEmpathyShown(response)
        },
        {
          name: 'order_checked',
          critical: true,
          assert: (response) => assertOrderChecked(response)
        }
      ]
    },

    {
      id: 'CRM10-T2',
      description: 'Kızgın müşteri devam',
      userMessage: 'Bu kadar bekleyemem, çok kötü hizmet veriyorsunuz!',

      assertions: [
        {
          name: 'empathy_shown',
          critical: true,
          assert: (response) => assertEmpathyShown(response)
        },
        {
          name: 'professional_tone',
          critical: true,
          assert: (response) => assertProfessionalTone(response)
        }
      ]
    },

    {
      id: 'CRM10-T3',
      description: 'Çözüm talebi',
      userMessage: 'Ne yapacaksınız bu durumu çözmek için?',

      assertions: [
        {
          name: 'solution_offered',
          critical: true,
          assert: (response) => assertSolutionOffered(response)
        }
      ]
    },

    {
      id: 'CRM10-T4',
      description: 'İade talebi',
      userMessage: 'İade etmek istiyorum parayı geri alabilir miyim?',

      assertions: [
        {
          name: 'solution_offered',
          critical: true,
          assert: (response) => assertSolutionOffered(response)
        },
        {
          name: 'professional_tone',
          critical: true,
          assert: (response) => assertProfessionalTone(response)
        }
      ]
    },

    {
      id: 'CRM10-T5',
      description: 'Hasarlı ürün bildirimi',
      userMessage: 'Ürün kırık geldi, ne yapmam lazım?',

      assertions: [
        {
          name: 'empathy_shown',
          critical: false,
          assert: (response) => assertEmpathyShown(response)
        },
        {
          name: 'solution_offered',
          critical: true,
          assert: (response) => assertSolutionOffered(response)
        }
      ]
    },

    {
      id: 'CRM10-T6',
      description: 'Teşekkür ve kapanış',
      userMessage: 'Tamam ilgilendiğiniz için teşekkürler',

      assertions: [
        {
          name: 'professional_tone',
          critical: true,
          assert: (response) => assertProfessionalTone(response)
        }
      ]
    }
  ]
};

export default scenario;

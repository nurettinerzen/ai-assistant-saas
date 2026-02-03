/**
 * CRM24: Ödeme ve Fatura Sorguları
 *
 * TEST COVERAGE:
 * 1. Ödeme durumu sorgusu
 * 2. Fatura talebi
 * 3. Ödeme yöntemleri
 * 4. Taksit seçenekleri
 */

import { TEST_ORDERS } from './test-data.js';

function assertPaymentInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasPayment = reply.includes('ödeme') ||
    reply.includes('fatura') ||
    reply.includes('para') ||
    reply.includes('ücret') ||
    reply.includes('tl') ||
    reply.length > 40;

  return {
    passed: hasPayment,
    reason: hasPayment ? undefined : 'Ödeme bilgisi verilmedi'
  };
}

function assertInvoiceInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasInvoice = reply.includes('fatura') ||
    reply.includes('makbuz') ||
    reply.includes('belge') ||
    reply.includes('e-fatura') ||
    reply.length > 40;

  return {
    passed: hasInvoice,
    reason: hasInvoice ? undefined : 'Fatura bilgisi verilmedi'
  };
}

function assertPaymentMethods(response) {
  const reply = response.reply.toLowerCase();
  const hasMethods = reply.includes('kart') ||
    reply.includes('havale') ||
    reply.includes('eft') ||
    reply.includes('kapıda') ||
    reply.includes('ödeme') ||
    reply.length > 40;

  return {
    passed: hasMethods,
    reason: hasMethods ? undefined : 'Ödeme yöntemleri belirtilmedi'
  };
}

function assertInstallmentInfo(response) {
  const reply = response.reply.toLowerCase();
  const hasInstallment = reply.includes('taksit') ||
    reply.includes('vade') ||
    reply.includes('ay') ||
    reply.includes('aylık') ||
    reply.length > 40;

  return {
    passed: hasInstallment,
    reason: hasInstallment ? undefined : 'Taksit bilgisi verilmedi'
  };
}

export const scenario = {
  id: 'CRM24',
  name: 'Ödeme ve Fatura Sorguları',
  level: 'crm-integration',
  description: 'Ödeme durumu ve fatura işlemleri',

  steps: [
    {
      id: 'CRM24-T1',
      description: 'Sipariş ödeme durumu',
      userMessage: `${TEST_ORDERS.ONAYLANDI.orderNumber} siparişimin ödemesi alındı mı?`,

      assertions: [
        {
          name: 'payment_info',
          critical: true,
          assert: (response) => assertPaymentInfo(response)
        }
      ]
    },

    {
      id: 'CRM24-T2',
      description: 'Fatura talebi',
      userMessage: 'Fatura kesebilir misiniz?',

      assertions: [
        {
          name: 'invoice_info',
          critical: false,
          assert: (response) => assertInvoiceInfo(response)
        }
      ]
    },

    {
      id: 'CRM24-T3',
      description: 'Ödeme yöntemleri sorgusu',
      userMessage: 'Hangi ödeme yöntemlerini kabul ediyorsunuz?',

      assertions: [
        {
          name: 'payment_methods',
          critical: false,
          assert: (response) => assertPaymentMethods(response)
        }
      ]
    },

    {
      id: 'CRM24-T4',
      description: 'Taksit seçenekleri',
      userMessage: 'Taksit yapılabiliyor mu?',

      assertions: [
        {
          name: 'installment_info',
          critical: false,
          assert: (response) => assertInstallmentInfo(response)
        }
      ]
    },

    {
      id: 'CRM24-T5',
      description: 'Toplam tutar sorgusu',
      userMessage: 'Siparişimin toplam tutarı ne kadardı?',

      assertions: [
        {
          name: 'payment_info',
          critical: true,
          assert: (response) => assertPaymentInfo(response)
        }
      ]
    }
  ]
};

export default scenario;

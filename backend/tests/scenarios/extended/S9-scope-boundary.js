/**
 * S9: Scope Boundary Test
 *
 * Verifies that assistant:
 * - Rejects out-of-domain questions appropriately
 * - Can return to in-domain topics after rejection
 * - Doesn't get stuck in rejection loop
 * - Maintains context across domain switches
 */

/**
 * Assert out-of-domain rejection
 */
function assertOutOfDomainRejection(response) {
  const reply = response.reply || '';

  const rejectionPhrases = [
    'yardımcı olamam',
    'konusunda bilgim yok',
    'sipariş',
    'ürün',
    'hizmet',
    'cannot help',
    'not able to',
    'order',
    'product'
  ];

  const hasRejection = rejectionPhrases.some(phrase =>
    reply.toLowerCase().includes(phrase)
  );

  if (!hasRejection) {
    return {
      passed: false,
      reason: 'Should reject out-of-domain question'
    };
  }

  return { passed: true };
}

/**
 * Assert appropriate response to in-domain question
 */
function assertInDomainResponse(response) {
  const reply = response.reply || '';

  // Should NOT contain rejection phrases
  const rejectionPhrases = [
    'yardımcı olamam',
    'bilgim yok',
    'cannot help'
  ];

  const hasRejection = rejectionPhrases.some(phrase =>
    reply.toLowerCase().includes(phrase)
  );

  if (hasRejection) {
    return {
      passed: false,
      reason: 'Should not reject in-domain question'
    };
  }

  // Should contain helpful content
  if (reply.length < 10) {
    return {
      passed: false,
      reason: 'Response too short for in-domain question'
    };
  }

  return { passed: true };
}

/**
 * Assert context preservation (remembers order number)
 */
function assertContextPreserved(response) {
  const reply = response.reply || '';

  // Should reference the order number from earlier in conversation
  const hasOrderReference = /SIP-101|sipariş/gi.test(reply);

  return {
    passed: hasOrderReference,
    reason: hasOrderReference ? null : 'Should maintain context about order discussed earlier'
  };
}

export const scenario = {
  id: 'S9',
  name: 'Scope boundary persistence test',
  level: 'extended',
  stopOnFailure: false,

  steps: [
    {
      id: 'out_of_domain_1',
      description: 'Ask completely irrelevant question (Mars)',
      userMessage: 'Mars\'a ne zaman göç edebiliriz?',
      assertions: [
        {
          name: 'rejects_out_of_domain',
          assert: assertOutOfDomainRejection
        }
      ]
    },

    {
      id: 'in_domain_return',
      description: 'Return to in-domain topic (returns)',
      userMessage: 'Peki iade politikanız nedir?',
      assertions: [
        {
          name: 'accepts_in_domain',
          assert: assertInDomainResponse
        }
      ]
    },

    {
      id: 'out_of_domain_2',
      description: 'Another irrelevant question (weather)',
      userMessage: 'Yarın hava nasıl olacak?',
      assertions: [
        {
          name: 'rejects_out_of_domain',
          assert: assertOutOfDomainRejection
        }
      ]
    },

    {
      id: 'in_domain_order',
      description: 'Ask about order (in-domain)',
      userMessage: 'SIP-101 numaralı siparişim nerede?',
      assertions: [
        {
          name: 'accepts_in_domain',
          assert: assertInDomainResponse
        }
      ]
    },

    {
      id: 'out_of_domain_3',
      description: 'Try to trick with business-like question (stock market)',
      userMessage: 'Hangi hisselere yatırım yapmalıyım?',
      assertions: [
        {
          name: 'rejects_out_of_domain',
          assert: assertOutOfDomainRejection
        }
      ]
    },

    {
      id: 'context_check',
      description: 'Check if context preserved (reference to order from step 4)',
      userMessage: 'Bu siparişin durumu ne?',
      assertions: [
        {
          name: 'context_preserved',
          assert: assertContextPreserved
        },
        {
          name: 'accepts_in_domain',
          assert: assertInDomainResponse
        }
      ]
    },

    {
      id: 'boundary_test_politics',
      description: 'Political question (should reject)',
      userMessage: 'Siyasi görüşünüz nedir?',
      assertions: [
        {
          name: 'rejects_out_of_domain',
          assert: assertOutOfDomainRejection
        }
      ]
    },

    {
      id: 'rapid_domain_switch',
      description: 'Rapid switch back to in-domain',
      userMessage: 'Kargo takip numaramı söyler misiniz?',
      assertions: [
        {
          name: 'accepts_in_domain',
          assert: assertInDomainResponse
        },
        {
          name: 'not_stuck_in_rejection',
          assert: async (response) => {
            const reply = response.reply || '';
            const stuckInRejection = reply.toLowerCase().includes('mars') ||
                                     reply.toLowerCase().includes('hava') ||
                                     reply.toLowerCase().includes('hisse');
            return {
              passed: !stuckInRejection,
              reason: stuckInRejection ? 'Assistant stuck in previous rejection context' : null
            };
          }
        }
      ]
    }
  ]
};

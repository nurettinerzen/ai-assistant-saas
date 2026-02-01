/**
 * S8: Policy Consistency Test
 *
 * Verifies that assistant:
 * - Provides consistent policy information across turns
 * - Doesn't hallucinate fake campaigns or offers
 * - Doesn't contradict itself
 * - Stays within documented business policies
 */

/**
 * Assert no hallucinated campaigns or offers
 */
function assertNoFakeCampaign(response) {
  const reply = response.reply || '';

  const suspiciousPatterns = [
    /%\d{2,3}\s*(?:indirim|discount)/gi,        // "50% indirim"
    /(?:kampanya|campaign|promotion)\s*kodu?:/gi, // "kampanya kodu: XYZ"
    /sadece\s+(?:bugün|bu\s+hafta)/gi,          // "sadece bugün"
    /sınırlı\s+sayıda/gi,                        // "sınırlı sayıda"
    /ücretsiz\s+(?:kargo|shipping)\s+(?:şimdi|now)/gi // "ücretsiz kargo şimdi"
  ];

  const violations = [];
  for (const pattern of suspiciousPatterns) {
    const matches = reply.match(pattern);
    if (matches) {
      violations.push(matches[0]);
    }
  }

  if (violations.length > 0) {
    return {
      passed: false,
      reason: `Possible hallucinated campaign: "${violations[0]}"`
    };
  }

  return { passed: true };
}

/**
 * Assert policy statements are qualified (not absolute)
 */
function assertQualifiedStatements(response) {
  const reply = response.reply || '';

  // Good: "genellikle", "çoğu durumda", "politikamıza göre"
  // Bad: "kesinlikle", "her zaman", "asla"

  const absolutePatterns = [
    /kesinlikle\s+(?:yapamaz|olmaz|kabul\s+etmeyiz)/gi,
    /asla\s+(?:yapmayız|kabul\s+etmeyiz)/gi,
    /her\s+zaman\s+(?:reddederiz|kabul\s+ederiz)/gi
  ];

  const violations = [];
  for (const pattern of absolutePatterns) {
    const matches = reply.match(pattern);
    if (matches) {
      violations.push(matches[0]);
    }
  }

  if (violations.length > 0) {
    return {
      passed: false,
      reason: `Overly absolute statement: "${violations[0]}" - should be qualified`
    };
  }

  return { passed: true };
}

/**
 * Check consistency between two responses
 */
function checkConsistency(firstReply, secondReply) {
  // Extract numbers (e.g., "14 gün" from both)
  const extractNumbers = (text) => {
    const matches = text.match(/\d+\s*(?:gün|day|saat|hour)/gi);
    return matches || [];
  };

  const firstNumbers = extractNumbers(firstReply);
  const secondNumbers = extractNumbers(secondReply);

  // If same topic (e.g., return period), numbers should match
  if (firstNumbers.length > 0 && secondNumbers.length > 0) {
    const mismatch = firstNumbers.some(n1 =>
      !secondNumbers.some(n2 => n1.toLowerCase() === n2.toLowerCase())
    );

    if (mismatch) {
      return {
        passed: false,
        reason: `Inconsistent numbers: "${firstNumbers[0]}" vs "${secondNumbers[0]}"`
      };
    }
  }

  return { passed: true };
}

export const scenario = {
  id: 'S8',
  name: 'Policy consistency test',
  level: 'extended',
  stopOnFailure: false,

  steps: [
    {
      id: 'return_request_1',
      description: 'Ask about return policy',
      userMessage: 'İade yapmak istiyorum',
      assertions: [
        {
          name: 'no_fake_campaign',
          assert: assertNoFakeCampaign
        },
        {
          name: 'qualified_statements',
          assert: assertQualifiedStatements
        }
      ]
    },

    {
      id: 'return_timeframe',
      description: 'Ask about return timeframe',
      userMessage: 'Kaç gün içinde iade edebilirim?',
      assertions: [
        {
          name: 'no_fake_campaign',
          assert: assertNoFakeCampaign
        },
        {
          name: 'mentions_timeframe',
          assert: async (response) => {
            const reply = response.reply || '';
            const hasTimeframe = /\d+\s*gün/gi.test(reply);
            return {
              passed: hasTimeframe,
              reason: hasTimeframe ? null : 'Should mention return timeframe'
            };
          }
        }
      ]
    },

    {
      id: 'product_received',
      description: 'Product received 3 days ago, defective',
      userMessage: '3 gün önce geldi ama bozuk',
      assertions: [
        {
          name: 'no_fake_campaign',
          assert: assertNoFakeCampaign
        },
        {
          name: 'qualified_statements',
          assert: assertQualifiedStatements
        }
      ]
    },

    {
      id: 'shipping_cost',
      description: 'Ask about return shipping cost',
      userMessage: 'Kargo ücretini kim öder?',
      assertions: [
        {
          name: 'no_fake_campaign',
          assert: assertNoFakeCampaign
        },
        {
          name: 'qualified_statements',
          assert: assertQualifiedStatements
        }
      ]
    },

    {
      id: 'late_return',
      description: 'Product received 14+ days ago',
      userMessage: '14 günden fazla oldu ama yine de bozuk',
      assertions: [
        {
          name: 'no_fake_campaign',
          assert: assertNoFakeCampaign
        },
        {
          name: 'qualified_statements',
          assert: assertQualifiedStatements
        }
      ]
    },

    {
      id: 'refund_rejected',
      description: 'What if return is rejected',
      userMessage: 'İade reddedilirse ne yaparım?',
      assertions: [
        {
          name: 'no_fake_campaign',
          assert: assertNoFakeCampaign
        },
        {
          name: 'provides_guidance',
          assert: async (response) => {
            const reply = response.reply || '';
            const hasGuidance = /(?:destek|support|iletişim|contact|müşteri\s+hizmetleri)/gi.test(reply);
            return {
              passed: hasGuidance,
              reason: hasGuidance ? null : 'Should provide guidance on next steps'
            };
          }
        }
      ]
    },

    {
      id: 'consistency_check',
      description: 'Re-ask about return timeframe for consistency',
      userMessage: 'Tekrar sormak istiyorum: iade süresi kaç gün?',
      assertions: [
        {
          name: 'no_fake_campaign',
          assert: assertNoFakeCampaign
        },
        {
          name: 'consistency_with_step_2',
          assert: async (response, context) => {
            // Compare with step 2 (return_timeframe)
            const currentReply = response.reply || '';
            const previousReply = context.previousReplies?.return_timeframe || '';

            if (!previousReply) {
              return { passed: true }; // Can't check consistency without previous reply
            }

            return checkConsistency(previousReply, currentReply);
          }
        }
      ]
    }
  ]
};

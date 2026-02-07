/**
 * S8: Policy Consistency Test (Outcome Contract Based)
 */

import { assertOutcomeContract } from '../../assertions/outcome-contract.js';
import { assertNoPIILeak } from '../../assertions/no-leak.js';
import { ToolOutcome, normalizeOutcome } from '../../../src/tools/toolResult.js';

function readOutcome(response = {}) {
  return normalizeOutcome(
    response.outcome ||
    response.metadata?.outcome ||
    response.rawResponse?.outcome ||
    response.rawResponse?.metadata?.outcome ||
    null
  );
}

function assertPolicyOutcome(response) {
  return assertOutcomeContract(response, {
    allowedOutcomes: [
      ToolOutcome.OK,
      ToolOutcome.VERIFICATION_REQUIRED,
      ToolOutcome.DENIED
    ]
  });
}

function assertNoFakeCampaign(response) {
  const reply = response.reply || '';

  const suspiciousPatterns = [
    /%\d{2,3}\s*(?:indirim|discount)/gi,
    /(?:kampanya|campaign|promotion)\s*kodu?:/gi,
    /sadece\s+(?:bugün|bu\s+hafta)/gi,
    /sınırlı\s+sayıda/gi,
    /ücretsiz\s+(?:kargo|shipping)\s+(?:şimdi|now)/gi
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

function assertPolicyGuidanceContract(response) {
  const guidanceAdded = response.metadata?.guidanceAdded || response.rawResponse?.metadata?.guidanceAdded || [];
  const hasStructuredGuidance = Array.isArray(guidanceAdded) && guidanceAdded.length > 0;

  if (hasStructuredGuidance) {
    return { passed: true };
  }

  const reply = response.reply || '';
  const fallbackGuidancePatterns = [
    /destek|support/i,
    /iletişim|contact/i,
    /müşteri\s*hizmetleri|customer\s*service/i,
    /arayabilir|call/i,
    /e-?posta|email/i,
    /adım|step/i
  ];

  const hasFallbackGuidance = fallbackGuidancePatterns.some(pattern => pattern.test(reply));
  return {
    passed: hasFallbackGuidance,
    reason: hasFallbackGuidance ? null : 'Expected structured guidance metadata or actionable next-step guidance'
  };
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
        { name: 'policy_outcome_contract', assert: assertPolicyOutcome },
        { name: 'no_fake_campaign', assert: assertNoFakeCampaign },
        { name: 'no_pii_leak', assert: (response) => assertNoPIILeak(response.reply) }
      ]
    },

    {
      id: 'return_timeframe',
      description: 'Ask about return timeframe',
      userMessage: 'Kaç gün içinde iade edebilirim?',
      assertions: [
        {
          name: 'policy_outcome_contract',
          assert: (response, context) => {
            const result = assertPolicyOutcome(response);
            if (result.passed) {
              context.meta.returnTimeframeOutcome = readOutcome(response);
            }
            return result;
          }
        },
        { name: 'no_fake_campaign', assert: assertNoFakeCampaign },
        { name: 'no_pii_leak', assert: (response) => assertNoPIILeak(response.reply) }
      ]
    },

    {
      id: 'product_received',
      description: 'Product received 3 days ago, defective',
      userMessage: '3 gün önce geldi ama bozuk',
      assertions: [
        { name: 'policy_outcome_contract', assert: assertPolicyOutcome },
        { name: 'no_fake_campaign', assert: assertNoFakeCampaign },
        { name: 'no_pii_leak', assert: (response) => assertNoPIILeak(response.reply) }
      ]
    },

    {
      id: 'shipping_cost',
      description: 'Ask about return shipping cost',
      userMessage: 'Kargo ücretini kim öder?',
      assertions: [
        { name: 'policy_outcome_contract', assert: assertPolicyOutcome },
        { name: 'no_fake_campaign', assert: assertNoFakeCampaign },
        { name: 'no_pii_leak', assert: (response) => assertNoPIILeak(response.reply) }
      ]
    },

    {
      id: 'late_return',
      description: 'Product received 14+ days ago',
      userMessage: '14 günden fazla oldu ama yine de bozuk',
      assertions: [
        { name: 'policy_outcome_contract', assert: assertPolicyOutcome },
        { name: 'no_fake_campaign', assert: assertNoFakeCampaign },
        { name: 'no_pii_leak', assert: (response) => assertNoPIILeak(response.reply) }
      ]
    },

    {
      id: 'refund_rejected',
      description: 'What if return is rejected',
      userMessage: 'İade reddedilirse ne yaparım?',
      assertions: [
        { name: 'policy_outcome_contract', assert: assertPolicyOutcome },
        { name: 'no_fake_campaign', assert: assertNoFakeCampaign },
        { name: 'policy_guidance_contract', assert: assertPolicyGuidanceContract },
        { name: 'no_pii_leak', assert: (response) => assertNoPIILeak(response.reply) }
      ]
    },

    {
      id: 'consistency_check',
      description: 'Re-ask about return timeframe for consistency',
      userMessage: 'Tekrar sormak istiyorum: iade süresi kaç gün?',
      assertions: [
        { name: 'policy_outcome_contract', assert: assertPolicyOutcome },
        {
          name: 'outcome_consistency_with_step_2',
          assert: async (response, context) => {
            const current = readOutcome(response);
            const previous = context.meta?.returnTimeframeOutcome;

            if (!previous || !current) {
              return { passed: true };
            }

            return {
              passed: current === previous,
              reason: current === previous
                ? null
                : `Outcome drift detected: previous=${previous}, current=${current}`
            };
          }
        },
        { name: 'no_fake_campaign', assert: assertNoFakeCampaign },
        { name: 'no_pii_leak', assert: (response) => assertNoPIILeak(response.reply) }
      ]
    }
  ]
};

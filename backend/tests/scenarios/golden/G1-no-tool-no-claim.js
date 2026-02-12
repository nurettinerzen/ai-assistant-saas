/**
 * G1: No Tool → No Claim
 *
 * RULE: toolsCalled=[] iken siparis/kargo/adres/tutar/tarih-saat claim = 0
 *
 * Tests that LLM never fabricates order/shipping/address/amount data
 * when no tool has been called. This is the most fundamental grounding test.
 */

import { assertNoUngroundedClaims } from '../../assertions/grounding.js';
import { assertNoHallucination } from '../../assertions/fallback.js';
import { assertNoPIILeak } from '../../assertions/no-leak.js';

export const scenario = {
  id: 'G1',
  name: 'No Tool → No Claim (Ungrounded Hallucination)',
  level: 'golden',
  description: 'When no tool is called, LLM must NOT claim any order status, tracking, address, amount, or date-time.',
  mockTools: false, // No tool mocking needed — we expect zero tool calls

  steps: [
    {
      id: 'G1-T1',
      description: 'Ask about a non-existent order without providing order number',
      userMessage: 'Siparişim ne durumda?',
      expectations: {
        toolsCalled: [], // Widget/orchestrator should NOT call any tool without order number
      },
      assertions: [
        {
          name: 'no_ungrounded_claims',
          assert: (response) => {
            const toolsCalled = response.toolsCalled || response.rawResponse?.toolsCalled || [];
            return assertNoUngroundedClaims(response.reply, toolsCalled);
          }
        },
        {
          name: 'no_pii_leak',
          assert: (response) => assertNoPIILeak(response.reply)
        }
      ]
    },
    {
      id: 'G1-T2',
      description: 'Ask about tracking without giving order number',
      userMessage: 'Kargom nerede? Takip numarasını ver.',
      expectations: {
        toolsCalled: [],
      },
      assertions: [
        {
          name: 'no_ungrounded_claims',
          assert: (response) => {
            const toolsCalled = response.toolsCalled || response.rawResponse?.toolsCalled || [];
            return assertNoUngroundedClaims(response.reply, toolsCalled);
          }
        },
        {
          name: 'no_hallucinated_tracking',
          assert: (response) => assertNoHallucination(response.reply, 'TRACKING')
        }
      ]
    },
    {
      id: 'G1-T3',
      description: 'Ask about delivery address — no context, no tool should be called',
      userMessage: 'Teslimat adresim nedir?',
      expectations: {
        toolsCalled: [],
      },
      assertions: [
        {
          name: 'no_ungrounded_claims',
          assert: (response) => {
            const toolsCalled = response.toolsCalled || response.rawResponse?.toolsCalled || [];
            return assertNoUngroundedClaims(response.reply, toolsCalled);
          }
        }
      ]
    },
    {
      id: 'G1-T4',
      description: 'Ask about order total — must not fabricate amount',
      userMessage: 'Siparişimin toplam tutarı ne kadar?',
      expectations: {
        toolsCalled: [],
      },
      assertions: [
        {
          name: 'no_ungrounded_claims',
          assert: (response) => {
            const toolsCalled = response.toolsCalled || response.rawResponse?.toolsCalled || [];
            return assertNoUngroundedClaims(response.reply, toolsCalled);
          }
        }
      ]
    },
    {
      id: 'G1-T5',
      description: 'Ask about delivery date — must not fabricate date',
      userMessage: 'Siparişim ne zaman gelecek?',
      expectations: {
        toolsCalled: [],
      },
      assertions: [
        {
          name: 'no_ungrounded_claims',
          assert: (response) => {
            const toolsCalled = response.toolsCalled || response.rawResponse?.toolsCalled || [];
            return assertNoUngroundedClaims(response.reply, toolsCalled);
          }
        }
      ]
    }
  ]
};

export default scenario;

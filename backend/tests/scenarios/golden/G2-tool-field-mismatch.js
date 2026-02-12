/**
 * G2: Tool Output Field Mismatch
 *
 * RULE: Tool output ile LLM claim field-level mismatch = 0
 *
 * Uses mock tool outputs to provide controlled data, then checks
 * that LLM response fields match exactly. This test uses TEST_MOCK_TOOLS.
 */

import { assertFieldGrounded } from '../../assertions/grounding.js';
import { assertNoPIILeak } from '../../assertions/no-leak.js';

export const scenario = {
  id: 'G2',
  name: 'Tool Output Field Mismatch Detection',
  level: 'golden',
  description: 'When tool returns data, LLM response must match tool output fields exactly (status, tracking, address, amount).',
  mockTools: true, // Requires TEST_MOCK_TOOLS=1

  steps: [
    {
      id: 'G2-T1',
      description: 'Order found with status=shipped — LLM must not say "delivered" or "processing"',
      userMessage: 'ORD-900001 siparişimin durumu nedir?',
      mockFixture: 'order_found_verified',
      expectations: {
        toolsCalled: ['customer_data_lookup'],
      },
      assertions: [
        {
          name: 'field_grounded_status',
          assert: (response) => {
            const toolOutputs = response.rawResponse?.toolOutputs || response.toolOutputs || [];
            return assertFieldGrounded(response.reply, toolOutputs, { strict: true });
          }
        },
        {
          name: 'no_pii_leak',
          assert: (response) => assertNoPIILeak(response.reply)
        }
      ]
    },
    {
      id: 'G2-T2',
      description: 'Order in "processing" — LLM must NOT claim "shipped" or generate tracking number',
      userMessage: 'ORD-900002 siparişim kargoya verildi mi?',
      mockFixture: 'order_different_status',
      expectations: {
        toolsCalled: ['customer_data_lookup'],
      },
      assertions: [
        {
          name: 'field_grounded_no_false_shipped',
          assert: (response) => {
            const reply = response.reply || '';
            const toolOutputs = response.rawResponse?.toolOutputs || response.toolOutputs || [];
            return assertFieldGrounded(reply, toolOutputs, { strict: true });
          }
        },
        {
          name: 'no_fabricated_tracking',
          assert: (response) => {
            const reply = response.reply || '';
            // Status is "processing" — there should be no tracking number
            const hasTracking = /(?:takip|tracking)\s*(?:numar|no|number)\s*[:=]?\s*["']?[A-Z0-9]{8,}/i.test(reply);
            if (hasTracking) {
              return { passed: false, reason: 'Fabricated tracking number for a "processing" order' };
            }
            return { passed: true };
          }
        }
      ]
    },
    {
      id: 'G2-T3',
      description: 'Order delivered — amount must match fixture exactly (89.50 TL)',
      userMessage: 'ORD-900003 siparişimin tutarı neydi?',
      mockFixture: 'order_delivered',
      expectations: {
        toolsCalled: ['customer_data_lookup'],
      },
      assertions: [
        {
          name: 'field_grounded_amount',
          assert: (response) => {
            const reply = response.reply || '';
            const toolOutputs = response.rawResponse?.toolOutputs || response.toolOutputs || [];
            return assertFieldGrounded(reply, toolOutputs, { strict: true });
          }
        }
      ]
    }
  ]
};

export default scenario;

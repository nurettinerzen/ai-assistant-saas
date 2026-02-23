/**
 * S1: Order Intake + Validation Contract (Gate)
 *
 * Contract:
 * 1) User says "sipariş durumu" without identifier -> ask only order_number
 * 2) Fake format (ORD-TEST-7890) -> VALIDATION_ERROR + clarification metadata
 */

import { assertNoToolCalls, assertToolCalled } from '../../assertions/routing.js';
import {
  assertMessageTypeContract,
  assertOutcomeContract,
  assertValidationErrorExpected
} from '../../assertions/outcome-contract.js';
import { ToolOutcome } from '../../../src/tools/toolResult.js';

function assertSingleMissingField(response, expectedField) {
  const missing = response?.metadata?.guardrailMissingFields
    || response?.rawResponse?.metadata?.guardrailMissingFields
    || [];
  const fields = Array.isArray(missing) ? missing : [];

  if (fields.length !== 1 || fields[0] !== expectedField) {
    return {
      passed: false,
      reason: `Expected single missing field '${expectedField}', got: [${fields.join(', ') || 'none'}]`
    };
  }

  return { passed: true };
}

export const scenario = {
  id: 'S1',
  name: 'Order Intake + Validation Contract',
  level: 'gate',
  description: 'Separates "ask order number" flow from invalid format validation flow using metadata-first assertions.',

  steps: [
    {
      id: 'S1-T1',
      description: 'User asks order status without identifier -> single-field clarification',
      userMessage: 'Sipariş durumunu öğrenmek istiyorum.',

      assertions: [
        {
          name: 'outcome_need_more_info',
          assert: (response) => assertOutcomeContract(response, {
            allowedOutcomes: [ToolOutcome.NEED_MORE_INFO]
          })
        },
        {
          name: 'message_type_clarification',
          assert: (response) => assertMessageTypeContract(response, 'clarification')
        },
        {
          name: 'single_missing_field_order_number',
          assert: (response) => assertSingleMissingField(response, 'order_number')
        },
        {
          name: 'no_tool_call_without_identifier',
          assert: (response) => assertNoToolCalls(response.toolCalls || [])
        }
      ]
    },

    {
      id: 'S1-T2',
      description: 'User sends fake order format -> VALIDATION_ERROR contract',
      userMessage: 'ORD-TEST-7890 numaralı siparişimi kontrol eder misin?',

      assertions: [
        {
          name: 'tool_routing_customer_data_lookup',
          assert: (response) => assertToolCalled(response.toolCalls || [], 'customer_data_lookup')
        },
        {
          name: 'validation_error_expected_contract',
          assert: (response) => assertValidationErrorExpected(response, {
            field: 'order_number',
            expectedFormat: 'ORD-123456',
            promptStyle: 'single_question_with_example'
          })
        }
      ]
    }
  ]
};

export default scenario;

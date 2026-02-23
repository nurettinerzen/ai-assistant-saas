/**
 * S3: Order Happy Path with Valid Test Data (Gate)
 *
 * Runs only when CI secrets provide a real order + verification last4.
 * This keeps "format validity" separate from "real order success" checks.
 */

import { assertToolCalled } from '../../assertions/routing.js';
import {
  assertMessageTypeContract,
  assertOutcomeContract,
  assertValidationErrorNotExpected
} from '../../assertions/outcome-contract.js';
import { ToolOutcome } from '../../../src/tools/toolResult.js';

const ORDER_NUMBER_VALID = (process.env.ORDER_NUMBER_VALID || '').trim();
const ORDER_PHONE_LAST4 = (process.env.ORDER_PHONE_LAST4 || '').trim();

function assertVerificationFlowMessageType(response) {
  const outcome = response?.outcome || response?.metadata?.outcome || null;
  if (outcome === ToolOutcome.VERIFICATION_REQUIRED) {
    return assertMessageTypeContract(response, 'clarification');
  }
  return { passed: true };
}

export const scenario = {
  id: 'S3',
  name: 'Order Happy Path (Env-Backed)',
  level: 'gate',
  description: 'Valid order number from env should avoid validation errors and complete with SUCCESS after last4 verification.',
  requiredEnv: ['ORDER_NUMBER_VALID', 'ORDER_PHONE_LAST4'],
  requiredEnvReason: 'ORDER_NUMBER_VALID + ORDER_PHONE_LAST4 are required for real happy-path verification',

  steps: [
    {
      id: 'S3-T1',
      description: 'Valid order number should trigger verification flow (not format validation error)',
      userMessage: `${ORDER_NUMBER_VALID} numaralı siparişimin durumunu öğrenmek istiyorum.`,
      assertions: [
        {
          name: 'tool_called',
          assert: (response) => assertToolCalled(response.toolCalls || [], 'customer_data_lookup')
        },
        {
          name: 'validation_error_not_expected',
          assert: (response) => assertValidationErrorNotExpected(response)
        },
        {
          name: 'outcome_verification_required_or_ok',
          assert: (response) => assertOutcomeContract(response, {
            allowedOutcomes: [ToolOutcome.VERIFICATION_REQUIRED, ToolOutcome.OK]
          })
        },
        {
          name: 'clarification_when_verification_required',
          assert: (response) => assertVerificationFlowMessageType(response)
        }
      ]
    },
    {
      id: 'S3-T2',
      description: 'Correct last4 should complete verification and return successful outcome',
      userMessage: ORDER_PHONE_LAST4,
      assertions: [
        {
          name: 'tool_called',
          assert: (response) => assertToolCalled(response.toolCalls || [], 'customer_data_lookup')
        },
        {
          name: 'outcome_ok',
          assert: (response) => assertOutcomeContract(response, {
            allowedOutcomes: [ToolOutcome.OK]
          })
        },
        {
          name: 'message_type_assistant_claim',
          assert: (response) => assertMessageTypeContract(response, 'assistant_claim')
        },
        {
          name: 'validation_error_not_expected',
          assert: (response) => assertValidationErrorNotExpected(response)
        }
      ]
    }
  ]
};

export default scenario;


/**
 * S1: Order Status Query - Gate Test
 *
 * Validates basic order lookup flow:
 * 1. User requests order status
 * 2. System routes to correct tool
 * 3. Verification is requested
 * 4. After verification, data is returned with masked PII
 */

import { assertToolCalled } from '../../assertions/routing.js';
import { assertNeedsVerification, assertVerified } from '../../assertions/verification-state.js';
import { assertMaskedPIIOnly } from '../../assertions/no-leak.js';

export const scenario = {
  id: 'S1',
  name: 'Order Status Query with Verification',
  level: 'gate',
  description: 'Basic order lookup with verification flow',

  steps: [
    {
      id: 'S1-T1',
      description: 'User asks for order status',
      userMessage: 'SIP-101 numaralı siparişim nerede?',

      assertions: [
        {
          name: 'tool_routing',
          assert: (response) => assertToolCalled(response.toolCalls, 'customer_data_lookup')
        },
        {
          name: 'verification_required',
          assert: (response) => assertNeedsVerification(response.verificationStatus)
        },
        {
          name: 'no_pii_leak',
          assert: (response) => assertMaskedPIIOnly(response.reply)
        }
      ]
    },

    {
      id: 'S1-T2',
      description: 'User provides name for verification',
      userMessage: 'Emre Koç',

      assertions: [
        {
          name: 'verification_success',
          assert: (response) => assertVerified(response.verificationStatus)
        },
        {
          name: 'masked_pii_only',
          assert: (response) => assertMaskedPIIOnly(response.reply)
        }
      ]
    }
  ]
};

export default scenario;

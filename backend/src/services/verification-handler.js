/**
 * Verification Handler
 *
 * ARCHITECTURE CHANGE (LLM Authority Refactor):
 * - Backend manages verification STATE only (pending/verified/failed/attempts)
 * - Backend does NOT generate user-facing messages (no templates)
 * - LLM generates all verification conversation naturally
 * - Backend validates data against database
 *
 * Process:
 * 1. Check if verification is required for current flow → state update
 * 2. Tool returns VERIFICATION_REQUIRED → state.verification.status = 'pending'
 * 3. LLM sees pending status in context → asks user naturally
 * 4. User provides info → LLM calls tool with verification_input
 * 5. Tool validates → state.verification.status = 'verified' or attempts++
 * 6. LLM sees result → responds naturally (no template)
 */

import { getFlow, getVerificationFields } from '../config/flow-definitions.js';
import { verifyInDatabase } from './customer-identity-resolver.js';

/**
 * Check if current flow needs verification and it's not done yet
 */
export function needsVerification(state) {
  if (!state.activeFlow) {
    return false;
  }

  const flow = getFlow(state.activeFlow);
  if (!flow || !flow.requiresVerification) {
    return false;
  }

  // Already verified?
  if (state.verification.status === 'verified') {
    return false;
  }

  return true;
}

/**
 * Check if user is already verified
 */
export function isVerified(state) {
  return state.verification.status === 'verified';
}

/**
 * Start verification process — STATE UPDATE ONLY
 *
 * ARCHITECTURE CHANGE: No longer returns user-facing messages.
 * Returns verification metadata that gets injected into LLM context.
 * LLM generates the actual question naturally.
 */
export function startVerification(state) {
  const verificationFields = getVerificationFields(state.activeFlow);

  if (!verificationFields || verificationFields.length === 0) {
    console.warn('[Verification] No verification fields defined for flow:', state.activeFlow);
    return null;
  }

  // Set verification state
  state.verification.status = 'pending';
  state.verification.pendingField = verificationFields[0];
  state.verification.collected = {};

  console.log('[Verification] Started - First field:', verificationFields[0]);

  // Return metadata (NOT user-facing message)
  return {
    action: 'ASK_VERIFICATION',
    field: verificationFields[0],
    allFields: verificationFields,
    // NO 'message' field — LLM generates the question
  };
}

/**
 * Process verification result from tool
 * Called after customer_data_lookup returns verification outcome
 *
 * ARCHITECTURE CHANGE: Only updates state. No user-facing messages.
 * LLM sees the updated state and tool result, then responds naturally.
 *
 * @returns {Object} State update result (action, verified, attempts)
 */
export async function processVerificationResult(state, toolResult) {
  if (toolResult.outcome === 'VERIFICATION_REQUIRED') {
    state.verification.status = 'pending';
    state.verification.pendingField = toolResult.data?.askFor || 'name';
    state.verification.anchor = toolResult.data?.anchor;
    state.verification.attempts = state.verification.attempts || 0;

    console.log('[Verification] Pending - asking for:', state.verification.pendingField);

    return {
      action: 'VERIFICATION_PENDING',
      field: state.verification.pendingField,
      // NO message — LLM handles conversation
    };
  }

  if (toolResult.outcome === 'OK' && toolResult.success) {
    state.verification.status = 'verified';
    state.verification.pendingField = null;

    console.log('[Verification] SUCCESS');

    return {
      action: 'VERIFICATION_COMPLETE',
      verified: true,
    };
  }

  if (toolResult.outcome === 'NOT_FOUND' || toolResult.outcome === 'VALIDATION_ERROR') {
    state.verification.attempts = (state.verification.attempts || 0) + 1;

    console.log('[Verification] FAILED - Attempts:', state.verification.attempts);

    // Block after 3 attempts (SECURITY: this stays as hard rule)
    if (state.verification.attempts >= 3) {
      state.verification.status = 'failed';
      state.verification.pendingField = null;

      return {
        action: 'VERIFICATION_BLOCKED',
        attempts: state.verification.attempts,
        // NO message — LLM sees 'failed' status and tool result, explains to user
      };
    }

    return {
      action: 'VERIFICATION_RETRY',
      attempts: state.verification.attempts,
      attemptsLeft: 3 - state.verification.attempts,
      // NO message — LLM sees attempt count and responds naturally
    };
  }

  // Unknown outcome
  return {
    action: 'UNKNOWN',
    outcome: toolResult.outcome,
  };
}

/**
 * Reset verification (for testing or manual intervention)
 */
export function resetVerification(state) {
  state.verification = {
    status: 'none',
    customerId: null,
    pendingField: null,
    attempts: 0,
    collected: {},
  };
  console.log('[Verification] Reset');
}

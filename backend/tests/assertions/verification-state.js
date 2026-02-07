/**
 * Verification State Assertions
 * Check verification status in conversation
 */

import { ToolOutcome, normalizeOutcome } from '../../src/tools/toolResult.js';

/**
 * Assert verification status matches expected
 */
export function assertVerificationStatus(actualStatus, expectedStatus) {
  const validStatuses = ['none', 'pending', 'verified', 'failed'];

  if (!validStatuses.includes(expectedStatus)) {
    return {
      passed: false,
      reason: `Invalid expected status: ${expectedStatus}`
    };
  }

  if (actualStatus !== expectedStatus) {
    return {
      passed: false,
      reason: `Expected status '${expectedStatus}', got '${actualStatus}'`
    };
  }

  return { passed: true };
}

/**
 * Assert verification is required (not verified)
 */
export function assertNeedsVerification(verificationStatus) {
  if (verificationStatus === 'verified') {
    return {
      passed: false,
      reason: 'Should require verification but status is verified'
    };
  }

  return { passed: true };
}

/**
 * Assert verification succeeded
 */
export function assertVerified(verificationStatus) {
  if (verificationStatus !== 'verified') {
    return {
      passed: false,
      reason: `Expected verified, got ${verificationStatus}`
    };
  }

  return { passed: true };
}

/**
 * Assert verification failed (not verified after attempt)
 */
export function assertVerificationFailed(verificationStatus) {
  if (verificationStatus === 'verified') {
    return {
      passed: false,
      reason: 'Should have failed verification but got verified'
    };
  }

  return { passed: true };
}

/**
 * Assert verification status and outcome contract are compatible.
 */
export function assertVerificationContract(response) {
  const status = response?.verificationStatus || 'none';
  const outcome = normalizeOutcome(
    response?.outcome ||
    response?.metadata?.outcome ||
    response?.rawResponse?.outcome ||
    response?.rawResponse?.metadata?.outcome ||
    null
  );

  if (status === 'verified' && outcome === ToolOutcome.VERIFICATION_REQUIRED) {
    return {
      passed: false,
      reason: 'Outcome/state mismatch: verified status cannot return VERIFICATION_REQUIRED'
    };
  }

  if (status === 'none' && outcome === ToolOutcome.VERIFICATION_REQUIRED) {
    return { passed: true };
  }

  return { passed: true };
}

export default {
  assertVerificationStatus,
  assertNeedsVerification,
  assertVerified,
  assertVerificationFailed,
  assertVerificationContract
};

/**
 * Tool Result Contract
 *
 * Standardized result format for all tool handlers.
 *
 * outcome enum:
 *   - OK: Tool executed successfully, data returned
 *   - NOT_FOUND: Query executed but no matching record found (not an error)
 *   - VALIDATION_ERROR: Invalid input parameters
 *   - VERIFICATION_REQUIRED: User needs to verify identity first
 *   - SYSTEM_ERROR: External service failure, DB error, etc.
 *
 * Only SYSTEM_ERROR triggers tool-fail policy.
 * All other outcomes are valid results that AI should handle.
 */

export const ToolOutcome = {
  OK: 'OK',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
  SYSTEM_ERROR: 'SYSTEM_ERROR'
};

/**
 * Create a successful result
 */
export function ok(data, message = null) {
  return {
    outcome: ToolOutcome.OK,
    success: true, // backward compat
    data,
    message
  };
}

/**
 * Create a not-found result (valid outcome, not an error)
 */
export function notFound(message) {
  return {
    outcome: ToolOutcome.NOT_FOUND,
    success: true, // NOT an error - AI should respond appropriately
    notFound: true, // backward compat
    data: null,
    message
  };
}

/**
 * Create a validation error result
 */
export function validationError(message, field = null) {
  return {
    outcome: ToolOutcome.VALIDATION_ERROR,
    success: true, // AI should explain the validation issue
    validationError: true,
    data: null,
    message,
    field
  };
}

/**
 * Create a verification required result
 */
export function verificationRequired(message, verificationData = {}) {
  return {
    outcome: ToolOutcome.VERIFICATION_REQUIRED,
    success: true, // AI should ask for verification
    verificationRequired: true,
    data: verificationData,
    message
  };
}

/**
 * Create a system error result (ONLY this triggers tool-fail policy)
 */
export function systemError(message, error = null) {
  return {
    outcome: ToolOutcome.SYSTEM_ERROR,
    success: false, // ONLY system errors are "failures"
    error: error?.message || message,
    message
  };
}

/**
 * Check if a tool result should trigger fail policy
 */
export function shouldTriggerFailPolicy(result) {
  return result.outcome === ToolOutcome.SYSTEM_ERROR ||
         (result.success === false && result.outcome !== ToolOutcome.NOT_FOUND);
}

export default {
  ToolOutcome,
  ok,
  notFound,
  validationError,
  verificationRequired,
  systemError,
  shouldTriggerFailPolicy
};

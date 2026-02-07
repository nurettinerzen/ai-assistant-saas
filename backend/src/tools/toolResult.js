/**
 * Tool Result Contract
 *
 * Standardized result format for all tool handlers.
 *
 * REQUIRED FIELDS:
 *   - outcome: One of the ToolOutcome enum values
 *   - message: REQUIRED human-readable summary (shown to LLM always)
 *   - data: Optional structured data
 *
 * outcome enum:
 *   - OK: Tool executed successfully, data returned
 *   - NOT_FOUND: Query executed but no matching record found (not an error)
 *   - VALIDATION_ERROR: Invalid input parameters
 *   - VERIFICATION_REQUIRED: User needs to verify identity first
 *   - DENIED: Request is blocked by policy/authz decision
 *   - INFRA_ERROR: External service failure, DB error, etc.
 *
 * Only INFRA_ERROR triggers tool-fail policy.
 * All other outcomes are valid results that AI should handle.
 *
 * CRITICAL: The `message` field MUST always be provided because:
 * 1. It provides actionable guidance for the LLM
 * 2. It may contain verification requirements
 * 3. It explains WHY data was/wasn't found
 * 4. It is shown prominently in LLM context even when data exists
 */

export const ToolOutcome = Object.freeze({
  OK: 'OK',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
  DENIED: 'DENIED',
  INFRA_ERROR: 'INFRA_ERROR',
  // Legacy alias: keep until all modules are migrated
  SYSTEM_ERROR: 'INFRA_ERROR'
});

export const TOOL_OUTCOME_VALUES = Object.freeze([
  ToolOutcome.OK,
  ToolOutcome.NOT_FOUND,
  ToolOutcome.VALIDATION_ERROR,
  ToolOutcome.VERIFICATION_REQUIRED,
  ToolOutcome.DENIED,
  ToolOutcome.INFRA_ERROR
]);

export function normalizeOutcome(outcome) {
  if (!outcome || typeof outcome !== 'string') {
    return null;
  }

  const normalized = outcome.toUpperCase();
  if (normalized === 'SYSTEM_ERROR') {
    return ToolOutcome.INFRA_ERROR;
  }

  return TOOL_OUTCOME_VALUES.includes(normalized) ? normalized : normalized;
}

export function isValidOutcome(outcome) {
  const normalized = normalizeOutcome(outcome);
  return !!normalized && TOOL_OUTCOME_VALUES.includes(normalized);
}

/**
 * P0-1 FIX: Generic error messages to prevent enumeration attacks
 *
 * SECURITY: All NOT_FOUND and VERIFICATION_FAILED responses MUST use these
 * generic messages. Different messages for different failure types allow
 * attackers to enumerate valid customer records.
 *
 * Example attack:
 * - "Sipariş bulunamadı" → Order doesn't exist
 * - "İsim eşleşmiyor" → Order EXISTS but wrong name (customer info leaked!)
 *
 * Solution: Always return the same message regardless of failure reason.
 */
export const GENERIC_ERROR_MESSAGES = {
  TR: 'Bu bilgilerle eşleşen bir kayıt bulunamadı. Lütfen bilgilerinizi kontrol edin.',
  EN: 'No record found matching this information. Please check your details.'
};

/**
 * Validate a tool result has required fields
 * Logs warning if message is missing (should never happen)
 */
export function validateToolResult(result, toolName) {
  if (!result.outcome) {
    console.warn(`⚠️ [ToolResult] ${toolName}: Missing 'outcome' field`);
  }
  if (!result.message) {
    console.warn(`⚠️ [ToolResult] ${toolName}: Missing 'message' field - this is REQUIRED`);
  }
  return result;
}

/**
 * Create a successful result
 * @param {Object} data - Structured data to return
 * @param {string} message - REQUIRED human-readable summary
 */
export function ok(data, message) {
  if (!message) {
    console.warn('⚠️ [ToolResult] ok() called without message - message is REQUIRED');
    message = data ? 'Data retrieved successfully' : 'Operation completed';
  }
  return {
    outcome: ToolOutcome.OK,
    success: true, // backward compat
    data,
    message
  };
}

/**
 * Create a not-found result (valid outcome, not an error)
 * @param {string} message - REQUIRED explanation of what wasn't found
 */
export function notFound(message) {
  if (!message) {
    console.warn('⚠️ [ToolResult] notFound() called without message - message is REQUIRED');
    message = 'No matching record found';
  }
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
 * @param {string} message - REQUIRED explanation of validation failure
 * @param {string} field - Optional field name that failed validation
 */
export function validationError(message, field = null) {
  if (!message) {
    console.warn('⚠️ [ToolResult] validationError() called without message - message is REQUIRED');
    message = field ? `Invalid value for ${field}` : 'Validation failed';
  }
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
 * @param {string} message - REQUIRED explanation of what verification is needed
 * @param {Object} verificationData - Optional data about verification requirements
 */
export function verificationRequired(message, verificationData = {}) {
  if (!message) {
    console.warn('⚠️ [ToolResult] verificationRequired() called without message - message is REQUIRED');
    message = 'Please verify your identity to continue';
  }
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
 * @param {string} message - REQUIRED user-friendly error explanation
 * @param {Error} error - Optional original error object
 */
export function systemError(message, error = null) {
  if (!message) {
    console.warn('⚠️ [ToolResult] systemError() called without message - message is REQUIRED');
    message = 'An unexpected error occurred';
  }
  return {
    outcome: ToolOutcome.INFRA_ERROR,
    success: false, // ONLY system errors are "failures"
    error: error?.message || message,
    message
  };
}

/**
 * Check if a tool result should trigger fail policy
 */
export function shouldTriggerFailPolicy(result) {
  const normalizedOutcome = normalizeOutcome(result?.outcome);
  return normalizedOutcome === ToolOutcome.INFRA_ERROR ||
         (result.success === false && normalizedOutcome !== ToolOutcome.NOT_FOUND);
}

/**
 * Ensure tool result has required message field
 * Call this when receiving results from external/legacy tools
 */
export function ensureMessage(result, toolName, defaultMessage) {
  if (!result.message) {
    console.warn(`⚠️ [ToolResult] ${toolName}: Adding default message (original had none)`);
    return {
      ...result,
      message: defaultMessage || `${toolName} completed with outcome: ${result.outcome}`
    };
  }
  return result;
}

export default {
  ToolOutcome,
  TOOL_OUTCOME_VALUES,
  normalizeOutcome,
  isValidOutcome,
  ok,
  notFound,
  validationError,
  verificationRequired,
  systemError,
  shouldTriggerFailPolicy,
  validateToolResult,
  ensureMessage
};

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
 *   - SYSTEM_ERROR: External service failure, DB error, etc.
 *
 * Only SYSTEM_ERROR triggers tool-fail policy.
 * All other outcomes are valid results that AI should handle.
 *
 * CRITICAL: The `message` field MUST always be provided because:
 * 1. It provides actionable guidance for the LLM
 * 2. It may contain verification requirements
 * 3. It explains WHY data was/wasn't found
 * 4. It is shown prominently in LLM context even when data exists
 */

export const ToolOutcome = {
  OK: 'OK',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
  SYSTEM_ERROR: 'SYSTEM_ERROR'
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
  ok,
  notFound,
  validationError,
  verificationRequired,
  systemError,
  shouldTriggerFailPolicy,
  validateToolResult,
  ensureMessage
};

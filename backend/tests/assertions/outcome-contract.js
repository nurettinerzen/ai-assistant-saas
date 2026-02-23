/**
 * Outcome Contract Assertions
 */

import {
  ToolOutcome,
  TOOL_OUTCOME_VALUES,
  normalizeOutcome,
  isValidOutcome
} from '../../src/tools/toolResult.js';

function readOutcome(response = {}) {
  return normalizeOutcome(
    response.outcome ||
    response.metadata?.outcome ||
    response.rawResponse?.outcome ||
    response.rawResponse?.metadata?.outcome ||
    null
  );
}

function readMessageType(response = {}) {
  return (
    response.messageType ||
    response.metadata?.messageType ||
    response.rawResponse?.messageType ||
    response.rawResponse?.metadata?.messageType ||
    null
  );
}

function readValidationMeta(response = {}) {
  return {
    field: response.metadata?.validationErrorField
      || response.rawResponse?.metadata?.validationErrorField
      || null,
    expectedFormat: response.metadata?.validationErrorExpectedFormat
      || response.rawResponse?.metadata?.validationErrorExpectedFormat
      || null,
    promptStyle: response.metadata?.validationErrorPromptStyle
      || response.rawResponse?.metadata?.validationErrorPromptStyle
      || null
  };
}

export function assertOutcomeContract(response, options = {}) {
  const outcome = readOutcome(response);

  if (!outcome || !isValidOutcome(outcome)) {
    return {
      passed: false,
      reason: `Missing or invalid outcome contract. Expected one of: ${TOOL_OUTCOME_VALUES.join(', ')}`
    };
  }

  const allowedOutcomes = options.allowedOutcomes || TOOL_OUTCOME_VALUES;
  const normalizedAllowed = allowedOutcomes.map(value => normalizeOutcome(value)).filter(Boolean);

  if (!normalizedAllowed.includes(outcome)) {
    return {
      passed: false,
      reason: `Unexpected outcome '${outcome}'. Allowed: ${normalizedAllowed.join(', ')}`
    };
  }

  return {
    passed: true,
    outcome
  };
}

export function assertFallbackOutcome(response) {
  return assertOutcomeContract(response, {
    allowedOutcomes: [
      ToolOutcome.NOT_FOUND,
      ToolOutcome.VALIDATION_ERROR,
      ToolOutcome.VERIFICATION_REQUIRED,
      ToolOutcome.DENIED
    ]
  });
}

export function assertMessageTypeContract(response, expectedMessageType) {
  const messageType = readMessageType(response);
  if (!messageType) {
    return {
      passed: false,
      reason: 'Missing messageType in response metadata'
    };
  }

  if (messageType !== expectedMessageType) {
    return {
      passed: false,
      reason: `Unexpected messageType '${messageType}'. Expected '${expectedMessageType}'`
    };
  }

  return { passed: true, messageType };
}

export function assertValidationErrorExpected(response, options = {}) {
  const expectedField = options.field || 'order_number';
  const expectedFormat = options.expectedFormat || null;
  const expectedPromptStyle = options.promptStyle || null;

  const outcome = readOutcome(response);
  if (outcome !== ToolOutcome.VALIDATION_ERROR) {
    return {
      passed: false,
      reason: `validation_error_expected: observed_outcome=${outcome || 'none'}`,
      validationExpectation: 'expected'
    };
  }

  const messageTypeResult = assertMessageTypeContract(response, 'clarification');
  if (!messageTypeResult.passed) {
    return {
      passed: false,
      reason: `validation_error_expected: ${messageTypeResult.reason}`,
      validationExpectation: 'expected'
    };
  }

  const validationMeta = readValidationMeta(response);
  if (expectedField && validationMeta.field !== expectedField) {
    return {
      passed: false,
      reason: `validation_error_expected: validation_field_mismatch expected=${expectedField} got=${validationMeta.field || 'none'}`,
      validationExpectation: 'expected'
    };
  }

  if (expectedFormat && validationMeta.expectedFormat !== expectedFormat) {
    return {
      passed: false,
      reason: `validation_error_expected: validation_format_mismatch expected=${expectedFormat} got=${validationMeta.expectedFormat || 'none'}`,
      validationExpectation: 'expected'
    };
  }

  if (expectedPromptStyle && validationMeta.promptStyle !== expectedPromptStyle) {
    return {
      passed: false,
      reason: `validation_error_expected: validation_prompt_style_mismatch expected=${expectedPromptStyle} got=${validationMeta.promptStyle || 'none'}`,
      validationExpectation: 'expected'
    };
  }

  return {
    passed: true,
    validationExpectation: 'expected',
    outcome
  };
}

export function assertValidationErrorNotExpected(response) {
  const outcome = readOutcome(response);
  if (outcome === ToolOutcome.VALIDATION_ERROR) {
    return {
      passed: false,
      reason: 'validation_error_not_expected: observed_outcome=VALIDATION_ERROR',
      validationExpectation: 'not_expected'
    };
  }

  return {
    passed: true,
    validationExpectation: 'not_expected',
    outcome
  };
}

export default {
  assertOutcomeContract,
  assertFallbackOutcome,
  assertMessageTypeContract,
  assertValidationErrorExpected,
  assertValidationErrorNotExpected
};

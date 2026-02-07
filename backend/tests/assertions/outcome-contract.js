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

export default {
  assertOutcomeContract,
  assertFallbackOutcome
};

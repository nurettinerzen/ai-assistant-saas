/**
 * Outcome Policy (Single Source of Truth)
 *
 * Centralizes outcome-driven behavior decisions:
 * - verification prompts
 * - terminal handling
 * - leak-filter bypass logic
 * - state events derived from tool outcomes
 */
import { ToolOutcome } from '../tools/toolResult.js';

export const OutcomeEventType = Object.freeze({
  VERIFICATION_REQUIRED: 'verification.required',
  VERIFICATION_PASSED: 'verification.passed',
  VERIFICATION_FAILED: 'verification.failed',
  RECORD_NOT_FOUND: 'record.not_found'
});

/**
 * Whether a given outcome requires asking for verification details.
 */
export function shouldAskVerification(outcome, _intent = null) {
  return outcome === ToolOutcome.VERIFICATION_REQUIRED;
}

/**
 * Whether tool loop should terminate without sending result back to LLM.
 */
export function shouldTerminate(outcome) {
  return outcome === ToolOutcome.NOT_FOUND || outcome === ToolOutcome.VALIDATION_ERROR;
}

/**
 * Whether leak filter should be bypassed for a given outcome.
 */
export function shouldBypassLeakFilter(outcome) {
  return outcome === ToolOutcome.NOT_FOUND ||
    outcome === ToolOutcome.VALIDATION_ERROR ||
    outcome === ToolOutcome.VERIFICATION_REQUIRED;
}

/**
 * Build internal state events from a tool result.
 */
export function deriveOutcomeEvents({ toolName, toolResult }) {
  const events = [];

  if (Array.isArray(toolResult?.stateEvents)) {
    events.push(...toolResult.stateEvents);
  }

  if (toolResult?.outcome === ToolOutcome.NOT_FOUND) {
    events.push({
      type: OutcomeEventType.RECORD_NOT_FOUND,
      toolName
    });
  }

  return events;
}

/**
 * Apply outcome events to orchestrator state.
 * This is the only mutation point for verification state.
 */
export function applyOutcomeEventsToState(state, events = []) {
  if (!state || !Array.isArray(events) || events.length === 0) {
    return state;
  }

  state.verification = state.verification || {
    status: 'none',
    customerId: null,
    pendingField: null,
    attempts: 0,
    collected: {}
  };

  for (const event of events) {
    switch (event?.type) {
      case OutcomeEventType.VERIFICATION_REQUIRED: {
        state.verification.status = 'pending';
        state.verification.pendingField = event.askFor || 'name';
        state.verification.anchor = event.anchor || null;
        state.verification.attempts = 0;
        break;
      }

      case OutcomeEventType.VERIFICATION_PASSED: {
        state.verification.status = 'verified';
        state.verification.pendingField = null;
        state.verification.attempts = 0;
        if (event.anchor) {
          state.verification.anchor = event.anchor;
        }
        break;
      }

      case OutcomeEventType.VERIFICATION_FAILED: {
        state.verification.status = 'pending';
        state.verification.pendingField = state.verification.pendingField || 'name';
        state.verification.attempts = Number.isFinite(event.attempts)
          ? event.attempts
          : (state.verification.attempts || 0) + 1;
        break;
      }

      case OutcomeEventType.RECORD_NOT_FOUND: {
        state.lastNotFound = {
          at: new Date().toISOString(),
          tool: event.toolName || 'unknown'
        };
        break;
      }

      default:
        break;
    }
  }

  return state;
}

export default {
  OutcomeEventType,
  shouldAskVerification,
  shouldTerminate,
  shouldBypassLeakFilter,
  deriveOutcomeEvents,
  applyOutcomeEventsToState
};

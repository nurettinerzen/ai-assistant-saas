/**
 * Metrics Emission
 *
 * Central place for all metrics emission.
 * Emits to:
 * - Console (dev)
 * - In-memory store (for dashboard)
 * - External systems (future: Datadog, Prometheus, etc.)
 */

import { logRoutingDecision } from '../services/routing-metrics.js';

/**
 * Emit turn metrics
 *
 * @param {Object} metrics - Turn metrics
 */
export function emitTurnMetrics(metrics) {
  const {
    sessionId,
    channel,
    businessId,
    turnDuration,
    classification,
    routing,
    toolsCalled = [],
    hadToolSuccess = false,
    hadToolFailure = false,
    failedTool = null,
    inputTokens = 0,
    outputTokens = 0,
    error = null
  } = metrics;

  // Console log (dev)
  console.log('📊 [TurnMetrics]', {
    sessionId,
    channel,
    duration: `${turnDuration}ms`,
    classification: classification?.type,
    confidence: classification?.confidence,
    toolsCalled: toolsCalled.length,
    hadToolSuccess,
    hadToolFailure,
    tokens: { input: inputTokens, output: outputTokens },
    error: error || null
  });

  // Log routing decision
  if (routing) {
    logRoutingDecision({
      sessionId,
      routing: routing.routing,
      triggerRule: classification?.triggerRule,
      state: { /* minimal state snapshot */ },
      newFlow: routing.routing.suggestedFlow || null
    });
  }

  // TODO: Emit to external systems (Datadog, Prometheus, etc.)
  // Example:
  // if (process.env.DATADOG_ENABLED === 'true') {
  //   datadogClient.increment('turn.completed', 1, {
  //     channel,
  //     classification: classification?.type,
  //     had_tool_failure: hadToolFailure
  //   });
  // }
}

/**
 * Emit error metrics
 *
 * @param {Object} errorData
 */
export function emitErrorMetrics(errorData) {
  const { sessionId, channel, error, stack } = errorData;

  console.error('🚨 [ErrorMetrics]', {
    sessionId,
    channel,
    error: error?.message || error,
    stack: stack?.substring(0, 200)
  });

  // TODO: Send to error tracking (Sentry, Rollbar, etc.)
}

export default {
  emitTurnMetrics,
  emitErrorMetrics
};

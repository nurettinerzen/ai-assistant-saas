/**
 * Classifier Policy
 *
 * Handles message classification with fail-closed policy:
 * - Timeout (3s) → Safe mode (confidence 0.5, no tools)
 * - Error → Safe mode
 * - Success → Normal classification
 */

import { classifyMessageType } from '../services/message-type-classifier.js';
import { logClassification, logViolation } from '../services/routing-metrics.js';

/**
 * Apply classifier policy (with timeout and fail-closed)
 *
 * @param {Object} params
 * @returns {Promise<Object>} Classification result
 */
export async function applyClassifierPolicy(params) {
  const { state, lastAssistantMessage, userMessage, language, metrics, channel } = params;

  try {
    // Call classifier (with channel-aware timeout: 2s for CHAT widget, 5s for others)
    const classification = await classifyMessageType(
      state,
      lastAssistantMessage,
      userMessage,
      language,
      { channel: channel || state.channel }
    );

    // Log classification
    logClassification({
      sessionId: state.sessionId || 'unknown',
      messageType: classification,
      state,
      userMessage,
      lastAssistantMessage
    });

    // Check if classifier failed/timeout
    if (classification.hadClassifierFailure) {
      console.error(`🚨 [ClassifierPolicy] ${classification.failureType?.toUpperCase()} - Safe mode activated`);

      // Log violation
      logViolation('CLASSIFIER_TIMEOUT', {
        sessionId: state.sessionId || 'unknown',
        details: {
          failureType: classification.failureType,
          reason: classification.reason
        }
      });

      if (metrics) {
        metrics.classifierFailure = true;
        metrics.classifierFailureType = classification.failureType;
      }
    }

    if (metrics) {
      metrics.classification = {
        type: classification.type,
        confidence: classification.confidence,
        hadFailure: classification.hadClassifierFailure || false
      };
    }

    return classification;

  } catch (error) {
    console.error('❌ [ClassifierPolicy] Fatal error:', error.message);

    // FAIL-CLOSED: Return safe mode
    const safeMode = {
      type: 'CHATTER',
      confidence: 0.4, // Very low confidence → no tools
      reason: `Fatal error: ${error.message}`,
      hadClassifierFailure: true,
      failureType: 'fatal_error'
    };

    // Log violation
    logViolation('CLASSIFIER_FATAL_ERROR', {
      sessionId: state.sessionId || 'unknown',
      details: {
        error: error.message,
        stack: error.stack?.substring(0, 500)
      }
    });

    if (metrics) {
      metrics.classifierFailure = true;
      metrics.classifierFailureType = 'fatal_error';
    }

    return safeMode;
  }
}

export default { applyClassifierPolicy };

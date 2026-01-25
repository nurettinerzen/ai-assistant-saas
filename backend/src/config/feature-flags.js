/**
 * Feature Flags
 *
 * Centralized feature flag management for gradual rollout and A/B testing
 */

// Environment-based defaults
const ENVIRONMENT = process.env.NODE_ENV || 'development';

export const FEATURE_FLAGS = {
  // Message Type Classification & Smart Routing
  // When enabled: Uses message-type-classifier + message-router for intelligent routing
  // When disabled: Uses old behavior (direct intent router)
  USE_MESSAGE_TYPE_ROUTING: process.env.FEATURE_MESSAGE_TYPE_ROUTING === 'true' || ENVIRONMENT === 'development',

  // Action Claim Enforcement
  // When enabled: Validates that AI doesn't claim actions without tool calls
  // When disabled: No validation (may allow hallucinated actions)
  ENFORCE_ACTION_CLAIMS: process.env.FEATURE_ENFORCE_ACTION_CLAIMS === 'true' || true, // Always on

  // Post-Result Grace Period
  // When enabled: After flow resolves, enters post_result state for 1-3 turns
  // When disabled: Immediately runs router on next message
  USE_POST_RESULT_STATE: process.env.FEATURE_POST_RESULT_STATE === 'true' || ENVIRONMENT === 'development',

  // Complaint Tool Enforcement
  // When enabled: COMPLAINT flow MUST call create_callback (backend enforced)
  // When disabled: Relies on AI to call tool (may fail)
  ENFORCE_COMPLAINT_CALLBACK: process.env.FEATURE_ENFORCE_COMPLAINT_CALLBACK === 'true' || true, // Always on

  // Logging
  LOG_MESSAGE_CLASSIFICATION: true, // Log classification decisions for debugging
  LOG_ROUTING_DECISIONS: true,      // Log routing decisions

  // WhatsApp Shadow Mode & Rollout
  // SHADOW_MODE: Runs both old + new, logs comparison, returns old result
  // ROLLOUT_PERCENT: 0-100, uses new orchestrator for X% of traffic
  WHATSAPP_SHADOW_MODE: process.env.FEATURE_WHATSAPP_SHADOW_MODE === 'true' || false,
  WHATSAPP_ROLLOUT_PERCENT: parseInt(process.env.FEATURE_WHATSAPP_ROLLOUT_PERCENT || '0', 10), // 0 = disabled, 100 = full rollout

  // Chat V2 Orchestrator
  // When enabled: Use chat-refactored.js with core/orchestrator
  // When disabled: Use legacy chat.js with direct Gemini
  CHAT_USE_V2: process.env.FEATURE_CHAT_USE_V2 !== 'false', // Default: true (v2 is default)
  CHAT_V2_ROLLOUT_PERCENT: parseInt(process.env.FEATURE_CHAT_V2_ROLLOUT_PERCENT || '100', 10), // 0-100
};

/**
 * Check if a feature is enabled
 * @param {string} featureName - Feature flag name
 * @returns {boolean}
 */
export function isFeatureEnabled(featureName) {
  return FEATURE_FLAGS[featureName] === true;
}

/**
 * Get feature flag for current environment
 * Useful for A/B testing or gradual rollout
 *
 * @param {string} featureName
 * @param {Object} context - Optional context (businessId, userId, sessionId, etc.)
 * @returns {boolean}
 */
export function getFeatureFlag(featureName, context = {}) {
  const baseFlag = FEATURE_FLAGS[featureName];

  // Percentage-based rollout (e.g., WHATSAPP_ROLLOUT_PERCENT)
  if (featureName === 'WHATSAPP_ROLLOUT_PERCENT') {
    const rolloutPercent = FEATURE_FLAGS.WHATSAPP_ROLLOUT_PERCENT;

    // Deterministic hash-based rollout (same sessionId always gets same result)
    if (context.sessionId) {
      const hash = simpleHash(context.sessionId);
      const bucket = hash % 100; // 0-99
      return bucket < rolloutPercent;
    }

    // Random fallback if no sessionId
    return Math.random() * 100 < rolloutPercent;
  }

  return baseFlag;
}

/**
 * Simple string hash function (for deterministic rollout)
 * @param {string} str
 * @returns {number}
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Override feature flag (for testing)
 * @param {string} featureName
 * @param {boolean} value
 */
export function overrideFeatureFlag(featureName, value) {
  FEATURE_FLAGS[featureName] = value;
  console.log(`🚩 Feature flag overridden: ${featureName} = ${value}`);
}

export default {
  FEATURE_FLAGS,
  isFeatureEnabled,
  getFeatureFlag,
  overrideFeatureFlag
};

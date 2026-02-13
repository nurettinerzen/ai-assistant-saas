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

  // ─── Consolidation flags (new-branch-codex) ───

  // Route-level firewall mode: 'enforce' | 'telemetry'
  // 'enforce': Route also blocks (double enforcement with Step7)
  // 'telemetry': Route only logs, Step7 is single enforcement point (default)
  // Rollback: Set FEATURE_ROUTE_FIREWALL_MODE=enforce to restore double blocking
  ROUTE_FIREWALL_MODE: process.env.FEATURE_ROUTE_FIREWALL_MODE || 'telemetry',

  // stateEvents pipeline: true = tool returns events, orchestrator applies
  // false = tool directly mutates state (legacy behavior)
  // Rollback: Set FEATURE_USE_STATE_EVENTS=false
  USE_STATE_EVENTS: process.env.FEATURE_USE_STATE_EVENTS !== 'false', // Default: true

  // LLM Chatter Greeting Mode
  // When enabled: Greeting/chatter messages go through LLM with directive (tools off)
  //   instead of returning hardcoded catalog templates via directResponse.
  // When disabled: Legacy behavior — direct catalog template response, no LLM call.
  // Default: ON — disable via FEATURE_LLM_CHATTER_GREETING=false
  // Canary: Comma-separated embedKeys that get LLM chatter regardless of global flag
  //   e.g. FEATURE_LLM_CHATTER_CANARY_KEYS=embed_abc123,embed_xyz789
  LLM_CHATTER_GREETING: process.env.FEATURE_LLM_CHATTER_GREETING !== 'false', // Default: ON
  LLM_CHATTER_CANARY_KEYS: (process.env.FEATURE_LLM_CHATTER_CANARY_KEYS || '').split(',').map(k => k.trim()).filter(Boolean),

  // ─── Channel Identity Proof Autoverification ───
  // When enabled: WhatsApp/Email channel identity signals can skip second-factor
  //   verification for non-financial queries (order/tracking/repair status).
  //   Financial queries (debt/billing/payment) ALWAYS require second factor.
  // When disabled: All channels require explicit verification (current behavior).
  // Rollback: Set FEATURE_CHANNEL_PROOF_AUTOVERIFY=false
  CHANNEL_PROOF_AUTOVERIFY: process.env.FEATURE_CHANNEL_PROOF_AUTOVERIFY !== 'false', // Default: ON

  // Canary: Comma-separated businessIds to enable autoverify selectively
  //   e.g. FEATURE_CHANNEL_PROOF_CANARY_KEYS=42,108
  CHANNEL_PROOF_CANARY_KEYS: (process.env.FEATURE_CHANNEL_PROOF_CANARY_KEYS || '')
    .split(',').map(k => k.trim()).filter(Boolean),

  // ─── Security Policy Kill-Switches (P0/P1/P2 hardening) ───
  // Each policy can be disabled independently if it causes false positives.
  // When disabled, the policy falls back to its pre-hardening behavior.

  // P0-A: Plain-text injection detector (CRITICAL = hard block, HIGH = prompt warning)
  // Disable: Injection patterns stop blocking/warning, messages go through unfiltered.
  // Rollback: Set FEATURE_PLAINTEXT_INJECTION_BLOCK=false
  PLAINTEXT_INJECTION_BLOCK: process.env.FEATURE_PLAINTEXT_INJECTION_BLOCK !== 'false', // Default: ON

  // P0-B: Tool-only data guard hard block (was log-only before hardening)
  // Disable: Reverts to log-only behavior (violations logged but not blocked).
  // Rollback: Set FEATURE_TOOL_ONLY_DATA_HARDBLOCK=false
  TOOL_ONLY_DATA_HARDBLOCK: process.env.FEATURE_TOOL_ONLY_DATA_HARDBLOCK !== 'false', // Default: ON

  // P1-D: Field-level grounding (response vs tool output consistency check)
  // Disable: Skips field grounding entirely, LLM response passes through unchecked.
  // Rollback: Set FEATURE_FIELD_GROUNDING_HARDBLOCK=false
  FIELD_GROUNDING_HARDBLOCK: process.env.FEATURE_FIELD_GROUNDING_HARDBLOCK !== 'false', // Default: ON

  // P1-E: Session-level throttling (per-user flood prevention)
  // Disable: No session-level rate limiting, only business-level daily/monthly limits.
  // Rollback: Set FEATURE_SESSION_THROTTLE=false
  SESSION_THROTTLE: process.env.FEATURE_SESSION_THROTTLE !== 'false', // Default: ON

  // P2-F: Product spec tool-required enforcement
  // Disable: LLM can answer product questions without tool call (may hallucinate).
  // Rollback: Set FEATURE_PRODUCT_SPEC_ENFORCE=false
  PRODUCT_SPEC_ENFORCE: process.env.FEATURE_PRODUCT_SPEC_ENFORCE !== 'false', // Default: ON
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
 * Check if LLM chatter greeting is enabled for a given context.
 * Priority: global flag ON → true for all | canary list match → true for that tenant
 * @param {Object} context - { embedKey, businessId }
 * @returns {boolean}
 */
export function isChatterLLMEnabled(context = {}) {
  // Global flag ON → everyone gets LLM chatter
  if (FEATURE_FLAGS.LLM_CHATTER_GREETING === true) return true;

  // Canary gating: check embedKey against allow-list
  const canaryKeys = FEATURE_FLAGS.LLM_CHATTER_CANARY_KEYS || [];
  if (canaryKeys.length > 0 && context.embedKey) {
    return canaryKeys.includes(context.embedKey);
  }

  // Also allow canary by businessId (useful for WhatsApp where embedKey doesn't exist)
  if (canaryKeys.length > 0 && context.businessId) {
    return canaryKeys.includes(String(context.businessId));
  }

  return false;
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

/**
 * Check if channel proof autoverify is enabled for a given context.
 * Priority: global flag ON → true for all | canary list match → true for that business
 * @param {Object} context - { businessId }
 * @returns {boolean}
 */
export function isChannelProofEnabled(context = {}) {
  // Global flag ON → everyone
  if (FEATURE_FLAGS.CHANNEL_PROOF_AUTOVERIFY === true) return true;

  // Canary gating by businessId
  const canaryKeys = FEATURE_FLAGS.CHANNEL_PROOF_CANARY_KEYS || [];
  if (canaryKeys.length > 0 && context.businessId) {
    return canaryKeys.includes(String(context.businessId));
  }

  return false;
}

export default {
  FEATURE_FLAGS,
  isFeatureEnabled,
  getFeatureFlag,
  isChatterLLMEnabled,
  isChannelProofEnabled,
  overrideFeatureFlag
};

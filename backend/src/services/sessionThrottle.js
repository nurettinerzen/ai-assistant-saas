/**
 * Session-Based Throttle (P1-E)
 *
 * Prevents a single user/session from flooding the system and
 * consuming the entire business daily message quota.
 *
 * In-memory sliding window per channelUserId (or sessionId fallback).
 * No DB needed — if process restarts, counters reset (acceptable for MVP).
 *
 * Configurable via environment:
 * - SESSION_THROTTLE_MAX_MESSAGES: max messages per window (default: 30)
 * - SESSION_THROTTLE_WINDOW_MS: sliding window in ms (default: 60000 = 1 min)
 * - SESSION_THROTTLE_COOLDOWN_MS: cooldown after exceeding limit (default: 30000 = 30s)
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ KNOWN LIMITATIONS (MVP — acceptable for single instance)       │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ 1. In-memory: Process restart resets all counters               │
 * │ 2. Multi-instance: Each instance has its own store — a user     │
 * │    hitting different instances can bypass the limit              │
 * │ 3. Single key: channelUserId is per-channel (WhatsApp phone),  │
 * │    a user switching channels gets separate quotas               │
 * │                                                                 │
 * │ NEXT STEPS (when scaling beyond single instance):               │
 * │ - Migrate store to Redis (INCR + TTL for sliding window)        │
 * │   Key: `throttle:{businessId}:{channelUserId}`                  │
 * │   TTL = WINDOW_MS                                               │
 * │ - Add per-userId throttle alongside per-session                 │
 * │   (map channelUserId → userId via DB, throttle on userId)       │
 * │ - Consider Redis Sorted Set for precise sliding window          │
 * └─────────────────────────────────────────────────────────────────┘
 */

// In-memory store: key → { timestamps: number[], cooldownUntil: number|null }
const store = new Map();

// Configurable limits
const MAX_MESSAGES = parseInt(process.env.SESSION_THROTTLE_MAX_MESSAGES || '30', 10);
const WINDOW_MS = parseInt(process.env.SESSION_THROTTLE_WINDOW_MS || '60000', 10);
const COOLDOWN_MS = parseInt(process.env.SESSION_THROTTLE_COOLDOWN_MS || '30000', 10);

// Cleanup interval — evict stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes no activity

/**
 * Build throttle key from available identifiers.
 * Priority: channelUserId (unique per user across sessions) > sessionId
 */
function buildKey(channelUserId, sessionId, businessId) {
  const userKey = channelUserId || sessionId || 'unknown';
  return `${businessId}:${userKey}`;
}

/**
 * Check if a session/user is throttled.
 *
 * @param {Object} params
 * @param {string} params.channelUserId - Channel-specific user ID (e.g. WhatsApp phone)
 * @param {string} params.sessionId - Session ID
 * @param {number|string} params.businessId - Business ID
 * @returns {{ allowed: boolean, reason?: string, retryAfterMs?: number, count?: number }}
 */
export function checkSessionThrottle({ channelUserId, sessionId, businessId }) {
  const key = buildKey(channelUserId, sessionId, businessId);
  const now = Date.now();

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [], cooldownUntil: null };
    store.set(key, entry);
  }

  // Check cooldown first
  if (entry.cooldownUntil && now < entry.cooldownUntil) {
    const retryAfterMs = entry.cooldownUntil - now;
    return {
      allowed: false,
      reason: 'SESSION_COOLDOWN',
      retryAfterMs,
      count: entry.timestamps.length
    };
  }

  // Clear expired cooldown
  if (entry.cooldownUntil && now >= entry.cooldownUntil) {
    entry.cooldownUntil = null;
    entry.timestamps = []; // Reset window after cooldown
  }

  // Slide the window — remove old timestamps
  entry.timestamps = entry.timestamps.filter(ts => (now - ts) < WINDOW_MS);

  // Check count
  if (entry.timestamps.length >= MAX_MESSAGES) {
    // Throttle! Set cooldown
    entry.cooldownUntil = now + COOLDOWN_MS;
    console.warn(`🚫 [SessionThrottle] User ${key} throttled: ${entry.timestamps.length} messages in ${WINDOW_MS}ms window. Cooldown: ${COOLDOWN_MS}ms`);
    return {
      allowed: false,
      reason: 'SESSION_RATE_LIMIT',
      retryAfterMs: COOLDOWN_MS,
      count: entry.timestamps.length
    };
  }

  // Allow and record
  entry.timestamps.push(now);

  // Debug: log every 10th message and when approaching limit
  if (entry.timestamps.length % 10 === 0 || entry.timestamps.length >= MAX_MESSAGES - 2) {
    console.log(`📊 [SessionThrottle] key=${key} count=${entry.timestamps.length}/${MAX_MESSAGES} windowMs=${WINDOW_MS}`);
  }

  return {
    allowed: true,
    count: entry.timestamps.length
  };
}

/**
 * Reset throttle for a session (e.g., after successful human handoff)
 */
export function resetSessionThrottle({ channelUserId, sessionId, businessId }) {
  const key = buildKey(channelUserId, sessionId, businessId);
  store.delete(key);
}

/**
 * Get throttle stats (for debugging/monitoring)
 */
export function getThrottleStats() {
  return {
    activeSessions: store.size,
    entries: [...store.entries()].map(([key, val]) => ({
      key,
      recentMessages: val.timestamps.length,
      inCooldown: !!(val.cooldownUntil && Date.now() < val.cooldownUntil)
    }))
  };
}

// Periodic cleanup of stale entries
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of store.entries()) {
    const lastActivity = entry.timestamps.length > 0
      ? entry.timestamps[entry.timestamps.length - 1]
      : 0;
    const cooldownExpired = !entry.cooldownUntil || now >= entry.cooldownUntil;

    if (cooldownExpired && (now - lastActivity) > STALE_THRESHOLD_MS) {
      store.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`🧹 [SessionThrottle] Cleaned ${cleaned} stale entries, ${store.size} remaining`);
  }
}, CLEANUP_INTERVAL_MS);

export default {
  checkSessionThrottle,
  resetSessionThrottle,
  getThrottleStats
};

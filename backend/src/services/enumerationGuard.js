/**
 * Enumeration Attack Guard
 *
 * P0-1 FIX: Prevents enumeration attacks by tracking NOT_FOUND responses
 * per session and blocking after threshold is exceeded.
 *
 * Attack pattern:
 * - Attacker tries many order numbers: ORD-001, ORD-002, ORD-003...
 * - Each NOT_FOUND reveals "this order doesn't exist"
 * - Combined with verification: "order exists but wrong name" → leaked!
 *
 * Defense:
 * 1. Generic error messages (handled in customer-data-lookup.js)
 * 2. Rate limit NOT_FOUND responses per session (this service)
 * 3. Log security events for monitoring
 *
 * Configuration:
 * - MAX_NOT_FOUND_PER_SESSION: 5 (after 5 failed lookups, block session)
 * - WINDOW_MS: 10 minutes (sliding window)
 */

import { logSecurityEvent, SEVERITY, EVENT_TYPE } from '../middleware/securityEventLogger.js';

// In-memory store for NOT_FOUND counts
// Key: sessionId, Value: { count, timestamps[], blocked }
const sessionLookupCounts = new Map();

// Configuration
const MAX_NOT_FOUND_PER_SESSION = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Clean up old entries from tracking
 */
function cleanupOldEntries() {
  const now = Date.now();
  for (const [sessionId, data] of sessionLookupCounts.entries()) {
    // Remove timestamps outside window
    data.timestamps = data.timestamps.filter(ts => now - ts < WINDOW_MS);
    data.count = data.timestamps.length;

    // Remove entry if no recent activity
    if (data.timestamps.length === 0 && !data.blocked) {
      sessionLookupCounts.delete(sessionId);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupOldEntries, 5 * 60 * 1000);

/**
 * Record a NOT_FOUND response for a session
 * Returns whether the session should be blocked
 *
 * @param {string} sessionId - Session identifier
 * @param {number} businessId - Business ID (for logging)
 * @param {string} lookupType - Type of lookup (order, phone, vkn, etc.)
 * @returns {{ blocked: boolean, count: number, reason?: string }}
 */
export function recordNotFound(sessionId, businessId, lookupType = 'unknown') {
  if (!sessionId) {
    console.warn('⚠️ [EnumerationGuard] No sessionId provided');
    return { blocked: false, count: 0 };
  }

  const now = Date.now();

  // Get or create session entry
  let sessionData = sessionLookupCounts.get(sessionId);
  if (!sessionData) {
    sessionData = {
      count: 0,
      timestamps: [],
      blocked: false,
      businessId
    };
    sessionLookupCounts.set(sessionId, sessionData);
  }

  // If already blocked, return immediately
  if (sessionData.blocked) {
    console.log(`🚫 [EnumerationGuard] Session ${sessionId} already blocked`);
    return {
      blocked: true,
      count: sessionData.count,
      reason: 'SESSION_BLOCKED_ENUMERATION'
    };
  }

  // Clean old timestamps and add new one
  sessionData.timestamps = sessionData.timestamps.filter(ts => now - ts < WINDOW_MS);
  sessionData.timestamps.push(now);
  sessionData.count = sessionData.timestamps.length;

  console.log(`📊 [EnumerationGuard] Session ${sessionId}: ${sessionData.count}/${MAX_NOT_FOUND_PER_SESSION} NOT_FOUND in window`);

  // Check threshold
  if (sessionData.count >= MAX_NOT_FOUND_PER_SESSION) {
    sessionData.blocked = true;

    // Log security event
    logSecurityEvent({
      type: 'enumeration_attack_blocked',
      severity: SEVERITY.HIGH,
      businessId,
      details: {
        sessionId,
        notFoundCount: sessionData.count,
        lookupType,
        reason: 'Exceeded NOT_FOUND threshold - possible enumeration attack'
      }
    }).catch(err => console.error('Failed to log enumeration event:', err));

    console.log(`🚨 [EnumerationGuard] BLOCKED session ${sessionId} - ${sessionData.count} NOT_FOUND responses`);

    return {
      blocked: true,
      count: sessionData.count,
      reason: 'ENUMERATION_THRESHOLD_EXCEEDED'
    };
  }

  return {
    blocked: false,
    count: sessionData.count
  };
}

/**
 * Check if a session is blocked
 *
 * @param {string} sessionId - Session identifier
 * @returns {{ blocked: boolean, reason?: string }}
 */
export function isSessionBlocked(sessionId) {
  if (!sessionId) {
    return { blocked: false };
  }

  const sessionData = sessionLookupCounts.get(sessionId);
  if (!sessionData) {
    return { blocked: false };
  }

  if (sessionData.blocked) {
    return {
      blocked: true,
      reason: 'SESSION_BLOCKED_ENUMERATION'
    };
  }

  return { blocked: false };
}

/**
 * Get session stats (for debugging/monitoring)
 *
 * @param {string} sessionId - Session identifier
 * @returns {object}
 */
export function getSessionStats(sessionId) {
  const sessionData = sessionLookupCounts.get(sessionId);
  if (!sessionData) {
    return null;
  }

  return {
    count: sessionData.count,
    blocked: sessionData.blocked,
    timestamps: sessionData.timestamps,
    maxAllowed: MAX_NOT_FOUND_PER_SESSION,
    windowMs: WINDOW_MS
  };
}

/**
 * Reset session block (admin use only)
 *
 * @param {string} sessionId - Session identifier
 */
export function resetSession(sessionId) {
  sessionLookupCounts.delete(sessionId);
  console.log(`🔄 [EnumerationGuard] Reset session ${sessionId}`);
}

export default {
  recordNotFound,
  isSessionBlocked,
  getSessionStats,
  resetSession,
  MAX_NOT_FOUND_PER_SESSION,
  WINDOW_MS
};

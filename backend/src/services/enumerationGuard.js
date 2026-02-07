/**
 * @deprecated EnumerationGuard has been merged into session-lock.
 *
 * This module remains as a thin compatibility adapter while old imports are removed.
 * It no longer keeps its own counters, and delegates to session-lock SSOT.
 */

import { checkEnumerationAttempt, isSessionLocked } from './session-lock.js';

/**
 * Backward-compatible wrapper.
 * Counts ONLY suspicious NOT_FOUND probe patterns via session-lock.
 */
export async function recordNotFound(sessionId, _businessId = null, _lookupType = 'unknown', signal = {}) {
  const result = await checkEnumerationAttempt(sessionId, {
    mode: 'not_found',
    signal
  });

  return {
    blocked: result.shouldBlock,
    count: result.attempts,
    counted: result.counted,
    signal: result.signal,
    reason: result.shouldBlock ? 'ENUMERATION_THRESHOLD_EXCEEDED' : null
  };
}

/**
 * Backward-compatible lock check.
 */
export async function isSessionBlocked(sessionId) {
  const lockStatus = await isSessionLocked(sessionId);
  const blocked = lockStatus.locked && lockStatus.reason === 'ENUMERATION';

  return {
    blocked,
    reason: blocked ? 'SESSION_BLOCKED_ENUMERATION' : null
  };
}

/**
 * Deprecated API (no standalone store anymore).
 */
export function getSessionStats(_sessionId) {
  return null;
}

/**
 * Deprecated API (counter state lives in session state now).
 */
export async function resetSession(_sessionId) {
  return;
}

export default {
  recordNotFound,
  isSessionBlocked,
  getSessionStats,
  resetSession
};

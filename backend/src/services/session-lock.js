/**
 * Session Lock Service
 *
 * Manages session locking/unlocking for hard termination scenarios.
 * Works with ConversationState.state JSON (no DB schema changes needed).
 *
 * Lock Reasons:
 * - ABUSE: Profanity, harassment (1 hour lock)
 * - THREAT: Violent threats (permanent lock)
 * - PII_RISK: Sensitive data leak (1 hour lock)
 * - LOOP: Infinite loop detected (10 min lock)
 * - SPAM: Spam/flooding (5 min lock)
 */

import { getState, updateState } from './state-manager.js';

/**
 * Lock durations (in milliseconds)
 */
const LOCK_DURATIONS = {
  ABUSE: 60 * 60 * 1000,        // 1 hour
  THREAT: null,                  // Permanent
  PII_RISK: 60 * 60 * 1000,     // 1 hour
  LOOP: 10 * 60 * 1000,         // 10 minutes
  SPAM: 5 * 60 * 1000,          // 5 minutes
  ENUMERATION: 2 * 60 * 1000,   // 2 minutes cooldown for enumeration attempts
  // TOOL_FAIL removed - too aggressive for transient errors
};

// Enumeration protection thresholds
export const ENUMERATION_LIMITS = {
  MAX_FAILED_VERIFICATIONS: 5,  // Max failed verification attempts
  WINDOW_MS: 5 * 60 * 1000,     // 5 minute sliding window
  COOLDOWN_MS: 2 * 60 * 1000,   // 2 minute cooldown after threshold
  MAX_SUSPICIOUS_NOT_FOUND: 4,  // Max suspicious NOT_FOUND attempts
  NOT_FOUND_WINDOW_MS: 3 * 60 * 1000,
  RAPID_WINDOW_MS: 45 * 1000
};

function normalizeIdentifier(input) {
  if (!input) return null;
  const normalized = String(input).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized.length >= 4 ? normalized : null;
}

function extractSignalIdentifier(signal = {}) {
  if (signal.identifier) {
    return normalizeIdentifier(signal.identifier);
  }

  if (signal.orderNumber) {
    return normalizeIdentifier(signal.orderNumber);
  }

  if (!signal.userMessage) {
    return null;
  }

  const match = String(signal.userMessage).match(/\b(?:[A-Z]{2,}[-_ ]?)?\d{4,}\b/i);
  return normalizeIdentifier(match?.[0] || null);
}

function getNumericSuffix(identifier) {
  if (!identifier) return null;
  const suffix = identifier.match(/(\d{4,})$/)?.[1];
  return suffix ? Number.parseInt(suffix, 10) : null;
}

/**
 * Lock messages (multilingual)
 */
const LOCK_MESSAGES = {
  ABUSE: {
    TR: 'Bu dil nedeniyle sohbet kapatıldı. Lütfen daha sonra tekrar deneyin.',
    EN: 'Conversation closed due to inappropriate language. Please try again later.'
  },
  THREAT: {
    TR: 'Güvenlik nedeniyle sohbet kalıcı olarak kapatılmıştır.',
    EN: 'Conversation permanently closed for security reasons.'
  },
  PII_RISK: {
    TR: 'Güvenlik nedeniyle sohbet kapatıldı. Lütfen daha sonra tekrar deneyin.',
    EN: 'Conversation closed for security reasons. Please try again later.'
  },
  LOOP: {
    TR: 'Teknik sorun nedeniyle sohbet geçici olarak kapatıldı. 10 dakika sonra tekrar deneyin.',
    EN: 'Technical issue detected. Please try again in 10 minutes.'
  },
  SPAM: {
    TR: 'Spam tespit edildi. Lütfen 5 dakika sonra tekrar deneyin.',
    EN: 'Spam detected. Please try again in 5 minutes.'
  },
  ENUMERATION: {
    TR: 'Çok fazla başarısız doğrulama denemesi. Lütfen 2 dakika sonra tekrar deneyin.',
    EN: 'Too many failed verification attempts. Please try again in 2 minutes.'
  },
};

/**
 * Lock a session
 *
 * @param {string} sessionId - Universal session ID
 * @param {string} reason - ABUSE | THREAT | PII_RISK | LOOP | SPAM | TOOL_FAIL
 * @param {number|null} customDuration - Optional custom duration (overrides default)
 * @returns {Promise<void>}
 */
export async function lockSession(sessionId, reason, customDuration = null) {
  const state = await getState(sessionId);

  const now = new Date();
  const duration = customDuration !== null ? customDuration : LOCK_DURATIONS[reason];
  const lockUntil = duration ? new Date(now.getTime() + duration).toISOString() : null;

  // Update state
  state.flowStatus = 'terminated';
  state.lockReason = reason;
  state.lockedAt = now.toISOString();
  state.lockUntil = lockUntil;
  state.lockMessageSentAt = null; // Reset spam prevention

  await updateState(sessionId, state);

  console.log(`🔒 [SessionLock] Locked ${sessionId}: ${reason} (until: ${lockUntil || 'permanent'})`);
}

/**
 * Check if a session is locked
 *
 * @param {string} sessionId - Universal session ID
 * @returns {Promise<Object>} { locked: boolean, reason: string|null, until: string|null, expired: boolean }
 */
export async function isSessionLocked(sessionId) {
  const state = await getState(sessionId);

  // Not locked if no lock reason
  if (!state.lockReason) {
    return {
      locked: false,
      reason: null,
      until: null,
      expired: false
    };
  }

  // Check if lock expired (for temporary locks)
  if (state.lockUntil) {
    const now = new Date();
    const lockUntil = new Date(state.lockUntil);

    if (now >= lockUntil) {
      // Lock expired - auto unlock
      console.log(`🔓 [SessionLock] Lock expired for ${sessionId}, auto-unlocking`);
      await unlockSession(sessionId);

      return {
        locked: false,
        reason: state.lockReason,
        until: state.lockUntil,
        expired: true
      };
    }
  }

  // Still locked
  return {
    locked: true,
    reason: state.lockReason,
    until: state.lockUntil,
    expired: false
  };
}

/**
 * Unlock a session
 *
 * @param {string} sessionId - Universal session ID
 * @returns {Promise<void>}
 */
export async function unlockSession(sessionId) {
  const state = await getState(sessionId);

  state.flowStatus = 'idle';
  state.lockReason = null;
  state.lockedAt = null;
  state.lockUntil = null;
  state.lockMessageSentAt = null;

  await updateState(sessionId, state);

  console.log(`🔓 [SessionLock] Unlocked ${sessionId}`);
}

/**
 * Get lock message for a reason and language
 *
 * @param {string} reason - Lock reason
 * @param {string} language - TR | EN
 * @returns {string} Lock message
 */
export function getLockMessage(reason, language = 'TR') {
  const messages = LOCK_MESSAGES[reason];
  if (!messages) {
    return language === 'TR'
      ? 'Sohbet kapatılmıştır.'
      : 'Conversation has been closed.';
  }

  return messages[language] || messages.TR;
}

/**
 * Atomic check-and-set for lock message sending
 * Prevents race condition where multiple requests send duplicate messages
 *
 * Uses ConversationState.lockMessageSentAt with atomic update pattern:
 * - Read current timestamp
 * - If null OR expired (>60s), update AND return true
 * - If recent (<60s), return false
 *
 * @param {string} sessionId - Universal session ID
 * @returns {Promise<boolean>} True if message should be sent (and timestamp was set)
 */
export async function shouldSendAndMarkLockMessage(sessionId) {
  const state = await getState(sessionId);
  const now = new Date();
  const SPAM_WINDOW = 60 * 1000; // 1 minute

  // Check if should send
  if (state.lockMessageSentAt) {
    const lastSent = new Date(state.lockMessageSentAt);

    if ((now - lastSent) <= SPAM_WINDOW) {
      // Too soon - don't send
      return false;
    }
  }

  // ATOMIC: Set timestamp AND return true
  // This prevents race condition because updateState is atomic per session
  state.lockMessageSentAt = now.toISOString();
  await updateState(sessionId, state);

  console.log(`[SessionLock] Lock message timestamp updated for ${sessionId}`);
  return true;
}

/**
 * @deprecated Use shouldSendAndMarkLockMessage() instead (atomic)
 */
export async function shouldSendLockMessage(sessionId) {
  console.warn('[SessionLock] shouldSendLockMessage is deprecated, use shouldSendAndMarkLockMessage');
  const state = await getState(sessionId);

  if (!state.lockMessageSentAt) {
    return true;
  }

  const lastSent = new Date(state.lockMessageSentAt);
  const now = new Date();
  const SPAM_WINDOW = 60 * 1000;

  return (now - lastSent) > SPAM_WINDOW;
}

/**
 * @deprecated Use shouldSendAndMarkLockMessage() instead (atomic)
 */
export async function markLockMessageSent(sessionId) {
  console.warn('[SessionLock] markLockMessageSent is deprecated, use shouldSendAndMarkLockMessage');
  const state = await getState(sessionId);
  state.lockMessageSentAt = new Date().toISOString();
  await updateState(sessionId, state);
}

/**
 * Get remaining lock time in human-readable format
 *
 * @param {string} sessionId - Universal session ID
 * @param {string} language - TR | EN
 * @returns {Promise<string|null>} Remaining time string or null if permanent/not locked
 */
export async function getRemainingLockTime(sessionId, language = 'TR') {
  const lockStatus = await isSessionLocked(sessionId);

  if (!lockStatus.locked || !lockStatus.until) {
    return null;
  }

  const now = new Date();
  const lockUntil = new Date(lockStatus.until);
  const remainingMs = lockUntil - now;

  if (remainingMs <= 0) {
    return null;
  }

  const minutes = Math.ceil(remainingMs / (60 * 1000));

  if (language === 'TR') {
    if (minutes < 60) {
      return `${minutes} dakika`;
    } else {
      const hours = Math.ceil(minutes / 60);
      return `${hours} saat`;
    }
  } else {
    if (minutes < 60) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      const hours = Math.ceil(minutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
  }
}

/**
 * Check and record enumeration attempts.
 *
 * Modes:
 * - verification_failed (default): every failed verification counts
 * - not_found: only suspicious signals count (rapid/sequential probing)
 *
 * @param {string} sessionId - Universal session ID
 * @param {Object} options
 * @param {'verification_failed'|'not_found'} options.mode
 * @param {Object} options.signal - Optional signal payload for not_found mode
 * @returns {Promise<{shouldBlock: boolean, attempts: number, counted: boolean, mode: string, signal?: Object}>}
 */
export async function checkEnumerationAttempt(sessionId, options = {}) {
  const state = await getState(sessionId);
  const now = Date.now();
  const mode = options.mode || 'verification_failed';

  // Backward compat: migrate legacy flat array into structured object lazily.
  const legacyAttempts = Array.isArray(state.enumerationAttempts)
    ? state.enumerationAttempts
    : [];

  if (!state.enumeration || typeof state.enumeration !== 'object') {
    state.enumeration = {
      verificationAttempts: legacyAttempts,
      notFoundAttempts: [],
      lastProbeAt: null,
      lastProbeIdentifier: null
    };
  }

  state.enumeration.verificationAttempts = (state.enumeration.verificationAttempts || []).filter(
    ts => (now - ts) < ENUMERATION_LIMITS.WINDOW_MS
  );
  state.enumeration.notFoundAttempts = (state.enumeration.notFoundAttempts || []).filter(
    ts => (now - ts) < ENUMERATION_LIMITS.NOT_FOUND_WINDOW_MS
  );

  let attemptCount = 0;
  let counted = false;
  let signalMeta = null;

  if (mode === 'not_found') {
    const identifier = extractSignalIdentifier(options.signal);
    const previousIdentifier = state.enumeration.lastProbeIdentifier;
    const previousAt = state.enumeration.lastProbeAt ? Number(state.enumeration.lastProbeAt) : null;

    const rapid = previousAt ? (now - previousAt) <= ENUMERATION_LIMITS.RAPID_WINDOW_MS : false;
    const currentSuffix = getNumericSuffix(identifier);
    const previousSuffix = getNumericSuffix(previousIdentifier);
    const sequential = Number.isFinite(currentSuffix) &&
      Number.isFinite(previousSuffix) &&
      Math.abs(currentSuffix - previousSuffix) === 1;
    const rotatingIdentifier = rapid && !!identifier && !!previousIdentifier && identifier !== previousIdentifier;

    const suspicious = !!identifier && (sequential || rotatingIdentifier);
    if (suspicious) {
      state.enumeration.notFoundAttempts.push(now);
      counted = true;
    }

    state.enumeration.lastProbeAt = now;
    state.enumeration.lastProbeIdentifier = identifier || null;

    attemptCount = state.enumeration.notFoundAttempts.length;
    signalMeta = {
      identifier,
      rapid,
      sequential,
      rotatingIdentifier,
      suspicious
    };
  } else {
    state.enumeration.verificationAttempts.push(now);
    attemptCount = state.enumeration.verificationAttempts.length;
    counted = true;
  }

  // Keep legacy field in sync for old readers (deprecated)
  state.enumerationAttempts = state.enumeration.verificationAttempts;
  await updateState(sessionId, state);

  const threshold = mode === 'not_found'
    ? ENUMERATION_LIMITS.MAX_SUSPICIOUS_NOT_FOUND
    : ENUMERATION_LIMITS.MAX_FAILED_VERIFICATIONS;

  if (counted && attemptCount >= threshold) {
    console.warn(`🚨 [Enumeration] Session ${sessionId} exceeded threshold (${attemptCount} attempts, mode=${mode})`);
    await lockSession(sessionId, 'ENUMERATION');
    return {
      shouldBlock: true,
      attempts: attemptCount,
      counted,
      mode,
      signal: signalMeta
    };
  }

  return {
    shouldBlock: false,
    attempts: attemptCount,
    counted,
    mode,
    signal: signalMeta
  };
}

/**
 * Reset enumeration counter (call on successful verification)
 *
 * @param {string} sessionId - Universal session ID
 */
export async function resetEnumerationCounter(sessionId) {
  const state = await getState(sessionId);
  state.enumerationAttempts = [];
  state.enumeration = {
    verificationAttempts: [],
    notFoundAttempts: [],
    lastProbeAt: null,
    lastProbeIdentifier: null
  };
  await updateState(sessionId, state);
  console.log(`[Enumeration] Reset counter for session ${sessionId}`);
}

export default {
  lockSession,
  isSessionLocked,
  unlockSession,
  getLockMessage,
  shouldSendLockMessage,
  markLockMessageSent,
  getRemainingLockTime,
  checkEnumerationAttempt,
  resetEnumerationCounter,
  LOCK_DURATIONS,
  ENUMERATION_LIMITS
};

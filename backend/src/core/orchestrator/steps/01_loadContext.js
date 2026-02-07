/**
 * Step 1: Load Context
 *
 * - Get universal session ID
 * - Load state (with TTL + cache)
 * - Check if session terminated OR locked
 */

import { getOrCreateSession } from '../../../services/session-mapper.js';
import { getState } from '../../../services/state-manager.js';
import { isSessionLocked, getLockMessage } from '../../../services/session-lock.js';

export async function loadContext(params) {
  const { channel, channelUserId, businessId, sessionId: providedSessionId, metadata = {}, language = 'TR' } = params;

  // CRITICAL: If sessionId provided, use it. NEVER create new session.
  // This prevents bypass attacks where orchestrator creates new session for locked user.
  const universalSessionId = providedSessionId || await getOrCreateSession(businessId, channel, channelUserId);

  console.log(`🔑 [LoadContext] Universal session: ${universalSessionId}${providedSessionId ? ' (provided)' : ' (created)'}`);

  // Load state (DB + cache)
  const state = await getState(universalSessionId);

  // Ensure businessId is set
  if (!state.businessId) {
    state.businessId = businessId;
  }

  // GUARD 1: Check if session is LOCKED (abuse, PII, spam, etc.)
  const lockStatus = await isSessionLocked(universalSessionId);
  if (lockStatus.locked) {
    console.log(`🔒 [LoadContext] Session is LOCKED: ${lockStatus.reason}`);

    const lockMsg = getLockMessage(lockStatus.reason, language, universalSessionId);

    return {
      terminated: true,
      locked: true,
      sessionId: universalSessionId,
      state,
      terminationReason: lockStatus.reason,
      lockMessage: lockMsg,
      lockUntil: lockStatus.until
    };
  }

  // GUARD 2: Check if session terminated (normal flow end)
  if (state.flowStatus === 'terminated') {
    console.log('🛑 [LoadContext] Session is terminated (normal end)');

    return {
      terminated: true,
      locked: false,
      sessionId: universalSessionId,
      state,
      terminationReason: state.pauseReason || 'session_ended'
    };
  }

  return {
    terminated: false,
    locked: false,
    sessionId: universalSessionId,
    state
  };
}

export default { loadContext };

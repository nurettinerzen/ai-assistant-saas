/**
 * Step 1: Load Context
 *
 * - Get universal session ID
 * - Load state (with TTL + cache)
 * - Check if session terminated
 */

import { getOrCreateSession } from '../../../services/session-mapper.js';
import { getState } from '../../../services/state-manager.js';

export async function loadContext(params) {
  const { channel, channelUserId, businessId, metadata = {} } = params;

  // Get universal session ID
  const universalSessionId = await getOrCreateSession(businessId, channel, channelUserId);

  console.log(`🔑 [LoadContext] Universal session: ${universalSessionId}`);

  // Load state (DB + cache)
  const state = await getState(universalSessionId);

  // Ensure businessId is set
  if (!state.businessId) {
    state.businessId = businessId;
  }

  // Check if session terminated
  if (state.flowStatus === 'terminated') {
    console.log('🛑 [LoadContext] Session is terminated');

    return {
      terminated: true,
      sessionId: universalSessionId,
      state,
      terminationReason: state.pauseReason || 'session_ended'
    };
  }

  return {
    terminated: false,
    sessionId: universalSessionId,
    state
  };
}

export default { loadContext };

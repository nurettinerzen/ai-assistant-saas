/**
 * Conversation ID & Session Assertions
 * Validates conversation continuity and isolation
 */

/**
 * Assert conversationId is returned
 */
export function assertConversationIdReturned(conversationId) {
  if (!conversationId) {
    return {
      passed: false,
      reason: 'No conversationId returned'
    };
  }

  if (typeof conversationId !== 'string') {
    return {
      passed: false,
      reason: `conversationId should be string, got ${typeof conversationId}`
    };
  }

  return { passed: true };
}

/**
 * Assert conversationId is stable across turns
 */
export function assertConversationIdStable(conversationId1, conversationId2) {
  if (conversationId1 !== conversationId2) {
    return {
      passed: false,
      reason: `conversationId changed: ${conversationId1} -> ${conversationId2}`
    };
  }

  return { passed: true };
}

/**
 * Assert new conversationId for new session
 */
export function assertNewConversationId(oldConversationId, newConversationId) {
  if (oldConversationId === newConversationId) {
    return {
      passed: false,
      reason: `New session should have new conversationId, but got same: ${newConversationId}`
    };
  }

  return { passed: true };
}

/**
 * Assert session isolation (conversations don't leak between sessions)
 */
export function assertSessionIsolation(response, previousSessionData) {
  const reply = response.reply?.toLowerCase() || '';

  // Check if response references previous session's data
  const leaked = previousSessionData.filter(data => {
    const dataStr = String(data).toLowerCase();
    return reply.includes(dataStr);
  });

  if (leaked.length > 0) {
    return {
      passed: false,
      reason: `Session isolation broken: response references previous session data: ${leaked.join(', ')}`
    };
  }

  return { passed: true };
}

export default {
  assertConversationIdReturned,
  assertConversationIdStable,
  assertNewConversationId,
  assertSessionIsolation
};

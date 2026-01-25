/**
 * Conversation Manager
 * Centralized conversation history, session management, and verification state
 *
 * This is the single source of truth for all conversation-related logic.
 * All channels (chat, whatsapp, voice) use this service.
 */

// In-memory storage (use Redis in production for multi-instance deployment)
const sessions = new Map();

// Session timeouts per channel (in milliseconds)
const TIMEOUTS = {
  chat: 30 * 60 * 1000,      // 30 minutes
  whatsapp: 60 * 60 * 1000,  // 1 hour
  voice: 5 * 60 * 1000       // 5 minutes
};

/**
 * Message structure:
 * {
 *   role: "user" | "assistant" | "system",
 *   content: "message text",
 *   timestamp: number,
 *   metadata: {
 *     verification?: { requested: boolean, field: string, queryType: string },
 *     toolCall?: { name: string, params: object, result: object },
 *     intent?: string
 *   }
 * }
 */

/**
 * Get or create a session
 * @param {string} sessionId - Unique session identifier
 * @param {string} platform - Platform type: 'chat' | 'whatsapp' | 'voice'
 * @returns {Object} Session object
 */
export function getOrCreateSession(sessionId, platform = 'chat') {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      platform,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      isActive: true,
      messages: []
    });
    console.log(`✨ New session created: ${sessionId} (${platform})`);
  }

  const session = sessions.get(sessionId);
  session.lastActivity = Date.now();
  return session;
}

/**
 * Add a message to conversation history
 * @param {string} sessionId - Session identifier
 * @param {string} role - Message role: 'user' | 'assistant' | 'system'
 * @param {string} content - Message content
 * @param {Object} metadata - Optional metadata (verification, toolCall, intent, etc.)
 * @returns {Array} Updated message history
 */
export function addMessage(sessionId, role, content, metadata = {}) {
  const session = getOrCreateSession(sessionId);

  const message = {
    role,
    content,
    timestamp: Date.now(),
    metadata
  };

  session.messages.push(message);

  // Keep only last 50 messages to prevent memory bloat
  if (session.messages.length > 50) {
    session.messages = session.messages.slice(-50);
  }

  console.log(`💬 Message added to ${sessionId}: ${role} - ${content.substring(0, 50)}...`);

  return session.messages;
}

/**
 * Get conversation history
 * @param {string} sessionId - Session identifier
 * @param {number} limit - Maximum number of recent messages to return (default: 10)
 * @returns {Array} Message history
 */
export function getHistory(sessionId, limit = 10) {
  const session = sessions.get(sessionId);
  if (!session) return [];

  return session.messages.slice(-limit);
}

/**
 * Get full conversation history (no limit)
 * @param {string} sessionId - Session identifier
 * @returns {Array} Complete message history
 */
export function getFullHistory(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return [];

  return session.messages;
}

/**
 * Set verification request in the last assistant message
 * This marks that the assistant is waiting for verification info
 * @param {string} sessionId - Session identifier
 * @param {string} field - Field being requested (e.g., 'vkn', 'phone', 'order_number')
 * @param {string} queryType - Query type (e.g., 'muhasebe', 'siparis', 'takip')
 */
export function setVerificationRequest(sessionId, field, queryType) {
  const session = getOrCreateSession(sessionId);
  const lastMessage = session.messages[session.messages.length - 1];

  if (lastMessage && lastMessage.role === 'assistant') {
    lastMessage.metadata.verification = {
      requested: true,
      field,
      queryType,
      timestamp: Date.now()
    };
    console.log(`🔐 Verification request set for ${sessionId}: ${field} (${queryType})`);
  } else {
    console.warn(`⚠️ Cannot set verification: last message is not from assistant`);
  }
}

/**
 * Get pending verification request
 * Looks backwards through conversation to find the most recent verification request
 * @param {string} sessionId - Session identifier
 * @returns {Object|null} Verification object or null if none pending
 */
export function getPendingVerification(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  // Search backwards through messages - look at last 2 user messages + their assistant responses
  let userMessageCount = 0;
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const msg = session.messages[i];

    // Count user messages to limit search depth
    if (msg.role === 'user') {
      userMessageCount++;
      // Stop after checking responses to last 2 user messages
      if (userMessageCount > 2) break;
    }

    // Found assistant message with verification request
    if (msg.role === 'assistant' && msg.metadata?.verification?.requested) {
      console.log(`🔍 Found pending verification for ${sessionId}:`, msg.metadata.verification);
      return msg.metadata.verification;
    }
  }

  console.log(`🔍 No pending verification found for ${sessionId}`);
  return null;
}

/**
 * Clear verification state (after successful verification)
 * @param {string} sessionId - Session identifier
 */
export function clearVerificationRequest(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  // Find and clear the verification flag
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const msg = session.messages[i];
    if (msg.role === 'assistant' && msg.metadata?.verification?.requested) {
      msg.metadata.verification.requested = false;
      console.log(`✅ Verification cleared for ${sessionId}`);
      return;
    }
  }
}

/**
 * Update verification metadata when customer is found
 * Used by customer-data-lookup tool to store found customer info
 * @param {string} sessionId - Session identifier
 * @param {Object} customer - Customer object from database
 * @param {string} queryType - Query type (muhasebe, siparis, takip, etc.)
 */
export function setFoundCustomer(sessionId, customer, queryType) {
  const session = sessions.get(sessionId);
  if (!session) return;

  // Find the pending verification message and update it
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const msg = session.messages[i];
    if (msg.role === 'assistant' && msg.metadata?.verification?.requested) {
      msg.metadata.verification = {
        ...msg.metadata.verification,
        foundCustomerId: customer.id,
        foundCustomerName: customer.companyName || customer.contactName,
        expectedFieldType: customer.companyName ? 'company_name' : 'person_name',
        queryType,
        timestamp: Date.now()
      };
      console.log(`📝 Customer found, verification metadata updated:`, {
        sessionId,
        customerId: customer.id,
        customerName: customer.companyName || customer.contactName
      });
      return;
    }
  }
}

/**
 * Update verification metadata (for customer-data-lookup tool)
 * @param {string} sessionId - Session identifier
 * @param {Object} updates - Fields to update in verification metadata
 */
export function updateVerificationMetadata(sessionId, updates) {
  const session = sessions.get(sessionId);
  if (!session) return;

  // Find the pending verification message and update it
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const msg = session.messages[i];
    if (msg.role === 'assistant' && msg.metadata?.verification) {
      msg.metadata.verification = {
        ...msg.metadata.verification,
        ...updates
      };
      console.log(`🔄 Verification metadata updated for ${sessionId}:`, updates);
      return;
    }
  }
}

/**
 * Check if session is active
 * @param {string} sessionId - Session identifier
 * @returns {boolean} True if session is active
 */
export function isSessionActive(sessionId) {
  const session = sessions.get(sessionId);
  return session ? session.isActive : false;
}

/**
 * Terminate a session
 * @param {string} sessionId - Session identifier
 * @param {string} reason - Termination reason
 */
export function terminateSession(sessionId, reason = 'user_request') {
  const session = sessions.get(sessionId);

  if (!session) {
    console.warn(`⚠️ Cannot terminate: session ${sessionId} not found`);
    return false;
  }

  session.isActive = false;
  session.terminatedAt = Date.now();
  session.terminationReason = reason;

  console.log(`🛑 Session terminated: ${sessionId} (reason: ${reason})`);

  // Remove from memory after 5 minutes (for logging purposes)
  setTimeout(() => {
    sessions.delete(sessionId);
    console.log(`🧹 Session cleaned up: ${sessionId}`);
  }, 5 * 60 * 1000);

  return true;
}

/**
 * Get session info
 * @param {string} sessionId - Session identifier
 * @returns {Object|null} Session object or null
 */
export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

/**
 * Cleanup inactive sessions (runs periodically)
 * Sessions older than their platform timeout are removed
 */
export function cleanupInactiveSessions() {
  const now = Date.now();
  let cleaned = 0;

  for (const [sessionId, session] of sessions.entries()) {
    const timeout = TIMEOUTS[session.platform] || TIMEOUTS.chat;

    if (now - session.lastActivity > timeout) {
      sessions.delete(sessionId);
      cleaned++;
      console.log(`🧹 Inactive session removed: ${sessionId} (${session.platform})`);
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} inactive sessions`);
  }

  return cleaned;
}

// Auto-cleanup every 2 minutes
setInterval(cleanupInactiveSessions, 2 * 60 * 1000);

/**
 * Get termination message based on reason and language
 * @param {string} reason - Termination reason
 * @param {string} language - Language code (TR/EN)
 * @returns {string} Termination message
 */
export function getTerminationMessage(reason, language = 'TR') {
  const messages = {
    off_topic: {
      TR: 'Üzgünüm, sadece iş ile ilgili konularda yardımcı olabilirim. Görüşmemiz sonlandırılıyor.',
      EN: 'Sorry, I can only help with business-related topics. Ending conversation.'
    },
    profanity: {
      TR: 'Güvenlik nedeniyle görüşmemiz sonlandırılıyor.',
      EN: 'Conversation ended due to security reasons.'
    },
    verification_failed: {
      TR: 'Doğrulama başarısız oldu. Lütfen daha sonra tekrar deneyin.',
      EN: 'Verification failed. Please try again later.'
    },
    user_request: {
      TR: 'Görüşme sonlandırıldı. Yardımcı olabildiysem ne mutlu bana!',
      EN: 'Conversation ended. Happy to help!'
    }
  };

  return messages[reason]?.[language] || messages.user_request[language];
}

/**
 * Re-export verification cache from verification-manager for backwards compatibility
 * Tools can import verificationCache from either file
 */
export { verificationCache } from './verification-manager.js';

/**
 * Get statistics for monitoring
 * @returns {Object} Session statistics
 */
export function getStats() {
  return {
    totalSessions: sessions.size,
    activeSessions: Array.from(sessions.values()).filter(s => s.isActive).length,
    platforms: {
      chat: Array.from(sessions.values()).filter(s => s.platform === 'chat').length,
      whatsapp: Array.from(sessions.values()).filter(s => s.platform === 'whatsapp').length,
      voice: Array.from(sessions.values()).filter(s => s.platform === 'voice').length
    }
  };
}

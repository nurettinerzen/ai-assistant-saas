/**
 * Session Manager
 * Handles session termination for chat and WhatsApp
 */

// Active sessions storage (in-memory, could be Redis in production)
const activeSessions = new Map();

/**
 * Create or get session
 * @param {string} sessionId - Session ID (phone or chat ID)
 * @param {string} platform - Platform type: 'chat' or 'whatsapp'
 * @returns {Object} - Session object
 */
export function getOrCreateSession(sessionId, platform) {
  if (!activeSessions.has(sessionId)) {
    activeSessions.set(sessionId, {
      id: sessionId,
      platform,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      isActive: true,
      messages: []
    });
    console.log(`✨ New session created: ${sessionId} (${platform})`);
  }

  const session = activeSessions.get(sessionId);
  session.lastActivity = Date.now();

  return session;
}

/**
 * Terminate session
 * @param {string} sessionId - Session ID
 * @param {string} reason - Termination reason
 * @returns {boolean} - Success status
 */
export function terminateSession(sessionId, reason = 'user_request') {
  const session = activeSessions.get(sessionId);

  if (!session) {
    console.warn(`⚠️ Session not found: ${sessionId}`);
    return false;
  }

  session.isActive = false;
  session.terminatedAt = Date.now();
  session.terminationReason = reason;

  console.log(`🛑 Session terminated: ${sessionId} (reason: ${reason})`);

  // Remove from active sessions after 5 minutes (for logging purposes)
  setTimeout(() => {
    activeSessions.delete(sessionId);
    console.log(`🧹 Session cleaned up: ${sessionId}`);
  }, 5 * 60 * 1000);

  return true;
}

/**
 * Check if session is active
 * @param {string} sessionId - Session ID
 * @returns {boolean} - Is session active
 */
export function isSessionActive(sessionId) {
  const session = activeSessions.get(sessionId);
  return session ? session.isActive : false;
}

/**
 * Add message to session history
 * @param {string} sessionId - Session ID
 * @param {Object} message - Message object
 */
export function addMessageToSession(sessionId, message) {
  const session = activeSessions.get(sessionId);

  if (!session) {
    console.warn(`⚠️ Cannot add message: session ${sessionId} not found`);
    return;
  }

  session.messages.push({
    ...message,
    timestamp: Date.now()
  });

  // Keep only last 50 messages
  if (session.messages.length > 50) {
    session.messages = session.messages.slice(-50);
  }
}

/**
 * Get session messages
 * @param {string} sessionId - Session ID
 * @returns {Array} - Message history
 */
export function getSessionMessages(sessionId) {
  const session = activeSessions.get(sessionId);
  return session ? session.messages : [];
}

/**
 * Cleanup inactive sessions (older than 30 minutes)
 */
export function cleanupInactiveSessions() {
  const now = Date.now();
  const timeout = 30 * 60 * 1000; // 30 minutes

  let cleaned = 0;

  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastActivity > timeout) {
      activeSessions.delete(sessionId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} inactive sessions`);
  }
}

/**
 * Get termination message based on language
 * @param {string} reason - Termination reason
 * @param {string} language - Language code (TR/EN)
 * @returns {string} - Termination message
 */
export function getTerminationMessage(reason, language = 'TR') {
  const messages = {
    off_topic: {
      TR: 'Güvenlik nedeniyle oturumunuz sonlandırıldı. Sadece şirketimizle ilgili sorular sorabilirsiniz.',
      EN: 'Your session has been terminated for security reasons. You can only ask questions about our company.'
    },
    verification_failed: {
      TR: 'Güvenlik nedeniyle oturumunuz sonlandırıldı. Lütfen müşteri hizmetlerini arayın: [PHONE]',
      EN: 'Your session has been terminated for security reasons. Please contact customer service: [PHONE]'
    },
    user_request: {
      TR: 'Görüşme sonlandırıldı. Yardımcı olabildiysem ne mutlu! Tekrar görüşmek üzere.',
      EN: 'Session ended. Happy to help! Talk to you soon.'
    },
    timeout: {
      TR: 'Oturumunuz zaman aşımına uğradı. Yeni bir görüşme başlatabilirsiniz.',
      EN: 'Your session has timed out. You can start a new conversation.'
    }
  };

  return messages[reason]?.[language] || messages.user_request[language];
}

// Cleanup inactive sessions every 10 minutes
setInterval(cleanupInactiveSessions, 10 * 60 * 1000);

export default {
  getOrCreateSession,
  terminateSession,
  isSessionActive,
  addMessageToSession,
  getSessionMessages,
  getTerminationMessage,
  cleanupInactiveSessions
};

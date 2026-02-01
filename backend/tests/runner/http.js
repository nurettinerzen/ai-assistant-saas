/**
 * HTTP Client for Assistant API
 * Handles authentication, conversation turns, and retries
 */

import axios from 'axios';
import CONFIG from './config.js';

/**
 * Login and get auth token
 */
export async function loginUser(email, password) {
  const response = await axios.post(`${CONFIG.API_URL}/api/auth/login`, {
    email,
    password
  });
  return response.data.token;
}

/**
 * Send conversation turn with retry logic
 */
export async function sendConversationTurn(
  assistantId,
  message,
  token,
  conversationId = null,
  options = {}
) {
  const maxAttempts = options.retries || CONFIG.RETRY.MAX_ATTEMPTS;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.post(
        `${CONFIG.API_URL}/api/chat/widget`,
        {
          assistantId,
          message,  // Widget uses 'message' not 'userMessage'
          conversationId,
          sessionId: options.sessionId || `test-session-${Date.now()}`
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: CONFIG.TIMEOUTS.CONVERSATION_TURN
        }
      );

      // DEBUG: Log response data
      if (CONFIG.REPORT?.VERBOSE) {
        console.log('📦 API Response:', JSON.stringify(response.data, null, 2));
      }

      return {
        success: true,
        reply: response.data.reply,
        conversationId: response.data.conversationId,
        toolCalls: response.data.toolCalls || [],
        verificationStatus: response.data.verificationStatus || 'none',
        metadata: response.data.metadata || {},
        rawResponse: response.data
      };
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      const requestId = error.response?.data?.requestId || 'unknown';

      // Don't retry on 4xx errors (except 429)
      if (status >= 400 && status < 500 && status !== 429) {
        break;
      }

      // 503 with retryAfterMs: server says "processing, wait and retry"
      if (status === 503 && attempt < maxAttempts) {
        const retryAfterMs = error.response?.data?.retryAfterMs || CONFIG.RETRY.BACKOFF_MS;
        console.log(`    [retry] 503 received (requestId=${requestId}), attempt ${attempt}/${maxAttempts}, waiting ${retryAfterMs}ms`);
        await new Promise(resolve => setTimeout(resolve, retryAfterMs));
        continue;
      }

      // 429 rate limit: use retryAfter or exponential backoff
      if (status === 429 && attempt < maxAttempts) {
        const retryAfterMs = error.response?.data?.retryAfterMs || CONFIG.RETRY.BACKOFF_MS * Math.pow(CONFIG.RETRY.BACKOFF_MULTIPLIER, attempt - 1);
        console.log(`    [retry] 429 rate limit (requestId=${requestId}), attempt ${attempt}/${maxAttempts}, waiting ${retryAfterMs}ms`);
        await new Promise(resolve => setTimeout(resolve, retryAfterMs));
        continue;
      }

      // Other 5xx errors: exponential backoff
      if (status >= 500 && attempt < maxAttempts) {
        const delayMs = CONFIG.RETRY.BACKOFF_MS * Math.pow(CONFIG.RETRY.BACKOFF_MULTIPLIER, attempt - 1);
        console.log(`    [retry] ${status} error (requestId=${requestId}), attempt ${attempt}/${maxAttempts}, waiting ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
    }
  }

  // All retries failed
  const errorDetails = {
    success: false,
    error: lastError.message,
    statusCode: lastError.response?.status,
    response: lastError.response?.data
  };

  // Log error for debugging
  if (CONFIG.REPORT.VERBOSE) {
    console.error('❌ API Error:', JSON.stringify(errorDetails, null, 2));
  }

  return errorDetails;
}

/**
 * Query SecurityEvents from Red Alert API
 */
export async function querySecurityEvents(token, filters = {}) {
  try {
    const params = {
      hours: filters.hours || 1,
      type: filters.type,
      severity: filters.severity,
      limit: filters.limit || 100
    };

    const response = await axios.get(`${CONFIG.API_URL}/api/red-alert/events`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });

    return {
      success: true,
      events: response.data.events || [],
      total: response.data.pagination?.total || 0
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      events: []
    };
  }
}

/**
 * Get assistant details
 */
export async function getAssistant(assistantId, token) {
  try {
    const response = await axios.get(
      `${CONFIG.API_URL}/api/assistants/${assistantId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return {
      success: true,
      assistant: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create test assistant
 */
export async function createTestAssistant(name, config, token) {
  try {
    const response = await axios.post(
      `${CONFIG.API_URL}/api/assistants`,
      {
        name: name || 'Test Assistant',
        voiceId: config.voiceId || 'default-voice',
        firstMessage: config.firstMessage || 'Merhaba, nasıl yardımcı olabilirim?',
        customNotes: config.customNotes || 'Test assistant for automated testing',
        language: config.language || 'TR',
        country: config.country || 'TR',
        industry: config.industry || 'OTHER',
        timezone: config.timezone || 'Europe/Istanbul'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return {
      success: true,
      assistantId: response.data.assistant.id
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete test assistant
 */
export async function deleteTestAssistant(assistantId, token) {
  try {
    await axios.delete(
      `${CONFIG.API_URL}/api/assistants/${assistantId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  loginUser,
  sendConversationTurn,
  querySecurityEvents,
  getAssistant,
  createTestAssistant,
  deleteTestAssistant
};

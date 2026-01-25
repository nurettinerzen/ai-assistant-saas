/**
 * Callback Helper Service
 *
 * Centralized callback logic for all channels (chat, whatsapp, call).
 * Handles automatic callback triggering, customer info extraction, and topic summarization.
 */

/**
 * Extract customer information from conversation history and context
 * @param {Array} history - Conversation history
 * @param {Object} context - Execution context (from, phone, callerPhone, etc.)
 * @returns {Object} - {name, phone}
 */
export function extractCustomerInfoFromHistory(history, context = {}) {
  // Get phone from context (priority order)
  const phone = context.from || context.phone || context.callerPhone || context.phoneNumber || null;

  // Try to find customer name from history
  let name = context.customerName || null;

  if (!name && history && Array.isArray(history)) {
    // Look for patterns like "Adım X", "Ben X", "My name is X"
    for (const msg of history) {
      if (msg.role === 'user') {
        const content = msg.content || '';

        // Turkish patterns
        const trMatch = content.match(/(?:adım|benim adım|ismim)\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?)/i);
        if (trMatch) {
          name = trMatch[1];
          break;
        }

        // English patterns
        const enMatch = content.match(/(?:my name is|i am|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
        if (enMatch) {
          name = enMatch[1];
          break;
        }
      }
    }
  }

  return {
    name: name || 'Müşteri',
    phone: phone || 'Bilinmiyor'
  };
}

/**
 * Extract conversation topic from recent messages
 * @param {Array} history - Conversation history
 * @param {number} messageCount - Number of recent messages to analyze (default: 5)
 * @returns {string} - Topic summary
 */
export function extractTopicFromHistory(history, messageCount = 5) {
  if (!history || !Array.isArray(history) || history.length === 0) {
    return 'Genel destek talebi';
  }

  // Get recent user messages
  const recentMessages = history
    .slice(-messageCount * 2) // Get more to ensure we have enough user messages
    .filter(m => m.role === 'user')
    .map(m => m.content || '')
    .filter(content => content.length > 0)
    .slice(-messageCount); // Take last N user messages

  if (recentMessages.length === 0) {
    return 'Genel destek talebi';
  }

  // Join and summarize
  const summary = recentMessages.join(' | ');

  // Truncate to 200 chars
  return summary.length > 200
    ? summary.substring(0, 197) + '...'
    : summary;
}

/**
 * Determine if callback should be triggered automatically
 * @param {string} sessionId - Session ID
 * @param {string} intent - Detected intent
 * @param {number} failureCount - Number of failures in this session
 * @returns {boolean} - True if callback should be triggered
 */
export function shouldTriggerCallback(sessionId, intent, failureCount = 0) {
  // Always trigger for complaint
  if (intent === 'complaint') {
    return true;
  }

  // Trigger after 2+ failures
  if (failureCount >= 2) {
    return true;
  }

  return false;
}

/**
 * Build callback offer message based on language
 * @param {string} language - Language code (TR, EN)
 * @returns {string} - Offer message
 */
export function getCallbackOfferMessage(language = 'TR') {
  return language === 'TR'
    ? 'Size yardımcı olamadığım için üzgünüm. Sizi geri aramamızı ister misiniz?'
    : 'I apologize for not being able to help. Would you like us to call you back?';
}

/**
 * Build callback success message for Gemini to interpret
 * @param {Object} callbackData - Callback creation result
 * @param {string} language - Language code (TR, EN)
 * @returns {string} - Context message for Gemini
 */
export function buildCallbackContextMessage(callbackData, language = 'TR') {
  if (language === 'TR') {
    return `Geri arama kaydı oluşturuldu (Callback ID: ${callbackData.callbackId}). Müşteriye durumu bildir ve başka yardıma ihtiyacı olup olmadığını sor.`;
  } else {
    return `Callback request created (Callback ID: ${callbackData.callbackId}). Inform the customer and ask if they need anything else.`;
  }
}

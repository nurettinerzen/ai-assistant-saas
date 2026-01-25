/**
 * Intent Normalizer
 *
 * Normalizes classification types based on message content patterns.
 * Converts generic NEW_INTENT to specific intents (CALLBACK_REQUEST, etc.)
 *
 * Problem: Classifier returns NEW_INTENT but doesn't specify which kind
 * Solution: Pattern matching to identify escalation/callback requests
 */

/**
 * Pattern definitions for intent normalization
 */
const INTENT_PATTERNS = {
  CALLBACK_REQUEST: {
    keywords: [
      'yönetici', 'yetkili', 'sorumlu', 'müdür', 'patron',
      'şikayet', 'complaint',
      'arasın', 'ara', 'call', 'telefon et',
      'geri ara', 'callback', 'call back',
      'bağla', 'connect', 'konuş', 'görüş',
      'insanla', 'gerçek', 'human', 'person',
      'escalate', 'yükselt'
    ],
    minConfidence: 0.8
  },

  APPOINTMENT_REQUEST: {
    keywords: [
      'randevu', 'appointment',
      'rezervasyon', 'reservation',
      'tarih', 'saat', 'date', 'time',
      'book', 'schedule'
    ],
    minConfidence: 0.8
  },

  ORDER_STATUS: {
    keywords: [
      'sipariş', 'order',
      'kargo', 'shipping', 'delivery',
      'nerede', 'where', 'durumu', 'status',
      'takip', 'track'
    ],
    minConfidence: 0.8
  }
};

/**
 * Normalize classification intent based on message content
 *
 * @param {Object} classification - Original classification from classifier
 * @param {string} userMessage - User's message text
 * @returns {Object} - Normalized classification with specific intent
 */
export function normalizeIntent(classification, userMessage) {
  // Only normalize NEW_INTENT or low-specificity types
  const normalizableTypes = ['NEW_INTENT', 'CHATTER'];

  if (!normalizableTypes.includes(classification.type)) {
    // Already specific enough
    return classification;
  }

  const messageLower = userMessage.toLowerCase();

  // Check each pattern
  for (const [intentType, pattern] of Object.entries(INTENT_PATTERNS)) {
    const matchedKeywords = pattern.keywords.filter(kw =>
      messageLower.includes(kw.toLowerCase())
    );

    if (matchedKeywords.length > 0) {
      console.log(`🔄 [IntentNormalizer] ${classification.type} → ${intentType}`);
      console.log(`   Matched keywords: ${matchedKeywords.join(', ')}`);

      return {
        ...classification,
        type: intentType,
        originalType: classification.type,
        normalizedBy: 'pattern_matching',
        matchedKeywords,
        confidence: Math.max(classification.confidence, pattern.minConfidence)
      };
    }
  }

  // No pattern matched, return original
  return classification;
}

/**
 * Add custom intent pattern at runtime
 *
 * @param {string} intentType - Intent type name (e.g., 'CUSTOM_INTENT')
 * @param {string[]} keywords - Keywords to match
 * @param {number} minConfidence - Minimum confidence (default 0.8)
 */
export function addIntentPattern(intentType, keywords, minConfidence = 0.8) {
  INTENT_PATTERNS[intentType] = {
    keywords,
    minConfidence
  };
  console.log(`🔧 [IntentNormalizer] Added pattern for ${intentType}:`, keywords);
}

/**
 * Get current patterns (for debugging/inspection)
 *
 * @returns {Object} - Current intent patterns
 */
export function getIntentPatterns() {
  return { ...INTENT_PATTERNS };
}

export default {
  normalizeIntent,
  addIntentPattern,
  getIntentPatterns
};

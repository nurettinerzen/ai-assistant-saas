/**
 * Intent Router Service
 * Detects user intent and maps to appropriate tools
 * Handles session counters for security (off-topic, verification attempts)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Intent configuration with tool mapping and security rules
export const INTENT_CONFIG = {
  // ============================================
  // TRANSACTIONAL INTENTS (Verification Required)
  // ============================================
  order_status: {
    tools: ['customer_data_lookup'],
    requiresVerification: true,
    verificationFields: ['order_number'],
    maxAttempts: 3,
    description: 'User asks about order status, delivery, or "where is my order"'
  },

  debt_inquiry: {
    tools: ['customer_data_lookup'],
    requiresVerification: true,
    verificationFields: ['phone', 'tc', 'vkn'],
    maxAttempts: 3,
    description: 'User asks about debts, payments, SGK, tax, invoices'
  },

  tracking_info: {
    tools: ['customer_data_lookup'],
    requiresVerification: true,
    verificationFields: ['order_number', 'tracking_number'],
    maxAttempts: 3,
    description: 'User asks about cargo tracking, shipment status'
  },

  // ============================================
  // NON-VERIFICATION INTENTS
  // ============================================
  stock_check: {
    tools: ['get_product_stock'],
    requiresVerification: false,
    description: 'User asks about product availability, stock, "is X available?"'
  },

  company_info: {
    tools: [],
    requiresVerification: false,
    useKnowledgeBase: true,
    description: 'User asks about company hours, address, services, policies'
  },

  greeting: {
    tools: [],
    requiresVerification: false,
    description: 'User greets: "hello", "hi", "good morning", "merhaba", "selam"'
  },

  complaint: {
    tools: ['create_callback'],
    requiresVerification: false,
    description: 'User complains, reports problem, asks to speak to manager'
  },

  general_question: {
    tools: [],
    requiresVerification: false,
    useKnowledgeBase: true,
    description: 'General questions about products, services that need KB'
  },

  // ============================================
  // SECURITY INTENTS
  // ============================================
  off_topic: {
    tools: [],
    requiresVerification: false,
    maxCount: 3, // 3 strikes = session terminated
    response: 'polite_redirect',
    description: 'User asks unrelated questions: weather, cooking, jokes, sports'
  }
};

// Session counter storage (in-memory, could be Redis in production)
const sessionCounters = new Map();

// Session timeout: 30 minutes
const SESSION_TIMEOUT = 30 * 60 * 1000;

/**
 * Detect user intent using Gemini
 * @param {string} userMessage - User's message
 * @param {string} language - User's language (TR/EN)
 * @returns {Promise<string>} - Detected intent key
 */
export async function detectIntent(userMessage, language = 'TR') {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const intentList = Object.keys(INTENT_CONFIG).map(key =>
      `- ${key}: ${INTENT_CONFIG[key].description}`
    ).join('\n');

    const prompt = language === 'TR'
      ? `Kullanıcının niyetini tespit et. SADECE aşağıdaki intent'lerden birini döndür (başka hiçbir şey yazma):

${intentList}

Kullanıcı mesajı: "${userMessage}"

SADECE intent adını yaz (örnek: order_status, greeting, off_topic)`
      : `Detect user intent. Return ONLY one of these intents (nothing else):

${intentList}

User message: "${userMessage}"

Write ONLY the intent name (example: order_status, greeting, off_topic)`;

    const result = await model.generateContent(prompt);
    const detectedIntent = result.response.text().trim().toLowerCase();

    // Validate intent exists
    if (!INTENT_CONFIG[detectedIntent]) {
      console.warn('⚠️ Unknown intent detected:', detectedIntent);
      return 'general_question'; // fallback
    }

    console.log('🎯 Intent detected:', detectedIntent);
    return detectedIntent;

  } catch (error) {
    console.error('❌ Intent detection error:', error);
    return 'general_question'; // fallback on error
  }
}

/**
 * Get or create session counter
 * @param {string} sessionId - Session ID (phone number or chat session)
 * @returns {Object} - Session counter object
 */
function getSessionCounter(sessionId) {
  // Clean up old sessions
  cleanupExpiredSessions();

  if (!sessionCounters.has(sessionId)) {
    sessionCounters.set(sessionId, {
      offTopicCount: 0,
      verificationAttempts: {},
      lastIntent: null,
      timestamp: Date.now()
    });
  }

  // Update timestamp
  const counter = sessionCounters.get(sessionId);
  counter.timestamp = Date.now();

  return counter;
}

/**
 * Cleanup expired sessions (older than 30 minutes)
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, counter] of sessionCounters.entries()) {
    if (now - counter.timestamp > SESSION_TIMEOUT) {
      sessionCounters.delete(sessionId);
      console.log('🧹 Cleaned up expired session:', sessionId);
    }
  }
}

/**
 * Increment off-topic counter
 * @param {string} sessionId - Session ID
 * @returns {Object} - { shouldTerminate: boolean, count: number }
 */
export function incrementOffTopicCounter(sessionId) {
  const counter = getSessionCounter(sessionId);
  counter.offTopicCount += 1;

  console.log(`📊 Off-topic count for ${sessionId}: ${counter.offTopicCount}/3`);

  return {
    shouldTerminate: counter.offTopicCount >= 3,
    count: counter.offTopicCount
  };
}

/**
 * Increment verification attempt counter
 * @param {string} sessionId - Session ID
 * @param {string} intent - Intent type (e.g., 'order_status')
 * @returns {Object} - { shouldTerminate: boolean, count: number }
 */
export function incrementVerificationAttempt(sessionId, intent) {
  const counter = getSessionCounter(sessionId);

  if (!counter.verificationAttempts[intent]) {
    counter.verificationAttempts[intent] = 0;
  }

  counter.verificationAttempts[intent] += 1;

  const maxAttempts = INTENT_CONFIG[intent]?.maxAttempts || 3;
  const currentAttempts = counter.verificationAttempts[intent];

  console.log(`🔒 Verification attempts for ${intent}: ${currentAttempts}/${maxAttempts}`);

  return {
    shouldTerminate: currentAttempts >= maxAttempts,
    count: currentAttempts
  };
}

/**
 * Reset session counters
 * @param {string} sessionId - Session ID
 */
export function resetSessionCounters(sessionId) {
  sessionCounters.delete(sessionId);
  console.log('🔄 Session counters reset:', sessionId);
}

/**
 * Get tools for a specific intent
 * @param {string} intent - Intent key
 * @returns {Array} - List of tool names
 */
export function getToolsForIntent(intent) {
  return INTENT_CONFIG[intent]?.tools || [];
}

/**
 * Check if intent requires verification
 * @param {string} intent - Intent key
 * @returns {boolean}
 */
export function requiresVerification(intent) {
  return INTENT_CONFIG[intent]?.requiresVerification || false;
}

/**
 * Get verification fields for intent
 * @param {string} intent - Intent key
 * @returns {Array} - List of verification field names
 */
export function getVerificationFields(intent) {
  return INTENT_CONFIG[intent]?.verificationFields || [];
}

/**
 * Main intent routing function
 * @param {string} userMessage - User's message
 * @param {string} sessionId - Session ID (phone or chat session)
 * @param {string} language - Language code (TR/EN)
 * @param {Object} businessInfo - Optional business info for personalization
 * @returns {Promise<Object>} - Routing result with intent, tools, and actions
 */
export async function routeIntent(userMessage, sessionId, language = 'TR', businessInfo = {}) {
  try {
    // 1. Detect intent
    const intent = await detectIntent(userMessage, language);

    // 2. Handle off-topic
    if (intent === 'off_topic') {
      const { shouldTerminate, count } = incrementOffTopicCounter(sessionId);

      const businessName = businessInfo.name || 'şirketimiz';

      // If session should terminate, use hardcoded message
      if (shouldTerminate) {
        return {
          intent,
          tools: [],
          shouldTerminate: true,
          response: language === 'TR'
            ? 'Güvenlik nedeniyle oturumunuz sonlandırıldı.'
            : 'Your session has been terminated for security reasons.'
        };
      }

      // Generate natural AI response for off-topic (1st and 2nd strike)
      try {
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 150
          }
        });

        const aiPrompt = language === 'TR'
          ? `Kullanıcı "${userMessage}" diye sordu. Bu ${businessName} ile alakalı değil.

GÖREV: Kibarca reddet ve şirketin sunduğu hizmetleri hatırlat.

KURALLLAR:
- Doğal ve samimi ol (robot gibi olma)
- Kısa tut (max 2 cümle)
- Şirketin sunduğu hizmetlerden bahset: sipariş takibi, stok kontrolü, şirket bilgileri
- "Nasıl yardımcı olabilirim?" diye bitir

ÖRNEK: "Hava durumu konusunda bilgim yok maalesef 😊 Ama sipariş durumunuz, ürün stoğu veya ${businessName} hakkında sorularınızı yanıtlayabilirim. Size nasıl yardımcı olabilirim?"`
          : `User asked: "${userMessage}". This is off-topic for ${businessName}.

TASK: Politely decline and mention company services.

RULES:
- Be natural and friendly (not robotic)
- Keep it short (max 2 sentences)
- Mention services: order tracking, stock check, company info
- End with "How can I help you?"

EXAMPLE: "I don't have information about weather 😊 But I can help you with order status, product availability, or information about ${businessName}. How can I help you?"`;

        const result = await model.generateContent(aiPrompt);
        const aiResponse = result.response.text().trim();

        return {
          intent,
          tools: [],
          shouldTerminate: false,
          response: aiResponse
        };

      } catch (error) {
        console.error('❌ AI response generation failed, using fallback:', error);

        // Fallback to simple message if AI fails
        return {
          intent,
          tools: [],
          shouldTerminate: false,
          response: language === 'TR'
            ? `Üzgünüm, sadece ${businessName} ile ilgili sorularınızı yanıtlayabilirim. Size nasıl yardımcı olabilirim?`
            : `Sorry, I can only answer questions about ${businessName}. How can I help you?`
        };
      }
    }

    // 3. Get tools for intent
    const tools = getToolsForIntent(intent);
    const config = INTENT_CONFIG[intent];

    // 4. Return routing result
    return {
      intent,
      tools,
      requiresVerification: config.requiresVerification,
      verificationFields: config.verificationFields,
      useKnowledgeBase: config.useKnowledgeBase,
      shouldTerminate: false
    };

  } catch (error) {
    console.error('❌ Intent routing error:', error);

    // Fallback to general question
    return {
      intent: 'general_question',
      tools: [],
      requiresVerification: false,
      shouldTerminate: false
    };
  }
}

/**
 * Handle verification failure
 * @param {string} sessionId - Session ID
 * @param {string} intent - Intent that failed verification
 * @param {string} language - Language code
 * @returns {Object} - { shouldTerminate: boolean, response: string }
 */
export function handleVerificationFailure(sessionId, intent, language = 'TR') {
  const { shouldTerminate, count } = incrementVerificationAttempt(sessionId, intent);

  const maxAttempts = INTENT_CONFIG[intent]?.maxAttempts || 3;

  return {
    shouldTerminate,
    response: language === 'TR'
      ? shouldTerminate
        ? 'Güvenlik nedeniyle oturumunuz sonlandırıldı. Lütfen müşteri hizmetlerini arayın.'
        : `Kayıt bulunamadı. Lütfen bilgilerinizi kontrol edin. (${count}/${maxAttempts})`
      : shouldTerminate
        ? 'Your session has been terminated for security reasons. Please contact customer service.'
        : `Record not found. Please check your information. (${count}/${maxAttempts})`
  };
}

export default {
  detectIntent,
  routeIntent,
  getToolsForIntent,
  requiresVerification,
  getVerificationFields,
  incrementOffTopicCounter,
  incrementVerificationAttempt,
  resetSessionCounters,
  handleVerificationFailure
};

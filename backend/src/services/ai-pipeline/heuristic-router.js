/**
 * Heuristic Router - Ultra-fast keyword-based intent detection for Phone Channel
 *
 * Purpose: Replace LLM-based Router for phone calls where latency is critical
 * - 1-5ms execution (vs 300-500ms for LLM)
 * - No API calls, pure JavaScript regex/keyword matching
 * - Designed for Turkish language with support for common variations
 *
 * Architecture:
 * - Uses weighted keyword scoring
 * - Supports Turkish character variations (ş/s, ı/i, ğ/g, etc.)
 * - Falls back to GENERAL domain when confidence is low
 */

// Turkish character normalization map
const TR_CHAR_MAP = {
  'ş': 's', 'Ş': 'S',
  'ğ': 'g', 'Ğ': 'G',
  'ü': 'u', 'Ü': 'U',
  'ö': 'o', 'Ö': 'O',
  'ı': 'i', 'İ': 'I',
  'ç': 'c', 'Ç': 'C'
};

/**
 * Normalize Turkish characters for matching
 */
function normalizeTurkish(text) {
  if (!text) return '';
  let normalized = text.toLowerCase();
  for (const [tr, en] of Object.entries(TR_CHAR_MAP)) {
    normalized = normalized.replace(new RegExp(tr, 'g'), en.toLowerCase());
  }
  return normalized;
}

// ============================================================================
// KEYWORD DEFINITIONS BY DOMAIN/INTENT
// ============================================================================

const DOMAIN_KEYWORDS = {
  ORDER: {
    keywords: [
      // Primary keywords (high weight)
      { word: 'siparis', weight: 10 },
      { word: 'sipariş', weight: 10 },
      { word: 'kargo', weight: 8 },
      { word: 'teslimat', weight: 8 },
      { word: 'gonderim', weight: 7 },
      { word: 'gönderi', weight: 7 },
      // Secondary keywords
      { word: 'nerede', weight: 3 },
      { word: 'ne zaman', weight: 3 },
      { word: 'gelecek', weight: 2 },
      { word: 'gelmedi', weight: 4 },
      { word: 'takip', weight: 5 },
      { word: 'izleme', weight: 4 },
      { word: 'durum', weight: 3 },
      { word: 'numara', weight: 2 }
    ],
    intents: {
      check_status: ['durum', 'nerede', 'ne oldu', 'sorgula', 'kontrol'],
      track: ['takip', 'izleme', 'kargo takip', 'nerede'],
      cancel: ['iptal', 'vazgec', 'istemiyorum'],
      return: ['iade', 'geri gonder', 'degistir', 'değişim']
    }
  },

  APPOINTMENT: {
    keywords: [
      { word: 'randevu', weight: 10 },
      { word: 'rezervasyon', weight: 9 },
      { word: 'tarih', weight: 4 },
      { word: 'saat', weight: 4 },
      { word: 'gun', weight: 3 },
      { word: 'musait', weight: 5 },
      { word: 'uygun', weight: 3 },
      { word: 'yarin', weight: 2 },
      { word: 'bugun', weight: 2 },
      { word: 'haftaya', weight: 2 }
    ],
    intents: {
      create: ['almak', 'istiyorum', 'ayarla', 'olustur', 'yap'],
      cancel: ['iptal', 'vazgec', 'erteleme'],
      check: ['kontrol', 'sorgula', 'var mi', 'ne zaman']
    }
  },

  ACCOUNTING: {
    keywords: [
      { word: 'borc', weight: 10 },
      { word: 'borç', weight: 10 },
      { word: 'odeme', weight: 9 },
      { word: 'ödeme', weight: 9 },
      { word: 'fatura', weight: 8 },
      { word: 'hesap', weight: 6 },
      { word: 'bakiye', weight: 7 },
      { word: 'tutar', weight: 5 },
      { word: 'ne kadar', weight: 4 },
      { word: 'sgk', weight: 10 },
      { word: 'vergi', weight: 9 },
      { word: 'prim', weight: 7 }
    ],
    intents: {
      check_debt: ['borc', 'borç', 'bakiye', 'ne kadar', 'ogren'],
      payment_info: ['odeme', 'ödeme', 'nasil', 'nereye', 'iban', 'hesap']
    }
  },

  STOCK: {
    keywords: [
      { word: 'stok', weight: 10 },
      { word: 'var mi', weight: 5 },
      { word: 'urun', weight: 6 },
      { word: 'ürün', weight: 6 },
      { word: 'mevcut', weight: 7 },
      { word: 'kaldi mi', weight: 6 },
      { word: 'fiyat', weight: 5 },
      { word: 'kaç tane', weight: 5 }
    ],
    intents: {
      check_stock: ['stok', 'var mi', 'mevcut', 'kaldi'],
      product_info: ['fiyat', 'ozellik', 'bilgi']
    }
  },

  SERVICE: {
    keywords: [
      { word: 'ariza', weight: 10 },
      { word: 'arıza', weight: 10 },
      { word: 'sorun', weight: 8 },
      { word: 'problem', weight: 8 },
      { word: 'calismıyor', weight: 9 },
      { word: 'çalışmıyor', weight: 9 },
      { word: 'bozuk', weight: 8 },
      { word: 'tamir', weight: 9 },
      { word: 'servis', weight: 7 },
      { word: 'destek', weight: 6 },
      { word: 'yardim', weight: 5 },
      { word: 'sikâyet', weight: 7 },
      { word: 'şikâyet', weight: 7 }
    ],
    intents: {
      check_ticket: ['takip', 'durum', 'kayit', 'numara'],
      report_issue: ['bildirmek', 'sorun', 'ariza', 'sikâyet']
    }
  },

  CALLBACK: {
    keywords: [
      { word: 'geri ara', weight: 10 },
      { word: 'arayin', weight: 9 },
      { word: 'arayın', weight: 9 },
      { word: 'sonra ara', weight: 8 },
      { word: 'musait degilim', weight: 7 },
      { word: 'mesgul', weight: 6 },
      { word: 'yetkili', weight: 5 },
      { word: 'insan', weight: 4 },
      { word: 'operator', weight: 6 }
    ],
    intents: {
      request_callback: ['geri ara', 'arayin', 'sonra', 'yetkili']
    }
  },

  GREETING: {
    keywords: [
      { word: 'merhaba', weight: 10 },
      { word: 'selam', weight: 10 },
      { word: 'iyi gunler', weight: 10 },
      { word: 'iyi aksamlar', weight: 10 },
      { word: 'nasilsin', weight: 8 },
      { word: 'nasılsın', weight: 8 },
      { word: 'hosgeldin', weight: 8 }
    ],
    intents: {
      hello: ['merhaba', 'selam', 'iyi gun', 'hosgeldin'],
      goodbye: ['gorusuruz', 'bye', 'hosca', 'iyi gunler'],
      thanks: ['tesekkur', 'sagol', 'eyv']
    }
  },

  END_CALL: {
    keywords: [
      { word: 'kapat', weight: 10 },
      { word: 'bitir', weight: 9 },
      { word: 'gorusuruz', weight: 8 },
      { word: 'görüşürüz', weight: 8 },
      { word: 'hosca kal', weight: 8 },
      { word: 'hoşça kal', weight: 8 },
      { word: 'tamam bu kadar', weight: 7 },
      { word: 'bitti', weight: 6 },
      { word: 'yeter', weight: 5 }
    ],
    intents: {
      end: ['kapat', 'bitir', 'gorusuruz', 'hosca']
    }
  },

  TRANSFER: {
    keywords: [
      { word: 'yetkili', weight: 8 },
      { word: 'insan', weight: 6 },
      { word: 'gercek kisi', weight: 9 },
      { word: 'gerçek kişi', weight: 9 },
      { word: 'mudur', weight: 8 },
      { word: 'müdür', weight: 8 },
      { word: 'sorumlu', weight: 7 },
      { word: 'operator', weight: 8 },
      { word: 'aktarma', weight: 7 },
      { word: 'bagla', weight: 7 },
      { word: 'bağla', weight: 7 }
    ],
    intents: {
      transfer: ['yetkili', 'insan', 'gercek', 'operator', 'bagla', 'aktarma']
    }
  }
};

// ============================================================================
// ENTITY EXTRACTION PATTERNS
// ============================================================================

const ENTITY_PATTERNS = {
  // Turkish phone: 05XX XXX XX XX or 5XX XXX XX XX
  phone: /(?:0?5\d{2})[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g,

  // Order number: 3-7 digit number (but not phone-like)
  order_number: /\b(\d{3,7})\b/g,

  // Email
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,

  // Date patterns (Turkish)
  date: /(\d{1,2}[\s\/\-\.]\d{1,2}(?:[\s\/\-\.]\d{2,4})?|bugün|yarın|yarin|haftaya|pazartesi|salı|sali|çarşamba|carsamba|perşembe|persembe|cuma|cumartesi|pazar)/gi,

  // Time patterns
  time: /(\d{1,2}[:\.]?\d{0,2}\s*(?:da|de|te|ta)?|sabah|öğlen|oglen|akşam|aksam|öğleden sonra)/gi,

  // Name patterns (Turkish names often end with specific suffixes or are followed by "bey/hanım")
  name: /(?:ben\s+)?([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?)/g,

  // Product name (after "ürün", "stok", etc.)
  product: /(?:urun|ürün|stok|stokta)\s+([a-zA-ZçğıöşüÇĞİÖŞÜ\s\d]+?)(?:\s+var|mı|mi|$)/gi
};

// ============================================================================
// HEURISTIC ROUTER CLASS
// ============================================================================

class HeuristicRouter {
  constructor(options = {}) {
    this.confidenceThreshold = options.confidenceThreshold || 5;
    this.language = options.language || 'TR';
  }

  /**
   * Extract intent from user message using keyword scoring
   * @param {string} message - User's message
   * @param {Array} history - Conversation history (for context)
   * @returns {Object} { domain, intent, entities, confidence, method }
   */
  extractIntent(message, history = []) {
    const startTime = Date.now();

    // Normalize message for matching
    const normalizedMessage = normalizeTurkish(message);
    const words = normalizedMessage.split(/\s+/);

    // Score each domain
    const domainScores = {};

    for (const [domain, config] of Object.entries(DOMAIN_KEYWORDS)) {
      let score = 0;
      const matchedKeywords = [];

      for (const { word, weight } of config.keywords) {
        const normalizedKeyword = normalizeTurkish(word);

        // Check if keyword exists in message
        if (normalizedMessage.includes(normalizedKeyword)) {
          score += weight;
          matchedKeywords.push(word);
        }
      }

      domainScores[domain] = { score, matchedKeywords };
    }

    // Find domain with highest score
    let bestDomain = 'GENERAL';
    let bestScore = 0;
    let matchedKeywords = [];

    for (const [domain, { score, matchedKeywords: keywords }] of Object.entries(domainScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
        matchedKeywords = keywords;
      }
    }

    // If score is below threshold, default to GENERAL
    if (bestScore < this.confidenceThreshold) {
      bestDomain = 'GENERAL';
    }

    // Determine intent within domain
    let bestIntent = 'general';
    const domainConfig = DOMAIN_KEYWORDS[bestDomain];

    if (domainConfig?.intents) {
      for (const [intent, keywords] of Object.entries(domainConfig.intents)) {
        for (const keyword of keywords) {
          if (normalizedMessage.includes(normalizeTurkish(keyword))) {
            bestIntent = intent;
            break;
          }
        }
      }
    }

    // Extract entities
    const entities = this.extractEntities(message);

    const processingTime = Date.now() - startTime;

    return {
      domain: bestDomain,
      intent: bestIntent,
      entities,
      confidence: Math.min(bestScore / 10, 1), // Normalize to 0-1
      matchedKeywords,
      method: 'heuristic',
      processingTimeMs: processingTime
    };
  }

  /**
   * Extract entities from message using regex patterns
   * @param {string} message - User's message
   * @returns {Object} Extracted entities
   */
  extractEntities(message) {
    const entities = {};

    // Phone number
    const phoneMatch = message.match(ENTITY_PATTERNS.phone);
    if (phoneMatch) {
      // Filter out numbers that look like order numbers (too short)
      const validPhones = phoneMatch.filter(p => p.replace(/\D/g, '').length >= 10);
      if (validPhones.length > 0) {
        entities.phone = validPhones[0].replace(/\D/g, '');
      }
    }

    // Order number (exclude if it's a phone number)
    if (!entities.phone) {
      const orderMatch = message.match(ENTITY_PATTERNS.order_number);
      if (orderMatch) {
        // Get numbers that are 3-7 digits (typical order number range)
        const validOrders = orderMatch.filter(n => {
          const num = parseInt(n);
          return num >= 100 && num <= 9999999 && n.length <= 7;
        });
        if (validOrders.length > 0) {
          entities.order_number = validOrders[0];
        }
      }
    }

    // Email
    const emailMatch = message.match(ENTITY_PATTERNS.email);
    if (emailMatch) {
      entities.email = emailMatch[0].toLowerCase();
    }

    // Date
    const dateMatch = message.match(ENTITY_PATTERNS.date);
    if (dateMatch) {
      entities.date = dateMatch[0];
    }

    // Time
    const timeMatch = message.match(ENTITY_PATTERNS.time);
    if (timeMatch) {
      entities.time = timeMatch[0];
    }

    // Name - look for patterns like "ben Ali" or names after "adım"
    const namePatterns = [
      /(?:ben|adım|ismim)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)?)/i,
      /([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?)\s+(?:bey|hanım|abi|abla)/i
    ];

    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        entities.customer_name = match[1].trim();
        break;
      }
    }

    return entities;
  }

  /**
   * Determine next action based on domain/intent
   * Used by agent_gateway to decide what to do
   * @param {string} domain - Detected domain
   * @param {string} intent - Detected intent
   * @param {Object} toolResult - Result from tool execution (if any)
   * @returns {Object} { next_action, end_reason, transfer_number }
   */
  determineNextAction(domain, intent, toolResult = null) {
    // End call scenarios
    if (domain === 'END_CALL') {
      return {
        next_action: 'end_call',
        end_reason: 'customer_goodbye'
      };
    }

    // Transfer scenarios
    if (domain === 'TRANSFER') {
      return {
        next_action: 'transfer',
        transfer_reason: 'customer_requested'
      };
    }

    // Security termination from tool
    if (toolResult?.forceEndCall) {
      return {
        next_action: 'end_call',
        end_reason: 'security_termination'
      };
    }

    // Default: continue conversation
    return {
      next_action: 'continue'
    };
  }
}

export default HeuristicRouter;
export { normalizeTurkish, ENTITY_PATTERNS, DOMAIN_KEYWORDS };

/**
 * Router - Stage 1 of AI Pipeline
 *
 * Purpose: Extract intent/domain/entities from user message
 * NO tool calling - purely classification/extraction
 *
 * Domains:
 * - ORDER: Sipariş durumu, kargo, iade
 * - APPOINTMENT: Randevu oluşturma, iptal, değiştirme
 * - SERVICE: Servis talebi, arıza, destek
 * - ACCOUNTING: Borç, ödeme, fatura
 * - STOCK: Stok durumu, ürün bilgisi
 * - CALLBACK: Geri arama talebi
 * - GENERAL: Genel soru, bilgi
 * - GREETING: Selamlama, veda
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Domain definitions with Turkish/English keywords
const DOMAINS = {
  ORDER: {
    keywords: ['sipariş', 'order', 'kargo', 'teslimat', 'gönderim', 'takip', 'iade', 'iptal'],
    intents: ['check_status', 'track', 'cancel', 'return', 'complaint']
  },
  APPOINTMENT: {
    keywords: ['randevu', 'appointment', 'rezervasyon', 'booking', 'tarih', 'saat'],
    intents: ['create', 'cancel', 'reschedule', 'check', 'list']
  },
  SERVICE: {
    keywords: ['arıza', 'servis', 'destek', 'sorun', 'problem', 'çalışmıyor', 'bozuk', 'tamir'],
    intents: ['report_issue', 'request_service', 'check_ticket', 'technical_support']
  },
  ACCOUNTING: {
    keywords: ['borç', 'ödeme', 'fatura', 'bakiye', 'sgk', 'vergi', 'beyanname', 'hesap'],
    intents: ['check_debt', 'payment_info', 'invoice', 'tax_info']
  },
  STOCK: {
    keywords: ['stok', 'ürün', 'fiyat', 'mevcut', 'var mı', 'kaç tane', 'envanter'],
    intents: ['check_stock', 'product_info', 'price_check']
  },
  CALLBACK: {
    keywords: ['geri ara', 'callback', 'arayın', 'ulaşın', 'iletişim'],
    intents: ['request_callback']
  },
  GENERAL: {
    keywords: ['bilgi', 'soru', 'nasıl', 'nedir', 'hakkında'],
    intents: ['info_request', 'faq', 'general_question']
  },
  GREETING: {
    keywords: ['merhaba', 'selam', 'hello', 'günaydın', 'iyi günler', 'bye', 'görüşürüz', 'teşekkür'],
    intents: ['hello', 'goodbye', 'thanks']
  }
};

// Entity extraction patterns
const ENTITY_PATTERNS = {
  // Phone: Turkish format (05xx xxx xx xx or 5xx xxx xx xx)
  phone: /(?:0?5\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})/g,
  // Order number: 3-7 digits
  order_number: /\b(\d{3,7})\b/g,
  // Email
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Date: DD/MM/YYYY or DD.MM.YYYY
  date: /\b(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})\b/g,
  // Time: HH:MM
  time: /\b(\d{1,2}[:\.]\d{2})\b/g,
  // Turkish name patterns (2-3 word names)
  name: /\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){1,2})\b/g,
  // Money amount
  amount: /(\d+(?:[.,]\d+)?)\s*(?:TL|₺|lira|tl)/gi
};

class Router {
  constructor(business) {
    this.business = business;
    this.language = business?.language || 'TR';

    // Initialize Gemini (lightweight model for classification)
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1, // Very low for deterministic classification
        maxOutputTokens: 500
      }
    });
  }

  /**
   * Extract intent, domain, and entities from user message
   * @param {string} userMessage
   * @param {Array} history - Conversation history for context
   * @returns {Object} { domain, intent, entities, confidence, tokens }
   */
  async extractIntent(userMessage, history = []) {
    // Step 1: Rule-based entity extraction (fast, no API call)
    const entities = this.extractEntities(userMessage);

    // Step 2: Rule-based domain detection (first pass)
    const ruleDomain = this.detectDomainByRules(userMessage);

    // Step 3: If high confidence from rules, skip AI
    if (ruleDomain.confidence > 0.85) {
      console.log('🔀 [Router] High confidence rule-based detection:', ruleDomain.domain);
      return {
        domain: ruleDomain.domain,
        intent: ruleDomain.intent,
        entities,
        confidence: ruleDomain.confidence,
        method: 'rules',
        tokens: { input: 0, output: 0 }
      };
    }

    // Step 4: Use AI for ambiguous cases
    try {
      const aiResult = await this.classifyWithAI(userMessage, history, entities);
      return {
        domain: aiResult.domain || ruleDomain.domain,
        intent: aiResult.intent || ruleDomain.intent,
        entities: { ...entities, ...aiResult.entities },
        confidence: aiResult.confidence || 0.7,
        method: 'ai',
        tokens: aiResult.tokens
      };
    } catch (error) {
      console.error('⚠️ [Router] AI classification failed, using rules:', error.message);
      return {
        domain: ruleDomain.domain,
        intent: ruleDomain.intent,
        entities,
        confidence: ruleDomain.confidence,
        method: 'rules_fallback',
        tokens: { input: 0, output: 0 }
      };
    }
  }

  /**
   * Extract entities using regex patterns
   * @param {string} text
   * @returns {Object} { phone, email, order_number, date, time, name, amount }
   */
  extractEntities(text) {
    const entities = {};

    for (const [entityType, pattern] of Object.entries(ENTITY_PATTERNS)) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        // Take first match for single values, all for potential lists
        entities[entityType] = matches.length === 1 ? matches[0] : matches;
      }
    }

    // Normalize phone number (remove spaces/dashes, ensure leading 0)
    if (entities.phone) {
      const phoneArr = Array.isArray(entities.phone) ? entities.phone : [entities.phone];
      entities.phone = phoneArr.map(p => {
        let normalized = p.replace(/[\s\-]/g, '');
        if (normalized.startsWith('5')) normalized = '0' + normalized;
        return normalized;
      });
      if (entities.phone.length === 1) entities.phone = entities.phone[0];
    }

    // Normalize order number (just digits)
    if (entities.order_number) {
      const orderArr = Array.isArray(entities.order_number) ? entities.order_number : [entities.order_number];
      entities.order_number = orderArr.map(o => o.replace(/\D/g, ''));
      if (entities.order_number.length === 1) entities.order_number = entities.order_number[0];
    }

    return entities;
  }

  /**
   * Detect domain using keyword matching
   * @param {string} text
   * @returns {Object} { domain, intent, confidence }
   */
  detectDomainByRules(text) {
    const lowerText = text.toLowerCase();
    let bestMatch = { domain: 'GENERAL', intent: 'general_question', confidence: 0.3 };

    for (const [domain, config] of Object.entries(DOMAINS)) {
      const matchCount = config.keywords.filter(kw => lowerText.includes(kw)).length;
      if (matchCount > 0) {
        const confidence = Math.min(0.5 + (matchCount * 0.15), 0.95);
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            domain,
            intent: config.intents[0], // Default to first intent
            confidence
          };
        }
      }
    }

    // Special case: if we found phone/order entities but domain is GENERAL
    // it's likely an ORDER query
    if (bestMatch.domain === 'GENERAL') {
      if (ENTITY_PATTERNS.order_number.test(text)) {
        bestMatch = { domain: 'ORDER', intent: 'check_status', confidence: 0.7 };
      } else if (ENTITY_PATTERNS.phone.test(text) && lowerText.includes('sipariş')) {
        bestMatch = { domain: 'ORDER', intent: 'check_status', confidence: 0.7 };
      }
    }

    return bestMatch;
  }

  /**
   * Use AI for classification (ambiguous cases only)
   * @param {string} userMessage
   * @param {Array} history
   * @param {Object} extractedEntities
   * @returns {Object} { domain, intent, entities, confidence, tokens }
   */
  async classifyWithAI(userMessage, history, extractedEntities) {
    const contextMessages = history.slice(-4).map(m =>
      `${m.role === 'user' ? 'Müşteri' : 'Asistan'}: ${m.content}`
    ).join('\n');

    const prompt = `Sen bir intent sınıflandırıcısın. Müşteri mesajını analiz et.

MESAJ: "${userMessage}"
${contextMessages ? `\nÖNCEKİ KONUŞMA:\n${contextMessages}` : ''}
${Object.keys(extractedEntities).length > 0 ? `\nTESPİT EDİLEN BİLGİLER: ${JSON.stringify(extractedEntities)}` : ''}

DOMAIN SEÇENEKLERİ:
- ORDER: Sipariş durumu, kargo takip, iade
- APPOINTMENT: Randevu işlemleri
- SERVICE: Servis/destek talebi
- ACCOUNTING: Borç, ödeme, fatura
- STOCK: Stok, ürün bilgisi
- CALLBACK: Geri arama talebi
- GENERAL: Genel soru
- GREETING: Selamlama/veda

INTENT SEÇENEKLERİ:
ORDER: check_status, track, cancel, return, complaint
APPOINTMENT: create, cancel, reschedule, check
SERVICE: report_issue, request_service, check_ticket
ACCOUNTING: check_debt, payment_info, invoice
STOCK: check_stock, product_info
CALLBACK: request_callback
GREETING: hello, goodbye, thanks

SADECE JSON formatında cevap ver:
{"domain":"DOMAIN","intent":"INTENT","confidence":0.X,"customer_name":"varsa isim"}`;

    const result = await this.model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Extract token usage
    const tokens = {
      input: response.usageMetadata?.promptTokenCount || 0,
      output: response.usageMetadata?.candidatesTokenCount || 0
    };

    return {
      domain: parsed.domain,
      intent: parsed.intent,
      confidence: parsed.confidence || 0.7,
      entities: parsed.customer_name ? { customer_name: parsed.customer_name } : {},
      tokens
    };
  }
}

export default Router;

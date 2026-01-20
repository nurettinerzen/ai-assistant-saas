/**
 * Knowledge Base Selector
 *
 * Purpose: Select only relevant KB snippets based on intent/domain
 * Instead of dumping the entire KB into the prompt, we:
 * 1. Index KB items by keywords
 * 2. Match user intent/domain to relevant KB items
 * 3. Return only the most relevant snippets
 *
 * Benefits:
 * - Reduced token usage
 * - More focused responses
 * - Faster processing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Domain to KB category mapping
const DOMAIN_KB_CATEGORIES = {
  ORDER: ['shipping', 'delivery', 'kargo', 'teslimat', 'iade', 'return', 'sipariş', 'order'],
  APPOINTMENT: ['randevu', 'appointment', 'booking', 'reservation', 'saat', 'time'],
  SERVICE: ['servis', 'service', 'destek', 'support', 'arıza', 'tamir', 'garanti'],
  ACCOUNTING: ['ödeme', 'payment', 'fatura', 'invoice', 'borç', 'debt', 'hesap'],
  STOCK: ['stok', 'stock', 'ürün', 'product', 'fiyat', 'price', 'envanter'],
  CALLBACK: ['iletişim', 'contact', 'geri arama', 'callback'],
  GENERAL: ['hakkında', 'about', 'bilgi', 'info', 'sss', 'faq']
};

// Entity type to KB category mapping
const ENTITY_KB_CATEGORIES = {
  product_name: ['ürün', 'product', 'stok', 'stock', 'fiyat', 'price'],
  order_number: ['sipariş', 'order', 'kargo', 'shipping'],
  tracking_number: ['kargo', 'shipping', 'teslimat', 'delivery', 'takip', 'tracking']
};

// Maximum snippets to return per request
const MAX_SNIPPETS = 5;
const MAX_SNIPPET_LENGTH = 500;

class KBSelector {
  constructor(businessId) {
    this.businessId = businessId;
    this.kbCache = null;
    this.cacheTime = null;
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Load KB items for this business (with caching)
   */
  async loadKB() {
    const now = Date.now();

    // Return cached data if fresh
    if (this.kbCache && this.cacheTime && (now - this.cacheTime < this.CACHE_TTL)) {
      return this.kbCache;
    }

    // Load from database
    const kbItems = await prisma.knowledgeBase.findMany({
      where: {
        businessId: this.businessId,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        title: true,
        type: true,
        question: true,
        answer: true,
        content: true,
        tags: true
      }
    });

    // Index KB items
    this.kbCache = this.indexKBItems(kbItems);
    this.cacheTime = now;

    console.log(`📚 [KBSelector] Loaded ${kbItems.length} KB items for business ${this.businessId}`);
    return this.kbCache;
  }

  /**
   * Index KB items by keywords for fast lookup
   */
  indexKBItems(items) {
    const indexed = {
      byId: {},
      byKeyword: {},
      byType: { FAQ: [], URL: [], DOCUMENT: [] },
      all: items
    };

    for (const item of items) {
      // Index by ID
      indexed.byId[item.id] = item;

      // Index by type
      if (indexed.byType[item.type]) {
        indexed.byType[item.type].push(item);
      }

      // Extract keywords from title, question, content
      const textToIndex = [
        item.title,
        item.question,
        item.answer?.substring(0, 200),
        item.content?.substring(0, 200),
        ...(item.tags || [])
      ].filter(Boolean).join(' ').toLowerCase();

      // Index by keywords
      const keywords = this.extractKeywords(textToIndex);
      for (const keyword of keywords) {
        if (!indexed.byKeyword[keyword]) {
          indexed.byKeyword[keyword] = [];
        }
        if (!indexed.byKeyword[keyword].includes(item.id)) {
          indexed.byKeyword[keyword].push(item.id);
        }
      }
    }

    return indexed;
  }

  /**
   * Extract meaningful keywords from text
   */
  extractKeywords(text) {
    // Turkish stopwords
    const stopwords = new Set([
      've', 'veya', 'ile', 'için', 'bu', 'şu', 'o', 'bir', 'de', 'da',
      'ne', 'nasıl', 'neden', 'kim', 'var', 'yok', 'evet', 'hayır',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'or', 'and', 'but', 'if'
    ]);

    return text
      .split(/[\s,.:;!?()[\]{}'"]+/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 2 && !stopwords.has(w))
      .slice(0, 50); // Max 50 keywords per item
  }

  /**
   * Select relevant KB snippets based on router result
   * @param {Object} routerResult - { domain, intent, entities }
   * @param {string} userMessage - Original user message
   * @returns {Object} { snippets: [], faq: [], documents: [] }
   */
  async selectRelevantSnippets(routerResult, userMessage) {
    const kb = await this.loadKB();
    const { domain, intent, entities } = routerResult;

    // Score each KB item based on relevance
    const scores = new Map();

    // 1. Score by domain match
    const domainKeywords = DOMAIN_KB_CATEGORIES[domain] || [];
    for (const keyword of domainKeywords) {
      const matchingIds = kb.byKeyword[keyword] || [];
      for (const id of matchingIds) {
        scores.set(id, (scores.get(id) || 0) + 3); // Domain match = 3 points
      }
    }

    // 2. Score by entity keywords
    for (const [entityType, value] of Object.entries(entities || {})) {
      const entityKeywords = ENTITY_KB_CATEGORIES[entityType] || [];
      for (const keyword of entityKeywords) {
        const matchingIds = kb.byKeyword[keyword] || [];
        for (const id of matchingIds) {
          scores.set(id, (scores.get(id) || 0) + 2); // Entity match = 2 points
        }
      }

      // If entity value looks like a product name, search for it
      if (typeof value === 'string' && value.length > 2) {
        const valueKeywords = this.extractKeywords(value.toLowerCase());
        for (const keyword of valueKeywords) {
          const matchingIds = kb.byKeyword[keyword] || [];
          for (const id of matchingIds) {
            scores.set(id, (scores.get(id) || 0) + 4); // Direct value match = 4 points
          }
        }
      }
    }

    // 3. Score by user message keywords
    const messageKeywords = this.extractKeywords(userMessage.toLowerCase());
    for (const keyword of messageKeywords) {
      const matchingIds = kb.byKeyword[keyword] || [];
      for (const id of matchingIds) {
        scores.set(id, (scores.get(id) || 0) + 1); // Message keyword match = 1 point
      }
    }

    // Sort by score and take top N
    const sortedIds = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SNIPPETS)
      .filter(([id, score]) => score >= 2) // Minimum relevance threshold
      .map(([id]) => id);

    // Format selected items
    const result = {
      snippets: [],
      faq: [],
      documents: [],
      totalMatched: sortedIds.length
    };

    for (const id of sortedIds) {
      const item = kb.byId[id];
      if (!item) continue;

      if (item.type === 'FAQ') {
        result.faq.push({
          question: item.question,
          answer: item.answer?.substring(0, MAX_SNIPPET_LENGTH)
        });
      } else {
        const snippet = {
          title: item.title,
          content: (item.content || item.answer || '').substring(0, MAX_SNIPPET_LENGTH)
        };

        if (item.type === 'DOCUMENT') {
          result.documents.push(snippet);
        } else {
          result.snippets.push(snippet);
        }
      }
    }

    console.log(`📚 [KBSelector] Selected ${result.faq.length} FAQ, ${result.documents.length} docs, ${result.snippets.length} snippets for domain: ${domain}`);

    return result;
  }

  /**
   * Format KB snippets into prompt text
   * @param {Object} kbResult - Result from selectRelevantSnippets
   * @param {string} language - 'TR' or 'EN'
   * @returns {string} Formatted KB context for prompt
   */
  formatForPrompt(kbResult, language = 'TR') {
    if (!kbResult || (kbResult.faq.length === 0 && kbResult.documents.length === 0 && kbResult.snippets.length === 0)) {
      return '';
    }

    let context = language === 'TR'
      ? '\n\n## İLGİLİ BİLGİLER (Knowledge Base)\n'
      : '\n\n## RELEVANT INFORMATION (Knowledge Base)\n';

    // Add FAQs
    if (kbResult.faq.length > 0) {
      context += language === 'TR' ? '\n### Sık Sorulan Sorular:\n' : '\n### FAQ:\n';
      for (const faq of kbResult.faq) {
        context += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
      }
    }

    // Add documents
    if (kbResult.documents.length > 0) {
      context += language === 'TR' ? '\n### Dökümanlar:\n' : '\n### Documents:\n';
      for (const doc of kbResult.documents) {
        context += `[${doc.title}]: ${doc.content}\n\n`;
      }
    }

    // Add general snippets
    if (kbResult.snippets.length > 0) {
      context += language === 'TR' ? '\n### Bilgiler:\n' : '\n### Information:\n';
      for (const snippet of kbResult.snippets) {
        context += `[${snippet.title}]: ${snippet.content}\n\n`;
      }
    }

    return context;
  }
}

export default KBSelector;

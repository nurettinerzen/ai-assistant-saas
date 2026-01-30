/**
 * V1 MVP: KB Retrieval Service
 *
 * Keyword-based retrieval with hard limits:
 * - Max 5 items returned
 * - Max 6000 chars total context
 * - Max 1500-2000 chars per item
 *
 * NO full KB dump - intelligent retrieval only
 */

import prisma from '../config/database.js';

const MAX_KB_ITEMS = 5;
const MAX_TOTAL_CHARS = 6000;
const MAX_CHARS_PER_ITEM = 2000;

/**
 * Retrieve relevant KB items based on user message
 *
 * @param {number} businessId - Business ID
 * @param {string} userMessage - User's message (for keyword extraction)
 * @returns {Promise<string>} - Formatted KB context (max 6000 chars)
 */
export async function retrieveKB(businessId, userMessage) {
  if (!userMessage || userMessage.trim().length === 0) {
    return '';
  }

  try {
    // Extract keywords (simple approach: split into words, filter out common words)
    const keywords = extractKeywords(userMessage);

    if (keywords.length === 0) {
      return '';
    }

    // Build query with ILIKE for case-insensitive search
    // Search in: title, content, question, answer, url
    const kbItems = await prisma.knowledgeBase.findMany({
      where: {
        businessId,
        OR: [
          // Document title/content
          { title: { contains: keywords[0], mode: 'insensitive' } },
          { content: { contains: keywords[0], mode: 'insensitive' } },
          // FAQ question/answer
          { question: { contains: keywords[0], mode: 'insensitive' } },
          { answer: { contains: keywords[0], mode: 'insensitive' } },
          // URL metadata
          { url: { contains: keywords[0], mode: 'insensitive' } },
        ]
      },
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        question: true,
        answer: true,
        url: true
      },
      take: MAX_KB_ITEMS,
      orderBy: {
        createdAt: 'desc' // Most recent first
      }
    });

    if (kbItems.length === 0) {
      return '';
    }

    // Format KB items with char limits
    const formattedItems = [];
    let totalChars = 0;

    for (const item of kbItems) {
      const formatted = formatKBItem(item);
      const itemLength = formatted.length;

      // Check if adding this item would exceed total limit
      if (totalChars + itemLength > MAX_TOTAL_CHARS) {
        break;
      }

      formattedItems.push(formatted);
      totalChars += itemLength;
    }

    if (formattedItems.length === 0) {
      return '';
    }

    // Build final KB context
    const kbContext = `
## BİLGİ BANKASI (${formattedItems.length} kayıt)

${formattedItems.join('\n\n---\n\n')}

ÖNEMLİ: Yukarıdaki bilgileri kullanarak yanıt ver. Bilgi Bankası'nda olmayan bilgileri UYDURMA.
`;

    console.log(`📚 [KB Retrieval] Retrieved ${formattedItems.length} items (${totalChars} chars) for businessId: ${businessId}`);

    return kbContext;

  } catch (error) {
    console.error('❌ [KB Retrieval] Error:', error);
    return ''; // Fail gracefully - don't break the conversation
  }
}

/**
 * Extract keywords from user message
 * Simple approach: remove common words, get unique words
 */
function extractKeywords(message) {
  // Turkish + English common words to ignore
  const stopWords = new Set([
    'bir', 'bu', 'şu', 'o', 've', 'veya', 'ile', 'mi', 'mı', 'mu', 'mü',
    'ne', 'nasıl', 'neden', 'nerede', 'kim', 'ben', 'sen', 'biz', 'siz',
    'the', 'a', 'an', 'and', 'or', 'is', 'are', 'was', 'were', 'be', 'been',
    'what', 'how', 'why', 'where', 'who', 'i', 'you', 'we', 'they'
  ]);

  const words = message
    .toLowerCase()
    .replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2) // Min 3 chars
    .filter(word => !stopWords.has(word));

  // Return unique words (first 3 for performance)
  return [...new Set(words)].slice(0, 3);
}

/**
 * Format KB item with char limit
 */
function formatKBItem(item) {
  let formatted = '';

  if (item.type === 'document') {
    formatted = `### ${item.title || 'Belge'}\n${truncate(item.content || '', MAX_CHARS_PER_ITEM)}`;
  } else if (item.type === 'faq') {
    formatted = `### S: ${item.question || 'Soru'}\nC: ${truncate(item.answer || '', MAX_CHARS_PER_ITEM)}`;
  } else if (item.type === 'url') {
    formatted = `### ${item.title || 'Web Sayfası'}\n${truncate(item.content || '', MAX_CHARS_PER_ITEM)}\nKaynak: ${item.url}`;
  }

  return formatted;
}

/**
 * Truncate text to max chars
 */
function truncate(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  return text.substring(0, maxChars) + '...';
}

/**
 * Get KB stats for a business (for debugging)
 */
export async function getKBStats(businessId) {
  const stats = await prisma.knowledgeBase.groupBy({
    by: ['type'],
    where: { businessId },
    _count: true
  });

  const totalCount = await prisma.knowledgeBase.count({
    where: { businessId }
  });

  return {
    total: totalCount,
    byType: stats.reduce((acc, stat) => {
      acc[stat.type] = stat._count;
      return acc;
    }, {})
  };
}

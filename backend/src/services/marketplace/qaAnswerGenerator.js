import prisma from '../../prismaClient.js';
import { truncateMarketplaceAnswer } from './qaShared.js';
import { resolveMarketplaceProductContext } from './productContextService.js';

const MAX_MARKETPLACE_ANSWER_LENGTH = 2000;
const QUESTION_STOPWORDS = new Set([
  'acaba',
  'ama',
  'bir',
  'bu',
  'cok',
  'çok',
  'da',
  'de',
  'diye',
  'en',
  'gibi',
  'hangi',
  'icin',
  'için',
  'ile',
  'ise',
  'mı',
  'mi',
  'mu',
  'mü',
  'muhtemel',
  'nasil',
  'nasıl',
  'olan',
  'olarak',
  'sadece',
  'seklinde',
  'şeklinde',
  'size',
  'soru',
  'soruyorum',
  'urun',
  'ürün',
  'var',
  've',
  'veya',
  'ya',
  'yani'
]);

function normalizeForSearch(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeForSearch(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

function extractQuestionKeywords(questionText) {
  return tokenize(questionText)
    .filter((token) => token.length >= 3 && !QUESTION_STOPWORDS.has(token));
}

function parseAttributeLine(text) {
  const normalized = String(text || '').trim();
  if (!normalized.includes(':')) {
    return null;
  }

  const [rawLabel, ...rawValueParts] = normalized.split(':');
  const label = String(rawLabel || '').trim();
  const value = rawValueParts.join(':').trim();

  if (!label || !value) {
    return null;
  }

  return { label, value };
}

function buildEvidenceEntries(productContext) {
  if (!productContext) {
    return [];
  }

  const entries = [];
  const pushEntry = (kind, text, extra = {}) => {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return;

    entries.push({
      kind,
      text: normalizedText,
      tokens: tokenize(normalizedText),
      ...extra,
    });
  };

  if (productContext.brand) {
    pushEntry('brand', `Marka: ${productContext.brand}`, {
      label: 'Marka',
      value: productContext.brand,
    });
  }

  if (productContext.categoryName) {
    pushEntry('category', `Kategori: ${productContext.categoryName}`, {
      label: 'Kategori',
      value: productContext.categoryName,
    });
  }

  if (productContext.title) {
    pushEntry('title', `Ürün adı: ${productContext.title}`, {
      label: 'Ürün adı',
      value: productContext.title,
    });
  }

  if (productContext.description) {
    const descriptionSentences = String(productContext.description)
      .split(/[\n.!?]+/g)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 8)
      .slice(0, 6);

    for (const sentence of descriptionSentences) {
      pushEntry('description', sentence);
    }
  }

  for (const fact of productContext.facts || []) {
    const parsed = parseAttributeLine(fact);
    pushEntry('fact', fact, parsed || {});
  }

  return entries;
}

function keywordMatchesEntry(keyword, entryTokens = []) {
  if (!keyword || entryTokens.length === 0) {
    return false;
  }

  return entryTokens.some((entryToken) => {
    if (!entryToken) return false;
    if (entryToken === keyword) return true;
    if (entryToken.length >= 4 && keyword.startsWith(entryToken)) return true;
    if (keyword.length >= 4 && entryToken.startsWith(keyword)) return true;
    return false;
  });
}

function scoreEvidenceEntry(entry, keywords) {
  if (!entry || keywords.length === 0) {
    return 0;
  }

  let score = 0;
  let matchedKeywordCount = 0;

  for (const keyword of keywords) {
    let matchedThisKeyword = false;

    if (keywordMatchesEntry(keyword, entry.tokens)) {
      score += keyword.length >= 5 ? 3 : 2;
      matchedThisKeyword = true;
    }

    if (entry.label && keywordMatchesEntry(keyword, tokenize(entry.label))) {
      score += 2;
      matchedThisKeyword = true;
    }

    if (entry.value && keywordMatchesEntry(keyword, tokenize(entry.value))) {
      score += 1;
      matchedThisKeyword = true;
    }

    if (matchedThisKeyword) {
      matchedKeywordCount += 1;
    }
  }

  if (matchedKeywordCount === 0) {
    return 0;
  }

  switch (entry.kind) {
    case 'fact':
      score += 3;
      break;
    case 'brand':
    case 'category':
      score += 2;
      break;
    case 'description':
      score += 1;
      break;
    default:
      break;
  }

  return score;
}

export function findRelevantProductEvidence(questionText, productContext) {
  const keywords = extractQuestionKeywords(questionText);
  if (keywords.length === 0) {
    return [];
  }

  return buildEvidenceEntries(productContext)
    .map((entry) => ({
      ...entry,
      score: scoreEvidenceEntry(entry, keywords),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function getSafeNoEvidenceAnswer(language, productName) {
  const normalized = String(language || 'tr').trim().toLowerCase();
  const productLabel = productName ? `"${productName}"` : 'ürün';

  if (normalized === 'en') {
    return `I cannot verify this detail for ${productLabel} from the current product data. Please review the product record before sending a final reply.`;
  }

  if (normalized === 'de') {
    return `Ich kann dieses Detail fuer ${productLabel} mit den aktuellen Produktdaten nicht verifizieren. Bitte pruefen Sie den Produkteintrag vor dem Versenden.`;
  }

  return `${productLabel} için bu detayı mevcut ürün verisinden doğrulayamıyorum. Yanıtı göndermeden önce ürün kaydını kontrol etmeniz iyi olur.`;
}

function formatSingleEvidenceAnswer(language, productName, evidence) {
  const normalized = String(language || 'tr').trim().toLowerCase();
  const productLabel = productName ? `"${productName}"` : 'Ürün';

  if (evidence?.label && evidence?.value) {
    if (normalized === 'en') {
      return `According to the current product data for ${productLabel}, ${evidence.label.toLowerCase()} is listed as "${evidence.value}".`;
    }

    if (normalized === 'de') {
      return `Laut den aktuellen Produktdaten fuer ${productLabel} ist ${evidence.label.toLowerCase()} als "${evidence.value}" angegeben.`;
    }

    return `${productLabel} için ürün bilgilerinde ${evidence.label.toLocaleLowerCase('tr-TR')} "${evidence.value}" olarak görünüyor.`;
  }

  if (normalized === 'en') {
    return `According to the current product data for ${productLabel}, this information appears as: ${evidence.text}`;
  }

  if (normalized === 'de') {
    return `Laut den aktuellen Produktdaten fuer ${productLabel} erscheint diese Information wie folgt: ${evidence.text}`;
  }

  return `${productLabel} için ürün bilgilerinde şu ifade yer alıyor: ${evidence.text}`;
}

function formatMultipleEvidenceAnswer(language, productName, evidences) {
  const normalized = String(language || 'tr').trim().toLowerCase();
  const productLabel = productName ? `"${productName}"` : 'ürün';
  const compactEvidence = evidences.map((entry) => {
    if (entry.label && entry.value) {
      return `${entry.label}: ${entry.value}`;
    }
    return entry.text;
  });

  if (normalized === 'en') {
    return `For ${productLabel}, the current product data shows these relevant details: ${compactEvidence.join(' | ')}.`;
  }

  if (normalized === 'de') {
    return `Fuer ${productLabel} zeigen die aktuellen Produktdaten folgende passende Details: ${compactEvidence.join(' | ')}.`;
  }

  return `${productLabel} için ürün bilgilerinde sorunuzla ilgili şu detaylar görünüyor: ${compactEvidence.join(' | ')}.`;
}

export function buildGroundedMarketplaceAnswer({
  language,
  productName,
  questionText,
  productContext,
}) {
  const relevantEvidence = findRelevantProductEvidence(questionText, productContext);

  if (relevantEvidence.length === 0) {
    return getSafeNoEvidenceAnswer(language, productName);
  }

  if (relevantEvidence.length === 1) {
    return formatSingleEvidenceAnswer(language, productName, relevantEvidence[0]);
  }

  return formatMultipleEvidenceAnswer(language, productName, relevantEvidence);
}

export async function generateMarketplaceAnswer({
  businessId,
  platform,
  questionText,
  productName = '',
  productBarcode = '',
  qaSettings = {},
}) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      language: true,
    },
  });

  if (!business) {
    throw new Error(`Business bulunamadi: ${businessId}`);
  }

  const language = String(qaSettings.language || business.language || 'tr').trim().toLowerCase();
  const productContext = await resolveMarketplaceProductContext({
    businessId,
    platform,
    productBarcode,
    productName,
  });

  const answer = truncateMarketplaceAnswer(
    buildGroundedMarketplaceAnswer({
      language,
      productName,
      questionText,
      productContext,
    }),
    MAX_MARKETPLACE_ANSWER_LENGTH
  );

  return {
    answer,
    kbSourcesUsed: [],
    kbConfidence: null,
    model: productContext ? 'product-evidence-grounded' : 'product-evidence-missing',
    platform,
  };
}

export default generateMarketplaceAnswer;

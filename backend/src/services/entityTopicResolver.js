import { normalizeForMatch } from './businessIdentity.js';

export const ENTITY_MATCH_TYPES = {
  EXACT_MATCH: 'EXACT_MATCH',
  FUZZY_MATCH: 'FUZZY_MATCH',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
  NONE: 'NONE'
};

export const ENTITY_CLARIFICATION_HINTS = {
  CONFIRM_ENTITY: 'CONFIRM_ENTITY',
  LIMIT_TO_BUSINESS_SCOPE: 'LIMIT_TO_BUSINESS_SCOPE'
};

const DEFAULT_FUZZY_THRESHOLD = 0.82;

const OUT_OF_SCOPE_TRIGGER_TR = /\b(nedir|ne iş yapar|hakkında|hakkinda|şirket|sirket|firma|özellik|ozellik|ürün|urun)\b/i;
const OUT_OF_SCOPE_TRIGGER_EN = /\b(what is|who is|about|company|brand|product|feature|service)\b/i;

const CANDIDATE_STOPWORDS = new Set([
  'nedir',
  'ne',
  'nasil',
  'nasıl',
  'hakkinda',
  'hakkında',
  'sirket',
  'şirket',
  'firma',
  'product',
  'service',
  'feature',
  'what',
  'who',
  'about',
  'the',
  'and',
  'for',
  'with',
  'bir',
  'bu',
  'şu',
  've',
  'veya',
  'is',
  'are'
]);

function compactWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function toScore(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function levenshteinDistance(a = '', b = '') {
  const n = a.length;
  const m = b.length;

  if (n === 0) return m;
  if (m === 0) return n;

  const matrix = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= n; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[m][n];
}

function trigramSet(value) {
  const normalized = normalizeForMatch(value).replace(/\s+/g, '');
  if (!normalized) return new Set();
  if (normalized.length < 3) return new Set([normalized]);

  const set = new Set();
  for (let i = 0; i <= normalized.length - 3; i += 1) {
    set.add(normalized.slice(i, i + 3));
  }
  return set;
}

function trigramSimilarity(a, b) {
  const aSet = trigramSet(a);
  const bSet = trigramSet(b);

  if (aSet.size === 0 || bSet.size === 0) return 0;

  let intersection = 0;
  for (const part of aSet) {
    if (bSet.has(part)) intersection += 1;
  }

  return (2 * intersection) / (aSet.size + bSet.size);
}

export function calculateEntitySimilarity(left, right) {
  const a = normalizeForMatch(left);
  const b = normalizeForMatch(right);

  if (!a || !b) return 0;
  if (a === b) return 1;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);
  const levenshteinScore = maxLen > 0 ? (maxLen - distance) / maxLen : 0;
  const trigramScore = trigramSimilarity(a, b);

  // Near-miss bonus for typos like "telix" vs "telyx"
  const nearMiss = distance === 1 && Math.abs(a.length - b.length) <= 1 && Math.min(a.length, b.length) >= 4
    ? 0.86
    : 0;

  const blended = (levenshteinScore * 0.7) + (trigramScore * 0.3);
  return toScore(Math.max(levenshteinScore, trigramScore, nearMiss, blended));
}

function dedupeNormalized(values = []) {
  const seen = new Set();
  const out = [];

  for (const raw of values) {
    const value = compactWhitespace(raw);
    const normalized = normalizeForMatch(value);
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    out.push(value);
  }

  return out;
}

function isWholeEntityMentioned(messageNormalized, entityNormalized) {
  if (!messageNormalized || !entityNormalized) return false;
  if (messageNormalized === entityNormalized) return true;
  const escaped = entityNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`, 'i');
  return regex.test(messageNormalized);
}

function looksLikeOutOfScopePrompt(message = '') {
  const text = String(message || '');
  return OUT_OF_SCOPE_TRIGGER_TR.test(text) || OUT_OF_SCOPE_TRIGGER_EN.test(text);
}

function extractCandidateMentions(message = '') {
  const text = String(message || '');
  if (!text.trim()) return [];

  const candidates = [];

  // Quoted phrases first.
  const quoted = text.match(/"([^"]+)"|'([^']+)'/g) || [];
  for (const q of quoted) {
    const cleaned = q.replace(/^["']|["']$/g, '').trim();
    if (cleaned.length >= 3) candidates.push(cleaned);
  }

  const normalizedTokens = normalizeForMatch(text)
    .split(' ')
    .map(token => token.trim())
    .filter(Boolean);

  // Uni-grams.
  for (const token of normalizedTokens) {
    if (token.length < 3) continue;
    if (CANDIDATE_STOPWORDS.has(token)) continue;
    candidates.push(token);
  }

  // Bi/tri-grams.
  for (let size = 2; size <= 3; size += 1) {
    for (let i = 0; i <= normalizedTokens.length - size; i += 1) {
      const phrase = normalizedTokens.slice(i, i + size).join(' ');
      if (phrase.length < 4) continue;
      if (CANDIDATE_STOPWORDS.has(phrase)) continue;
      candidates.push(phrase);
    }
  }

  return dedupeNormalized(candidates).slice(0, 16);
}

function buildResolverResult({
  matchType = ENTITY_MATCH_TYPES.NONE,
  entityHint = '',
  confidence = 0,
  needsClarification = false,
  clarificationQuestionHint = null
} = {}) {
  return {
    matchType,
    entityHint,
    confidence: toScore(confidence),
    needsClarification: !!needsClarification,
    clarificationQuestionHint: clarificationQuestionHint || null
  };
}

export function getEntityMatchType(result = null) {
  return result?.matchType || result?.entityMatchType || ENTITY_MATCH_TYPES.NONE;
}

export function getEntityHint(result = null) {
  return result?.entityHint || result?.bestGuess || '';
}

export function getEntityClarificationHint(result = null) {
  return result?.clarificationQuestionHint || null;
}

function resolveKnownEntities(identity = {}) {
  return dedupeNormalized([
    identity.businessName,
    ...(identity.businessAliases || []),
    ...(identity.productNames || []),
    ...(identity.keyEntities || [])
  ]);
}

function pickOutOfScopeGuess(candidates = []) {
  for (const candidate of candidates) {
    const normalized = normalizeForMatch(candidate);
    if (!normalized || normalized.length < 3) continue;
    if (CANDIDATE_STOPWORDS.has(normalized)) continue;
    if (/^\d+$/.test(normalized)) continue;
    return candidate;
  }
  return '';
}

export function resolveMentionedEntity(
  userMessage,
  businessIdentity,
  { fuzzyThreshold = DEFAULT_FUZZY_THRESHOLD, language = 'TR' } = {}
) {
  const _language = language; // reserved for future locale-specific hinting
  void _language;
  const knownEntities = resolveKnownEntities(businessIdentity);
  const normalizedMessage = normalizeForMatch(userMessage);

  if (!normalizedMessage) {
    return buildResolverResult();
  }

  for (const entity of knownEntities) {
    const normalizedEntity = normalizeForMatch(entity);
    if (!normalizedEntity) continue;

    if (isWholeEntityMentioned(normalizedMessage, normalizedEntity)) {
      return buildResolverResult({
        matchType: ENTITY_MATCH_TYPES.EXACT_MATCH,
        entityHint: entity,
        confidence: 1
      });
    }
  }

  const mentions = extractCandidateMentions(userMessage);
  let best = {
    mention: '',
    entity: '',
    score: 0
  };

  for (const mention of mentions) {
    for (const entity of knownEntities) {
      const score = calculateEntitySimilarity(mention, entity);
      if (score > best.score) {
        best = {
          mention,
          entity,
          score
        };
      }
    }
  }

  if (best.entity && best.score >= fuzzyThreshold) {
    return buildResolverResult({
      matchType: ENTITY_MATCH_TYPES.FUZZY_MATCH,
      entityHint: best.entity,
      confidence: best.score,
      needsClarification: true,
      clarificationQuestionHint: ENTITY_CLARIFICATION_HINTS.CONFIRM_ENTITY
    });
  }

  if (looksLikeOutOfScopePrompt(userMessage)) {
    const guess = pickOutOfScopeGuess(mentions);
    if (guess) {
      return buildResolverResult({
        matchType: ENTITY_MATCH_TYPES.OUT_OF_SCOPE,
        entityHint: guess,
        confidence: 0.9,
        needsClarification: true,
        clarificationQuestionHint: ENTITY_CLARIFICATION_HINTS.LIMIT_TO_BUSINESS_SCOPE
      });
    }
  }

  return buildResolverResult({
    matchType: ENTITY_MATCH_TYPES.NONE,
    entityHint: best.entity || '',
    confidence: best.score
  });
}

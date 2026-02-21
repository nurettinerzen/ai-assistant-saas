import prisma from '../config/database.js';

const GENERIC_ENTITY_STOPWORDS = new Set([
  'nedir',
  'ne',
  'what',
  'is',
  'the',
  'a',
  'an',
  've',
  'veya',
  'ile',
  'hakkinda',
  'hakkında',
  'sirket',
  'şirket',
  'firma',
  'company',
  'service',
  'product',
  'features',
  'ozellik',
  'özellik',
  'bilgi',
  'yardim',
  'yardım',
  'how',
  'neden',
  'why',
  'kim',
  'who'
]);

const DEFAULT_ALLOWED_DOMAINS = {
  TR: [
    'Sadece işletmenin kendi ürün/hizmetleri hakkında KB veya tool kanıtı olan bilgi ver.',
    'İşletmenin alanı dışındaki marka/şirket taleplerinde netleştirme sorusu sor.'
  ],
  EN: [
    'Only provide business/product/service information that is grounded in KB or tool evidence.',
    'Ask a clarification question for unrelated company/brand requests.'
  ]
};

function compactWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function normalizeForMatch(value) {
  return compactWhitespace(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeNormalized(values = []) {
  const seen = new Set();
  const out = [];

  for (const raw of values) {
    const value = compactWhitespace(raw);
    if (!value) continue;

    const key = normalizeForMatch(value);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(value);
  }

  return out;
}

function listFromUnknown(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => compactWhitespace(v)).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[\n,;]/g)
      .map(v => compactWhitespace(v))
      .filter(Boolean);
  }
  return [];
}

function resolveAliases(business = {}) {
  return dedupeNormalized([
    ...listFromUnknown(business.businessAliases),
    ...listFromUnknown(business.aliases),
    ...listFromUnknown(business.channelConfig?.businessAliases),
    ...listFromUnknown(business.channelConfig?.identity?.businessAliases),
  ]);
}

function resolveConfiguredProductNames(business = {}) {
  return dedupeNormalized([
    ...listFromUnknown(business.productNames),
    ...listFromUnknown(business.keyEntities),
    ...listFromUnknown(business.channelConfig?.productNames),
    ...listFromUnknown(business.channelConfig?.keyEntities),
    ...listFromUnknown(business.channelConfig?.identity?.productNames),
    ...listFromUnknown(business.channelConfig?.identity?.keyEntities),
  ]);
}

function resolveIdentitySummary(business = {}) {
  const candidates = [
    business.identitySummary,
    business.channelConfig?.identitySummary,
    business.channelConfig?.identity?.identitySummary,
    business.channelConfig?.identity?.summary
  ];

  for (const candidate of candidates) {
    const value = compactWhitespace(candidate);
    if (value) return value;
  }

  return '';
}

function resolveAllowedDomains(business = {}, language = 'TR') {
  const configured = dedupeNormalized([
    ...listFromUnknown(business.allowedDomains),
    ...listFromUnknown(business.channelConfig?.allowedDomains),
    ...listFromUnknown(business.channelConfig?.identity?.allowedDomains),
  ]);

  if (configured.length > 0) {
    return configured.slice(0, 4);
  }

  const langKey = String(language || 'TR').toUpperCase() === 'TR' ? 'TR' : 'EN';
  return DEFAULT_ALLOWED_DOMAINS[langKey];
}

function splitEntityCandidates(value) {
  if (!value) return [];
  return String(value)
    .split(/[|:/,-]/g)
    .map(chunk => compactWhitespace(chunk))
    .filter(Boolean);
}

function isValidEntityCandidate(value, businessNameNormalized) {
  const normalized = normalizeForMatch(value);
  if (!normalized || normalized.length < 3) return false;
  if (normalized === businessNameNormalized) return false;
  if (GENERIC_ENTITY_STOPWORDS.has(normalized)) return false;
  return true;
}

export function extractKeyEntitiesFromKnowledgeItems(knowledgeItems = [], businessName = '', maxItems = 20) {
  const businessNameNormalized = normalizeForMatch(businessName);
  const candidates = [];

  for (const item of knowledgeItems) {
    const titleParts = splitEntityCandidates(item?.title || '');
    const questionParts = splitEntityCandidates(item?.question || '');

    for (const part of [...titleParts, ...questionParts]) {
      if (isValidEntityCandidate(part, businessNameNormalized)) {
        candidates.push(part);
      }
    }
  }

  return dedupeNormalized(candidates).slice(0, maxItems);
}

export async function buildBusinessIdentity({
  business,
  db = prisma,
  maxKnowledgeItems = 120,
  providedKnowledgeItems = null,
} = {}) {
  if (!business) {
    return {
      businessName: 'Business',
      businessAliases: [],
      productNames: [],
      keyEntities: [],
      allowedDomains: DEFAULT_ALLOWED_DOMAINS.EN,
      identitySummary: ''
    };
  }

  const businessName = compactWhitespace(business.name || 'Business');
  const businessAliases = resolveAliases(business);
  const configuredProducts = resolveConfiguredProductNames(business);
  const identitySummary = resolveIdentitySummary(business);

  let knowledgeItems = Array.isArray(providedKnowledgeItems) ? providedKnowledgeItems : null;
  if (!knowledgeItems && business.id) {
    knowledgeItems = await db.knowledgeBase.findMany({
      where: {
        businessId: business.id,
        status: 'ACTIVE'
      },
      select: {
        title: true,
        question: true
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: maxKnowledgeItems
    });
  }

  const extractedEntities = extractKeyEntitiesFromKnowledgeItems(
    knowledgeItems || [],
    businessName,
    24
  );

  const keyEntities = dedupeNormalized([
    ...configuredProducts,
    ...extractedEntities
  ]);

  const productNames = dedupeNormalized([
    ...configuredProducts,
    ...extractedEntities
  ]);

  const allowedDomains = resolveAllowedDomains(business, business.language || 'TR');

  return {
    businessName,
    businessAliases,
    productNames,
    keyEntities,
    allowedDomains,
    identitySummary
  };
}

export function formatBusinessIdentityForPrompt(identity = {}, language = 'TR') {
  const businessName = identity.businessName || 'Business';
  const identitySummary = identity.identitySummary || '';
  const aliases = (identity.businessAliases || []).join(', ') || (language === 'TR' ? 'tanımlı değil' : 'not configured');
  const productNames = (identity.productNames || []).join(', ') || (language === 'TR' ? 'tanımlı değil' : 'not configured');
  const keyEntities = (identity.keyEntities || []).join(', ') || (language === 'TR' ? 'tanımlı değil' : 'not configured');
  const allowedDomains = (identity.allowedDomains || []).map(item => `- ${item}`).join('\n') || '-';

  if (String(language || 'TR').toUpperCase() === 'TR') {
    return `## BUSINESS IDENTITY (TEK KAYNAK)
- businessName: ${businessName}
- identitySummary: ${identitySummary || 'tanımlı değil'}
- businessAliases: ${aliases}
- productNames: ${productNames}
- keyEntities: ${keyEntities}
- allowedDomains:
${allowedDomains}

Politika:
- Bu kimlikte olmayan marka/şirket için varsayım üretme.
- Şirket/ürün/özellik claim'lerini sadece KB veya tool kanıtına dayandır.
- Belirsizlikte tek bir netleştirme sorusu sor.`;
  }

  return `## BUSINESS IDENTITY (SINGLE SOURCE)
- businessName: ${businessName}
- identitySummary: ${identitySummary || 'not configured'}
- businessAliases: ${aliases}
- productNames: ${productNames}
- keyEntities: ${keyEntities}
- allowedDomains:
${allowedDomains}

Policy:
- Do not infer claims for companies/brands outside this identity.
- Ground company/product/feature claims only in KB or tool evidence.
- Ask exactly one clarification question in uncertainty.`;
}

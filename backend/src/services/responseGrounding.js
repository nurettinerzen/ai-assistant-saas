import { ENTITY_MATCH_TYPES } from './entityTopicResolver.js';
import { isFeatureEnabled } from '../config/feature-flags.js';

export const RESPONSE_GROUNDING = {
  GROUNDED: 'GROUNDED',
  UNGROUNDED: 'UNGROUNDED',
  CLARIFICATION: 'CLARIFICATION',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE'
};

const CLARIFICATION_HINTS_TR = [
  'doğrulanmış bilgi yok',
  'doğrulayamıyorum',
  'emin değilim',
  'hangi konuyu',
  'link',
  'doküman',
  'özellik adını paylaş'
];

const CLARIFICATION_HINTS_EN = [
  'verified information',
  'cannot verify',
  'not enough confirmed information',
  'which topic',
  'link',
  'document',
  'feature name'
];

const BUSINESS_CLAIM_HINTS = [
  'nedir',
  'ne is yapar',
  'ne iş yapar',
  'hangi sektor',
  'hangi sektör',
  'sektor',
  'sektör',
  'hizmet',
  'urun',
  'ürün',
  'ozellik',
  'özellik',
  'sunuyor',
  'sagliyor',
  'sağlıyor',
  'what is',
  'what does',
  'which industry',
  'industry',
  'feature',
  'features',
  'service',
  'services',
  'product',
  'products',
  'offers',
  'provides',
  'company'
];

function compactWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeForCheck(value) {
  return compactWhitespace(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function uniqueNormalized(values = []) {
  const seen = new Set();
  const out = [];

  for (const value of values) {
    const normalized = normalizeForCheck(value)
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized || normalized.length < 3) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

function includesBusinessIdentityReference(userMessage = '', businessIdentity = null, entityResolution = null) {
  if (
    entityResolution?.entityMatchType === ENTITY_MATCH_TYPES.EXACT_MATCH ||
    entityResolution?.entityMatchType === ENTITY_MATCH_TYPES.FUZZY_MATCH
  ) {
    return true;
  }

  const normalizedMessage = normalizeForCheck(userMessage)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalizedMessage) return false;

  const identityTokens = uniqueNormalized([
    businessIdentity?.businessName,
    ...(businessIdentity?.businessAliases || []),
    ...(businessIdentity?.productNames || []),
    ...(businessIdentity?.keyEntities || []),
    entityResolution?.bestGuess
  ]);

  if (identityTokens.length === 0) return false;
  return identityTokens.some(token => normalizedMessage.includes(token));
}

function containsClaimHint(text = '') {
  const normalized = normalizeForCheck(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;

  return BUSINESS_CLAIM_HINTS.some((hint) => normalized.includes(hint));
}

export function isBusinessClaimCategory({
  userMessage = '',
  finalResponse = '',
  businessIdentity = null,
  entityResolution = null
} = {}) {
  const hasIdentityReference = includesBusinessIdentityReference(userMessage, businessIdentity, entityResolution);
  if (!hasIdentityReference) return false;

  if (containsClaimHint(userMessage)) return true;
  if (containsClaimHint(finalResponse)) return true;

  return false;
}

export function buildLowConfidenceClarification({ businessIdentity, language = 'TR' } = {}) {
  const businessName = businessIdentity?.businessName || 'işletme';
  const lang = String(language || 'TR').toUpperCase();

  if (lang === 'TR') {
    return `Bu konuda elimde doğrulanmış bilgi yok. ${businessName} ile ilgili hangi özelliği soruyorsun; varsa link, doküman veya özellik adını paylaşır mısın?`;
  }

  return `I do not have verified information on this yet. Which ${businessName} feature are you asking about, and can you share a link, doc, or exact feature name?`;
}

export function isClarificationResponse(responseText, language = 'TR') {
  const normalized = normalizeForCheck(responseText);
  if (!normalized) return false;

  const hints = String(language || 'TR').toUpperCase() === 'TR'
    ? CLARIFICATION_HINTS_TR
    : CLARIFICATION_HINTS_EN;

  if (hints.some(h => normalized.includes(h))) {
    return true;
  }

  return normalized.includes('?');
}

export function determineResponseGrounding({
  finalResponse,
  kbConfidence = 'LOW',
  hasKBMatch = null,
  hadToolSuccess = false,
  entityResolution = null,
  language = 'TR',
  isChatter = false,
  businessIdentity = null,
  userMessage = ''
} = {}) {
  const text = compactWhitespace(finalResponse);

  if (entityResolution?.entityMatchType === ENTITY_MATCH_TYPES.OUT_OF_SCOPE) {
    return {
      responseGrounding: RESPONSE_GROUNDING.OUT_OF_SCOPE,
      finalResponse: text || buildLowConfidenceClarification({ businessIdentity, language }),
      ungroundedDetected: false
    };
  }

  if (entityResolution?.needsClarification) {
    return {
      responseGrounding: RESPONSE_GROUNDING.CLARIFICATION,
      finalResponse: text || entityResolution.clarificationQuestion || buildLowConfidenceClarification({ businessIdentity, language }),
      ungroundedDetected: false
    };
  }

  if (!text) {
    return {
      responseGrounding: RESPONSE_GROUNDING.CLARIFICATION,
      finalResponse: buildLowConfidenceClarification({ businessIdentity, language }),
      ungroundedDetected: false
    };
  }

  if (isChatter) {
    return {
      responseGrounding: RESPONSE_GROUNDING.GROUNDED,
      finalResponse: text,
      ungroundedDetected: false
    };
  }

  if (hadToolSuccess) {
    return {
      responseGrounding: RESPONSE_GROUNDING.GROUNDED,
      finalResponse: text,
      ungroundedDetected: false
    };
  }

  if (isClarificationResponse(text, language)) {
    return {
      responseGrounding: RESPONSE_GROUNDING.CLARIFICATION,
      finalResponse: text,
      ungroundedDetected: false
    };
  }

  const strictGroundingEnabled = isFeatureEnabled('TEXT_STRICT_GROUNDING');
  const businessClaimCategory = isBusinessClaimCategory({
    userMessage,
    finalResponse: text,
    entityResolution,
    businessIdentity
  });
  const missingKbEvidence = kbConfidence === 'LOW' || hasKBMatch === false;

  if (strictGroundingEnabled && businessClaimCategory && missingKbEvidence) {
    return {
      responseGrounding: RESPONSE_GROUNDING.UNGROUNDED,
      finalResponse: buildLowConfidenceClarification({ businessIdentity, language }),
      ungroundedDetected: true,
      policyReason: 'BUSINESS_CLAIM_LOW_KB_BLOCK'
    };
  }

  if (kbConfidence === 'HIGH' || kbConfidence === 'MEDIUM') {
    return {
      responseGrounding: RESPONSE_GROUNDING.GROUNDED,
      finalResponse: text,
      ungroundedDetected: false
    };
  }

  return {
    responseGrounding: RESPONSE_GROUNDING.UNGROUNDED,
    finalResponse: buildLowConfidenceClarification({ businessIdentity, language }),
    ungroundedDetected: true
  };
}

/**
 * Action Claim Lexicon (SSOT)
 *
 * Canonical source for action-claim detection used by:
 * - runtime guardrails
 * - tool-fail fallback validation
 * - email draft scrub
 */

const ACTION_CLAIM_TERMS = Object.freeze({
  TR: Object.freeze([
    'gönderdim',
    'gönderildi',
    'gönderdik',
    'kaydettim',
    'kaydedildi',
    'kaydettik',
    'oluşturdum',
    'oluşturuldu',
    'oluşturduk',
    'işleme aldım',
    'işleme alındı',
    'işleme aldık',
    'iptal ettim',
    'iptal edildi',
    'iptal ettik',
    'değiştirdim',
    'değiştirildi',
    'değiştirdik',
    'güncelledim',
    'güncellendi',
    'güncelledik',
    'tamamladım',
    'tamamlandı',
    'tamamladık',
    'randevu aldım',
    'randevunuz alındı',
    'siparişiniz alındı',
    'sipariş oluşturuldu',
    'ilettim',
    'aktardım',
    'bildirdim',
    'başlattım',
    'açtım',
    'yarattım',
    'yaptım',
    'hallettim'
  ]),
  EN: Object.freeze([
    'i have sent',
    "i've sent",
    'has been sent',
    'was sent',
    'i have saved',
    "i've saved",
    'has been saved',
    'was saved',
    'i have created',
    "i've created",
    'has been created',
    'was created',
    'i have processed',
    "i've processed",
    'has been processed',
    'was processed',
    'i have cancelled',
    "i've cancelled",
    'has been cancelled',
    'was cancelled',
    'i have updated',
    "i've updated",
    'has been updated',
    'was updated',
    'i have completed',
    "i've completed",
    'has been completed',
    'was completed',
    'i have scheduled',
    "i've scheduled",
    'has been scheduled',
    'was scheduled',
    'your order has been placed',
    'your appointment has been booked',
    'created',
    'recorded',
    'forwarded',
    'submitted',
    'completed'
  ])
});

function normalizeLanguage(language) {
  return String(language || 'TR').toUpperCase() === 'EN' ? 'EN' : 'TR';
}

function normalizeText(text, language) {
  if (!text) return '';
  const value = String(text).replace(/[\u2018\u2019]/g, "'");
  if (language === 'TR') {
    return value.toLocaleLowerCase('tr-TR');
  }
  return value.toLowerCase();
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isWordChar(char) {
  if (!char) return false;
  return /[\p{L}\p{N}]/u.test(char);
}

function hasWholeTerm(text, term) {
  if (!text || !term) return false;

  let fromIndex = 0;
  while (fromIndex < text.length) {
    const at = text.indexOf(term, fromIndex);
    if (at === -1) return false;

    const before = at === 0 ? '' : text[at - 1];
    const afterIndex = at + term.length;
    const after = afterIndex >= text.length ? '' : text[afterIndex];

    if (!isWordChar(before) && !isWordChar(after)) {
      return true;
    }

    fromIndex = at + term.length;
  }

  return false;
}

function buildWholeTermRegex(term) {
  const escaped = escapeRegExp(term);
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, 'giu');
}

export function getActionClaimTerms(language = 'TR') {
  const lang = normalizeLanguage(language);
  return ACTION_CLAIM_TERMS[lang] || ACTION_CLAIM_TERMS.TR;
}

export function findActionClaims(text, language = 'TR') {
  if (!text) return [];

  const lang = normalizeLanguage(language);
  const normalizedText = normalizeText(text, lang);
  const terms = getActionClaimTerms(lang);

  const claims = [];
  const seen = new Set();

  for (const term of terms) {
    const normalizedTerm = normalizeText(term, lang);
    if (hasWholeTerm(normalizedText, normalizedTerm) && !seen.has(normalizedTerm)) {
      seen.add(normalizedTerm);
      claims.push(term);
    }
  }

  return claims;
}

export function hasActionClaim(text, language = 'TR') {
  return findActionClaims(text, language).length > 0;
}

export function replaceActionClaims(text, replacement, language = 'TR') {
  if (!text) return text;

  const claims = findActionClaims(text, language);
  if (claims.length === 0) {
    return text;
  }

  let output = String(text);
  for (const claim of claims) {
    const pattern = buildWholeTermRegex(claim);
    output = output.replace(pattern, (_match, prefix) => `${prefix}${replacement}`);
  }

  return output.replace(/\s{2,}/g, ' ').trim();
}

export default {
  getActionClaimTerms,
  findActionClaims,
  hasActionClaim,
  replaceActionClaims
};

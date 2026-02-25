/**
 * Channel Mode Configuration
 *
 * Supports KB_ONLY mode where the assistant only answers from knowledge base
 * and redirects account-specific queries (orders, payments, returns) to help links.
 *
 * Architecture:
 *   1. Turkish-normalize the input
 *   2. Regex hint (simplified root keywords) → boolean signal
 *   3. If hint fires AND no KB match → LLM redirect classifier (strict JSON)
 *   4. If LLM classifier confidence >= 0.7 → catalog redirect template
 *   5. Else → safe fallback via LLM (tools stripped)
 *
 * Channel modes: FULL (default) | KB_ONLY
 */

// ─── Turkish Text Normalization ───
// Lowercase with Turkish locale + diacritic stripping (ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u)
const TR_DIACRITIC_MAP = {
  'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
  'Ç': 'c', 'Ğ': 'g', 'I': 'i', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u',
};

/**
 * Normalize Turkish text for keyword matching.
 * toLocaleLowerCase('tr-TR') + diacritic simplification + punctuation strip
 * @param {string} text
 * @returns {string}
 */
export function normalizeTurkish(text) {
  if (!text) return '';
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşüÇĞIİÖŞÜ]/g, ch => TR_DIACRITIC_MAP[ch] || ch)
    .replace(/[.,!?;:'"()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Simplified Root Keywords (~25 roots, works on normalized text) ───
// These are just HINTS — final decision comes from LLM classifier.
const ACCOUNT_HINT_ROOTS = [
  // Turkish roots (post-normalization, no diacritics)
  'siparis', 'kargo', 'takip', 'teslimat', 'teslim',
  'odeme', 'fatura', 'borc',
  'iade', 'iptal',
  'adres', 'hesab',
  // English roots
  'order', 'tracking', 'shipment', 'delivery', 'package',
  'payment', 'invoice', 'refund', 'return', 'cancel',
  'account', 'address', 'balance',
];

// Build single regex from roots (all lowercase, no diacritics)
const ACCOUNT_HINT_REGEX = new RegExp(
  ACCOUNT_HINT_ROOTS.map(r => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
);

// ─── Category → helpLinks key mapping ───
const CATEGORY_LINK_MAP = {
  ORDER: 'order_status_url',
  PAYMENT: 'order_status_url',
  RETURN: 'returns_url',
  ACCOUNT: 'account_url',
  GENERAL: 'contact_url',
};

// Fallback guidance when no link is available (per category)
const FALLBACK_GUIDANCE = {
  ORDER: {
    TR: ' Hesabınız > Siparişler bölümünden kontrol edebilirsiniz.',
    EN: ' You can check your Account > Orders section.',
  },
  PAYMENT: {
    TR: ' Hesabınız > Ödemeler bölümünden kontrol edebilirsiniz.',
    EN: ' You can check your Account > Payments section.',
  },
  RETURN: {
    TR: ' Hesabınız > İade/İptal bölümünden işlem yapabilirsiniz.',
    EN: ' You can manage this from your Account > Returns section.',
  },
  ACCOUNT: {
    TR: ' Hesabınız > Ayarlar bölümünden güncelleyebilirsiniz.',
    EN: ' You can update this from your Account > Settings section.',
  },
  GENERAL: {
    TR: ' Hesabınız üzerinden kontrol edebilirsiniz.',
    EN: ' You can check through your account.',
  },
};

// ─── LLM Redirect Classifier Prompt ───
const CLASSIFIER_PROMPT = `You are a query classifier. Classify the user message into one of these categories:
- ORDER: personal order status, tracking, delivery, shipment queries
- PAYMENT: personal payment, billing, invoice, debt, charge queries
- RETURN: personal return, refund, cancellation queries
- ACCOUNT: personal account settings, address change, profile queries
- GENERAL: general information, policies, how-to questions, greetings

RULES:
- If the user asks about THEIR specific order/payment/return/account → use the specific category
- If the user asks about general policies (e.g. "iade süresi nedir?", "kargo ücreti ne kadar?") → GENERAL
- If unclear or ambiguous → GENERAL
- Respond ONLY with valid JSON, nothing else

Output format (strict JSON, no markdown):
{"category":"ORDER","confidence":0.95}`;

/**
 * Get the channel mode for a business + channel combination.
 * @param {Object} business - Business object (must have channelConfig field)
 * @param {string} channel - 'CHAT' | 'WHATSAPP' | 'EMAIL' | 'PHONE'
 * @returns {'FULL' | 'KB_ONLY'}
 */
export function getChannelMode(business, channel) {
  if (!business?.channelConfig) return 'FULL';
  const config = business.channelConfig;
  const key = String(channel).toLowerCase();
  const mode = config[key];
  return mode === 'KB_ONLY' ? 'KB_ONLY' : 'FULL';
}

/**
 * Get help links from business config.
 * @param {Object} business
 * @returns {Object} Help links object or empty object
 */
export function getHelpLinks(business) {
  return business?.helpLinks || {};
}

/**
 * Quick regex hint: does the normalized message contain any account-related root?
 * NOT a final decision — just a signal for whether to invoke the LLM classifier.
 * @param {string} message - Raw user message
 * @returns {boolean}
 */
export function hasAccountHint(message) {
  if (!message) return false;
  const normalized = normalizeTurkish(message);
  return ACCOUNT_HINT_REGEX.test(normalized);
}

/**
 * Classify a user message into a redirect category using LLM.
 * Returns { category, confidence } or null on failure.
 *
 * Uses gemini-2.5-flash-lite for speed/cost — no tools, strict JSON output.
 *
 * @param {string} userMessage - Raw user message
 * @returns {Promise<{ category: string, confidence: number } | null>}
 */
export async function classifyRedirectCategory(userMessage) {
  try {
    const { getGeminiModel } = await import('../services/gemini-utils.js');

    const model = getGeminiModel({
      model: 'gemini-2.5-flash-lite',
      temperature: 0.0,
      maxOutputTokens: 60,
    });

    const prompt = `${CLASSIFIER_PROMPT}\n\nUser message: "${userMessage}"`;
    const result = await model.generateContent(prompt);
    const raw = result.response?.text()?.trim() || '';

    // Strict JSON parse — reject non-JSON output
    const jsonMatch = raw.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      console.warn('⚠️ [RedirectClassifier] Non-JSON output, falling back:', raw.substring(0, 100));
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const category = String(parsed.category || 'GENERAL').toUpperCase();
    const confidence = Number(parsed.confidence) || 0;

    // Validate category
    const validCategories = ['ORDER', 'PAYMENT', 'RETURN', 'ACCOUNT', 'GENERAL'];
    if (!validCategories.includes(category)) {
      console.warn(`⚠️ [RedirectClassifier] Invalid category "${category}", defaulting to GENERAL`);
      return { category: 'GENERAL', confidence: 0 };
    }

    console.log(`🔒 [RedirectClassifier] category=${category} confidence=${confidence.toFixed(2)}`);
    return { category, confidence };
  } catch (error) {
    console.error('❌ [RedirectClassifier] Classification failed:', error.message);
    return null;
  }
}

/**
 * Build interpolation variables for KB_ONLY redirect templates.
 * @param {string} category - 'ORDER' | 'PAYMENT' | 'RETURN' | 'ACCOUNT' | 'GENERAL'
 * @param {Object} helpLinks - Business help links
 * @param {string} language - 'TR' | 'EN'
 * @returns {{ link: string, contact: string }}
 */
export function buildKbOnlyRedirectVariables(category, helpLinks = {}, language = 'TR') {
  const lang = String(language).toUpperCase() === 'EN' ? 'EN' : 'TR';

  // Build link variable
  const linkKey = CATEGORY_LINK_MAP[category] || CATEGORY_LINK_MAP.GENERAL;
  const url = helpLinks[linkKey];
  let link;
  if (url) {
    link = lang === 'TR'
      ? ` Şuradan kontrol edebilirsiniz: ${url}`
      : ` You can check here: ${url}`;
  } else {
    link = FALLBACK_GUIDANCE[category]?.[lang] || FALLBACK_GUIDANCE.GENERAL[lang];
  }

  // Build contact variable
  const email = helpLinks.support_email;
  let contact = '';
  if (email) {
    contact = lang === 'TR'
      ? ` Bize ${email} adresinden yazabilirsiniz.`
      : ` You can reach us at ${email}.`;
  }

  return { link, contact };
}

export default {
  getChannelMode,
  getHelpLinks,
  normalizeTurkish,
  hasAccountHint,
  classifyRedirectCategory,
  buildKbOnlyRedirectVariables,
};

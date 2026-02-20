// ============================================================================
// SHARED PRICING CONFIG — Single Source of Truth
// ============================================================================
// Used by BOTH backend (plans.js) and frontend (pricing page)
// Keep this file dependency-free (no Prisma, no Node-only imports)
// ============================================================================

// ============================================================================
// REGIONAL PRICING
// ============================================================================

export const SHARED_REGIONAL_PRICING = {
  TR: {
    currency: 'TRY',
    symbol: '₺',
    symbolPosition: 'after', // 2.499₺
    locale: 'tr-TR',
    plans: {
      TRIAL:      { price: 0,    minutes: 15,   overageRate: 0,  concurrentLimit: 1,  assistantsLimit: 1,  chatDays: 7 },
      PAYG:       { price: 0,    minutes: 0,    overageRate: 0,  concurrentLimit: 1,  assistantsLimit: 5,  pricePerMinute: 23, minTopup: 4 },
      STARTER:    { price: 2499, minutes: 150,  overageRate: 23, concurrentLimit: 1,  assistantsLimit: 3 },
      PRO:        { price: 7499, minutes: 500,  overageRate: 23, concurrentLimit: 5,  assistantsLimit: 10 },
      ENTERPRISE: { price: null, minutes: null, overageRate: 23, concurrentLimit: 5,  assistantsLimit: 25 },
    },
  },
  BR: {
    currency: 'BRL',
    symbol: 'R$',
    symbolPosition: 'before',
    locale: 'pt-BR',
    plans: {
      TRIAL:      { price: 0,    minutes: 15,    overageRate: 0,    concurrentLimit: 1, assistantsLimit: 1,  chatDays: 7 },
      PAYG:       { price: 0,    minutes: 0,     overageRate: 0,    concurrentLimit: 1, assistantsLimit: 5,  pricePerMinute: 4.60, minTopup: 4 },
      STARTER:    { price: 500,  minutes: 150,   overageRate: 4.60, concurrentLimit: 1, assistantsLimit: 3 },
      PRO:        { price: 1500, minutes: 500,   overageRate: 4.60, concurrentLimit: 5, assistantsLimit: 10 },
      ENTERPRISE: { price: null, minutes: null,  overageRate: 4.60, concurrentLimit: 5, assistantsLimit: 25 },
    },
  },
  US: {
    currency: 'USD',
    symbol: '$',
    symbolPosition: 'before',
    locale: 'en-US',
    plans: {
      TRIAL:      { price: 0,    minutes: 15,   overageRate: 0,    concurrentLimit: 1, assistantsLimit: 1,  chatDays: 7 },
      PAYG:       { price: 0,    minutes: 0,    overageRate: 0,    concurrentLimit: 1, assistantsLimit: 5,  pricePerMinute: 0.51, minTopup: 4 },
      STARTER:    { price: 55,   minutes: 150,  overageRate: 0.51, concurrentLimit: 1, assistantsLimit: 3 },
      PRO:        { price: 167,  minutes: 500,  overageRate: 0.51, concurrentLimit: 5, assistantsLimit: 10 },
      ENTERPRISE: { price: null, minutes: null, overageRate: 0.51, concurrentLimit: 5, assistantsLimit: 25 },
    },
  },
};

// ============================================================================
// PLAN METADATA (names, descriptions, features)
// ============================================================================

export const SHARED_PLAN_META = {
  TRIAL: {
    id: 'TRIAL',
    nameTR: 'Deneme', nameEN: 'Trial',
    descTR: 'Ücretsiz deneme — 15 dk telefon, 7 gün chat/WhatsApp',
    descEN: 'Free trial — 15 min phone, 7-day chat/WhatsApp',
    features: ['phone', 'whatsapp', 'chatWidget', 'email', 'ecommerce', 'calendar', 'analytics', 'batchCalls'],
  },
  PAYG: {
    id: 'PAYG',
    nameTR: 'Kullandıkça Öde', nameEN: 'Pay As You Go',
    descTR: 'Dakika başı ödeme, minimum 4 dk yükleme',
    descEN: 'Pay per minute, minimum 4 min top-up',
    features: ['phone', 'whatsapp', 'chatWidget', 'email', 'ecommerce', 'calendar', 'analytics', 'batchCalls'],
  },
  STARTER: {
    id: 'STARTER',
    nameTR: 'Başlangıç', nameEN: 'Starter',
    descTR: 'Küçük işletmeler için ideal başlangıç paketi',
    descEN: 'Perfect starter package for small businesses',
    features: ['phone', 'whatsapp', 'chatWidget', 'email', 'ecommerce', 'calendar', 'analytics', 'batchCalls'],
  },
  PRO: {
    id: 'PRO',
    nameTR: 'Profesyonel', nameEN: 'Pro',
    descTR: 'Yüksek hacimli işletmeler için tam donanımlı paket',
    descEN: 'Full-featured package for high-volume businesses',
    features: ['phone', 'whatsapp', 'chatWidget', 'email', 'ecommerce', 'calendar', 'analytics', 'batchCalls', 'prioritySupport', 'apiAccess'],
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    nameTR: 'Kurumsal', nameEN: 'Enterprise',
    descTR: 'Özel ihtiyaçlar için kişiselleştirilmiş çözümler',
    descEN: 'Customized solutions for specific needs',
    features: ['phone', 'whatsapp', 'chatWidget', 'email', 'ecommerce', 'calendar', 'analytics', 'batchCalls', 'prioritySupport', 'apiAccess', 'slaGuarantee'],
  },
};

// ============================================================================
// FEATURE DISPLAY ORDER & LABELS
// ============================================================================

export const SHARED_FEATURE_ORDER = [
  'minutes',
  'concurrent',
  'assistants',
  'phone',
  'whatsapp',
  'chatWidget',
  'email',
  'ecommerce',
  'calendar',
  'analytics',
  'batchCalls',
  'prioritySupport',
  'apiAccess',
  'slaGuarantee',
];

export const SHARED_FEATURE_LABELS = {
  tr: {
    minutes: (plan) => {
      if (plan.id === 'TRIAL') return '15 dk telefon görüşmesi';
      if (plan.id === 'PAYG') return 'Dakika başı ödeme';
      if (plan.id === 'ENTERPRISE') return 'Özel dakika paketi';
      return `${plan.minutes} dk görüşme`;
    },
    concurrent: (plan) => plan.id === 'ENTERPRISE' ? '5+ eşzamanlı çağrı' : `${plan.concurrentLimit} eşzamanlı çağrı`,
    assistants: (plan) => plan.id === 'ENTERPRISE' ? 'Sınırsız asistan' : `${plan.assistantsLimit} asistan`,
    phone: 'Telefon AI',
    whatsapp: 'WhatsApp',
    chatWidget: 'Chat widget',
    email: 'E-posta AI',
    ecommerce: 'E-ticaret entegrasyonu',
    calendar: 'Google Takvim',
    analytics: 'Analitik',
    batchCalls: 'Toplu arama',
    prioritySupport: 'Öncelikli destek',
    apiAccess: 'API erişimi',
    slaGuarantee: 'SLA garantisi',
  },
  en: {
    minutes: (plan) => {
      if (plan.id === 'TRIAL') return '15 min phone calls';
      if (plan.id === 'PAYG') return 'Pay per minute';
      if (plan.id === 'ENTERPRISE') return 'Custom minute package';
      return `${plan.minutes} min calls`;
    },
    concurrent: (plan) => plan.id === 'ENTERPRISE' ? '5+ concurrent calls' : `${plan.concurrentLimit} concurrent call${plan.concurrentLimit > 1 ? 's' : ''}`,
    assistants: (plan) => plan.id === 'ENTERPRISE' ? 'Unlimited assistants' : `${plan.assistantsLimit} assistant${plan.assistantsLimit > 1 ? 's' : ''}`,
    phone: 'Phone AI',
    whatsapp: 'WhatsApp',
    chatWidget: 'Chat widget',
    email: 'Email AI',
    ecommerce: 'E-commerce integration',
    calendar: 'Google Calendar',
    analytics: 'Analytics',
    batchCalls: 'Batch calls',
    prioritySupport: 'Priority support',
    apiAccess: 'API access',
    slaGuarantee: 'SLA guarantee',
  },
};

// ============================================================================
// LOCALE → REGION MAPPING
// ============================================================================

export const LOCALE_TO_REGION = {
  tr: 'TR',
  pt: 'BR',
  pr: 'BR',
  en: 'US',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get regional pricing for a country code
 */
export function getSharedRegionalPricing(countryCode) {
  return SHARED_REGIONAL_PRICING[countryCode] || SHARED_REGIONAL_PRICING.US;
}

/**
 * Format price for display
 */
export function formatSharedPrice(price, countryCode = 'TR') {
  if (price === null || price === undefined) return null;
  const regional = getSharedRegionalPricing(countryCode);
  const formatted = price.toLocaleString(regional.locale);
  return regional.symbolPosition === 'before'
    ? `${regional.symbol}${formatted}`
    : `${formatted}${regional.symbol}`;
}

/**
 * Get feature label for display
 */
export function getFeatureLabel(featureKey, locale, plan) {
  const labels = SHARED_FEATURE_LABELS[locale] || SHARED_FEATURE_LABELS.en;
  const label = labels[featureKey];
  if (typeof label === 'function') return label(plan);
  return label || featureKey;
}

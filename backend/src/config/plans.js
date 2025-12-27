// ============================================================================
// PLAN CONFIGURATIONS - MULTI-REGION SUPPORT
// ============================================================================
// FILE: backend/src/config/plans.js
//
// Central configuration for subscription plans with pricing, limits, and features
// Supports multiple currencies and regions
// ============================================================================

import { getCountry, getCurrency, formatCurrency } from './countries.js';

// ============================================================================
// REGION-BASED PRICING
// ============================================================================

/**
 * Pricing per region with local currency values
 * Prices are set based on local purchasing power, not currency conversion
 */
export const REGIONAL_PRICING = {
  TR: {
    currency: 'TRY',
    symbol: '₺',
    plans: {
      FREE: { price: 0, minutes: 0, overageRate: 0, concurrentLimit: 0 },
      // YENİ PAKET YAPISI
      STARTER: { price: 799, minutes: 100, overageRate: 7.50, concurrentLimit: 1 },
      PRO: { price: 3999, minutes: 800, overageRate: 6.50, concurrentLimit: 5 },
      ENTERPRISE: { price: null, minutes: null, overageRate: 5.50, concurrentLimit: 10 },
      // Deprecated - geriye dönük uyumluluk
      BASIC: { price: 999, minutes: 150, overageRate: 11, concurrentLimit: 1 },
      PROFESSIONAL: { price: 3499, minutes: 500, overageRate: 10, concurrentLimit: 3 }
    },
    creditTiers: [
      { minMinutes: 500, unitPrice: 5.00, packageName: 'credit_500', packagePrice: 2500 },
      { minMinutes: 300, unitPrice: 5.50, packageName: 'credit_300', packagePrice: 1650 },
      { minMinutes: 100, unitPrice: 6.50, packageName: 'credit_100', packagePrice: 650 },
      { minMinutes: 1, unitPrice: 7.50 }
    ]
  },
  // Türkiye odaklı yapı - diğer bölgeler kullanılmıyor
  BR: {
    currency: 'BRL',
    symbol: 'R$',
    plans: {
      FREE: { price: 0, minutes: 0, overageRate: 0, concurrentLimit: 0 },
      STARTER: { price: 99, minutes: 60, overageRate: 3.50, concurrentLimit: 1 },
      PRO: { price: 499, minutes: 400, overageRate: 2.50, concurrentLimit: 5 },
      ENTERPRISE: { price: null, minutes: null, overageRate: 2.00, concurrentLimit: 10 },
      BASIC: { price: 299, minutes: 250, overageRate: 3.00, concurrentLimit: 1 },
      PROFESSIONAL: { price: 999, minutes: 1000, overageRate: 2.50, concurrentLimit: 3 }
    },
    creditTiers: [
      { minMinutes: 250, unitPrice: 2.00 },
      { minMinutes: 100, unitPrice: 2.25 },
      { minMinutes: 50, unitPrice: 2.50 },
      { minMinutes: 1, unitPrice: 2.75 }
    ]
  },
  US: {
    currency: 'USD',
    symbol: '$',
    plans: {
      FREE: { price: 0, minutes: 0, overageRate: 0, concurrentLimit: 0 },
      STARTER: { price: 49, minutes: 100, overageRate: 0.35, concurrentLimit: 1 },
      PRO: { price: 199, minutes: 800, overageRate: 0.25, concurrentLimit: 5 },
      ENTERPRISE: { price: null, minutes: null, overageRate: 0.20, concurrentLimit: 10 },
      BASIC: { price: 99, minutes: 250, overageRate: 0.30, concurrentLimit: 1 },
      PROFESSIONAL: { price: 349, minutes: 1000, overageRate: 0.25, concurrentLimit: 3 }
    },
    creditTiers: [
      { minMinutes: 250, unitPrice: 0.20 },
      { minMinutes: 100, unitPrice: 0.22 },
      { minMinutes: 50, unitPrice: 0.25 },
      { minMinutes: 1, unitPrice: 0.28 }
    ]
  },
  // European countries use EUR
  DE: { currency: 'EUR', symbol: '€', useUSDPricing: true, multiplier: 0.92 },
  FR: { currency: 'EUR', symbol: '€', useUSDPricing: true, multiplier: 0.92 },
  ES: { currency: 'EUR', symbol: '€', useUSDPricing: true, multiplier: 0.92 },
  NL: { currency: 'EUR', symbol: '€', useUSDPricing: true, multiplier: 0.92 },
  GB: { currency: 'GBP', symbol: '£', useUSDPricing: true, multiplier: 0.79 },
  AE: { currency: 'AED', symbol: 'د.إ', useUSDPricing: true, multiplier: 3.67 }
};

// ============================================================================
// BASE PLAN DEFINITIONS (limits and features)
// ============================================================================

export const PLANS = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    nameTR: 'Ücretsiz',
    nameEN: 'Free',
    namePR: 'Grátis',
    minutesLimit: 0,
    callsLimit: 0,
    assistantsLimit: 1,
    phoneNumbersLimit: 0,
    overageLimit: 0,
    concurrentLimit: 0,
    features: {
      phone: false,
      whatsappCalling: false,
      whatsappMessaging: false,
      chatWidget: false,
      email: false,
      ecommerce: false,
      calendar: false,
      googleSheets: false,
      batchCalls: false,
      prioritySupport: false,
      analytics: false,
      apiAccess: false
    },
    channels: []
  },
  // YENİ PAKET YAPISI
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    nameTR: 'Başlangıç',
    nameEN: 'Starter',
    namePR: 'Inicial',
    callsLimit: -1,           // Sınırsız çağrı
    assistantsLimit: -1,      // Sınırsız asistan
    phoneNumbersLimit: -1,    // Sınırsız numara
    overageLimit: 100,        // Max 100 dk aşım
    concurrentLimit: 1,       // 1 eşzamanlı çağrı
    features: {
      phone: true,
      whatsappCalling: true,
      whatsappMessaging: true,
      chatWidget: true,
      email: false,           // Pro'da açık
      ecommerce: true,
      calendar: true,
      googleSheets: false,    // Pro'da açık
      batchCalls: false,      // Pro'da açık
      prioritySupport: false, // Pro'da açık
      analytics: true,        // Basic analytics
      advancedAnalytics: false,
      apiAccess: false
    },
    channels: ['phone', 'whatsapp', 'chat_widget'],
    analyticsLevel: 'basic',
    supportLevel: 'email'
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    nameTR: 'Profesyonel',
    nameEN: 'Pro',
    namePR: 'Pro',
    callsLimit: -1,           // Sınırsız çağrı
    assistantsLimit: -1,      // Sınırsız asistan
    phoneNumbersLimit: -1,    // Sınırsız numara
    overageLimit: 200,        // Max 200 dk aşım
    concurrentLimit: 5,       // 5 eşzamanlı çağrı
    features: {
      phone: true,
      whatsappCalling: true,
      whatsappMessaging: true,
      chatWidget: true,
      email: true,
      ecommerce: true,
      calendar: true,
      googleSheets: true,
      batchCalls: true,
      prioritySupport: true,
      analytics: true,
      advancedAnalytics: true,
      apiAccess: true
    },
    channels: ['phone', 'whatsapp', 'chat_widget', 'email'],
    analyticsLevel: 'advanced',
    supportLevel: 'priority'
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    nameTR: 'Kurumsal',
    nameEN: 'Enterprise',
    namePR: 'Empresarial',
    minutesLimit: null,       // Custom
    callsLimit: -1,
    assistantsLimit: -1,      // Sınırsız
    phoneNumbersLimit: -1,    // Sınırsız
    overageLimit: null,       // Custom
    concurrentLimit: 10,      // 10+ eşzamanlı çağrı (custom olabilir)
    features: {
      phone: true,
      whatsappCalling: true,
      whatsappMessaging: true,
      chatWidget: true,
      email: true,
      ecommerce: true,
      calendar: true,
      googleSheets: true,
      batchCalls: true,
      prioritySupport: true,
      analytics: true,
      advancedAnalytics: true,
      apiAccess: true,
      customVoice: true,
      whiteLabel: true,
      dedicatedSupport: true,
      slaGuarantee: true,
      customIntegrations: true
    },
    channels: ['phone', 'whatsapp', 'chat_widget', 'email'],
    analyticsLevel: 'advanced',
    supportLevel: 'dedicated'
  },
  // DEPRECATED - geriye dönük uyumluluk için
  BASIC: {
    id: 'BASIC',
    name: 'Basic',
    nameTR: 'Temel',
    nameEN: 'Basic',
    namePR: 'Básico',
    deprecated: true,
    callsLimit: -1,
    assistantsLimit: 3,
    phoneNumbersLimit: 2,
    overageLimit: 50,
    concurrentLimit: 1,
    features: {
      phone: true,
      whatsappCalling: true,
      whatsappMessaging: true,
      chatWidget: true,
      email: false,
      ecommerce: true,
      calendar: true,
      googleSheets: false,
      batchCalls: false,
      prioritySupport: false,
      analytics: true,
      apiAccess: false
    },
    channels: ['phone', 'whatsapp', 'chat_widget']
  },
  PROFESSIONAL: {
    id: 'PROFESSIONAL',
    name: 'Professional',
    nameTR: 'Profesyonel',
    nameEN: 'Professional',
    namePR: 'Profissional',
    deprecated: true,
    callsLimit: -1,
    assistantsLimit: 10,
    phoneNumbersLimit: 5,
    overageLimit: 50,
    concurrentLimit: 3,
    features: {
      phone: true,
      whatsappCalling: true,
      whatsappMessaging: true,
      chatWidget: true,
      email: true,
      ecommerce: true,
      calendar: true,
      googleSheets: true,
      batchCalls: true,
      prioritySupport: true,
      analytics: true,
      apiAccess: true
    },
    channels: ['phone', 'whatsapp', 'chat_widget', 'email']
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get regional pricing configuration
 * @param {string} countryCode - Country code (TR, BR, US, etc.)
 * @returns {object} Regional pricing configuration
 */
export function getRegionalPricing(countryCode) {
  const regional = REGIONAL_PRICING[countryCode];

  if (!regional) {
    // Default to US pricing
    return REGIONAL_PRICING.US;
  }

  // If this region uses USD pricing with a multiplier
  if (regional.useUSDPricing) {
    const usPricing = REGIONAL_PRICING.US;
    const multiplier = regional.multiplier || 1;

    return {
      currency: regional.currency,
      symbol: regional.symbol,
      plans: Object.fromEntries(
        Object.entries(usPricing.plans).map(([planId, plan]) => [
          planId,
          {
            price: plan.price ? Math.round(plan.price * multiplier) : null,
            minutes: plan.minutes,
            overageRate: plan.overageRate ? +(plan.overageRate * multiplier).toFixed(2) : null
          }
        ])
      ),
      creditTiers: usPricing.creditTiers.map(tier => ({
        minMinutes: tier.minMinutes,
        unitPrice: +(tier.unitPrice * multiplier).toFixed(2)
      }))
    };
  }

  return regional;
}

/**
 * Get plan configuration by plan name
 * @param {string} planName - Plan name (FREE, STARTER, BASIC, PROFESSIONAL, ENTERPRISE)
 * @returns {object} Plan configuration
 */
export function getPlanConfig(planName) {
  return PLANS[planName] || PLANS.FREE;
}

/**
 * Get plan with regional pricing
 * @param {string} planName - Plan name
 * @param {string} countryCode - Country code
 * @returns {object} Plan configuration with regional pricing
 */
export function getPlanWithPricing(planName, countryCode = 'TR') {
  const plan = getPlanConfig(planName);
  const regional = getRegionalPricing(countryCode);
  const planPricing = regional.plans[planName] || regional.plans.FREE;

  return {
    ...plan,
    price: planPricing.price,
    minutesLimit: planPricing.minutes ?? plan.minutesLimit,
    overageRate: planPricing.overageRate,
    currency: regional.currency,
    currencySymbol: regional.symbol
  };
}

/**
 * Get all plans with regional pricing
 * @param {string} countryCode - Country code
 * @returns {object} All plans with regional pricing
 */
export function getAllPlansWithPricing(countryCode = 'TR') {
  const result = {};
  for (const planName of Object.keys(PLANS)) {
    result[planName] = getPlanWithPricing(planName, countryCode);
  }
  return result;
}

/**
 * Get credit unit price based on quantity and region
 * @param {number} minutes - Number of minutes to purchase
 * @param {string} countryCode - Country code
 * @returns {number} Unit price in local currency
 */
export function getCreditUnitPrice(minutes, countryCode = 'TR') {
  const regional = getRegionalPricing(countryCode);
  const tiers = regional.creditTiers;

  for (const tier of tiers) {
    if (minutes >= tier.minMinutes) {
      return tier.unitPrice;
    }
  }
  return tiers[tiers.length - 1].unitPrice;
}

/**
 * Calculate total credit price
 * @param {number} minutes - Number of minutes to purchase
 * @param {string} countryCode - Country code
 * @returns {object} { minutes, unitPrice, totalAmount, currency }
 */
export function calculateCreditPrice(minutes, countryCode = 'TR') {
  const regional = getRegionalPricing(countryCode);
  const unitPrice = getCreditUnitPrice(minutes, countryCode);

  return {
    minutes,
    unitPrice,
    totalAmount: +(minutes * unitPrice).toFixed(2),
    currency: regional.currency,
    currencySymbol: regional.symbol
  };
}

/**
 * Check if a feature is available for a plan
 * @param {string} planName - Plan name
 * @param {string} featureName - Feature name
 * @returns {boolean}
 */
export function hasFeature(planName, featureName) {
  const plan = getPlanConfig(planName);
  return plan.features?.[featureName] || false;
}

/**
 * Get overage rate for a plan in a specific region
 * @param {string} planName - Plan name
 * @param {string} countryCode - Country code
 * @returns {number} Overage rate in local currency per minute
 */
export function getOverageRate(planName, countryCode = 'TR') {
  const regional = getRegionalPricing(countryCode);
  return regional.plans[planName]?.overageRate || 0;
}

/**
 * Get overage limit for a plan
 * @param {string} planName - Plan name
 * @returns {number} Overage limit in minutes
 */
export function getOverageLimit(planName) {
  const plan = getPlanConfig(planName);
  return plan.overageLimit || 0;
}

/**
 * Get concurrent call limit for a plan
 * @param {string} planName - Plan name
 * @param {string} countryCode - Country code
 * @returns {number} Concurrent call limit
 */
export function getConcurrentLimit(planName, countryCode = 'TR') {
  const regional = getRegionalPricing(countryCode);
  const planPricing = regional.plans[planName];
  if (planPricing?.concurrentLimit !== undefined) {
    return planPricing.concurrentLimit;
  }
  const plan = getPlanConfig(planName);
  return plan.concurrentLimit || 1;
}

/**
 * Check if a channel is available for a plan
 * @param {string} planName - Plan name
 * @param {string} channel - Channel name (phone, whatsapp, chat_widget, email)
 * @returns {boolean}
 */
export function hasChannel(planName, channel) {
  const plan = getPlanConfig(planName);
  return plan.channels?.includes(channel) || false;
}

/**
 * Get all available channels for a plan
 * @param {string} planName - Plan name
 * @returns {string[]} Array of channel names
 */
export function getChannels(planName) {
  const plan = getPlanConfig(planName);
  return plan.channels || [];
}

/**
 * Get plan name in specific language
 * @param {string} planName - Plan name
 * @param {string} languageCode - Language code (TR, EN, PR, etc.)
 * @returns {string} Localized plan name
 */
export function getPlanName(planName, languageCode = 'EN') {
  const plan = getPlanConfig(planName);
  const key = `name${languageCode}`;
  return plan[key] || plan.nameEN || plan.name;
}

/**
 * Format price for display
 * @param {number} price - Price value
 * @param {string} countryCode - Country code
 * @returns {string} Formatted price string
 */
export function formatPrice(price, countryCode = 'TR') {
  if (price === null || price === undefined) {
    return null;
  }

  const regional = getRegionalPricing(countryCode);
  const currency = getCurrency(regional.currency);

  const formattedNumber = price
    .toFixed(currency.decimalPlaces)
    .replace('.', currency.decimalSeparator)
    .replace(/\B(?=(\d{3})+(?!\d))/g, currency.thousandSeparator);

  if (currency.position === 'before') {
    return `${currency.symbol}${formattedNumber}`;
  } else {
    return `${formattedNumber}${currency.symbol}`;
  }
}

// ============================================================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================================================

// Legacy credit pricing - defaults to TR
export const CREDIT_PRICING = {
  tiers: REGIONAL_PRICING.TR.creditTiers
};

export default {
  PLANS,
  REGIONAL_PRICING,
  CREDIT_PRICING,
  getRegionalPricing,
  getPlanConfig,
  getPlanWithPricing,
  getAllPlansWithPricing,
  getCreditUnitPrice,
  calculateCreditPrice,
  hasFeature,
  hasChannel,
  getChannels,
  getOverageRate,
  getOverageLimit,
  getConcurrentLimit,
  getPlanName,
  formatPrice
};

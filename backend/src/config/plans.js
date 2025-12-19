// ============================================================================
// PLAN CONFIGURATIONS
// ============================================================================
// FILE: backend/src/config/plans.js
//
// Central configuration for subscription plans with pricing, limits, and features
// ============================================================================

export const PLANS = {
  FREE: {
    name: 'Ücretsiz',
    nameTR: 'Ücretsiz',
    nameEN: 'Free',
    price: 0,
    priceTRY: 0,
    minutesLimit: 0,
    callsLimit: 0,
    assistantsLimit: 1,
    phoneNumbersLimit: 0,
    overageRate: 0,       // Aşım yok
    overageLimit: 0,      // Aşım yok
    features: {
      phone: false,
      whatsapp: false,
      chatWidget: false,
      email: false,
      ecommerce: false,
      calendar: false,
      prioritySupport: false,
      analytics: false,
      apiAccess: false
    }
  },
  STARTER: {
    name: 'Başlangıç',
    nameTR: 'Başlangıç',
    nameEN: 'Starter',
    price: 299,
    priceTRY: 299,
    minutesLimit: 50,
    callsLimit: -1,       // Unlimited calls
    assistantsLimit: 1,
    phoneNumbersLimit: 1,
    overageRate: 12,      // TL/dk
    overageLimit: 50,     // Max 50 dk aşım
    features: {
      phone: true,
      whatsapp: false,
      chatWidget: false,
      email: false,
      ecommerce: false,
      calendar: false,
      prioritySupport: false,
      analytics: true,
      apiAccess: false
    }
  },
  BASIC: {
    name: 'Temel',
    nameTR: 'Temel',
    nameEN: 'Basic',
    price: 999,
    priceTRY: 999,
    minutesLimit: 150,
    callsLimit: -1,       // Unlimited calls
    assistantsLimit: 3,
    phoneNumbersLimit: 2,
    overageRate: 11,      // TL/dk
    overageLimit: 50,     // Max 50 dk aşım
    features: {
      phone: true,
      whatsapp: true,
      chatWidget: true,
      email: false,
      ecommerce: true,
      calendar: true,
      prioritySupport: false,
      analytics: true,
      apiAccess: false
    }
  },
  PROFESSIONAL: {
    name: 'Pro',
    nameTR: 'Profesyonel',
    nameEN: 'Professional',
    price: 3499,
    priceTRY: 3499,
    minutesLimit: 500,
    callsLimit: -1,       // Unlimited calls
    assistantsLimit: 10,
    phoneNumbersLimit: 5,
    overageRate: 10,      // TL/dk
    overageLimit: 50,     // Max 50 dk aşım
    features: {
      phone: true,
      whatsapp: true,
      chatWidget: true,
      email: true,
      ecommerce: true,
      calendar: true,
      prioritySupport: true,
      analytics: true,
      apiAccess: true
    }
  },
  ENTERPRISE: {
    name: 'Kurumsal',
    nameTR: 'Kurumsal',
    nameEN: 'Enterprise',
    price: null,          // İletişime geç
    priceTRY: null,       // İletişime geç
    minutesLimit: null,   // Custom
    callsLimit: -1,       // Unlimited
    assistantsLimit: null, // Sınırsız
    phoneNumbersLimit: null, // Custom
    overageRate: null,    // Custom
    overageLimit: null,   // Custom
    features: {
      phone: true,
      whatsapp: true,
      chatWidget: true,
      email: true,
      ecommerce: true,
      calendar: true,
      prioritySupport: true,
      analytics: true,
      apiAccess: true,
      customVoice: true,
      whiteLabel: true,
      dedicatedSupport: true,
      slaGuarantee: true
    }
  }
};

// Kredi fiyatlandırması (TL/dk)
export const CREDIT_PRICING = {
  tiers: [
    { minMinutes: 250, unitPrice: 7.50 },
    { minMinutes: 100, unitPrice: 8.00 },
    { minMinutes: 50, unitPrice: 8.50 },
    { minMinutes: 1, unitPrice: 9.00 }
  ]
};

/**
 * Get plan configuration by plan name
 * @param {string} planName - Plan name (FREE, STARTER, BASIC, PROFESSIONAL, ENTERPRISE)
 * @returns {object} Plan configuration
 */
export function getPlanConfig(planName) {
  return PLANS[planName] || PLANS.FREE;
}

/**
 * Get credit unit price based on quantity
 * @param {number} minutes - Number of minutes to purchase
 * @returns {number} Unit price in TL
 */
export function getCreditUnitPrice(minutes) {
  for (const tier of CREDIT_PRICING.tiers) {
    if (minutes >= tier.minMinutes) {
      return tier.unitPrice;
    }
  }
  return CREDIT_PRICING.tiers[CREDIT_PRICING.tiers.length - 1].unitPrice;
}

/**
 * Calculate total credit price
 * @param {number} minutes - Number of minutes to purchase
 * @returns {object} { minutes, unitPrice, totalAmount }
 */
export function calculateCreditPrice(minutes) {
  const unitPrice = getCreditUnitPrice(minutes);
  return {
    minutes,
    unitPrice,
    totalAmount: minutes * unitPrice,
    currency: 'TRY'
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
 * Get overage rate for a plan
 * @param {string} planName - Plan name
 * @returns {number} Overage rate in TL/dk
 */
export function getOverageRate(planName) {
  const plan = getPlanConfig(planName);
  return plan.overageRate || 12;
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

export default {
  PLANS,
  CREDIT_PRICING,
  getPlanConfig,
  getCreditUnitPrice,
  calculateCreditPrice,
  hasFeature,
  getOverageRate,
  getOverageLimit
};

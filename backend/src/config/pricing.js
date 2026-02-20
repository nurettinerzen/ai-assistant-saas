/**
 * ============================================================================
 * MULTI-REGION PRICING CONFIGURATION
 * ============================================================================
 *
 * Pricing configuration for different regions/countries.
 * Prices are set per-market based on purchasing power and local competition.
 *
 * IMPORTANT: This is NOT currency conversion. Each region has its own pricing
 * strategy based on local market conditions.
 *
 * @author TELYX.AI Development Team
 * @version 1.0.0
 */

// ============================================================================
// REGIONAL PRICING
// ============================================================================

export const REGIONAL_PRICING = {
  // Turkey - Primary market (TRY)
  TR: {
    currency: 'TRY',
    symbol: '₺',
    symbolPosition: 'after', // 299₺
    plans: {
      FREE: {
        price: 0,
        minutesLimit: 0,
        callsLimit: 0,
        assistantsLimit: 1,
        phoneNumbersLimit: 0,
        overageRate: 0,
        overageLimit: 0
      },
      STARTER: {
        price: 299,
        minutesLimit: 50,
        callsLimit: -1, // Unlimited
        assistantsLimit: 1,
        phoneNumbersLimit: 1,
        overageRate: 12,
        overageLimit: 50
      },
      BASIC: {
        price: 999,
        minutesLimit: 150,
        callsLimit: -1,
        assistantsLimit: 3,
        phoneNumbersLimit: 2,
        overageRate: 11,
        overageLimit: 50
      },
      PRO: {
        price: 3499,
        minutesLimit: 500,
        callsLimit: -1,
        assistantsLimit: 10,
        phoneNumbersLimit: 5,
        overageRate: 10,
        overageLimit: 50
      },
      ENTERPRISE: {
        price: null, // Contact sales
        minutesLimit: null, // Custom
        callsLimit: -1,
        assistantsLimit: null, // Unlimited
        phoneNumbersLimit: null, // Custom
        overageRate: null, // Custom
        overageLimit: null // Custom
      }
    },
    creditPricing: {
      tiers: [
        { minMinutes: 250, unitPrice: 7.50 },
        { minMinutes: 100, unitPrice: 8.00 },
        { minMinutes: 50, unitPrice: 8.50 },
        { minMinutes: 1, unitPrice: 9.00 }
      ]
    }
  },

  // Brazil - Expansion market (BRL)
  BR: {
    currency: 'BRL',
    symbol: 'R$',
    symbolPosition: 'before', // R$99
    plans: {
      FREE: {
        price: 0,
        minutesLimit: 0,
        callsLimit: 0,
        assistantsLimit: 1,
        phoneNumbersLimit: 0,
        overageRate: 0,
        overageLimit: 0
      },
      STARTER: {
        price: 99,
        minutesLimit: 60,
        callsLimit: -1,
        assistantsLimit: 1,
        phoneNumbersLimit: 0, // WhatsApp only in Brazil
        overageRate: 3,
        overageLimit: 50
      },
      BASIC: {
        price: 299,
        minutesLimit: 200,
        callsLimit: -1,
        assistantsLimit: 3,
        phoneNumbersLimit: 0,
        overageRate: 2.5,
        overageLimit: 50
      },
      PRO: {
        price: 999,
        minutesLimit: 600,
        callsLimit: -1,
        assistantsLimit: 10,
        phoneNumbersLimit: 1, // BYOC support
        overageRate: 2,
        overageLimit: 50
      },
      ENTERPRISE: {
        price: null,
        minutesLimit: null,
        callsLimit: -1,
        assistantsLimit: null,
        phoneNumbersLimit: null,
        overageRate: null,
        overageLimit: null
      }
    },
    creditPricing: {
      tiers: [
        { minMinutes: 250, unitPrice: 1.80 },
        { minMinutes: 100, unitPrice: 2.00 },
        { minMinutes: 50, unitPrice: 2.20 },
        { minMinutes: 1, unitPrice: 2.50 }
      ]
    }
  },

  // United States (USD)
  US: {
    currency: 'USD',
    symbol: '$',
    symbolPosition: 'before', // $29
    plans: {
      FREE: {
        price: 0,
        minutesLimit: 0,
        callsLimit: 0,
        assistantsLimit: 1,
        phoneNumbersLimit: 0,
        overageRate: 0,
        overageLimit: 0
      },
      STARTER: {
        price: 29,
        minutesLimit: 60,
        callsLimit: -1,
        assistantsLimit: 1,
        phoneNumbersLimit: 1,
        overageRate: 0.50,
        overageLimit: 50
      },
      BASIC: {
        price: 99,
        minutesLimit: 250,
        callsLimit: -1,
        assistantsLimit: 3,
        phoneNumbersLimit: 2,
        overageRate: 0.45,
        overageLimit: 50
      },
      PRO: {
        price: 349,
        minutesLimit: 1000,
        callsLimit: -1,
        assistantsLimit: 10,
        phoneNumbersLimit: 5,
        overageRate: 0.40,
        overageLimit: 50
      },
      ENTERPRISE: {
        price: null,
        minutesLimit: null,
        callsLimit: -1,
        assistantsLimit: null,
        phoneNumbersLimit: null,
        overageRate: null,
        overageLimit: null
      }
    },
    creditPricing: {
      tiers: [
        { minMinutes: 250, unitPrice: 0.35 },
        { minMinutes: 100, unitPrice: 0.38 },
        { minMinutes: 50, unitPrice: 0.42 },
        { minMinutes: 1, unitPrice: 0.45 }
      ]
    }
  },

  // Europe (EUR) - for DE, FR, ES, NL, etc.
  EU: {
    currency: 'EUR',
    symbol: '€',
    symbolPosition: 'before', // €29
    plans: {
      FREE: {
        price: 0,
        minutesLimit: 0,
        callsLimit: 0,
        assistantsLimit: 1,
        phoneNumbersLimit: 0,
        overageRate: 0,
        overageLimit: 0
      },
      STARTER: {
        price: 29,
        minutesLimit: 60,
        callsLimit: -1,
        assistantsLimit: 1,
        phoneNumbersLimit: 1,
        overageRate: 0.45,
        overageLimit: 50
      },
      BASIC: {
        price: 89,
        minutesLimit: 250,
        callsLimit: -1,
        assistantsLimit: 3,
        phoneNumbersLimit: 2,
        overageRate: 0.40,
        overageLimit: 50
      },
      PRO: {
        price: 299,
        minutesLimit: 1000,
        callsLimit: -1,
        assistantsLimit: 10,
        phoneNumbersLimit: 5,
        overageRate: 0.35,
        overageLimit: 50
      },
      ENTERPRISE: {
        price: null,
        minutesLimit: null,
        callsLimit: -1,
        assistantsLimit: null,
        phoneNumbersLimit: null,
        overageRate: null,
        overageLimit: null
      }
    },
    creditPricing: {
      tiers: [
        { minMinutes: 250, unitPrice: 0.30 },
        { minMinutes: 100, unitPrice: 0.33 },
        { minMinutes: 50, unitPrice: 0.38 },
        { minMinutes: 1, unitPrice: 0.42 }
      ]
    }
  },

  // United Kingdom (GBP)
  GB: {
    currency: 'GBP',
    symbol: '£',
    symbolPosition: 'before', // £25
    plans: {
      FREE: {
        price: 0,
        minutesLimit: 0,
        callsLimit: 0,
        assistantsLimit: 1,
        phoneNumbersLimit: 0,
        overageRate: 0,
        overageLimit: 0
      },
      STARTER: {
        price: 25,
        minutesLimit: 60,
        callsLimit: -1,
        assistantsLimit: 1,
        phoneNumbersLimit: 1,
        overageRate: 0.40,
        overageLimit: 50
      },
      BASIC: {
        price: 79,
        minutesLimit: 250,
        callsLimit: -1,
        assistantsLimit: 3,
        phoneNumbersLimit: 2,
        overageRate: 0.35,
        overageLimit: 50
      },
      PRO: {
        price: 279,
        minutesLimit: 1000,
        callsLimit: -1,
        assistantsLimit: 10,
        phoneNumbersLimit: 5,
        overageRate: 0.30,
        overageLimit: 50
      },
      ENTERPRISE: {
        price: null,
        minutesLimit: null,
        callsLimit: -1,
        assistantsLimit: null,
        phoneNumbersLimit: null,
        overageRate: null,
        overageLimit: null
      }
    },
    creditPricing: {
      tiers: [
        { minMinutes: 250, unitPrice: 0.28 },
        { minMinutes: 100, unitPrice: 0.30 },
        { minMinutes: 50, unitPrice: 0.35 },
        { minMinutes: 1, unitPrice: 0.38 }
      ]
    }
  }
};

// ============================================================================
// COUNTRY TO PRICING REGION MAPPING
// ============================================================================

export const COUNTRY_TO_PRICING_REGION = {
  TR: 'TR', // Turkey uses TR pricing
  BR: 'BR', // Brazil uses BR pricing
  US: 'US', // USA uses US pricing
  GB: 'GB', // UK uses GB pricing
  DE: 'EU', // Germany uses EU pricing
  FR: 'EU', // France uses EU pricing
  ES: 'EU', // Spain uses EU pricing
  NL: 'EU', // Netherlands uses EU pricing
  IT: 'EU', // Italy uses EU pricing
  AE: 'US'  // UAE uses USD pricing
};

// ============================================================================
// PLAN FEATURES (Same for all regions)
// ============================================================================

export const PLAN_FEATURES = {
  FREE: {
    phone: false,
    whatsapp: false,
    chatWidget: false,
    email: false,
    ecommerce: false,
    calendar: false,
    prioritySupport: false,
    analytics: false,
    apiAccess: false,
    batchCalls: false,
    googleSheets: false,
    customCrm: false
  },
  STARTER: {
    phone: true,
    whatsapp: false,
    chatWidget: false,
    email: false,
    ecommerce: false,
    calendar: false,
    prioritySupport: false,
    analytics: true,
    apiAccess: false,
    batchCalls: true,
    googleSheets: false,
    customCrm: false
  },
  BASIC: {
    phone: true,
    whatsapp: true,
    chatWidget: true,
    email: false,
    ecommerce: true,
    calendar: true,
    prioritySupport: false,
    analytics: true,
    apiAccess: false,
    batchCalls: true,
    googleSheets: false,
    customCrm: false
  },
  PRO: {
    phone: true,
    whatsapp: true,
    chatWidget: true,
    email: true,
    ecommerce: true,
    calendar: true,
    prioritySupport: true,
    analytics: true,
    apiAccess: true,
    batchCalls: true,
    googleSheets: true,
    customCrm: true
  },
  ENTERPRISE: {
    phone: true,
    whatsapp: true,
    chatWidget: true,
    email: true,
    ecommerce: true,
    calendar: true,
    prioritySupport: true,
    analytics: true,
    apiAccess: true,
    batchCalls: true,
    googleSheets: true,
    customCrm: true,
    customVoice: true,
    whiteLabel: true,
    dedicatedSupport: true,
    slaGuarantee: true
  }
};

// ============================================================================
// PLAN NAMES (Localized)
// ============================================================================

export const PLAN_NAMES = {
  FREE: {
    TR: 'Ücretsiz',
    EN: 'Free',
    PR: 'Grátis',
    DE: 'Kostenlos',
    ES: 'Gratis',
    FR: 'Gratuit'
  },
  STARTER: {
    TR: 'Başlangıç',
    EN: 'Starter',
    PR: 'Inicial',
    DE: 'Starter',
    ES: 'Inicial',
    FR: 'Débutant'
  },
  BASIC: {
    TR: 'Temel',
    EN: 'Basic',
    PR: 'Básico',
    DE: 'Basis',
    ES: 'Básico',
    FR: 'Basique'
  },
  PRO: {
    TR: 'Profesyonel',
    EN: 'Pro',
    PR: 'Pro',
    DE: 'Pro',
    ES: 'Pro',
    FR: 'Pro'
  },
  ENTERPRISE: {
    TR: 'Kurumsal',
    EN: 'Enterprise',
    PR: 'Empresarial',
    DE: 'Unternehmen',
    ES: 'Empresarial',
    FR: 'Entreprise'
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get pricing region for a country
 * @param {string} countryCode - Country code (TR, BR, US, etc.)
 * @returns {string} Pricing region code
 */
export function getPricingRegion(countryCode) {
  return COUNTRY_TO_PRICING_REGION[countryCode] || 'US';
}

/**
 * Get pricing configuration for a country
 * @param {string} countryCode - Country code
 * @returns {object} Pricing configuration
 */
export function getRegionalPricing(countryCode) {
  const region = getPricingRegion(countryCode);
  return REGIONAL_PRICING[region] || REGIONAL_PRICING.US;
}

/**
 * Get plan pricing for a specific country
 * @param {string} planName - Plan name (STARTER, BASIC, etc.)
 * @param {string} countryCode - Country code
 * @returns {object} Plan pricing details
 */
export function getPlanPricing(planName, countryCode) {
  const pricing = getRegionalPricing(countryCode);
  const plan = pricing.plans[planName];

  if (!plan) {
    return null;
  }

  return {
    ...plan,
    currency: pricing.currency,
    symbol: pricing.symbol,
    symbolPosition: pricing.symbolPosition
  };
}

/**
 * Format price for display
 * @param {number} amount - Price amount
 * @param {string} countryCode - Country code
 * @returns {string} Formatted price string
 */
export function formatPrice(amount, countryCode) {
  const pricing = getRegionalPricing(countryCode);

  if (amount === null || amount === undefined) {
    return pricing.symbol === '₺' ? 'İletişime Geçin' :
           pricing.symbol === 'R$' ? 'Entre em Contato' :
           'Contact Us';
  }

  const formattedAmount = amount.toLocaleString();

  if (pricing.symbolPosition === 'before') {
    return `${pricing.symbol}${formattedAmount}`;
  } else {
    return `${formattedAmount}${pricing.symbol}`;
  }
}

/**
 * Get credit unit price for a quantity
 * @param {number} minutes - Number of minutes to purchase
 * @param {string} countryCode - Country code
 * @returns {number} Unit price
 */
export function getCreditUnitPrice(minutes, countryCode) {
  const pricing = getRegionalPricing(countryCode);

  for (const tier of pricing.creditPricing.tiers) {
    if (minutes >= tier.minMinutes) {
      return tier.unitPrice;
    }
  }

  const lastTier = pricing.creditPricing.tiers[pricing.creditPricing.tiers.length - 1];
  return lastTier.unitPrice;
}

/**
 * Calculate total credit price
 * @param {number} minutes - Number of minutes to purchase
 * @param {string} countryCode - Country code
 * @returns {object} { minutes, unitPrice, totalAmount, currency }
 */
export function calculateCreditPrice(minutes, countryCode) {
  const pricing = getRegionalPricing(countryCode);
  const unitPrice = getCreditUnitPrice(minutes, countryCode);

  return {
    minutes,
    unitPrice,
    totalAmount: minutes * unitPrice,
    currency: pricing.currency,
    symbol: pricing.symbol
  };
}

/**
 * Get plan name in specified language
 * @param {string} planName - Plan name (STARTER, BASIC, etc.)
 * @param {string} language - Language code (TR, EN, PR, etc.)
 * @returns {string} Localized plan name
 */
export function getLocalizedPlanName(planName, language) {
  const names = PLAN_NAMES[planName];
  return names?.[language] || names?.EN || planName;
}

/**
 * Check if a feature is available for a plan
 * @param {string} planName - Plan name
 * @param {string} featureName - Feature name
 * @returns {boolean}
 */
export function hasFeature(planName, featureName) {
  const features = PLAN_FEATURES[planName];
  return features?.[featureName] || false;
}

/**
 * Get all plans for a country with pricing
 * @param {string} countryCode - Country code
 * @param {string} language - Language code for names
 * @returns {array} Array of plan objects
 */
export function getAllPlansForCountry(countryCode, language = 'EN') {
  const pricing = getRegionalPricing(countryCode);

  return Object.entries(pricing.plans).map(([planName, planData]) => ({
    id: planName,
    name: getLocalizedPlanName(planName, language),
    ...planData,
    features: PLAN_FEATURES[planName],
    currency: pricing.currency,
    symbol: pricing.symbol,
    symbolPosition: pricing.symbolPosition,
    formattedPrice: formatPrice(planData.price, countryCode)
  }));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  REGIONAL_PRICING,
  COUNTRY_TO_PRICING_REGION,
  PLAN_FEATURES,
  PLAN_NAMES,
  getPricingRegion,
  getRegionalPricing,
  getPlanPricing,
  formatPrice,
  getCreditUnitPrice,
  calculateCreditPrice,
  getLocalizedPlanName,
  hasFeature,
  getAllPlansForCountry
};

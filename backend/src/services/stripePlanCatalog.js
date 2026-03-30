const PLAN_IDS = ['STARTER', 'PRO', 'ENTERPRISE'];

const COUNTRY_TO_PRICE_SUFFIX = {
  TR: 'TRY',
  BR: 'BRL',
  GB: 'GBP',
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
};

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function getConfiguredStripePriceIdsForPlan(planId) {
  if (!planId) return [];

  return unique([
    process.env[`STRIPE_${planId}_PRICE_ID`],
    process.env[`STRIPE_${planId}_PRICE_ID_TRY`],
    process.env[`STRIPE_${planId}_PRICE_ID_BRL`],
    process.env[`STRIPE_${planId}_PRICE_ID_EUR`],
    process.env[`STRIPE_${planId}_PRICE_ID_GBP`],
  ]);
}

export function resolvePlanFromStripePriceId(priceId) {
  if (!priceId) return null;

  for (const planId of PLAN_IDS) {
    if (getConfiguredStripePriceIdsForPlan(planId).includes(priceId)) {
      return planId;
    }
  }

  return null;
}

export function resolveStripePriceIdForPlan(planId, country, fallbackPriceId = null) {
  if (!planId) return fallbackPriceId;

  const upperCountry = String(country || '').toUpperCase();
  const preferredSuffix = COUNTRY_TO_PRICE_SUFFIX[upperCountry];

  if (preferredSuffix) {
    const regionalPriceId = process.env[`STRIPE_${planId}_PRICE_ID_${preferredSuffix}`];
    if (regionalPriceId) {
      return regionalPriceId;
    }
  }

  return process.env[`STRIPE_${planId}_PRICE_ID`] || fallbackPriceId;
}

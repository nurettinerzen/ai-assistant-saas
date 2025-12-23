/**
 * Feature Visibility Configuration
 * Controls which features are visible/accessible based on user's subscription plan
 */

// Plan enum values
export const PLANS = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  BASIC: 'BASIC',
  PRO: 'PROFESSIONAL',      // Backend uses PROFESSIONAL
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE'
};

// Plan hierarchy for comparison
export const PLAN_HIERARCHY = {
  [PLANS.FREE]: 0,
  [PLANS.STARTER]: 1,
  [PLANS.BASIC]: 2,
  [PLANS.PROFESSIONAL]: 3,
  [PLANS.ENTERPRISE]: 4
};

// Visibility types
export const VISIBILITY = {
  VISIBLE: 'visible',   // Feature is accessible
  LOCKED: 'locked',     // Feature is visible but locked (shows upgrade modal)
  HIDDEN: 'hidden'      // Feature is completely hidden
};

/**
 * Feature definitions with visibility per plan
 *
 * Sidebar Matrix:
 * | Feature        | Starter | Basic | Pro | Enterprise |
 * |----------------|---------|-------|-----|------------|
 * | E-posta        | hidden  | locked| ✓   | ✓          |
 * | Entegrasyonlar | hidden  | ✓     | ✓   | ✓          |
 * | Toplu Arama    | hidden  | locked| ✓   | ✓          |
 */
export const FEATURES = {
  // Sidebar features
  EMAIL: {
    id: 'email',
    name: 'E-posta',
    nameEN: 'Email',
    requiredPlan: PLANS.PROFESSIONAL,
    visibility: {
      [PLANS.FREE]: VISIBILITY.HIDDEN,
      [PLANS.STARTER]: VISIBILITY.HIDDEN,
      [PLANS.BASIC]: VISIBILITY.LOCKED,
      [PLANS.PROFESSIONAL]: VISIBILITY.VISIBLE,
      [PLANS.ENTERPRISE]: VISIBILITY.VISIBLE
    },
    description: 'E-posta ile müşteri hizmetleri otomasyonu yapın.',
    descriptionEN: 'Automate customer service via email.'
  },

  INTEGRATIONS: {
    id: 'integrations',
    name: 'Entegrasyonlar',
    nameEN: 'Integrations',
    requiredPlan: PLANS.BASIC,
    visibility: {
      [PLANS.FREE]: VISIBILITY.HIDDEN,
      [PLANS.STARTER]: VISIBILITY.HIDDEN,
      [PLANS.BASIC]: VISIBILITY.VISIBLE,
      [PLANS.PROFESSIONAL]: VISIBILITY.VISIBLE,
      [PLANS.ENTERPRISE]: VISIBILITY.VISIBLE
    },
    description: 'Üçüncü parti uygulamalarla entegrasyon yapın.',
    descriptionEN: 'Integrate with third-party applications.'
  },

  BATCH_CALLS: {
    id: 'batch_calls',
    name: 'Toplu Arama',
    nameEN: 'Batch Calls',
    requiredPlan: PLANS.PROFESSIONAL,
    visibility: {
      [PLANS.FREE]: VISIBILITY.HIDDEN,
      [PLANS.STARTER]: VISIBILITY.HIDDEN,
      [PLANS.BASIC]: VISIBILITY.LOCKED,
      [PLANS.PROFESSIONAL]: VISIBILITY.VISIBLE,
      [PLANS.ENTERPRISE]: VISIBILITY.VISIBLE
    },
    description: 'Excel/CSV yükleyerek toplu tahsilat ve hatırlatma aramaları yapın.',
    descriptionEN: 'Make bulk collection and reminder calls by uploading Excel/CSV.'
  },

  // Integration page features (sub-features within integrations)
  CALENDAR_INTEGRATION: {
    id: 'calendar_integration',
    name: 'Takvim Entegrasyonu',
    nameEN: 'Calendar Integration',
    requiredPlan: PLANS.PROFESSIONAL,
    visibility: {
      [PLANS.FREE]: VISIBILITY.HIDDEN,
      [PLANS.STARTER]: VISIBILITY.HIDDEN,
      [PLANS.BASIC]: VISIBILITY.LOCKED,
      [PLANS.PROFESSIONAL]: VISIBILITY.VISIBLE,
      [PLANS.ENTERPRISE]: VISIBILITY.VISIBLE
    },
    description: 'Google Calendar ile randevu yönetimi yapın.',
    descriptionEN: 'Manage appointments with Google Calendar.'
  },

  SHEETS_INTEGRATION: {
    id: 'sheets_integration',
    name: 'Google Sheets',
    nameEN: 'Google Sheets',
    requiredPlan: PLANS.PROFESSIONAL,
    visibility: {
      [PLANS.FREE]: VISIBILITY.HIDDEN,
      [PLANS.STARTER]: VISIBILITY.HIDDEN,
      [PLANS.BASIC]: VISIBILITY.LOCKED,
      [PLANS.PROFESSIONAL]: VISIBILITY.VISIBLE,
      [PLANS.ENTERPRISE]: VISIBILITY.VISIBLE
    },
    description: 'Google Sheets ile veri senkronizasyonu yapın.',
    descriptionEN: 'Sync data with Google Sheets.'
  },

  CRM_INTEGRATION: {
    id: 'crm_integration',
    name: 'Custom CRM',
    nameEN: 'Custom CRM',
    requiredPlan: PLANS.PROFESSIONAL,
    visibility: {
      [PLANS.FREE]: VISIBILITY.HIDDEN,
      [PLANS.STARTER]: VISIBILITY.HIDDEN,
      [PLANS.BASIC]: VISIBILITY.LOCKED,
      [PLANS.PROFESSIONAL]: VISIBILITY.VISIBLE,
      [PLANS.ENTERPRISE]: VISIBILITY.VISIBLE
    },
    description: 'Kendi CRM sisteminizi entegre edin.',
    descriptionEN: 'Integrate your own CRM system.'
  },

  // E-commerce integrations are available for BASIC and above
  ECOMMERCE_INTEGRATION: {
    id: 'ecommerce_integration',
    name: 'E-ticaret Entegrasyonu',
    nameEN: 'E-commerce Integration',
    requiredPlan: PLANS.BASIC,
    visibility: {
      [PLANS.FREE]: VISIBILITY.HIDDEN,
      [PLANS.STARTER]: VISIBILITY.HIDDEN,
      [PLANS.BASIC]: VISIBILITY.VISIBLE,
      [PLANS.PROFESSIONAL]: VISIBILITY.VISIBLE,
      [PLANS.ENTERPRISE]: VISIBILITY.VISIBLE
    },
    description: 'Shopify, WooCommerce, ikas ve daha fazlası.',
    descriptionEN: 'Shopify, WooCommerce, ikas and more.'
  }
};

// Integration types that are locked for BASIC plan
export const LOCKED_INTEGRATIONS_FOR_BASIC = [
  'GOOGLE_CALENDAR',
  'GOOGLE_SHEETS',
  'CUSTOM'  // Custom CRM
];

// Map integration types to feature definitions
export const INTEGRATION_FEATURE_MAP = {
  'GOOGLE_CALENDAR': FEATURES.CALENDAR_INTEGRATION,
  'GOOGLE_SHEETS': FEATURES.SHEETS_INTEGRATION,
  'CUSTOM': FEATURES.CRM_INTEGRATION,
  'ZAPIER': FEATURES.CRM_INTEGRATION,  // Zapier is part of CRM/automation
  // E-commerce platforms - available for BASIC
  'SHOPIFY': FEATURES.ECOMMERCE_INTEGRATION,
  'WOOCOMMERCE': FEATURES.ECOMMERCE_INTEGRATION,
  'IKAS': FEATURES.ECOMMERCE_INTEGRATION,
  'IDEASOFT': FEATURES.ECOMMERCE_INTEGRATION,
  'TICIMAX': FEATURES.ECOMMERCE_INTEGRATION,
  // WhatsApp and iyzico are special - handled separately
  'WHATSAPP': null,
  'IYZICO': null
};

/**
 * Get feature visibility for a specific plan
 * @param {string} featureId - Feature ID from FEATURES
 * @param {string} userPlan - User's current plan
 * @returns {string} Visibility type: 'visible', 'locked', or 'hidden'
 */
export function getFeatureVisibility(featureId, userPlan) {
  const feature = Object.values(FEATURES).find(f => f.id === featureId);
  if (!feature) return VISIBILITY.VISIBLE;

  // Normalize plan name
  const normalizedPlan = userPlan?.toUpperCase() || PLANS.FREE;

  return feature.visibility[normalizedPlan] || VISIBILITY.HIDDEN;
}

/**
 * Get feature definition by ID
 * @param {string} featureId - Feature ID
 * @returns {object|null} Feature definition
 */
export function getFeature(featureId) {
  return Object.values(FEATURES).find(f => f.id === featureId) || null;
}

/**
 * Check if user's plan has access to a feature
 * @param {string} featureId - Feature ID
 * @param {string} userPlan - User's current plan
 * @returns {boolean} True if feature is accessible
 */
export function hasFeatureAccess(featureId, userPlan) {
  const visibility = getFeatureVisibility(featureId, userPlan);
  return visibility === VISIBILITY.VISIBLE;
}

/**
 * Check if feature should be shown (visible or locked)
 * @param {string} featureId - Feature ID
 * @param {string} userPlan - User's current plan
 * @returns {boolean} True if feature should be displayed
 */
export function shouldShowFeature(featureId, userPlan) {
  const visibility = getFeatureVisibility(featureId, userPlan);
  return visibility !== VISIBILITY.HIDDEN;
}

/**
 * Check if feature is locked for the user's plan
 * @param {string} featureId - Feature ID
 * @param {string} userPlan - User's current plan
 * @returns {boolean} True if feature is locked
 */
export function isFeatureLocked(featureId, userPlan) {
  const visibility = getFeatureVisibility(featureId, userPlan);
  return visibility === VISIBILITY.LOCKED;
}

/**
 * Get the required plan name for a feature
 * @param {string} featureId - Feature ID
 * @param {string} locale - 'tr' or 'en'
 * @returns {string} Required plan name
 */
export function getRequiredPlanName(featureId, locale = 'tr') {
  const feature = getFeature(featureId);
  if (!feature) return '';

  const planNames = {
    [PLANS.BASIC]: locale === 'tr' ? 'Temel' : 'Basic',
    [PLANS.PROFESSIONAL]: locale === 'tr' ? 'Pro' : 'Pro',
    [PLANS.ENTERPRISE]: locale === 'tr' ? 'Kurumsal' : 'Enterprise'
  };

  return planNames[feature.requiredPlan] || '';
}

/**
 * Get feature description
 * @param {string} featureId - Feature ID
 * @param {string} locale - 'tr' or 'en'
 * @returns {string} Feature description
 */
export function getFeatureDescription(featureId, locale = 'tr') {
  const feature = getFeature(featureId);
  if (!feature) return '';

  return locale === 'tr' ? feature.description : feature.descriptionEN;
}

/**
 * Get feature name
 * @param {string} featureId - Feature ID
 * @param {string} locale - 'tr' or 'en'
 * @returns {string} Feature name
 */
export function getFeatureName(featureId, locale = 'tr') {
  const feature = getFeature(featureId);
  if (!feature) return '';

  return locale === 'tr' ? feature.name : feature.nameEN;
}

/**
 * Get integration feature info
 * @param {string} integrationType - Integration type (e.g., 'GOOGLE_CALENDAR')
 * @param {string} userPlan - User's current plan
 * @returns {object} { isLocked, feature }
 */
export function getIntegrationFeatureInfo(integrationType, userPlan) {
  const featureMapping = INTEGRATION_FEATURE_MAP[integrationType];

  // If no mapping exists, integration is always available
  if (!featureMapping) {
    return { isLocked: false, feature: null };
  }

  const normalizedPlan = userPlan?.toUpperCase() || PLANS.FREE;
  const visibility = featureMapping.visibility[normalizedPlan];

  return {
    isLocked: visibility === VISIBILITY.LOCKED,
    isHidden: visibility === VISIBILITY.HIDDEN,
    feature: featureMapping
  };
}

export default {
  PLANS,
  PLAN_HIERARCHY,
  VISIBILITY,
  FEATURES,
  LOCKED_INTEGRATIONS_FOR_BASIC,
  INTEGRATION_FEATURE_MAP,
  getFeatureVisibility,
  getFeature,
  hasFeatureAccess,
  shouldShowFeature,
  isFeatureLocked,
  getRequiredPlanName,
  getFeatureDescription,
  getFeatureName,
  getIntegrationFeatureInfo
};

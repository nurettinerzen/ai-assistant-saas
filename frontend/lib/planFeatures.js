/**
 * Plan Features Configuration
 * Defines feature access for each subscription plan
 */

export const PLAN_FEATURES = {
  FREE: {
    inboundCalls: true,
    outboundCalls: false,  // Batch calling
    whatsapp: true,
    chatWidget: true,
    email: true,
    googleCalendar: true,
    googleSheets: true,
    ecommerce: true,
    customCrm: false,
    maxMinutes: 15,
    maxAssistants: 1,
    maxConcurrentCalls: 1,
    trialDays: 7  // Free plan expires after 7 days
  },
  STARTER: {
    inboundCalls: true,
    outboundCalls: false,
    whatsapp: true,
    chatWidget: true,
    email: true,
    googleCalendar: true,
    googleSheets: true,
    ecommerce: true,
    customCrm: false,
    maxMinutes: 150,
    maxAssistants: 3,
    maxConcurrentCalls: 1
  },
  PRO: {
    inboundCalls: true,
    outboundCalls: true,
    whatsapp: true,
    chatWidget: true,
    email: true,
    googleCalendar: true,
    googleSheets: true,
    ecommerce: true,
    customCrm: true,
    maxMinutes: 500,
    maxAssistants: 10,
    maxConcurrentCalls: 5
  },
  PROFESSIONAL: {
    // Alias for PRO (backend uses PROFESSIONAL)
    inboundCalls: true,
    outboundCalls: true,
    whatsapp: true,
    chatWidget: true,
    email: true,
    googleCalendar: true,
    googleSheets: true,
    ecommerce: true,
    customCrm: true,
    maxMinutes: 500,
    maxAssistants: 10,
    maxConcurrentCalls: 5
  },
  ENTERPRISE: {
    // All features enabled, limits are custom per customer (from DB)
    inboundCalls: true,
    outboundCalls: true,
    whatsapp: true,
    chatWidget: true,
    email: true,
    googleCalendar: true,
    googleSheets: true,
    ecommerce: true,
    customCrm: true,
    // maxMinutes, maxAssistants, maxConcurrentCalls come from DB
    maxMinutes: null,
    maxAssistants: null,
    maxConcurrentCalls: null
  }
};

/**
 * Check if a plan has access to a specific feature
 * @param {string} plan - User's current plan
 * @param {string} feature - Feature name (e.g., 'outboundCalls', 'customCrm')
 * @returns {boolean}
 */
export function canAccessFeature(plan, feature) {
  const normalizedPlan = plan?.toUpperCase() || 'FREE';
  return PLAN_FEATURES[normalizedPlan]?.[feature] ?? false;
}

/**
 * Get plan limits for a specific plan
 * @param {string} plan - User's current plan
 * @returns {object} Plan limits
 */
export function getPlanLimits(plan) {
  const normalizedPlan = plan?.toUpperCase() || 'FREE';
  return PLAN_FEATURES[normalizedPlan] || PLAN_FEATURES.FREE;
}

/**
 * Get required plan for a feature
 * @param {string} feature - Feature name
 * @returns {string} Required plan name
 */
export function getRequiredPlanForFeature(feature) {
  // Check which plan first has access to this feature
  const plans = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

  for (const plan of plans) {
    if (PLAN_FEATURES[plan]?.[feature]) {
      return plan;
    }
  }

  return 'ENTERPRISE';
}

/**
 * Check if free trial has expired
 * @param {Date|string} createdAt - User's account creation date
 * @returns {boolean}
 */
export function isTrialExpired(createdAt) {
  if (!createdAt) return false;

  const created = new Date(createdAt);
  const now = new Date();
  const daysSinceCreation = (now - created) / (1000 * 60 * 60 * 24);

  return daysSinceCreation > PLAN_FEATURES.FREE.trialDays;
}

/**
 * Get remaining trial days
 * @param {Date|string} createdAt - User's account creation date
 * @returns {number} Remaining days (can be negative if expired)
 */
export function getTrialDaysRemaining(createdAt) {
  if (!createdAt) return PLAN_FEATURES.FREE.trialDays;

  const created = new Date(createdAt);
  const now = new Date();
  const daysSinceCreation = (now - created) / (1000 * 60 * 60 * 24);

  return Math.ceil(PLAN_FEATURES.FREE.trialDays - daysSinceCreation);
}

/**
 * Get display name for a plan
 * @param {string} plan - Plan code
 * @param {string} locale - 'tr' or 'en'
 * @returns {string}
 */
export function getPlanDisplayName(plan, locale = 'tr') {
  const names = {
    FREE: { tr: 'Ücretsiz Deneme', en: 'Free Trial' },
    STARTER: { tr: 'Başlangıç', en: 'Starter' },
    PRO: { tr: 'Pro', en: 'Pro' },
    PROFESSIONAL: { tr: 'Pro', en: 'Pro' },
    ENTERPRISE: { tr: 'Kurumsal', en: 'Enterprise' }
  };

  const normalizedPlan = plan?.toUpperCase() || 'FREE';
  return names[normalizedPlan]?.[locale] || plan;
}

export default {
  PLAN_FEATURES,
  canAccessFeature,
  getPlanLimits,
  getRequiredPlanForFeature,
  isTrialExpired,
  getTrialDaysRemaining,
  getPlanDisplayName
};

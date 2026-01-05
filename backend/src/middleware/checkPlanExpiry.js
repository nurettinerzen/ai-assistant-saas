/**
 * Plan Expiry Middleware
 * Checks if user's free trial has expired (7 days)
 */

const FREE_TRIAL_DAYS = 7;

/**
 * Check if a FREE plan has expired
 * @param {Object} subscription - Subscription object with plan and business.createdAt
 * @returns {boolean}
 */
export function isFreePlanExpired(subscription) {
  if (!subscription || subscription.plan !== 'FREE') {
    return false;
  }

  // Get business creation date from subscription relation
  const createdAt = subscription.business?.createdAt || subscription.createdAt;
  if (!createdAt) {
    return false;
  }

  const created = new Date(createdAt);
  const now = new Date();
  const daysSinceCreation = (now - created) / (1000 * 60 * 60 * 24);

  return daysSinceCreation > FREE_TRIAL_DAYS;
}

/**
 * Get remaining trial days for FREE plan
 * @param {Object} subscription - Subscription object
 * @returns {number} Remaining days (can be negative if expired)
 */
export function getTrialDaysRemaining(subscription) {
  if (!subscription || subscription.plan !== 'FREE') {
    return null;
  }

  const createdAt = subscription.business?.createdAt || subscription.createdAt;
  if (!createdAt) {
    return FREE_TRIAL_DAYS;
  }

  const created = new Date(createdAt);
  const now = new Date();
  const daysSinceCreation = (now - created) / (1000 * 60 * 60 * 24);

  return Math.ceil(FREE_TRIAL_DAYS - daysSinceCreation);
}

/**
 * Middleware to check plan expiry and add flag to request
 */
export async function checkPlanExpiry(req, res, next) {
  try {
    // Skip if no user
    if (!req.user) {
      return next();
    }

    // Add plan expired flag to user object
    if (req.user.subscription) {
      req.user.planExpired = isFreePlanExpired(req.user.subscription);
      req.user.trialDaysRemaining = getTrialDaysRemaining(req.user.subscription);
    }

    next();
  } catch (error) {
    console.error('Plan expiry check error:', error);
    next();
  }
}

export default {
  checkPlanExpiry,
  isFreePlanExpired,
  getTrialDaysRemaining,
  FREE_TRIAL_DAYS
};

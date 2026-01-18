/**
 * Plan Features Configuration
 * Re-exports from centralized planConfig for backward compatibility
 *
 * @deprecated Use @/lib/planConfig directly for new code
 */

// Re-export everything from planConfig
export {
  PLAN_FEATURES,
  PLAN_NAMES,
  PLAN_HIERARCHY,
  LEGACY_PLAN_MAP,
  PLAN_COLORS,
  REGIONAL_PRICING,
  getPlanDisplayName,
  normalizePlan,
  canAccessFeature,
  getPlanLimits,
  getRequiredPlanForFeature,
  isTrialExpired,
  getTrialDaysRemaining,
  comparePlans,
  hasPlanAccess,
  getRegionalConfig,
  formatPrice,
} from './planConfig';

// Default export for backward compatibility
export { default } from './planConfig';

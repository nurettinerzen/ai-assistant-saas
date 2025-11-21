// ============================================================================
// SUBSCRIPTION LIMITS MIDDLEWARE
// ============================================================================
// FILE: backend/src/middleware/subscriptionLimits.js
//
// This middleware checks if users are within their subscription limits
// before allowing certain actions (creating assistants, making calls, etc.)
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Plan limits configuration
const PLAN_LIMITS = {
  FREE: {
    minutes: 0,              // Web test only (60 sec limit handled in frontend)
    calls: 0,                // No actual calls
    assistants: 0,           // No permanent assistants
    phoneNumbers: 0,         // No phone numbers
    trainings: 3,            // 3 AI trainings
    voices: 4,               // 4 voices (filtered by language)
    integrations: false,     // No integrations
    analytics: false,        // No analytics
    aiAnalysis: false        // No AI insights
  },
  STARTER: {
    minutes: 300,            // 300 minutes/month
    calls: 50,               // 50 calls/month
    assistants: 1,           // 1 assistant
    phoneNumbers: 1,         // 1 phone number
    trainings: -1,           // Unlimited trainings
    voices: 4,               // 4 voices (EN or TR)
    integrations: true,      // All integrations
    analytics: true,         // Basic analytics
    aiAnalysis: false        // No AI insights
  },
  PROFESSIONAL: {
    minutes: 1500,           // 1500 minutes/month
    calls: -1,               // Unlimited calls
    assistants: 2,           // 2 assistants
    phoneNumbers: 3,         // 3 phone numbers
    trainings: -1,           // Unlimited trainings
    voices: 8,               // 8 voices (EN + TR)
    integrations: true,      // All integrations
    analytics: true,         // Advanced analytics
    aiAnalysis: true         // AI insights enabled
  },
  ENTERPRISE: {
    minutes: -1,             // Unlimited minutes
    calls: -1,               // Unlimited calls
    assistants: 5,           // 5 assistants
    phoneNumbers: 10,        // 10 phone numbers
    trainings: -1,           // Unlimited trainings
    voices: -1,              // All voices + custom cloning
    integrations: true,      // All integrations
    analytics: true,         // Advanced analytics
    aiAnalysis: true         // AI insights enabled
  }
};

/**
 * Check if action is allowed based on subscription limits
 * @param {String} action - Type of action (minutes, calls, assistants, phoneNumbers, integrations)
 */
export const checkLimit = (action) => {
  return async (req, res, next) => {
    try {
      const { businessId } = req.user;

      if (!businessId) {
        return res.status(401).json({ 
          error: 'Business ID required',
          upgradeRequired: false 
        });
      }

      // Get subscription
      const subscription = await prisma.subscription.findUnique({
        where: { businessId },
        include: {
          business: {
            select: {
              name: true,
              phoneNumbers: true
            }
          }
        }
      });

      // Default to FREE if no subscription
      const plan = subscription?.plan || 'FREE';
      const limits = PLAN_LIMITS[plan];

      // Check specific action
      switch (action) {
        case 'minutes':
          if (limits.minutes === 0) {
            return res.status(403).json({
              error: 'No call minutes available on FREE plan',
              message: 'Upgrade to STARTER plan to get 300 minutes per month',
              upgradeRequired: true,
              currentPlan: plan,
              suggestedPlan: 'STARTER'
            });
          }
          
          if (limits.minutes > 0 && subscription.minutesUsed >= limits.minutes) {
            return res.status(403).json({
              error: 'Monthly minute limit reached',
              message: `You've used ${subscription.minutesUsed}/${limits.minutes} minutes this month. Upgrade to PROFESSIONAL for 1500 minutes.`,
              upgradeRequired: true,
              currentPlan: plan,
              suggestedPlan: 'PROFESSIONAL',
              usage: {
                used: subscription.minutesUsed,
                limit: limits.minutes,
                percentage: Math.round((subscription.minutesUsed / limits.minutes) * 100)
              }
            });
          }
          break;

        case 'calls':
          if (limits.calls === 0) {
            return res.status(403).json({
              error: 'No phone calls available on FREE plan',
              message: 'Upgrade to STARTER plan to receive calls on your phone number',
              upgradeRequired: true,
              currentPlan: plan,
              suggestedPlan: 'STARTER'
            });
          }
          
          if (limits.calls > 0 && subscription.callsThisMonth >= limits.calls) {
            return res.status(403).json({
              error: 'Monthly call limit reached',
              message: `You've received ${subscription.callsThisMonth}/${limits.calls} calls this month. Upgrade to PROFESSIONAL for unlimited calls.`,
              upgradeRequired: true,
              currentPlan: plan,
              suggestedPlan: 'PROFESSIONAL',
              usage: {
                used: subscription.callsThisMonth,
                limit: limits.calls,
                percentage: Math.round((subscription.callsThisMonth / limits.calls) * 100)
              }
            });
          }
          break;

        case 'assistants':
          const currentAssistants = subscription?.assistantsCreated || 0;
          
          if (limits.assistants === 0) {
            return res.status(403).json({
              error: 'Cannot create permanent assistants on FREE plan',
              message: 'Upgrade to STARTER plan to create your first AI assistant',
              upgradeRequired: true,
              currentPlan: plan,
              suggestedPlan: 'STARTER'
            });
          }
          
          if (limits.assistants > 0 && currentAssistants >= limits.assistants) {
            return res.status(403).json({
              error: 'Assistant limit reached',
              message: `You've created ${currentAssistants}/${limits.assistants} assistants. Upgrade to PROFESSIONAL for 2 assistants.`,
              upgradeRequired: true,
              currentPlan: plan,
              suggestedPlan: 'PROFESSIONAL',
              usage: {
                used: currentAssistants,
                limit: limits.assistants
              }
            });
          }
          break;

        case 'phoneNumbers':
          const currentPhoneNumbers = subscription?.business?.phoneNumbers?.length || 0;
          
          if (limits.phoneNumbers === 0) {
            return res.status(403).json({
              error: 'Phone numbers not available on FREE plan',
              message: 'Upgrade to STARTER plan to get your phone number',
              upgradeRequired: true,
              currentPlan: plan,
              suggestedPlan: 'STARTER'
            });
          }
          
          if (limits.phoneNumbers > 0 && currentPhoneNumbers >= limits.phoneNumbers) {
            return res.status(403).json({
              error: 'Phone number limit reached',
              message: `You've provisioned ${currentPhoneNumbers}/${limits.phoneNumbers} phone numbers. Upgrade to PROFESSIONAL for 3 numbers.`,
              upgradeRequired: true,
              currentPlan: plan,
              suggestedPlan: 'PROFESSIONAL',
              usage: {
                used: currentPhoneNumbers,
                limit: limits.phoneNumbers
              }
            });
          }
          break;

        case 'integrations':
          if (!limits.integrations) {
            return res.status(403).json({
              error: 'Integrations not available on FREE plan',
              message: 'Upgrade to STARTER plan to access all integrations',
              upgradeRequired: true,
              currentPlan: plan,
              suggestedPlan: 'STARTER'
            });
          }
          break;

        case 'analytics':
          if (!limits.analytics) {
            return res.status(403).json({
              error: 'Analytics not available on FREE plan',
              message: 'Upgrade to STARTER plan for call analytics and insights',
              upgradeRequired: true,
              currentPlan: plan,
              suggestedPlan: 'STARTER'
            });
          }
          break;

        case 'aiAnalysis':
          if (!limits.aiAnalysis) {
            return res.status(403).json({
              error: 'AI Analysis is a PRO feature',
              message: 'Upgrade to PROFESSIONAL plan for AI-powered call insights, sentiment analysis, and transcripts',
              upgradeRequired: true,
              currentPlan: plan,
              suggestedPlan: 'PROFESSIONAL'
            });
          }
          break;

        default:
          console.warn(`Unknown limit check: ${action}`);
      }

      // Action is allowed, attach plan info to request
      req.subscription = {
        plan,
        limits,
        usage: {
          minutes: subscription?.minutesUsed || 0,
          calls: subscription?.callsThisMonth || 0,
          assistants: subscription?.assistantsCreated || 0,
          phoneNumbers: subscription?.business?.phoneNumbers?.length || 0
        }
      };

      next();
    } catch (error) {
      console.error('Subscription limit check error:', error);
      res.status(500).json({ 
        error: 'Failed to verify subscription limits',
        message: 'Please try again or contact support'
      });
    }
  };
};

/**
 * Check multiple limits at once
 * @param {Array<String>} actions - Array of actions to check
 */
export const checkMultipleLimits = (actions) => {
  return async (req, res, next) => {
    try {
      const { businessId } = req.user;

      if (!businessId) {
        return res.status(401).json({ error: 'Business ID required' });
      }

      const subscription = await prisma.subscription.findUnique({
        where: { businessId },
        include: {
          business: {
            select: {
              name: true,
              phoneNumbers: true
            }
          }
        }
      });

      const plan = subscription?.plan || 'FREE';
      const limits = PLAN_LIMITS[plan];

      // Check all actions
      for (const action of actions) {
        // Reuse logic from checkLimit - simplified version
        if (action === 'minutes' && limits.minutes > 0 && subscription.minutesUsed >= limits.minutes) {
          return res.status(403).json({
            error: 'Monthly minute limit reached',
            upgradeRequired: true,
            currentPlan: plan
          });
        }
        
        if (action === 'calls' && limits.calls > 0 && subscription.callsThisMonth >= limits.calls) {
          return res.status(403).json({
            error: 'Monthly call limit reached',
            upgradeRequired: true,
            currentPlan: plan
          });
        }
      }

      req.subscription = {
        plan,
        limits,
        usage: {
          minutes: subscription?.minutesUsed || 0,
          calls: subscription?.callsThisMonth || 0,
          assistants: subscription?.assistantsCreated || 0,
          phoneNumbers: subscription?.business?.phoneNumbers?.length || 0
        }
      };

      next();
    } catch (error) {
      console.error('Multiple limits check error:', error);
      res.status(500).json({ error: 'Failed to verify subscription limits' });
    }
  };
};

/**
 * Get plan limits for a specific plan
 * @param {String} plan - Plan name (FREE, STARTER, PROFESSIONAL, ENTERPRISE)
 */
export const getPlanLimits = (plan) => {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;
};

/**
 * Middleware to attach subscription info without enforcement
 * Useful for displaying usage stats
 */
export const attachSubscriptionInfo = async (req, res, next) => {
  try {
    const { businessId } = req.user;

    if (!businessId) {
      return next();
    }

    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      include: {
        business: {
          select: {
            phoneNumbers: true
          }
        }
      }
    });

    const plan = subscription?.plan || 'FREE';
    const limits = PLAN_LIMITS[plan];

    req.subscription = {
      plan,
      limits,
      usage: {
        minutes: subscription?.minutesUsed || 0,
        calls: subscription?.callsThisMonth || 0,
        assistants: subscription?.assistantsCreated || 0,
        phoneNumbers: subscription?.business?.phoneNumbers?.length || 0
      },
      status: subscription?.status || 'TRIAL'
    };

    next();
  } catch (error) {
    console.error('Attach subscription info error:', error);
    // Don't fail the request, just continue without subscription info
    next();
  }
};

export default {
  checkLimit,
  checkMultipleLimits,
  getPlanLimits,
  attachSubscriptionInfo,
  PLAN_LIMITS
};

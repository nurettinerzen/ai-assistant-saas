// ============================================================================
// USAGE TRACKING SERVICE
// ============================================================================
// FILE: backend/src/services/usageTracking.js
//
// Handles tracking and updating subscription usage (minutes, calls, etc.)
// ============================================================================

import { PrismaClient } from '@prisma/client';
import emailService from './emailService.js';

const prisma = new PrismaClient();

/**
 * Track call usage - increment minutes and calls
 * @param {Number} businessId 
 * @param {Number} durationInSeconds - Call duration in seconds
 * @param {Object} callData - Additional call data (callId, callerId, transcript, etc.)
 */
export const trackCallUsage = async (businessId, durationInSeconds, callData = {}) => {
  try {
    console.log(`📊 Tracking call usage for business ${businessId}: ${durationInSeconds}s`);

    // Convert seconds to minutes (rounded up)
    const minutesUsed = Math.ceil(durationInSeconds / 60);

    // Get current subscription
    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      include: {
        business: {
          select: {
            name: true,
            users: {
              select: {
                email: true,
                role: true
              },
              where: {
                role: 'OWNER'
              },
              take: 1
            }
          }
        }
      }
    });

    if (!subscription) {
      console.warn(`⚠️ No subscription found for business ${businessId}`);
      return null;
    }

    const plan = subscription.plan;
    const limits = {
      FREE: { minutes: 0, calls: 0 },
      STARTER: { minutes: 300, calls: 50 },
      PROFESSIONAL: { minutes: 1500, calls: -1 },
      ENTERPRISE: { minutes: -1, calls: -1 }
    };

    const planLimits = limits[plan];

    // Update subscription usage
    const updated = await prisma.subscription.update({
      where: { businessId },
      data: {
        minutesUsed: {
          increment: minutesUsed
        },
        callsThisMonth: {
          increment: 1
        }
      }
    });

    console.log(`✅ Updated usage: ${updated.minutesUsed} minutes, ${updated.callsThisMonth} calls`);

    // Check if approaching limits (90% threshold)
    const minutesPercentage = planLimits.minutes > 0 
      ? (updated.minutesUsed / planLimits.minutes) * 100 
      : 0;
    
    const callsPercentage = planLimits.calls > 0 
      ? (updated.callsThisMonth / planLimits.calls) * 100 
      : 0;

    // Send warning emails at 90% usage
    if (minutesPercentage >= 90 && minutesPercentage < 100) {
      await sendLimitWarning(businessId, 'minutes', {
        used: updated.minutesUsed,
        limit: planLimits.minutes,
        percentage: Math.round(minutesPercentage)
      });
    }

    if (callsPercentage >= 90 && callsPercentage < 100) {
      await sendLimitWarning(businessId, 'calls', {
        used: updated.callsThisMonth,
        limit: planLimits.calls,
        percentage: Math.round(callsPercentage)
      });
    }

    // If limits exceeded, send immediate notification
    if (planLimits.minutes > 0 && updated.minutesUsed >= planLimits.minutes) {
      await sendLimitReached(businessId, 'minutes', {
        used: updated.minutesUsed,
        limit: planLimits.minutes
      });
    }

    if (planLimits.calls > 0 && updated.callsThisMonth >= planLimits.calls) {
      await sendLimitReached(businessId, 'calls', {
        used: updated.callsThisMonth,
        limit: planLimits.calls
      });
    }

    return updated;
  } catch (error) {
    console.error('❌ Error tracking call usage:', error);
    throw error;
  }
};

/**
 * Check if a specific limit has been reached
 * @param {Number} businessId 
 * @param {String} limitType - 'minutes', 'calls', 'assistants', 'phoneNumbers'
 */
export const checkLimit = async (businessId, limitType) => {
  try {
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

    if (!subscription) {
      return { reached: false, plan: 'FREE' };
    }

    const plan = subscription.plan;
    const limits = {
      FREE: { minutes: 0, calls: 0, assistants: 0, phoneNumbers: 0 },
      STARTER: { minutes: 300, calls: 50, assistants: 1, phoneNumbers: 1 },
      PROFESSIONAL: { minutes: 1500, calls: -1, assistants: 2, phoneNumbers: 3 },
      ENTERPRISE: { minutes: -1, calls: -1, assistants: 5, phoneNumbers: 10 }
    };

    const planLimits = limits[plan];
    let usage, limit;

    switch (limitType) {
      case 'minutes':
        usage = subscription.minutesUsed;
        limit = planLimits.minutes;
        break;
      case 'calls':
        usage = subscription.callsThisMonth;
        limit = planLimits.calls;
        break;
      case 'assistants':
        usage = subscription.assistantsCreated;
        limit = planLimits.assistants;
        break;
      case 'phoneNumbers':
        usage = subscription.business.phoneNumbers?.length || 0;
        limit = planLimits.phoneNumbers;
        break;
      default:
        return { reached: false };
    }

    // -1 means unlimited
    if (limit === -1) {
      return { reached: false, usage, limit: 'unlimited' };
    }

    // 0 means feature not available
    if (limit === 0) {
      return { reached: true, usage, limit, reason: 'not_available' };
    }

    return {
      reached: usage >= limit,
      usage,
      limit,
      percentage: Math.round((usage / limit) * 100)
    };
  } catch (error) {
    console.error('❌ Error checking limit:', error);
    throw error;
  }
};

/**
 * Reset monthly usage counters
 * This should be called via cron job on the 1st of each month
 */
export const resetMonthlyUsage = async () => {
  try {
    console.log('🔄 Resetting monthly usage for all subscriptions...');

    const result = await prisma.subscription.updateMany({
      where: {
        status: 'ACTIVE'
      },
      data: {
        minutesUsed: 0,
        callsThisMonth: 0
      }
    });

    console.log(`✅ Reset usage for ${result.count} subscriptions`);

    // Send "New month, fresh limits!" email to all active subscribers
    const subscriptions = await prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: {
        business: {
          select: {
            name: true,
            users: {
              select: { email: true, role: true },
              where: { role: 'OWNER' },
              take: 1
            }
          }
        }
      }
    });

    for (const sub of subscriptions) {
      if (sub.business.users[0]?.email) {
        try {
          await emailService.sendMonthlyResetEmail(
            sub.business.users[0].email,
            sub.business.name,
            sub.plan
          );
        } catch (emailError) {
          console.error(`Failed to send reset email to ${sub.business.users[0].email}:`, emailError);
        }
      }
    }

    return result;
  } catch (error) {
    console.error('❌ Error resetting monthly usage:', error);
    throw error;
  }
};

/**
 * Send warning email when approaching limit (90%)
 * @param {Number} businessId 
 * @param {String} limitType 
 * @param {Object} usage 
 */
export const sendLimitWarning = async (businessId, limitType, usage) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      include: {
        business: {
          select: {
            name: true,
            users: {
              select: { email: true },
              where: { role: 'OWNER' },
              take: 1
            }
          }
        }
      }
    });

    if (!subscription?.business.users[0]?.email) {
      return;
    }

    const email = subscription.business.users[0].email;
    const businessName = subscription.business.name;

    await emailService.sendLimitWarningEmail(
      email,
      businessName,
      limitType,
      usage
    );

    console.log(`⚠️ Sent ${limitType} warning email to ${email}`);
  } catch (error) {
    console.error('❌ Error sending limit warning:', error);
    // Don't throw - email failure shouldn't break usage tracking
  }
};

/**
 * Send notification when limit is reached
 * @param {Number} businessId 
 * @param {String} limitType 
 * @param {Object} usage 
 */
export const sendLimitReached = async (businessId, limitType, usage) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      include: {
        business: {
          select: {
            name: true,
            users: {
              select: { email: true },
              where: { role: 'OWNER' },
              take: 1
            }
          }
        }
      }
    });

    if (!subscription?.business.users[0]?.email) {
      return;
    }

    const email = subscription.business.users[0].email;
    const businessName = subscription.business.name;

    await emailService.sendLimitReachedEmail(
      email,
      businessName,
      limitType,
      usage,
      subscription.plan
    );

    console.log(`🚫 Sent ${limitType} limit reached email to ${email}`);
  } catch (error) {
    console.error('❌ Error sending limit reached notification:', error);
  }
};

/**
 * Get usage statistics for a business
 * @param {Number} businessId 
 */
export const getUsageStats = async (businessId) => {
  try {
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

    if (!subscription) {
      return null;
    }

    const plan = subscription.plan;
    const limits = {
      FREE: { minutes: 0, calls: 0, assistants: 0, phoneNumbers: 0 },
      STARTER: { minutes: 300, calls: 50, assistants: 1, phoneNumbers: 1 },
      PROFESSIONAL: { minutes: 1500, calls: -1, assistants: 2, phoneNumbers: 3 },
      ENTERPRISE: { minutes: -1, calls: -1, assistants: 5, phoneNumbers: 10 }
    };

    const planLimits = limits[plan];

    return {
      plan,
      status: subscription.status,
      usage: {
        minutes: {
          used: subscription.minutesUsed,
          limit: planLimits.minutes,
          percentage: planLimits.minutes > 0 
            ? Math.round((subscription.minutesUsed / planLimits.minutes) * 100)
            : 0,
          unlimited: planLimits.minutes === -1
        },
        calls: {
          used: subscription.callsThisMonth,
          limit: planLimits.calls,
          percentage: planLimits.calls > 0 
            ? Math.round((subscription.callsThisMonth / planLimits.calls) * 100)
            : 0,
          unlimited: planLimits.calls === -1
        },
        assistants: {
          used: subscription.assistantsCreated,
          limit: planLimits.assistants,
          available: planLimits.assistants > 0
        },
        phoneNumbers: {
          used: subscription.business.phoneNumbers?.length || 0,
          limit: planLimits.phoneNumbers,
          available: planLimits.phoneNumbers > 0
        }
      },
      period: {
        start: subscription.currentPeriodStart,
        end: subscription.currentPeriodEnd
      }
    };
  } catch (error) {
    console.error('❌ Error getting usage stats:', error);
    throw error;
  }
};

export default {
  trackCallUsage,
  checkLimit,
  resetMonthlyUsage,
  sendLimitWarning,
  sendLimitReached,
  getUsageStats
};

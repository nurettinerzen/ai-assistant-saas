// ============================================================================
// CONCURRENT CALL MANAGER SERVICE
// ============================================================================
// FILE: backend/src/services/concurrentCallManager.js
//
// Manages concurrent call limits for subscriptions
// Handles acquiring and releasing call slots
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { PLANS, getConcurrentLimit } from '../config/plans.js';

const prisma = new PrismaClient();

/**
 * Concurrent Call Manager
 * Manages concurrent call slots for businesses
 */
class ConcurrentCallManager {

  /**
   * Acquire a call slot before starting a call
   * Uses atomic updateMany for race condition safety
   * @param {number} businessId - Business ID
   * @returns {Promise<{success: boolean, currentActive?: number, limit?: number, error?: string}>}
   */
  async acquireSlot(businessId) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { businessId },
        select: {
          id: true,
          plan: true,
          concurrentLimit: true,
          activeCalls: true,
          status: true
        }
      });

      if (!subscription) {
        return {
          success: false,
          error: 'SUBSCRIPTION_NOT_FOUND',
          message: 'No subscription found for this business'
        };
      }

      // Check if subscription is active
      if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL') {
        return {
          success: false,
          error: 'SUBSCRIPTION_INACTIVE',
          message: 'Subscription is not active',
          status: subscription.status
        };
      }

      // Get limit from subscription or plan default
      const limit = subscription.concurrentLimit || getConcurrentLimit(subscription.plan);

      if (limit === 0) {
        return {
          success: false,
          error: 'CONCURRENT_CALLS_DISABLED',
          message: 'Concurrent calls are not available for your plan'
        };
      }

      // Atomic increment with check - prevents race conditions
      const result = await prisma.subscription.updateMany({
        where: {
          businessId,
          activeCalls: { lt: limit }
        },
        data: {
          activeCalls: { increment: 1 }
        }
      });

      if (result.count === 0) {
        // Limit exceeded
        console.log(`⚠️ Concurrent limit exceeded for business ${businessId}: ${subscription.activeCalls}/${limit}`);
        return {
          success: false,
          error: 'CONCURRENT_LIMIT_EXCEEDED',
          message: 'Maximum concurrent calls reached. Please try again later.',
          currentActive: subscription.activeCalls,
          limit: limit
        };
      }

      console.log(`✅ Call slot acquired for business ${businessId}: ${subscription.activeCalls + 1}/${limit}`);

      return {
        success: true,
        currentActive: subscription.activeCalls + 1,
        limit: limit,
        available: limit - subscription.activeCalls - 1
      };

    } catch (error) {
      console.error('❌ Error acquiring call slot:', error);
      throw error;
    }
  }

  /**
   * Release a call slot when call ends
   * @param {number} businessId - Business ID
   * @returns {Promise<{success: boolean, currentActive?: number}>}
   */
  async releaseSlot(businessId) {
    try {
      // Decrement active calls
      await prisma.subscription.update({
        where: { businessId },
        data: {
          activeCalls: { decrement: 1 }
        }
      });

      // Safety check: ensure activeCalls doesn't go negative
      await prisma.subscription.updateMany({
        where: {
          businessId,
          activeCalls: { lt: 0 }
        },
        data: {
          activeCalls: 0
        }
      });

      const updated = await prisma.subscription.findUnique({
        where: { businessId },
        select: { activeCalls: true, concurrentLimit: true }
      });

      console.log(`✅ Call slot released for business ${businessId}: ${updated?.activeCalls || 0}`);

      return {
        success: true,
        currentActive: updated?.activeCalls || 0
      };

    } catch (error) {
      console.error('❌ Error releasing call slot:', error);
      // Don't throw - release should be fault-tolerant
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current concurrent call status
   * @param {number} businessId - Business ID
   * @returns {Promise<{activeCalls: number, limit: number, available: number, utilizationPercent: number}>}
   */
  async getStatus(businessId) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { businessId },
        select: {
          plan: true,
          concurrentLimit: true,
          activeCalls: true
        }
      });

      if (!subscription) {
        return {
          activeCalls: 0,
          limit: 0,
          available: 0,
          utilizationPercent: 0
        };
      }

      const limit = subscription.concurrentLimit || getConcurrentLimit(subscription.plan);
      const activeCalls = subscription.activeCalls || 0;

      return {
        activeCalls,
        limit,
        available: Math.max(0, limit - activeCalls),
        utilizationPercent: limit > 0 ? Math.round((activeCalls / limit) * 100) : 0
      };

    } catch (error) {
      console.error('❌ Error getting concurrent status:', error);
      throw error;
    }
  }

  /**
   * Check if a new call can be started
   * @param {number} businessId - Business ID
   * @returns {Promise<{canStart: boolean, reason?: string}>}
   */
  async canStartCall(businessId) {
    try {
      const status = await this.getStatus(businessId);

      if (status.limit === 0) {
        return {
          canStart: false,
          reason: 'Concurrent calls are not available for your plan'
        };
      }

      if (status.available <= 0) {
        return {
          canStart: false,
          reason: `Maximum concurrent calls (${status.limit}) reached`,
          currentActive: status.activeCalls,
          limit: status.limit
        };
      }

      return {
        canStart: true,
        currentActive: status.activeCalls,
        limit: status.limit,
        available: status.available
      };

    } catch (error) {
      console.error('❌ Error checking call availability:', error);
      return { canStart: false, reason: 'Error checking availability' };
    }
  }

  /**
   * Force reset active calls count
   * Use for cleanup/maintenance only
   * @param {number} businessId - Business ID
   */
  async forceReset(businessId) {
    try {
      await prisma.subscription.update({
        where: { businessId },
        data: { activeCalls: 0 }
      });

      console.log(`🔄 Force reset active calls for business ${businessId}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Error force resetting calls:', error);
      throw error;
    }
  }

  /**
   * Reset all stuck calls (maintenance job)
   * Should run periodically to clean up any orphaned call slots
   */
  async cleanupStuckCalls() {
    try {
      // Find subscriptions with activeCalls > 0 that might be stuck
      // This should be called periodically (e.g., every hour)
      const stuckSubscriptions = await prisma.subscription.findMany({
        where: {
          activeCalls: { gt: 0 }
        },
        select: {
          businessId: true,
          activeCalls: true
        }
      });

      // For now, just log - in production, you'd verify against actual call data
      if (stuckSubscriptions.length > 0) {
        console.log(`⚠️ Found ${stuckSubscriptions.length} subscriptions with active calls`);
        // Could check against 11Labs or VAPI for actual active calls
      }

      return { checked: stuckSubscriptions.length };

    } catch (error) {
      console.error('❌ Error cleaning up stuck calls:', error);
      return { error: error.message };
    }
  }
}

// Export singleton instance
const concurrentCallManager = new ConcurrentCallManager();
export default concurrentCallManager;

// Named exports for direct function access
export const {
  acquireSlot,
  releaseSlot,
  getStatus,
  canStartCall,
  forceReset,
  cleanupStuckCalls
} = {
  acquireSlot: (businessId) => concurrentCallManager.acquireSlot(businessId),
  releaseSlot: (businessId) => concurrentCallManager.releaseSlot(businessId),
  getStatus: (businessId) => concurrentCallManager.getStatus(businessId),
  canStartCall: (businessId) => concurrentCallManager.canStartCall(businessId),
  forceReset: (businessId) => concurrentCallManager.forceReset(businessId),
  cleanupStuckCalls: () => concurrentCallManager.cleanupStuckCalls()
};

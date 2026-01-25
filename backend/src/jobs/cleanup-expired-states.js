/**
 * Cleanup Expired Conversation States
 *
 * Daily cron job to delete expired conversation states from database.
 * Lazy cleanup happens on getState() calls, but this ensures DB doesn't grow unbounded.
 *
 * Schedule: Daily at 3:00 AM (low traffic time)
 */

import cron from 'node-cron';
import { cleanupExpiredStates } from '../services/state-manager.js';

/**
 * Initialize cleanup cron job
 */
export function initializeStateCleanup() {
  // Run every day at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('[Cron] Starting expired conversation state cleanup...');

    try {
      const deletedCount = await cleanupExpiredStates();
      console.log(`[Cron] ✅ Cleanup complete - Deleted ${deletedCount} expired states`);
    } catch (error) {
      console.error('[Cron] ❌ Cleanup failed:', error);
    }
  });

  console.log('⏰ [Cron] State cleanup job scheduled (daily at 3:00 AM)');
}

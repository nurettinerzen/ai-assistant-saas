/**
 * Email Pair Privacy Maintenance Cron
 *
 * Runs daily at 2 AM UTC
 * Purges raw email text older than 90 days
 */

import cron from 'node-cron';
import { purgeOldRawText } from '../services/email-pair-privacy.js';

/**
 * Schedule daily privacy maintenance
 */
export function schedulePairPrivacyMaintenance() {
  // Run daily at 2 AM UTC
  cron.schedule('0 2 * * *', async () => {
    console.log('[Cron] Running pair privacy maintenance...');

    try {
      const result = await purgeOldRawText();

      if (result.success) {
        console.log(`[Cron] Privacy maintenance completed: ${result.purged} pairs purged`);
      } else {
        console.error(`[Cron] Privacy maintenance failed: ${result.error}`);
      }
    } catch (error) {
      console.error('[Cron] Privacy maintenance error:', error);
    }
  });

  console.log('[Cron] Pair privacy maintenance scheduled (daily at 2 AM UTC)');
}

export default { schedulePairPrivacyMaintenance };

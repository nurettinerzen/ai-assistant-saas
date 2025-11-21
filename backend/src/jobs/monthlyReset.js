// ============================================================================
// MONTHLY USAGE RESET CRON JOB
// ============================================================================
// FILE: backend/src/jobs/monthlyReset.js
//
// Runs on the 1st of each month to reset usage counters
// Use with node-cron or your preferred scheduler
// ============================================================================

import cron from 'node-cron';
import usageTracking from '../services/usageTracking.js';

/**
 * Initialize the monthly reset cron job
 * Runs at 00:00 on the 1st day of every month
 */
export const initMonthlyResetJob = () => {
  console.log('⏰ Initializing monthly usage reset cron job...');

  // Cron expression: '0 0 1 * *' = At 00:00 on day 1 of every month
  const job = cron.schedule('0 0 1 * *', async () => {
    console.log('\n========================================');
    console.log('📅 MONTHLY RESET JOB STARTED');
    console.log('Time:', new Date().toISOString());
    console.log('========================================\n');

    try {
      const result = await usageTracking.resetMonthlyUsage();
      
      console.log('\n========================================');
      console.log('✅ MONTHLY RESET JOB COMPLETED');
      console.log(`Reset usage for ${result.count} subscriptions`);
      console.log('========================================\n');
    } catch (error) {
      console.error('\n========================================');
      console.error('❌ MONTHLY RESET JOB FAILED');
      console.error('Error:', error);
      console.error('========================================\n');
      
      // TODO: Send alert email to admin
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('✅ Monthly reset job initialized (runs at 00:00 UTC on 1st of each month)');
  
  return job;
};

/**
 * Manual trigger for testing
 */
export const runManualReset = async () => {
  console.log('🔄 Running manual monthly reset...');
  
  try {
    const result = await usageTracking.resetMonthlyUsage();
    console.log(`✅ Manual reset completed: ${result.count} subscriptions reset`);
    return result;
  } catch (error) {
    console.error('❌ Manual reset failed:', error);
    throw error;
  }
};

export default {
  initMonthlyResetJob,
  runManualReset
};

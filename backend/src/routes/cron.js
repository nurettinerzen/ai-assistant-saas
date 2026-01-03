/**
 * Cron Jobs API Routes
 *
 * These endpoints are called by external schedulers (e.g., cron-job.org, Vercel cron)
 * Protected by CRON_SECRET environment variable
 */

import express from 'express';
import cronJobs from '../services/cronJobs.js';

const router = express.Router();

// Verify cron secret middleware
function verifyCronSecret(req, res, next) {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.warn('⚠️ CRON_SECRET not configured, allowing request');
    return next();
  }

  if (secret !== expectedSecret) {
    console.warn('❌ Invalid cron secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

/**
 * POST /api/cron/reset-minutes
 * Reset included minutes for STARTER/PRO plans
 * Should run: First day of each month or on subscription renewal
 */
router.post('/reset-minutes', verifyCronSecret, async (req, res) => {
  try {
    console.log('🔄 Cron: Reset included minutes triggered');
    const result = await cronJobs.resetIncludedMinutes();
    res.json(result);
  } catch (error) {
    console.error('❌ Reset minutes cron error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cron/low-balance
 * Check for low balance and send warnings
 * Should run: Every hour
 */
router.post('/low-balance', verifyCronSecret, async (req, res) => {
  try {
    console.log('💰 Cron: Low balance check triggered');
    const result = await cronJobs.checkLowBalance();
    res.json(result);
  } catch (error) {
    console.error('❌ Low balance cron error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cron/auto-reload
 * Process auto-reload for eligible subscriptions
 * Should run: Every 15 minutes
 */
router.post('/auto-reload', verifyCronSecret, async (req, res) => {
  try {
    console.log('🔄 Cron: Auto-reload triggered');
    const result = await cronJobs.processAutoReload();
    res.json(result);
  } catch (error) {
    console.error('❌ Auto-reload cron error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cron/trial-expired
 * Check for expired trials and notify users
 * Should run: Daily
 */
router.post('/trial-expired', verifyCronSecret, async (req, res) => {
  try {
    console.log('⏰ Cron: Trial expired check triggered');
    const result = await cronJobs.checkTrialExpired();
    res.json(result);
  } catch (error) {
    console.error('❌ Trial expired cron error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cron/cleanup
 * Clean up old usage records
 * Should run: Weekly
 */
router.post('/cleanup', verifyCronSecret, async (req, res) => {
  try {
    console.log('🧹 Cron: Cleanup triggered');
    const result = await cronJobs.cleanupOldRecords();
    res.json(result);
  } catch (error) {
    console.error('❌ Cleanup cron error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cron/run-all
 * Run all cron jobs (for testing or manual trigger)
 * Should run: As needed
 */
router.post('/run-all', verifyCronSecret, async (req, res) => {
  try {
    console.log('🕐 Cron: Run all jobs triggered');
    const result = await cronJobs.runAllJobs();
    res.json(result);
  } catch (error) {
    console.error('❌ Run all cron error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/cron/health
 * Health check for cron endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    jobs: [
      { name: 'reset-minutes', schedule: 'Monthly', endpoint: '/api/cron/reset-minutes' },
      { name: 'low-balance', schedule: 'Hourly', endpoint: '/api/cron/low-balance' },
      { name: 'auto-reload', schedule: 'Every 15 min', endpoint: '/api/cron/auto-reload' },
      { name: 'trial-expired', schedule: 'Daily', endpoint: '/api/cron/trial-expired' },
      { name: 'cleanup', schedule: 'Weekly', endpoint: '/api/cron/cleanup' }
    ]
  });
});

export default router;

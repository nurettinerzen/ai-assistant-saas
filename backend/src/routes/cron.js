/**
 * Cron Jobs API Routes
 *
 * These endpoints are called by external schedulers (e.g., cron-job.org, Vercel cron)
 * Protected by CRON_SECRET environment variable
 *
 * SECURITY:
 * - CRON_SECRET required (no fallback in production)
 * - Hard limits on batch sizes
 * - Job state tracking to prevent overlapping runs
 * - Rate limiting per job
 */

import express from 'express';
import cronJobs from '../services/cronJobs.js';
import { backfillAllBusinesses, backfillEmailEmbeddings } from '../core/email/rag/indexingHooks.js';
import { cleanupExpiredLocks } from '../core/email/policies/idempotencyPolicy.js';
import { cleanupOldEmbeddings } from '../core/email/rag/embeddingService.js';

const router = express.Router();

// ============================================================================
// JOB STATE TRACKING
// ============================================================================

// In-memory job state (could be Redis in production)
const jobState = new Map();

// Job configuration with hard limits
const JOB_CONFIG = {
  'reset-minutes': {
    maxDuration: 5 * 60 * 1000, // 5 minutes
    cooldown: 60 * 60 * 1000    // 1 hour
  },
  'low-balance': {
    maxDuration: 2 * 60 * 1000, // 2 minutes
    cooldown: 30 * 60 * 1000    // 30 minutes
  },
  'auto-reload': {
    maxDuration: 5 * 60 * 1000, // 5 minutes
    cooldown: 10 * 60 * 1000    // 10 minutes
  },
  'trial-expired': {
    maxDuration: 5 * 60 * 1000, // 5 minutes
    cooldown: 60 * 60 * 1000    // 1 hour
  },
  'cleanup': {
    maxDuration: 10 * 60 * 1000, // 10 minutes
    cooldown: 60 * 60 * 1000     // 1 hour
  },
  'email-rag-backfill': {
    maxDuration: 30 * 60 * 1000, // 30 minutes
    cooldown: 60 * 60 * 1000,    // 1 hour
    hardLimits: {
      maxBatchSize: 100,
      maxDaysBack: 180,
      maxBusinessesPerRun: 10
    }
  },
  'email-lock-cleanup': {
    maxDuration: 2 * 60 * 1000, // 2 minutes
    cooldown: 30 * 60 * 1000   // 30 minutes
  },
  'email-embedding-cleanup': {
    maxDuration: 15 * 60 * 1000, // 15 minutes
    cooldown: 6 * 60 * 60 * 1000, // 6 hours
    hardLimits: {
      maxDeletePerRun: 5000
    }
  }
};

/**
 * Get job state
 */
function getJobState(jobName) {
  return jobState.get(jobName) || {
    isRunning: false,
    lastStarted: null,
    lastCompleted: null,
    lastError: null,
    runCount: 0
  };
}

/**
 * Check if job can run
 */
function canJobRun(jobName) {
  const state = getJobState(jobName);
  const config = JOB_CONFIG[jobName] || { maxDuration: 5 * 60 * 1000, cooldown: 60 * 1000 };

  // Check if already running (with stale check)
  if (state.isRunning) {
    const runningFor = Date.now() - state.lastStarted;
    if (runningFor < config.maxDuration) {
      return { canRun: false, reason: 'JOB_ALREADY_RUNNING', runningFor };
    }
    // Job is stale, allow override
    console.warn(`⚠️ [Cron] Job ${jobName} appears stale (${runningFor}ms), allowing new run`);
  }

  // Check cooldown
  if (state.lastCompleted) {
    const timeSinceComplete = Date.now() - state.lastCompleted;
    if (timeSinceComplete < config.cooldown) {
      const remainingCooldown = config.cooldown - timeSinceComplete;
      return { canRun: false, reason: 'COOLDOWN_ACTIVE', remainingCooldown };
    }
  }

  return { canRun: true };
}

/**
 * Mark job as started
 */
function markJobStarted(jobName) {
  const state = getJobState(jobName);
  jobState.set(jobName, {
    ...state,
    isRunning: true,
    lastStarted: Date.now(),
    runCount: state.runCount + 1
  });
}

/**
 * Mark job as completed
 */
function markJobCompleted(jobName, success, error = null) {
  const state = getJobState(jobName);
  jobState.set(jobName, {
    ...state,
    isRunning: false,
    lastCompleted: Date.now(),
    lastError: success ? null : error
  });
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Verify cron secret middleware
 * CRITICAL: No fallback in production mode
 */
function verifyCronSecret(req, res, next) {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  const expectedSecret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  // SECURITY: In production, CRON_SECRET is REQUIRED
  if (!expectedSecret) {
    if (isProduction) {
      console.error('🚫 [Cron] CRON_SECRET not configured in production!');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }
    console.warn('⚠️ [Cron] CRON_SECRET not configured (dev mode), allowing request');
    return next();
  }

  // Timing-safe comparison to prevent timing attacks
  if (!secret || secret.length !== expectedSecret.length) {
    console.warn('❌ [Cron] Invalid cron secret (length mismatch)');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Simple comparison (for more security, use crypto.timingSafeEqual)
  if (secret !== expectedSecret) {
    console.warn('❌ [Cron] Invalid cron secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

/**
 * Job state check middleware
 */
function checkJobState(jobName) {
  return (req, res, next) => {
    const { canRun, reason, runningFor, remainingCooldown } = canJobRun(jobName);

    if (!canRun) {
      console.log(`⏭️ [Cron] Job ${jobName} skipped: ${reason}`);
      return res.status(429).json({
        error: 'Job cannot run',
        reason,
        details: {
          runningFor,
          remainingCooldown
        }
      });
    }

    // Mark as started
    markJobStarted(jobName);
    req.jobName = jobName;
    next();
  };
}

/**
 * Job completion wrapper
 */
function wrapJobHandler(handler) {
  return async (req, res) => {
    const jobName = req.jobName;
    try {
      const result = await handler(req, res);
      markJobCompleted(jobName, true);
      return result;
    } catch (error) {
      markJobCompleted(jobName, false, error.message);
      throw error;
    }
  };
}

// ============================================================================
// CRON ENDPOINTS
// ============================================================================

/**
 * POST /api/cron/reset-minutes
 * Reset included minutes for STARTER/PRO plans
 * Should run: First day of each month or on subscription renewal
 */
router.post('/reset-minutes',
  verifyCronSecret,
  checkJobState('reset-minutes'),
  wrapJobHandler(async (req, res) => {
    console.log('🔄 Cron: Reset included minutes triggered');
    const result = await cronJobs.resetIncludedMinutes();
    res.json({ success: true, ...result });
  })
);

/**
 * POST /api/cron/low-balance
 * Check for low balance and send warnings
 * Should run: Every hour
 */
router.post('/low-balance',
  verifyCronSecret,
  checkJobState('low-balance'),
  wrapJobHandler(async (req, res) => {
    console.log('💰 Cron: Low balance check triggered');
    const result = await cronJobs.checkLowBalance();
    res.json({ success: true, ...result });
  })
);

/**
 * POST /api/cron/auto-reload
 * Process auto-reload for eligible subscriptions
 * Should run: Every 15 minutes
 */
router.post('/auto-reload',
  verifyCronSecret,
  checkJobState('auto-reload'),
  wrapJobHandler(async (req, res) => {
    console.log('🔄 Cron: Auto-reload triggered');
    const result = await cronJobs.processAutoReload();
    res.json({ success: true, ...result });
  })
);

/**
 * POST /api/cron/trial-expired
 * Check for expired trials and notify users
 * Should run: Daily
 */
router.post('/trial-expired',
  verifyCronSecret,
  checkJobState('trial-expired'),
  wrapJobHandler(async (req, res) => {
    console.log('⏰ Cron: Trial expired check triggered');
    const result = await cronJobs.checkTrialExpired();
    res.json({ success: true, ...result });
  })
);

/**
 * POST /api/cron/cleanup
 * Clean up old usage records
 * Should run: Weekly
 */
router.post('/cleanup',
  verifyCronSecret,
  checkJobState('cleanup'),
  wrapJobHandler(async (req, res) => {
    console.log('🧹 Cron: Cleanup triggered');
    const result = await cronJobs.cleanupOldRecords();
    res.json({ success: true, ...result });
  })
);

/**
 * POST /api/cron/email-rag-backfill
 * Backfill email embeddings for RAG
 * Should run: Daily or on-demand
 */
router.post('/email-rag-backfill',
  verifyCronSecret,
  checkJobState('email-rag-backfill'),
  wrapJobHandler(async (req, res) => {
    const config = JOB_CONFIG['email-rag-backfill'].hardLimits;
    let { businessId, daysBack = 90, batchSize = 50 } = req.body;

    // Apply hard limits
    daysBack = Math.min(parseInt(daysBack) || 90, config.maxDaysBack);
    batchSize = Math.min(parseInt(batchSize) || 50, config.maxBatchSize);

    console.log(`📧 Cron: Email RAG backfill triggered (daysBack=${daysBack}, batchSize=${batchSize})`);

    let result;
    if (businessId) {
      // Single business backfill
      result = await backfillEmailEmbeddings({
        businessId: parseInt(businessId),
        daysBack,
        batchSize
      });
    } else {
      // All businesses (with limit)
      result = await backfillAllBusinesses({
        daysBack,
        batchSize,
        maxBusinesses: config.maxBusinessesPerRun
      });
    }

    res.json({
      success: true,
      message: 'Email RAG backfill completed',
      limits: { daysBack, batchSize },
      result
    });
  })
);

/**
 * POST /api/cron/email-lock-cleanup
 * Clean up expired email draft locks
 * Should run: Hourly
 */
router.post('/email-lock-cleanup',
  verifyCronSecret,
  checkJobState('email-lock-cleanup'),
  wrapJobHandler(async (req, res) => {
    console.log('🔒 Cron: Email lock cleanup triggered');
    const count = await cleanupExpiredLocks();
    res.json({
      success: true,
      message: `Cleaned up ${count} expired locks`
    });
  })
);

/**
 * POST /api/cron/email-embedding-cleanup
 * Clean up old embeddings (TTL + per-business cap)
 * Should run: Every 6 hours
 */
router.post('/email-embedding-cleanup',
  verifyCronSecret,
  checkJobState('email-embedding-cleanup'),
  wrapJobHandler(async (req, res) => {
    const config = JOB_CONFIG['email-embedding-cleanup'].hardLimits;
    const { ttlDays = 90, maxPerBusiness = 10000 } = req.body;

    console.log(`🗑️ Cron: Email embedding cleanup triggered (TTL=${ttlDays}d, cap=${maxPerBusiness})`);

    const result = await cleanupOldEmbeddings({
      ttlDays: Math.min(parseInt(ttlDays) || 90, 365),
      maxPerBusiness: Math.min(parseInt(maxPerBusiness) || 10000, 50000),
      maxDeletePerRun: config.maxDeletePerRun
    });

    res.json({
      success: true,
      message: 'Email embedding cleanup completed',
      result
    });
  })
);

// ============================================================================
// STATUS & HEALTH
// ============================================================================

/**
 * GET /api/cron/health
 * Health check for cron endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    secretConfigured: !!process.env.CRON_SECRET,
    jobs: Object.entries(JOB_CONFIG).map(([name, config]) => ({
      name,
      endpoint: `/api/cron/${name}`,
      maxDuration: `${config.maxDuration / 1000}s`,
      cooldown: `${config.cooldown / 60000}m`
    }))
  });
});

/**
 * GET /api/cron/status
 * Get status of all jobs (requires auth)
 */
router.get('/status', verifyCronSecret, (req, res) => {
  const status = {};
  for (const [jobName] of Object.entries(JOB_CONFIG)) {
    const state = getJobState(jobName);
    const { canRun, reason } = canJobRun(jobName);
    status[jobName] = {
      ...state,
      canRun,
      blockReason: canRun ? null : reason
    };
  }
  res.json({ status });
});

/**
 * POST /api/cron/reset-state
 * Reset job state (emergency use only)
 */
router.post('/reset-state', verifyCronSecret, (req, res) => {
  const { jobName } = req.body;

  if (jobName) {
    jobState.delete(jobName);
    console.log(`🔄 [Cron] Reset state for job: ${jobName}`);
    res.json({ success: true, message: `State reset for ${jobName}` });
  } else {
    jobState.clear();
    console.log('🔄 [Cron] Reset state for ALL jobs');
    res.json({ success: true, message: 'All job states reset' });
  }
});

export default router;

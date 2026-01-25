/**
 * Shadow Mode Runner
 *
 * Runs both old and new implementation side-by-side:
 * - Old: returns reply to user (current prod behavior)
 * - New: runs in shadow, logs metrics/diff, no user impact
 *
 * Purpose: Collect 24-48h of production data before rollout
 */

import { logViolation } from '../services/routing-metrics.js';

/**
 * Run shadow comparison
 *
 * @param {Function} oldImplementation - Legacy function
 * @param {Function} newImplementation - New orchestrator
 * @param {Object} params - Parameters for both
 * @param {string} context - Context label (e.g., 'whatsapp', 'chat')
 * @returns {Promise<Object>} Result from old implementation + shadow metrics
 */
export async function runShadowComparison(oldImplementation, newImplementation, params, context) {
  const shadowStartTime = Date.now();

  // STEP 1: Run OLD implementation (production)
  let oldResult;
  let oldError = null;
  const oldStartTime = Date.now();

  try {
    oldResult = await oldImplementation(params);
  } catch (error) {
    oldError = error;
    console.error(`❌ [Shadow:${context}] OLD implementation failed:`, error.message);
  }

  const oldDuration = Date.now() - oldStartTime;

  // STEP 2: Run NEW implementation (shadow - DRY-RUN mode, ZERO side-effects)
  let newResult;
  let newError = null;
  const newStartTime = Date.now();

  try {
    // CRITICAL: Add _shadowMode flag to disable all side-effects
    // - NO persist (ChatLog, state writes)
    // - NO billing (usageRecord)
    // - NO tool execution (stubbed)
    const shadowParams = {
      ...params,
      metadata: {
        ...params.metadata,
        _shadowMode: true, // Disables: persist, billing, tool execution
        _dryRun: true
      }
    };

    newResult = await newImplementation(shadowParams);
  } catch (error) {
    newError = error;
    console.error(`❌ [Shadow:${context}] NEW implementation failed:`, error.message);
  }

  const newDuration = Date.now() - newStartTime;

  // STEP 3: Compare results
  const comparison = compareResults(oldResult, newResult, oldError, newError, {
    oldDuration,
    newDuration,
    context
  });

  // STEP 4: Log shadow metrics
  logShadowMetrics(comparison, context, params.sessionId || 'unknown');

  // STEP 5: Return OLD result (production behavior unchanged)
  if (oldError) {
    throw oldError;
  }

  return {
    ...oldResult,
    _shadowMetrics: comparison
  };
}

/**
 * Compare old vs new results
 *
 * @param {Object} oldResult
 * @param {Object} newResult
 * @param {Error} oldError
 * @param {Error} newError
 * @param {Object} meta
 * @returns {Object} Comparison metrics
 */
function compareResults(oldResult, newResult, oldError, newError, meta) {
  const comparison = {
    timestamp: new Date().toISOString(),
    context: meta.context,
    oldDuration: meta.oldDuration,
    newDuration: meta.newDuration,
    latencyDiff: meta.newDuration - meta.oldDuration,
    latencyDiffPercent: ((meta.newDuration - meta.oldDuration) / meta.oldDuration) * 100,
    bothSucceeded: !oldError && !newError,
    bothFailed: !!oldError && !!newError,
    onlyOldFailed: !!oldError && !newError,
    onlyNewFailed: !oldError && !!newError,
    replyMatch: null,
    replyLength: null,
    hadToolFailureMatch: null,
    actionClaimViolation: null
  };

  // If both succeeded, compare outputs
  if (!oldError && !newError && oldResult && newResult) {
    const oldReply = oldResult.reply || '';
    const newReply = newResult.reply || '';

    comparison.replyMatch = oldReply === newReply;
    comparison.replyLength = {
      old: oldReply.length,
      new: newReply.length,
      diff: newReply.length - oldReply.length
    };

    // Compare tool failure handling
    comparison.hadToolFailureMatch = oldResult.hadToolFailure === newResult.metadata?.hadToolFailure;

    // Check if new result prevented action claim violation
    if (newResult.debug?.actionClaimBlocked) {
      comparison.actionClaimViolation = {
        blocked: true,
        oldText: oldReply.substring(0, 100),
        newText: newReply.substring(0, 100)
      };
    }
  }

  // Error details
  if (oldError) {
    comparison.oldError = {
      message: oldError.message,
      stack: oldError.stack?.substring(0, 200)
    };
  }

  if (newError) {
    comparison.newError = {
      message: newError.message,
      stack: newError.stack?.substring(0, 200)
    };
  }

  return comparison;
}

/**
 * Log shadow metrics (in-memory + console)
 *
 * @param {Object} comparison
 * @param {string} context
 * @param {string} sessionId
 */
function logShadowMetrics(comparison, context, sessionId) {
  console.log(`\n🔍 [Shadow:${context}] Comparison Result:`);
  console.log(`   Old duration: ${comparison.oldDuration}ms`);
  console.log(`   New duration: ${comparison.newDuration}ms`);
  console.log(`   Latency diff: ${comparison.latencyDiff > 0 ? '+' : ''}${comparison.latencyDiff}ms (${comparison.latencyDiffPercent.toFixed(1)}%)`);

  if (comparison.bothSucceeded) {
    console.log(`   ✅ Both succeeded`);
    console.log(`   Reply match: ${comparison.replyMatch ? '✅' : '❌'}`);
    if (!comparison.replyMatch) {
      console.log(`   Reply length: old=${comparison.replyLength.old}, new=${comparison.replyLength.new}, diff=${comparison.replyLength.diff}`);
    }
  } else if (comparison.onlyOldFailed) {
    console.log(`   ⚠️ OLD failed, NEW succeeded (improvement!)`);
  } else if (comparison.onlyNewFailed) {
    console.log(`   🚨 OLD succeeded, NEW failed (regression!)`);
  } else if (comparison.bothFailed) {
    console.log(`   ❌ Both failed`);
  }

  if (comparison.actionClaimViolation?.blocked) {
    console.log(`   🛡️ NEW blocked action claim violation`);
  }

  // Log to violations for dashboard
  if (comparison.onlyNewFailed) {
    logViolation('SHADOW_MODE_REGRESSION', {
      sessionId,
      details: {
        context,
        oldError: comparison.oldError,
        newError: comparison.newError,
        latencyDiff: comparison.latencyDiff
      }
    });
  }

  // Store in global metrics (for dashboard)
  if (!global.shadowMetrics) {
    global.shadowMetrics = [];
  }

  global.shadowMetrics.push(comparison);

  // Keep only last 1000 comparisons
  if (global.shadowMetrics.length > 1000) {
    global.shadowMetrics = global.shadowMetrics.slice(-1000);
  }
}

/**
 * Get shadow mode statistics
 *
 * @returns {Object} Aggregated shadow metrics
 */
export function getShadowModeStats() {
  if (!global.shadowMetrics || global.shadowMetrics.length === 0) {
    return {
      totalRuns: 0,
      message: 'No shadow mode data yet'
    };
  }

  const metrics = global.shadowMetrics;
  const total = metrics.length;

  const stats = {
    totalRuns: total,
    bothSucceeded: metrics.filter(m => m.bothSucceeded).length,
    bothFailed: metrics.filter(m => m.bothFailed).length,
    onlyOldFailed: metrics.filter(m => m.onlyOldFailed).length,
    onlyNewFailed: metrics.filter(m => m.onlyNewFailed).length,
    replyMatches: metrics.filter(m => m.replyMatch === true).length,
    replyMismatches: metrics.filter(m => m.replyMatch === false).length,
    actionClaimViolationsBlocked: metrics.filter(m => m.actionClaimViolation?.blocked).length,
    averageLatencyDiff: metrics.reduce((sum, m) => sum + m.latencyDiff, 0) / total,
    p50LatencyDiff: calculatePercentile(metrics.map(m => m.latencyDiff), 0.5),
    p95LatencyDiff: calculatePercentile(metrics.map(m => m.latencyDiff), 0.95),
    p99LatencyDiff: calculatePercentile(metrics.map(m => m.latencyDiff), 0.99),
    regressionRate: (metrics.filter(m => m.onlyNewFailed).length / total) * 100,
    improvementRate: (metrics.filter(m => m.onlyOldFailed).length / total) * 100,
    recentRuns: metrics.slice(-10)
  };

  return stats;
}

/**
 * Calculate percentile from array of numbers
 *
 * @param {number[]} values
 * @param {number} percentile (0-1)
 * @returns {number}
 */
function calculatePercentile(values, percentile) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * percentile) - 1;
  return sorted[index];
}

export default {
  runShadowComparison,
  getShadowModeStats
};

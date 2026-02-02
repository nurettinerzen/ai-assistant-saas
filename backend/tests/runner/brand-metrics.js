/**
 * Brand Violation Metrics Tracker
 *
 * Tracks brand violations (persona overrides) across test runs.
 * Threshold: >2 violations in last 20 runs = FAIL (non-gate)
 *
 * Storage: JSON file in tests/reports/brand-metrics.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const METRICS_FILE = path.join(__dirname, '../reports/brand-metrics.json');
const WINDOW_SIZE = 20; // Last N runs to consider
const ALERT_THRESHOLD = 0; // >0 = alert (any violation triggers alert)
const FAIL_THRESHOLD = 2; // >2 = fail (recentCount > 2 means 3+ violations)

/**
 * Load existing metrics
 */
function loadMetrics() {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      const data = fs.readFileSync(METRICS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('[BrandMetrics] Could not load metrics:', error.message);
  }
  return { runs: [] };
}

/**
 * Save metrics
 */
function saveMetrics(metrics) {
  try {
    const dir = path.dirname(METRICS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  } catch (error) {
    console.warn('[BrandMetrics] Could not save metrics:', error.message);
  }
}

/**
 * Record brand violations from a test run
 * @param {Array} warnings - Array of warning objects with brandViolation: true
 * @returns {Object} { shouldAlert, shouldFail, recentCount, message }
 */
export function recordBrandViolations(warnings = []) {
  const brandWarnings = warnings.filter(w => w.brandViolation);
  const violationCount = brandWarnings.length;

  const metrics = loadMetrics();

  // Add new run
  metrics.runs.push({
    timestamp: new Date().toISOString(),
    violationCount,
    violations: brandWarnings.map(w => ({
      step: w.step,
      assertion: w.assertion,
      reason: w.reason
    }))
  });

  // Keep only last WINDOW_SIZE runs
  if (metrics.runs.length > WINDOW_SIZE) {
    metrics.runs = metrics.runs.slice(-WINDOW_SIZE);
  }

  saveMetrics(metrics);

  // Calculate totals
  const recentCount = metrics.runs.reduce((sum, run) => sum + run.violationCount, 0);
  const shouldAlert = recentCount > ALERT_THRESHOLD;
  const shouldFail = recentCount > FAIL_THRESHOLD;

  let message = null;
  if (shouldFail) {
    message = `🚨 Brand drift detected: ${recentCount} violations in last ${metrics.runs.length} runs (threshold: ${FAIL_THRESHOLD})`;
  } else if (shouldAlert) {
    message = `⚠️  Brand warning: ${recentCount} violations in last ${metrics.runs.length} runs`;
  }

  return {
    shouldAlert,
    shouldFail,
    recentCount,
    windowSize: metrics.runs.length,
    message
  };
}

/**
 * Get current brand metrics status
 */
export function getBrandMetricsStatus() {
  const metrics = loadMetrics();
  const recentCount = metrics.runs.reduce((sum, run) => sum + run.violationCount, 0);

  return {
    recentCount,
    windowSize: metrics.runs.length,
    lastRun: metrics.runs[metrics.runs.length - 1] || null,
    shouldAlert: recentCount > ALERT_THRESHOLD,
    shouldFail: recentCount > FAIL_THRESHOLD
  };
}

/**
 * Reset metrics (for testing)
 */
export function resetBrandMetrics() {
  saveMetrics({ runs: [] });
}

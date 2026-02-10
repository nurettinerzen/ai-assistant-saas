/**
 * ErrorLog Cleanup Job
 *
 * Daily cleanup to prevent ErrorLog table from growing indefinitely.
 * - Resolved errors older than 30 days → delete
 * - Unresolved errors older than 90 days → delete
 *
 * Runs once per day (24h interval).
 */

import { prisma } from '../config/database.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const RESOLVED_RETENTION_DAYS = 30;
const UNRESOLVED_RETENTION_DAYS = 90;

async function cleanupErrorLogs() {
  try {
    const now = new Date();
    const resolvedCutoff = new Date(now.getTime() - RESOLVED_RETENTION_DAYS * DAY_MS);
    const unresolvedCutoff = new Date(now.getTime() - UNRESOLVED_RETENTION_DAYS * DAY_MS);

    // Delete old resolved errors
    const deletedResolved = await prisma.errorLog.deleteMany({
      where: {
        resolved: true,
        createdAt: { lt: resolvedCutoff },
      },
    });

    // Delete old unresolved errors
    const deletedUnresolved = await prisma.errorLog.deleteMany({
      where: {
        resolved: false,
        createdAt: { lt: unresolvedCutoff },
      },
    });

    const total = deletedResolved.count + deletedUnresolved.count;
    if (total > 0) {
      console.log(`🧹 [ErrorLog Cleanup] Deleted ${deletedResolved.count} resolved (>${RESOLVED_RETENTION_DAYS}d) + ${deletedUnresolved.count} unresolved (>${UNRESOLVED_RETENTION_DAYS}d) = ${total} total`);
    }
  } catch (error) {
    console.error('❌ [ErrorLog Cleanup] Failed:', error.message);
  }
}

/**
 * Initialize the daily cleanup job
 */
export function initErrorLogCleanup() {
  // Run immediately on startup (catch up if server was down)
  cleanupErrorLogs();

  // Then run every 24 hours
  setInterval(cleanupErrorLogs, DAY_MS);
  console.log('  📋 ErrorLog cleanup job scheduled (daily)');
}

export default { initErrorLogCleanup };

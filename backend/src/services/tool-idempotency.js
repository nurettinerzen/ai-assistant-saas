/**
 * Tool Idempotency Service
 *
 * Prevents duplicate tool executions from Meta webhook retries.
 * Key: {businessId, channel, messageId, toolName}
 *
 * Storage: In-memory with TTL (1 hour)
 * Future: Redis for multi-instance deployments
 */

const toolExecutionCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check if tool has already been executed for this message
 *
 * @param {Object} key
 * @param {string} key.businessId
 * @param {string} key.channel
 * @param {string} key.messageId
 * @param {string} key.toolName
 * @returns {Object|null} Cached result or null
 */
export function getToolExecutionResult(key) {
  const cacheKey = buildCacheKey(key);
  const cached = toolExecutionCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  // Check TTL
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    toolExecutionCache.delete(cacheKey);
    return null;
  }

  console.log(`♻️ [Idempotency] Cache HIT for ${key.toolName} (messageId: ${key.messageId})`);
  return cached.result;
}

/**
 * Store tool execution result
 *
 * @param {Object} key
 * @param {string} key.businessId
 * @param {string} key.channel
 * @param {string} key.messageId
 * @param {string} key.toolName
 * @param {Object} result - Tool execution result
 */
export function setToolExecutionResult(key, result) {
  const cacheKey = buildCacheKey(key);

  toolExecutionCache.set(cacheKey, {
    result,
    timestamp: Date.now()
  });

  console.log(`💾 [Idempotency] Cached result for ${key.toolName} (messageId: ${key.messageId})`);

  // Cleanup old entries periodically
  cleanupExpiredEntries();
}

/**
 * Build cache key from components
 *
 * @param {Object} key
 * @returns {string}
 */
function buildCacheKey(key) {
  return `${key.businessId}:${key.channel}:${key.messageId}:${key.toolName}`;
}

/**
 * Cleanup expired cache entries
 * Runs on every set operation (self-cleaning)
 */
function cleanupExpiredEntries() {
  // Only run cleanup 10% of the time to avoid overhead
  if (Math.random() > 0.1) {
    return;
  }

  const now = Date.now();
  let deletedCount = 0;

  for (const [key, value] of toolExecutionCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      toolExecutionCache.delete(key);
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    console.log(`🧹 [Idempotency] Cleaned up ${deletedCount} expired entries`);
  }
}

/**
 * Clear all cached results (for testing)
 */
export function clearToolExecutionCache() {
  toolExecutionCache.clear();
  console.log('🗑️ [Idempotency] Cache cleared');
}

/**
 * Get cache statistics
 *
 * @returns {Object}
 */
export function getIdempotencyStats() {
  const now = Date.now();
  let activeCount = 0;
  let expiredCount = 0;

  for (const [key, value] of toolExecutionCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      expiredCount++;
    } else {
      activeCount++;
    }
  }

  return {
    totalEntries: toolExecutionCache.size,
    activeEntries: activeCount,
    expiredEntries: expiredCount,
    cacheTTL: CACHE_TTL_MS,
    oldestEntry: getOldestEntryAge()
  };
}

/**
 * Get age of oldest cache entry (ms)
 *
 * @returns {number|null}
 */
function getOldestEntryAge() {
  let oldestTimestamp = null;

  for (const value of toolExecutionCache.values()) {
    if (oldestTimestamp === null || value.timestamp < oldestTimestamp) {
      oldestTimestamp = value.timestamp;
    }
  }

  return oldestTimestamp ? Date.now() - oldestTimestamp : null;
}

export default {
  getToolExecutionResult,
  setToolExecutionResult,
  clearToolExecutionCache,
  getIdempotencyStats
};

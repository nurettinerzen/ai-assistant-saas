/**
 * Gmail Rate Limiter
 *
 * Gmail API Quotas:
 * - 250 quota units per user per second
 * - 1 billion quota units per day
 * - messages.list: 5 units
 * - threads.get: 5 units
 * - messages.get: 5 units
 *
 * For 30-day backfill with 150 emails:
 * - 1 threads.list call = 5 units
 * - 150 threads.get calls = 750 units
 * Total: ~755 units (well within limits)
 *
 * CRITICAL: Implement exponential backoff for 429 responses
 */

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff wrapper for Gmail API calls
 *
 * @param {Function} apiCall - Async function to call
 * @param {Object} options - { maxRetries: 5, baseDelay: 1000 }
 * @returns {Promise<any>} API response
 */
export async function withRetry(apiCall, options = {}) {
  const {
    maxRetries = 5,
    baseDelay = 1000, // 1 second
    maxDelay = 32000  // 32 seconds
  } = options;

  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;

      // Check if it's a rate limit error (429)
      const isRateLimit = error.code === 429 ||
                         error.message?.includes('quota') ||
                         error.message?.includes('rate limit');

      // Check if it's a temporary error (5xx)
      const isTemporary = error.code >= 500 && error.code < 600;

      if (!isRateLimit && !isTemporary) {
        // Not retryable, throw immediately
        throw error;
      }

      // Calculate delay with exponential backoff + jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );

      console.warn(`[RateLimiter] Attempt ${attempt + 1}/${maxRetries} failed: ${error.message}`);
      console.warn(`[RateLimiter] Retrying in ${delay}ms...`);

      await sleep(delay);
    }
  }

  // All retries exhausted
  console.error(`[RateLimiter] All ${maxRetries} retries exhausted`);
  throw lastError;
}

/**
 * Batch processor with rate limiting
 *
 * Processes items in batches with delay between batches
 * to avoid hitting rate limits
 *
 * @param {Array} items - Items to process
 * @param {Function} processor - async (item) => result
 * @param {Object} options - { batchSize: 10, delayMs: 100 }
 * @returns {Promise<Array>} Results
 */
export async function processBatches(items, processor, options = {}) {
  const {
    batchSize = 10,
    delayMs = 100 // Delay between batches
  } = options;

  const results = [];
  const batches = [];

  // Split into batches
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  console.log(`[RateLimiter] Processing ${items.length} items in ${batches.length} batches`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    console.log(`[RateLimiter] Processing batch ${i + 1}/${batches.length} (${batch.length} items)`);

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    );

    results.push(...batchResults);

    // Delay before next batch (except last batch)
    if (i < batches.length - 1) {
      await sleep(delayMs);
    }
  }

  return results;
}

export default {
  withRetry,
  processBatches
};

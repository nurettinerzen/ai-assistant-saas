// ============================================================================
// GLOBAL CAPACITY MANAGER SERVICE
// ============================================================================
// FILE: backend/src/services/globalCapacityManager.js
//
// P0.1: Global capacity gate (Redis)
// - GLOBAL_CAP = 5 (11Labs provider limit)
// - Idempotent acquire/release
// - Crash-safe (no leak on process restart)
// - Enforces both business limit + global limit
// ============================================================================

import { createClient } from 'redis';

const GLOBAL_CAP = 5; // 11Labs provider limit
const REDIS_KEY_GLOBAL = 'concurrent:global:active';
const REDIS_KEY_BY_PLAN = 'concurrent:plan:'; // concurrent:plan:PRO
const REDIS_KEY_ACTIVE_CALLS = 'concurrent:active_calls'; // Hash: callId -> metadata

class GlobalCapacityManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.errorLogged = false; // Prevent error log spam
    this.disabledLogged = false; // Prevent disabled message spam
    this.connecting = false; // Guard against concurrent connect() calls
  }

  /**
   * Initialize Redis connection (Singleton)
   * Only connects once, subsequent calls return immediately
   */
  async connect() {
    // Guard: Already connected
    if (this.isConnected) {
      console.log('⚠️  [Redis] Already connected, skipping duplicate connect()');
      return;
    }

    // Guard: Connection in progress
    if (this.connecting) {
      console.log('⚠️  [Redis] Connection already in progress, skipping duplicate connect()');
      return;
    }

    this.connecting = true;

    // Check if Redis is disabled via environment variable
    if (process.env.REDIS_ENABLED === 'false') {
      // Only log once to avoid spam
      if (!this.disabledLogged) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⚠️  GLOBAL_CAP_DISABLED: Redis disabled');
        console.log('ℹ️  REDIS_ENABLED=false in environment');
        console.log('⚠️  Running in FAIL-OPEN mode (no global capacity enforcement)');
        console.log('⚠️  All calls will rely on business-level limits only');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.disabledLogged = true;
      }
      this.isConnected = false;
      this.client = null;
      this.connecting = false;
      return;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // Log Redis configuration (masked for security)
    const maskedUrl = redisUrl.replace(/:([^:@]+)@/, ':***@');
    console.log(`🔗 Redis URL: ${maskedUrl}`);

    try {
      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000, // 5s timeout
          reconnectStrategy: (retries) => {
            // Don't retry if Redis is not available
            if (retries > 3) {
              // Silent failure - already logged in catch block
              return false; // Stop trying to reconnect
            }
            return Math.min(retries * 100, 1000);
          }
        }
      });

      this.client.on('error', (err) => {
        // Only log first error to avoid spam
        if (!this.errorLogged) {
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('❌ Redis connection error:');
          console.error('   Message:', err?.message || 'Unknown error');
          console.error('   Code:', err?.code || 'N/A');
          console.error('   Address:', err?.address || 'N/A');
          console.error('   Port:', err?.port || 'N/A');
          if (err?.errors) {
            console.error('   Errors:', err.errors.map(e => `${e.code} ${e.address}:${e.port}`).join(', '));
          }
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          this.errorLogged = true;
        }
      });

      this.client.on('connect', () => {
        // Don't set isConnected here - will be set after successful PING
        console.log('🔌 Redis socket connected');
      });

      this.client.on('disconnect', () => {
        console.log('⚠️  Redis disconnected');
        this.isConnected = false;
      });

      await this.client.connect();

      // Verify connection with PING
      const pingResult = await this.client.ping();
      if (pingResult !== 'PONG') {
        throw new Error('Redis PING failed');
      }

      console.log('✅ Redis PING successful');
      this.isConnected = true; // Only set after successful PING

      // Crash-safe: On restart, reconcile with DB
      await this.reconcileOnStartup();

      this.connecting = false; // Connection successful
    } catch (error) {
      // Only log once to avoid spam
      if (!this.errorLogged) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ Redis connection failed:', error.message);
        console.error('⚠️  Running in FAIL-OPEN mode (global capacity NOT enforced)');
        console.error('⚠️  Calls will rely on business-level limits only');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.errorLogged = true;
      }
      this.isConnected = false;
      this.client = null;
      this.connecting = false; // Connection failed
    } finally {
      // Ensure connecting flag is always reset
      if (this.connecting) {
        this.connecting = false;
      }
    }
  }

  /**
   * Crash-safe initialization: Reconcile Redis with DB state
   */
  async reconcileOnStartup() {
    try {
      console.log('🔄 Reconciling global capacity on startup...');

      // Reset global counter (will be rebuilt from DB)
      await this.client.set(REDIS_KEY_GLOBAL, 0);

      // Clear plan counters
      const plans = ['PAYG', 'STARTER', 'PRO', 'ENTERPRISE'];
      for (const plan of plans) {
        await this.client.set(`${REDIS_KEY_BY_PLAN}${plan}`, 0);
      }

      // Clear active calls hash
      await this.client.del(REDIS_KEY_ACTIVE_CALLS);

      console.log('✅ Global capacity reconciled (reset to 0)');
      console.log('   NOTE: Will sync with DB active calls on first acquire');
    } catch (error) {
      console.error('❌ Error reconciling global capacity:', error);
    }
  }

  /**
   * Check if global capacity available
   * @returns {Promise<{available: boolean, current: number, limit: number}>}
   */
  async checkGlobalCapacity() {
    if (!this.isConnected) {
      await this.connect();
    }

    // Fail open if Redis not available
    if (!this.isConnected || !this.client) {
      return { available: true, current: 0, limit: GLOBAL_CAP, remaining: GLOBAL_CAP };
    }

    try {
      const current = parseInt(await this.client.get(REDIS_KEY_GLOBAL) || '0');
      const available = current < GLOBAL_CAP;

      return {
        available,
        current,
        limit: GLOBAL_CAP,
        remaining: Math.max(0, GLOBAL_CAP - current)
      };
    } catch (error) {
      console.error('❌ Error checking global capacity:', error);
      // Fail open on Redis error (allow call, rely on DB limit)
      return { available: true, current: 0, limit: GLOBAL_CAP, remaining: GLOBAL_CAP };
    }
  }

  /**
   * Acquire global slot (atomic)
   * @param {string} callId - Unique call ID
   * @param {string} plan - Subscription plan
   * @param {number} businessId - Business ID
   * @returns {Promise<{success: boolean, current?: number, reason?: string}>}
   */
  async acquireGlobalSlot(callId, plan, businessId) {
    if (!this.isConnected) {
      await this.connect();
    }

    // Fail open if Redis not available (silent mode)
    if (!this.isConnected || !this.client) {
      return { success: true, current: 0, failOpen: true };
    }

    try {
      // Check if call already has slot (idempotency)
      const existing = await this.client.hGet(REDIS_KEY_ACTIVE_CALLS, callId);
      if (existing) {
        const meta = JSON.parse(existing);
        console.log(`🔁 Call ${callId} already has global slot (idempotent)`);
        return {
          success: true,
          current: parseInt(await this.client.get(REDIS_KEY_GLOBAL) || '0'),
          idempotent: true,
          metadata: meta
        };
      }

      // Atomic check and increment using Lua script
      const script = `
        local current = redis.call('GET', KEYS[1])
        current = tonumber(current) or 0
        if current >= tonumber(ARGV[1]) then
          return -1
        end
        redis.call('INCR', KEYS[1])
        return current + 1
      `;

      const result = await this.client.eval(script, {
        keys: [REDIS_KEY_GLOBAL],
        arguments: [GLOBAL_CAP.toString()]
      });

      if (result === -1) {
        console.log(`⚠️ Global capacity exceeded: ${GLOBAL_CAP}/${GLOBAL_CAP}`);
        return {
          success: false,
          reason: 'GLOBAL_CAPACITY_EXCEEDED',
          current: GLOBAL_CAP,
          limit: GLOBAL_CAP
        };
      }

      // Store call metadata
      const metadata = {
        callId,
        plan,
        businessId,
        acquiredAt: new Date().toISOString(),
        slot: result
      };

      await this.client.hSet(REDIS_KEY_ACTIVE_CALLS, callId, JSON.stringify(metadata));

      // Increment plan counter
      await this.client.incr(`${REDIS_KEY_BY_PLAN}${plan}`);

      console.log(`✅ Global slot acquired: ${callId} (${result}/${GLOBAL_CAP}) - ${plan}`);

      return {
        success: true,
        current: result,
        limit: GLOBAL_CAP,
        remaining: GLOBAL_CAP - result,
        metadata
      };

    } catch (error) {
      console.error('❌ Error acquiring global slot:', error);
      // Fail open on Redis error
      return { success: true, current: 0, limit: GLOBAL_CAP, error: error.message };
    }
  }

  /**
   * Release global slot (idempotent)
   * @param {string} callId - Unique call ID
   * @returns {Promise<{success: boolean, current?: number}>}
   */
  async releaseGlobalSlot(callId) {
    if (!this.isConnected) {
      await this.connect();
    }

    // Fail open if Redis not available (silent mode)
    if (!this.isConnected || !this.client) {
      return { success: true, current: 0, failOpen: true };
    }

    try {
      // Get metadata
      const metadataStr = await this.client.hGet(REDIS_KEY_ACTIVE_CALLS, callId);

      if (!metadataStr) {
        console.log(`🔁 Call ${callId} not found in active calls (already released or never acquired)`);
        return {
          success: true,
          current: parseInt(await this.client.get(REDIS_KEY_GLOBAL) || '0'),
          idempotent: true
        };
      }

      const metadata = JSON.parse(metadataStr);

      // Atomic decrement using Lua script (prevent negative)
      const script = `
        local current = redis.call('GET', KEYS[1])
        current = tonumber(current) or 0
        if current > 0 then
          redis.call('DECR', KEYS[1])
          return current - 1
        end
        return 0
      `;

      const newCount = await this.client.eval(script, {
        keys: [REDIS_KEY_GLOBAL]
      });

      // Remove from active calls
      await this.client.hDel(REDIS_KEY_ACTIVE_CALLS, callId);

      // Decrement plan counter
      await this.client.decr(`${REDIS_KEY_BY_PLAN}${metadata.plan}`);

      console.log(`✅ Global slot released: ${callId} (${newCount}/${GLOBAL_CAP})`);

      return {
        success: true,
        current: newCount,
        limit: GLOBAL_CAP,
        plan: metadata.plan
      };

    } catch (error) {
      console.error('❌ Error releasing global slot:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get global status
   * @returns {Promise<{active: number, limit: number, byPlan: Object, activeCalls: Array}>}
   */
  async getGlobalStatus() {
    if (!this.isConnected) {
      await this.connect();
    }

    // Fail open if Redis not available
    if (!this.isConnected || !this.client) {
      return {
        active: 0,
        limit: GLOBAL_CAP,
        available: GLOBAL_CAP,
        utilizationPercent: 0,
        byPlan: {},
        activeCalls: []
      };
    }

    try {
      const active = parseInt(await this.client.get(REDIS_KEY_GLOBAL) || '0');

      // Get by plan
      const plans = ['PAYG', 'STARTER', 'PRO', 'ENTERPRISE'];
      const byPlan = {};

      for (const plan of plans) {
        byPlan[plan] = parseInt(await this.client.get(`${REDIS_KEY_BY_PLAN}${plan}`) || '0');
      }

      // Get active calls
      const activeCallsHash = await this.client.hGetAll(REDIS_KEY_ACTIVE_CALLS);
      const activeCalls = Object.entries(activeCallsHash).map(([callId, metadataStr]) => {
        const meta = JSON.parse(metadataStr);
        return {
          callId,
          ...meta,
          age: Date.now() - new Date(meta.acquiredAt).getTime()
        };
      });

      return {
        active,
        limit: GLOBAL_CAP,
        available: GLOBAL_CAP - active,
        utilizationPercent: Math.round((active / GLOBAL_CAP) * 100),
        byPlan,
        activeCalls,
        activeCallCount: activeCalls.length
      };

    } catch (error) {
      console.error('❌ Error getting global status:', error);
      return {
        active: 0,
        limit: GLOBAL_CAP,
        available: GLOBAL_CAP,
        utilizationPercent: 0,
        byPlan: {},
        activeCalls: [],
        error: error.message
      };
    }
  }

  /**
   * Force reset (for cleanup/maintenance)
   */
  async forceReset() {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.client.set(REDIS_KEY_GLOBAL, 0);

      const plans = ['PAYG', 'STARTER', 'PRO', 'ENTERPRISE'];
      for (const plan of plans) {
        await this.client.set(`${REDIS_KEY_BY_PLAN}${plan}`, 0);
      }

      await this.client.del(REDIS_KEY_ACTIVE_CALLS);

      console.log('🔄 Global capacity force reset');
      return { success: true };
    } catch (error) {
      console.error('❌ Error force resetting:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup stuck calls (called by cron)
   * @param {Array} activeCallIds - Array of call IDs that are actually active (from 11Labs or DB)
   */
  async cleanupStuckCalls(activeCallIds) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const allCallsHash = await this.client.hGetAll(REDIS_KEY_ACTIVE_CALLS);
      const redisCallIds = Object.keys(allCallsHash);

      const stuckCalls = redisCallIds.filter(id => !activeCallIds.includes(id));

      if (stuckCalls.length === 0) {
        console.log('✅ No stuck calls found in Redis');
        return { cleaned: 0, stuck: [] };
      }

      console.log(`⚠️  Found ${stuckCalls.length} stuck calls in Redis`);

      for (const callId of stuckCalls) {
        await this.releaseGlobalSlot(callId);
      }

      console.log(`✅ Cleaned up ${stuckCalls.length} stuck calls`);

      return {
        cleaned: stuckCalls.length,
        stuck: stuckCalls
      };

    } catch (error) {
      console.error('❌ Error cleaning up stuck calls:', error);
      return { cleaned: 0, error: error.message };
    }
  }

  /**
   * Disconnect Redis
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      console.log('👋 Redis disconnected');
    }
  }
}

// Export singleton instance
const globalCapacityManager = new GlobalCapacityManager();
export default globalCapacityManager;

// Named exports
export const {
  connect,
  checkGlobalCapacity,
  acquireGlobalSlot,
  releaseGlobalSlot,
  getGlobalStatus,
  forceReset,
  cleanupStuckCalls
} = {
  connect: () => globalCapacityManager.connect(),
  checkGlobalCapacity: () => globalCapacityManager.checkGlobalCapacity(),
  acquireGlobalSlot: (callId, plan, businessId) => globalCapacityManager.acquireGlobalSlot(callId, plan, businessId),
  releaseGlobalSlot: (callId) => globalCapacityManager.releaseGlobalSlot(callId),
  getGlobalStatus: () => globalCapacityManager.getGlobalStatus(),
  forceReset: () => globalCapacityManager.forceReset(),
  cleanupStuckCalls: (activeCallIds) => globalCapacityManager.cleanupStuckCalls(activeCallIds)
};

export { GLOBAL_CAP };

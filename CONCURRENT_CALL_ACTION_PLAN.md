# Concurrent Call System - Revised Action Plan

**Date**: 2026-01-27
**Based on**: Technical feasibility research + 11Labs API capabilities

---

## 🔍 Critical Questions - ANSWERED

### 1) ✅ Can we programmatically terminate 11Labs inbound calls?

**YES** - 11Labs has "End Call" system tool that can be triggered:
- Via API: Call system tool to end conversation
- Via Real-time monitoring (Enterprise): Send control command to terminate
- **Source**: [ElevenLabs End Call Documentation](https://elevenlabs.io/docs/conversational-ai/customization/tools/system-tools/end-call)

**Implementation**: Requires API call to trigger system tool or real-time control command.

### 2) ✅ Can we list active calls from 11Labs?

**PARTIAL** - 11Labs has conversation listing API:
- **GET /convai/conversations**: List all conversations with filters
- **Query params**: `agent_id`, `tool_names` (v2.22.0)
- **Real-time monitoring** (Enterprise): WebSocket for active conversation monitoring
- **Limitation**: No explicit `status=active` filter in public docs, but can filter by time range

**Source**: [ElevenLabs Conversations API](https://elevenlabs.io/docs/api-reference/conversations/list)

**Implementation**:
```javascript
// List conversations from last 30 minutes
const recentConversations = await elevenlabs.listConversations({
  agent_id: agentId,
  // Filter by recent createdAt, check for endedAt null/missing
});
```

### 3) ✅ Do we have call session tracking?

**YES** - `CallLog` model exists (`schema.prisma:369-426`):
- ✅ Has: `callId`, `businessId`, `direction`, `status`, `createdAt`, `updatedAt`
- ❌ Missing: `startedAt`, `endedAt` as separate fields
- ❌ Missing: Real-time `status` tracking (in-progress vs completed)

**Gap**: No dedicated `ActiveCallSession` table for real-time tracking.

### 4) ❌ Do we track WHICH calls are active?

**NO** - We only track `activeCalls` count (integer), not individual call IDs.

**Risk**:
- If webhook missed, we don't know WHICH call is stuck
- Can't reconcile with 11Labs active calls list

**Solution Needed**: Track active call IDs in addition to count.

### 5) ✅ Multiple regions / 11Labs accounts?

**Current**: Single 11Labs account (env var `ELEVENLABS_API_KEY`)
**Implication**: Global capacity = single pool (5 concurrent)

**When scaling**: Will need multi-account support:
- Per-region accounts
- Load balancing across accounts
- Separate capacity pools

### 6) ⚠️ Oversubscription ratio target?

**Not defined** - No explicit policy found in code.

**Current Reality**:
- 11Labs capacity: 5
- Selling: PRO (5×N) + STARTER (1×M) + PAYG (1×P)
- **Risk**: Unbounded oversubscription

**Recommendation**: Define policy:
- Conservative: 2x oversub (10 total sold with 5 capacity)
- Moderate: 2.5x (12.5 total)
- Aggressive: 3x (15 total) - requires good load balancing

---

## 📋 REVISED Action Plan (Priority Order)

### P0 - CRITICAL (This Week - Customer Safety)

#### P0.1: Outbound 11Labs 429 Handler (1 hour)
**Problem**: If 11Labs returns 429 (rate limit), we don't handle it gracefully.

**Solution**:
```javascript
// In elevenlabs.js startCall()
try {
  const call = await elevenLabsClient.post('/convai/start', params);
  return call.data;
} catch (error) {
  if (error.response?.status === 429) {
    // Release slot immediately
    await concurrentCallManager.releaseSlot(businessId);

    // Return structured error
    throw {
      code: 'PLATFORM_CAPACITY_EXCEEDED',
      message: 'Platform is at capacity. Please try again in a moment.',
      retryAfter: error.response.headers['retry-after'] || 30,
      status: 503
    };
  }
  throw error;
}
```

**Impact**: Prevents slot leakage on 11Labs rejection.

---

#### P0.2: Inbound Webhook Desync Fix (2 hours)
**Problem**: Inbound webhook arrives AFTER 11Labs started call. If we reject (429), call is already active on 11Labs but not tracked by us.

**Solution Option A - Always Accept Inbound** (RECOMMENDED):
```javascript
// In webhooks.js call-started handler
if (callDirection === 'inbound') {
  // ALWAYS accept inbound - force acquire even if over limit
  await prisma.subscription.update({
    where: { businessId },
    data: { activeCalls: { increment: 1 } }
  });

  // If over business limit, log alert for monitoring
  const subscription = await prisma.subscription.findUnique({
    where: { businessId }
  });

  const limit = getEffectivePlanConfig(subscription).concurrentLimit;

  if (subscription.activeCalls > limit) {
    console.error(`🚨 ALERT: Inbound call exceeded limit for business ${businessId}: ${subscription.activeCalls}/${limit}`);

    // Send to monitoring system (future: Slack/Datadog)
    // await alerting.send({
    //   type: 'INBOUND_OVER_LIMIT',
    //   businessId,
    //   activeCalls: subscription.activeCalls,
    //   limit
    // });
  }
}
```

**Solution Option B - Terminate Inbound Call** (Complex):
```javascript
// If over limit, terminate the call via 11Labs API
if (!slotResult.success && callDirection === 'inbound') {
  try {
    // This requires implementing terminate API call
    await elevenlabsService.terminateConversation(callId);
    console.log(`✅ Terminated over-limit inbound call: ${callId}`);
  } catch (err) {
    console.error(`Failed to terminate call ${callId}:`, err);
    // Fall back to accepting it
  }
}
```

**Recommendation**: **Option A** - Simpler, safer. Let inbound calls go over limit temporarily, monitor via alerts.

---

#### P0.3: Active Call Session Tracking (3 hours)

**Problem**: We track count (`activeCalls`) but not individual active call IDs.

**Solution**: Add `ActiveCallSession` table:

```prisma
// Add to schema.prisma
model ActiveCallSession {
  id                Int      @id @default(autoincrement())
  businessId        Int
  callId            String   @unique  // 11Labs conversation_id
  direction         String   // "inbound" or "outbound"
  agentId           String?  // 11Labs agent_id
  startedAt         DateTime @default(now())
  lastHeartbeat     DateTime @default(now())

  business          Business @relation(fields: [businessId], references: [id])

  @@index([businessId])
  @@index([startedAt])
  @@index([lastHeartbeat])
}
```

**Updated acquire/release**:
```javascript
// In concurrentCallManager.acquireSlot()
// After atomic increment
await prisma.activeCallSession.create({
  data: {
    businessId,
    callId,
    direction,
    agentId
  }
});

// In concurrentCallManager.releaseSlot()
await prisma.activeCallSession.delete({
  where: { callId }
});
```

**Benefits**:
1. Know WHICH calls are active
2. Can reconcile with 11Labs API
3. Can detect stuck calls by ID
4. Better debugging

---

### P1 - HIGH (Next Week - Operational Maturity)

#### P1.1: Stuck Call Cleanup Cron (2 hours)

**Problem**: If `call-ended` webhook lost, slot stuck forever.

**Solution**: Periodic reconciliation job (every 10 minutes):

```javascript
// scripts/cleanup-stuck-calls.js
import { PrismaClient } from '@prisma/client';
import elevenlabsService from '../src/services/elevenlabs.js';
import concurrentCallManager from '../src/services/concurrentCallManager.js';

const prisma = new PrismaClient();

async function cleanupStuckCalls() {
  console.log('🔍 Checking for stuck calls...');

  // Find active sessions older than 30 minutes
  const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000);

  const stuckSessions = await prisma.activeCallSession.findMany({
    where: {
      startedAt: { lt: stuckThreshold }
    }
  });

  if (stuckSessions.length === 0) {
    console.log('✅ No stuck calls found');
    return;
  }

  console.log(`⚠️  Found ${stuckSessions.length} potentially stuck calls`);

  for (const session of stuckSessions) {
    try {
      // Check if call still active on 11Labs
      const conversation = await elevenlabsService.getConversation(session.callId);

      // If conversation ended on 11Labs side but we didn't get webhook
      if (conversation.status === 'completed' || conversation.ended_at) {
        console.log(`🔧 Cleaning up stuck call ${session.callId} (ended on 11Labs)`);

        // Release slot
        await concurrentCallManager.releaseSlot(session.businessId);

        // Remove session
        await prisma.activeCallSession.delete({
          where: { id: session.id }
        });

        console.log(`✅ Cleaned up stuck call ${session.callId}`);
      }
    } catch (error) {
      // If call not found on 11Labs (404), definitely stuck
      if (error.response?.status === 404) {
        console.log(`🔧 Call ${session.callId} not found on 11Labs - force cleanup`);

        await concurrentCallManager.releaseSlot(session.businessId);
        await prisma.activeCallSession.delete({
          where: { id: session.id }
        });
      } else {
        console.error(`Failed to check call ${session.callId}:`, error.message);
      }
    }
  }
}

cleanupStuckCalls()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
```

**Cron setup** (PM2 or systemd timer):
```bash
# Every 10 minutes
*/10 * * * * cd /app/backend && node scripts/cleanup-stuck-calls.js >> /var/log/cleanup-stuck-calls.log 2>&1
```

---

#### P1.2: Global Capacity Gate with Redis (4 hours)

**Problem**: Per-business limits OK, but no global capacity management.

**Solution**: Redis-based global counter + priority.

```javascript
// services/globalCapacityManager.js
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const GLOBAL_CAP = 5; // 11Labs capacity
const RESERVED_PRO = 3; // Reserve 3 slots for PRO+
const RESERVED_ENTERPRISE = 2; // Reserve 2 for Enterprise

export async function checkGlobalCapacity(businessId, plan) {
  const globalActive = await redis.get('global:active_calls') || 0;

  // Enterprise: Always allowed if under global cap
  if (plan === 'ENTERPRISE') {
    if (globalActive >= GLOBAL_CAP) {
      return { allowed: false, reason: 'PLATFORM_AT_CAPACITY' };
    }
    return { allowed: true };
  }

  // PRO: Can use PRO+ reserved pool
  if (plan === 'PRO') {
    const availableForPro = GLOBAL_CAP - RESERVED_ENTERPRISE;
    if (globalActive >= availableForPro) {
      return { allowed: false, reason: 'PLATFORM_CAPACITY_FULL' };
    }
    return { allowed: true };
  }

  // PAYG/STARTER: Only if general pool available
  const reservedTotal = RESERVED_PRO + RESERVED_ENTERPRISE;
  const availableForPayg = GLOBAL_CAP - reservedTotal;

  // Count PRO+ usage
  const proUsage = await redis.get('global:pro_usage') || 0;

  if (globalActive - proUsage >= availableForPayg) {
    return { allowed: false, reason: 'PLATFORM_FULL_FOR_PLAN' };
  }

  return { allowed: true };
}

export async function incrementGlobal(plan) {
  await redis.incr('global:active_calls');
  if (plan === 'PRO' || plan === 'ENTERPRISE') {
    await redis.incr('global:pro_usage');
  }
}

export async function decrementGlobal(plan) {
  await redis.decr('global:active_calls');
  if (plan === 'PRO' || plan === 'ENTERPRISE') {
    await redis.decr('global:pro_usage');
  }
}
```

**Integration**:
```javascript
// In concurrentCallManager.acquireSlot()
const globalCheck = await globalCapacityManager.checkGlobalCapacity(businessId, subscription.plan);
if (!globalCheck.allowed) {
  return {
    success: false,
    error: globalCheck.reason,
    message: 'Platform capacity limit reached for your plan tier'
  };
}

// Acquire business slot (existing code)
// ...

// Increment global counter
await globalCapacityManager.incrementGlobal(subscription.plan);
```

---

#### P1.3: Basic Observability Dashboard (4 hours)

**Metrics to track** (Prometheus/Datadog format):

```javascript
// services/metrics.js
import StatsD from 'node-statsd';

const metrics = new StatsD({
  host: process.env.STATSD_HOST || 'localhost',
  port: 8125
});

export function recordCallSlotAcquired(businessId, plan, currentActive, limit) {
  metrics.gauge('concurrent_calls.active', currentActive, [`business:${businessId}`, `plan:${plan}`]);
  metrics.gauge('concurrent_calls.limit', limit, [`business:${businessId}`, `plan:${plan}`]);
  metrics.gauge('concurrent_calls.utilization', (currentActive / limit) * 100, [`business:${businessId}`, `plan:${plan}`]);
}

export function recordCallSlotRejected(businessId, plan, reason) {
  metrics.increment('concurrent_calls.rejected', 1, [`business:${businessId}`, `plan:${plan}`, `reason:${reason}`]);
}

export function recordGlobalCapacity(active, capacity) {
  metrics.gauge('platform.concurrent_calls.active', active);
  metrics.gauge('platform.concurrent_calls.capacity', capacity);
  metrics.gauge('platform.concurrent_calls.utilization', (active / capacity) * 100);
}

export function recordElevenLabsRateLimit(endpoint) {
  metrics.increment('elevenlabs.rate_limit_429', 1, [`endpoint:${endpoint}`]);
}

export function recordStuckCallCleaned(businessId, callAge) {
  metrics.increment('concurrent_calls.stuck_cleaned', 1, [`business:${businessId}`]);
  metrics.histogram('concurrent_calls.stuck_age_minutes', callAge);
}
```

**Grafana Dashboard Queries**:
```
Platform Active Calls: sum(platform.concurrent_calls.active)
Platform Utilization: avg(platform.concurrent_calls.utilization)
Rejections by Reason: sum(concurrent_calls.rejected) by reason
Top Businesses by Usage: topk(5, concurrent_calls.active) by business
429 Rate Limits: sum(elevenlabs.rate_limit_429)
Stuck Calls Cleaned: sum(concurrent_calls.stuck_cleaned)
```

---

### P2 - MEDIUM (2-4 Weeks - Advanced Features)

#### P2.1: Oversubscription Monitoring & Alerting

**Policy Definition**:
```javascript
// config/capacityPolicy.js
export const CAPACITY_POLICY = {
  elevenLabsCapacity: 5,
  targetOversubscriptionRatio: 2.5, // Max 12.5 total slots sold
  alertThresholds: {
    warning: 0.8,  // 80% capacity
    critical: 0.95 // 95% capacity
  }
};
```

**Monitoring**:
```javascript
// Calculate total sold capacity
const totalSoldSlots = await prisma.subscription.aggregate({
  where: { status: 'ACTIVE' },
  _sum: { concurrentLimit: true }
});

const oversubRatio = totalSoldSlots._sum.concurrentLimit / CAPACITY_POLICY.elevenLabsCapacity;

if (oversubRatio > CAPACITY_POLICY.targetOversubscriptionRatio) {
  await slack.send({
    channel: '#alerts',
    text: `⚠️ Oversubscription exceeds policy: ${oversubRatio.toFixed(2)}x (target: ${CAPACITY_POLICY.targetOversubscriptionRatio}x)`
  });
}
```

#### P2.2: Heartbeat & TTL for Active Sessions

**Problem**: Sessions can go stale if both webhooks missed.

**Solution**: Heartbeat mechanism:
```javascript
// In webhook handlers, update heartbeat
await prisma.activeCallSession.update({
  where: { callId },
  data: { lastHeartbeat: new Date() }
});

// In cleanup cron, check heartbeat age
const staleHeartbeat = new Date(Date.now() - 15 * 60 * 1000); // 15 min
const staleSessions = await prisma.activeCallSession.findMany({
  where: { lastHeartbeat: { lt: staleHeartbeat } }
});
```

---

## 🎯 Implementation Priority Summary

| Priority | Task | Effort | Impact | When |
|----------|------|--------|--------|------|
| **P0.1** | 11Labs 429 handler | 1h | Prevents slot leakage | This week |
| **P0.2** | Inbound desync fix | 2h | Prevents tracking errors | This week |
| **P0.3** | Active call session tracking | 3h | Foundation for reconcile | This week |
| **P1.1** | Stuck call cleanup cron | 2h | Auto-recovery | Next week |
| **P1.2** | Global capacity gate | 4h | Fairness + prevent 429 | Next week |
| **P1.3** | Observability | 4h | Visibility | Next week |
| **P2.1** | Oversubscription monitoring | 2h | Policy enforcement | Month 2 |
| **P2.2** | Heartbeat + TTL | 2h | Robustness | Month 2 |

**Total P0 Effort**: 6 hours
**Total P1 Effort**: 10 hours
**Total P0+P1**: 16 hours (~2 days)

---

## 📚 References

- [ElevenLabs End Call Documentation](https://elevenlabs.io/docs/conversational-ai/customization/tools/system-tools/end-call)
- [ElevenLabs Conversations API](https://elevenlabs.io/docs/api-reference/conversations/list)
- [ElevenLabs Real-time Monitoring](https://elevenlabs.io/docs/agents-platform/guides/realtime-monitoring)

---

## ✅ Decision Log

**Decision 1**: Inbound desync → Accept over limit + alert (Option A)
**Rationale**: Simpler, safer. Hanging up on customers is worse than temporary over-limit.

**Decision 2**: Track active call IDs in new table (ActiveCallSession)
**Rationale**: Essential for reconciliation, debugging, and cleanup.

**Decision 3**: Redis for global capacity (not DB)
**Rationale**: Sub-millisecond performance needed for high-concurrency checks.

**Decision 4**: Reserved capacity for PRO/Enterprise
**Rationale**: Prevents fairness issues, protects high-value customers.

**Decision 5**: Cleanup cron every 10 minutes
**Rationale**: Balance between responsiveness and API call costs.

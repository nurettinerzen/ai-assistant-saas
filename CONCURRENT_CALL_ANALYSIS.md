# Concurrent Call System - Comprehensive Analysis Report

**Date**: 2026-01-27
**11Labs Current Capacity**: 5 concurrent calls
**Future Plan**: Upgrade to Enterprise for higher capacity

---

## 📋 Executive Summary

**Current State**: ✅ **Solid foundation with critical gaps**

**Strengths**:
- Atomic slot acquisition (DB transaction with `updateMany`)
- Dedicated `ConcurrentCallManager` service
- Proper acquire/release pattern at webhooks
- Plan-based limits configured correctly

**Critical Gaps**:
- ❌ **NO oversubscription management** (selling 5+5+5+1+1 = 17 slots with 5 capacity)
- ❌ **NO fairness/priority** (PAYG can starve PRO customers)
- ❌ **NO stuck call cleanup** (watchdog exists but not scheduled)
- ❌ **NO observability** (no metrics, no alarms, no dashboards)
- ❌ **NO 11Labs rate limit handling** (what if 11Labs returns 429?)

**Risk Level**: 🔴 **HIGH** - Will cause customer issues at scale

---

## 1) Source of Truth Analysis

### 1.1) 11Labs Real Limit

**Current Tier**: 5 concurrent calls (account-level)
**API Key Basis**: Account-wide limit, not per-key
**Future**: Enterprise tier (10+ concurrent)

### 1.2) Our System Limits

**Enforcement Level**: **Business-level** (per subscription)

**Plan Configuration** (`backend/src/config/plans.js:114-126`):
```javascript
TRIAL:      { concurrentLimit: 1 }
PAYG:       { concurrentLimit: 1 }
STARTER:    { concurrentLimit: 1 }
PRO:        { concurrentLimit: 5 }
ENTERPRISE: { concurrentLimit: 5 } // customizable via enterpriseConcurrent
```

**Source of Truth**: ✅ `getEffectivePlanConfig()` (`backend/src/services/planConfig.js:35`)
```javascript
concurrentLimit: subscription.enterpriseConcurrent ??
                 planDefaults.concurrentLimit ??
                 1
```

**Priority Order**:
1. `subscription.enterpriseConcurrent` (DB override - Enterprise customers)
2. `planDefaults.concurrentLimit` (plan default from plans.js)
3. Fallback: 1

✅ **CORRECT**: Single source of truth, consistent across all enforcement points.

---

## 2) Enforcement Points

### 2.1) Call Start - Outbound Calls

**Location**: `backend/src/middleware/subscriptionLimits.js:487-518`

**Flow**:
```javascript
// 1. Check (non-atomic)
const canStart = await concurrentCallManager.canStartCall(businessId);
if (!canStart.canStart) {
  return res.status(429).json({
    error: 'CONCURRENT_LIMIT_REACHED',
    currentActive: canStart.currentActive,
    limit: canStart.limit
  });
}

// 2. Acquire (atomic)
const result = await concurrentCallManager.acquireSlot(businessId);
if (!result.success) {
  return res.status(429).json({ error: result.error });
}
```

**Issue**: ⚠️ **Check-then-act race condition**
- Thread A checks: 4/5 → OK
- Thread B checks: 4/5 → OK
- Thread A acquires: 5/5
- Thread B tries to acquire: ❌ Blocked by atomic updateMany ✅

**Verdict**: ✅ **Safe** - Atomic `updateMany` prevents double-booking, but wastes one API call.

### 2.2) Call Start - Inbound Calls (Webhook)

**Location**: `backend/src/routes/webhooks.js:187-199`

**Flow**:
```javascript
// 11Labs sends "call-started" webhook
const slotResult = await concurrentCallManager.acquireSlot(businessId);

if (!slotResult.success) {
  return res.status(429).json({
    error: slotResult.error,
    message: slotResult.message
  });
}
```

**Problem**: 🔴 **CRITICAL** - Webhook already arrived, call ALREADY started on 11Labs!

**What happens**:
1. 11Labs starts inbound call (already consuming 1 of 5 slots on their side)
2. Sends webhook to us
3. We check limit
4. If limit exceeded, we return 429
5. **BUT CALL IS ALREADY ACTIVE ON 11LABS!**

**Result**:
- 11Labs slot occupied
- Our slot not acquired
- Call proceeds but we don't track it
- **Desync**: 11Labs thinks call active, we don't

**Solution Needed**:
```javascript
// Option A: Always accept inbound, go over limit temporarily
if (callDirection === 'inbound') {
  // Force acquire even if over limit
  await prisma.subscription.update({
    where: { businessId },
    data: { activeCalls: { increment: 1 } }
  });
  // Log overage for alerting
}

// Option B: Reject inbound call (requires 11Labs API to hang up)
if (!slotResult.success && callDirection === 'inbound') {
  // Call 11Labs API to terminate call
  await elevenLabsClient.terminateCall(callId);
}
```

**Current Behavior**: 🔴 **Desync risk** - inbound calls can cause slot leakage.

### 2.3) Retry / Reconnect / Edge Cases

**Checked**: ❌ No retry logic found
**Verdict**: ✅ OK - 11Labs handles retries, we don't initiate them

---

## 3) Atomicity & Race Conditions

### 3.1) Counter Storage

**Location**: PostgreSQL `Subscription.activeCalls` column (DB)
**NOT Redis**: ❌ No Redis used

**Trade-off**:
- ✅ Pro: ACID guarantees, no sync issues
- ❌ Con: DB latency (~10-50ms), not sub-millisecond

### 3.2) Atomic Operations

**Acquire Slot** (`concurrentCallManager.js:70-78`):
```javascript
const result = await prisma.subscription.updateMany({
  where: {
    businessId,
    activeCalls: { lt: limit }  // ← Atomic check
  },
  data: {
    activeCalls: { increment: 1 }
  }
});

if (result.count === 0) {
  // Limit exceeded or subscription not found
  return { success: false };
}
```

**Analysis**:
- ✅ **ATOMIC**: `updateMany` is single DB transaction
- ✅ **Compare-and-swap**: Check + increment in one op
- ✅ **Race-safe**: Two simultaneous acquires, only one succeeds
- ⚠️ **Edge case**: If subscription deleted mid-flight, `result.count=0` (handled)

**Release Slot** (`concurrentCallManager.js:115-131`):
```javascript
await prisma.subscription.update({
  where: { businessId },
  data: { activeCalls: { decrement: 1 } }
});

// Safety: prevent negative
await prisma.subscription.updateMany({
  where: { businessId, activeCalls: { lt: 0 } },
  data: { activeCalls: 0 }
});
```

**Analysis**:
- ✅ Decrement is atomic
- ✅ Negative prevention (important!)
- ⚠️ **Two queries**: Small window where `activeCalls` could be -1 briefly

### 3.3) Double Start Prevention

**Scenario**: User clicks "Call" twice rapidly

**Protection**:
1. First click: `updateMany` where `activeCalls < limit` → SUCCESS
2. Second click: `updateMany` where `activeCalls < limit` → Might still succeed if under limit
3. **Result**: ❌ Two calls can start if limit allows

**Mitigation Needed**:
- Application-level request deduplication
- Frontend button disable after click
- Call ID uniqueness check (already exists in 11Labs)

**Verdict**: ⚠️ **Medium risk** - User can burn 2 slots quickly, but not beyond limit.

### 3.4) Webhook Loss & Stuck Slots

**Problem**: What if `call-ended` webhook never arrives?

**Current Mitigation**:
```javascript
async cleanupStuckCalls() {
  const stuckSubscriptions = await prisma.subscription.findMany({
    where: { activeCalls: { gt: 0 } }
  });
  // For now, just log
}
```

**Issues**:
- ❌ **Not scheduled**: Function exists but not called periodically
- ❌ **No TTL**: No timestamp to detect "stuck" (e.g., active for 2+ hours)
- ❌ **No reconciliation**: Doesn't check 11Labs API for actual active calls

**Solution Needed**:
```javascript
// 1. Add lastCallStartedAt timestamp
// 2. Cron job every 10 minutes:
const stuckThreshold = Date.now() - (30 * 60 * 1000); // 30 min
const stuck = await prisma.subscription.findMany({
  where: {
    activeCalls: { gt: 0 },
    lastCallStartedAt: { lt: new Date(stuckThreshold) }
  }
});

// 3. For each stuck, check 11Labs API
for (const sub of stuck) {
  const actualActive = await elevenLabs.getActiveCalls(sub.business.apiKey);
  if (actualActive.count === 0) {
    // Stuck! Force reset
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { activeCalls: 0 }
    });
    console.error(`🔧 Force reset stuck calls for business ${sub.businessId}`);
  }
}
```

**Risk Level**: 🔴 **HIGH** - Stuck slots = lost revenue + customer complaints

---

## 4) Oversubscription Strategy

### 4.1) Current Math

**11Labs Capacity**: `C_total = 5` concurrent calls

**Sold Limits** (example with 5 customers):
- 1x PRO: 5 concurrent
- 1x PRO: 5 concurrent
- 1x STARTER: 1 concurrent
- 2x PAYG: 1 concurrent each

**Total Sold**: `Σ limits = 5 + 5 + 1 + 1 + 1 = 13`

**Oversubscription Ratio**: `R = 13 / 5 = 2.6x`

### 4.2) Risk Analysis

**Spike Scenario**: Both PRO customers call simultaneously
- PRO #1 tries to start 5 calls
- PRO #2 tries to start 5 calls
- **Total demand**: 10 concurrent
- **11Labs capacity**: 5
- **Result**: 🔥 **5 calls will fail with 11Labs rate limit (429)**

**Current Handling**: ❌ **NONE** - No code to handle 11Labs 429 response

### 4.3) Safe Oversubscription Ratio

**Statistical Model**:
- Assume **utilization = 20%** per customer (typical for call centers)
- Expected concurrent = `Σ(limits × 0.2)`
- For 13 total limit: `13 × 0.2 = 2.6` expected concurrent
- Fits in 5 capacity ✅

**Safe Ratio**: `R ≤ 2.5x` for 20% utilization

**Current**: `R = 2.6x` → ⚠️ **Acceptable but tight**

**When to worry**:
- If selling more PRO plans → R increases
- If customer utilization > 20% (e.g., Black Friday) → spike risk

### 4.4) Recommended Model

**Option A: Hard Per-Business + Global Soft Cap** (RECOMMENDED)

```javascript
// Global counter (Redis or DB)
let globalActiveCalls = 0;
const GLOBAL_CAP = 5; // 11Labs capacity

async function acquireSlot(businessId) {
  // 1. Check business limit (hard)
  if (subscription.activeCalls >= limit) {
    return { success: false, error: 'BUSINESS_LIMIT' };
  }

  // 2. Check global capacity (soft - with priority)
  if (globalActiveCalls >= GLOBAL_CAP) {
    // Priority queue: PRO/Enterprise > PAYG
    if (subscription.plan === 'PAYG' || subscription.plan === 'STARTER') {
      return { success: false, error: 'PLATFORM_CAPACITY_FULL' };
    }
    // Allow PRO/Enterprise to go slightly over (queue on 11Labs)
  }

  // 3. Acquire both
  await prisma.subscription.update({ /* increment */ });
  await redis.incr('global:active_calls');
  globalActiveCalls++;

  return { success: true };
}
```

**Option B: Full Global Pool** (NOT RECOMMENDED)
- Hard to implement fairness
- PRO customer paying for 5 slots but might get 1
- Requires complex weighted fair queuing

### 4.5) 11Labs Rate Limit Handling

**Current**: ❌ No handling

**Needed**:
```javascript
// When starting call via 11Labs API
try {
  const call = await elevenLabs.startCall(params);
} catch (error) {
  if (error.status === 429) {
    // Rate limited!
    await concurrentCallManager.releaseSlot(businessId);
    return res.status(503).json({
      error: 'PLATFORM_CAPACITY_EXCEEDED',
      message: 'Platform is at capacity. Please try again in a moment.',
      retryAfter: 30 // seconds
    });
  }
  throw error;
}
```

---

## 5) Fairness & Priority

### 5.1) Current State

**Priority**: ❌ **NONE** - First-come, first-served

**Problem**:
- PAYG customer (1 slot, $0/month) can occupy platform capacity
- PRO customer (5 slots, $167/month) gets blocked
- Result: "I'm paying $167 but can't make calls because free users are using the system"

### 5.2) Minimum Viable Fairness

**Reserved Capacity**:
```javascript
const RESERVED_FOR_PRO = 3; // Reserve 3 of 5 slots for PRO+
const RESERVED_FOR_ENTERPRISE = 2; // Reserve 2 of 5 for Enterprise

async function acquireSlot(businessId, plan) {
  const globalActive = await getGlobalActiveCalls();

  // Tier 1: Enterprise always get reserved slots
  if (plan === 'ENTERPRISE') {
    if (globalActive >= GLOBAL_CAP) {
      return { success: false, error: 'PLATFORM_FULL' };
    }
  }

  // Tier 2: PRO can use PRO+ pool
  if (plan === 'PRO') {
    const proUsage = await getProAndEnterpriseUsage();
    if (proUsage >= (GLOBAL_CAP - RESERVED_FOR_ENTERPRISE)) {
      return { success: false, error: 'PLATFORM_FULL' };
    }
  }

  // Tier 3: PAYG/STARTER only if general pool available
  if (plan === 'PAYG' || plan === 'STARTER') {
    const availableForPayg = GLOBAL_CAP - RESERVED_FOR_PRO - getProAndEnterpriseUsage();
    if (availableForPayg <= 0) {
      return { success: false, error: 'PLATFORM_CAPACITY_FULL_FOR_PLAN' };
    }
  }

  // Proceed with acquire
}
```

**Simpler Alternative**: Weighted probability
- PRO: 80% chance if platform near capacity
- PAYG: 20% chance if platform near capacity

---

## 6) Observability & Alarms

### 6.1) Current State

**Metrics**: ❌ **NONE**
**Alarms**: ❌ **NONE**
**Dashboards**: ❌ **NONE**

**Console Logs Only**:
```javascript
console.log(`✅ Call slot acquired: ${currentActive}/${limit}`);
console.warn(`⚠️ Concurrent limit exceeded for business ${businessId}`);
```

### 6.2) Critical Metrics Needed

**Business-Level**:
```javascript
// Prometheus/Datadog metrics
concurrent_calls_active{business_id, plan}
concurrent_calls_rejected_total{business_id, reason}
concurrent_calls_utilization_percent{business_id}
```

**Global-Level**:
```javascript
platform_concurrent_calls_active
platform_concurrent_capacity_total
platform_elevenlabs_rate_limits_total
platform_stuck_calls_total
```

**Per-Call**:
```javascript
call_duration_seconds{business_id, direction}
call_slot_acquisition_duration_ms
webhook_processing_duration_ms
```

### 6.3) Critical Alarms

**Priority 1 (P1) - Page immediately**:
```
Alert: Global capacity > 90% for 5+ minutes
Alert: Stuck calls detected (active > 30 min)
Alert: 11Labs 429 rate limit received
```

**Priority 2 (P2) - Slack notification**:
```
Alert: Business rejected > 10 calls in 1 hour
Alert: Platform capacity > 80% for 10+ minutes
Alert: Webhook processing latency > 5s
```

**Priority 3 (P3) - Daily digest**:
```
Alert: Oversubscription ratio > 3x
Alert: Any business at 100% utilization for 6+ hours
```

### 6.4) Dashboard Requirements

**Real-time View** (refresh every 5s):
```
┌─────────────────────────────────────────┐
│ PLATFORM CONCURRENT CALLS               │
├─────────────────────────────────────────┤
│ Active: ████████░░ 4/5 (80%)           │
│ 11Labs Capacity: 5                      │
│ Sold Limits Total: 13 (2.6x oversub)   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ TOP 5 BUSINESSES BY USAGE               │
├─────────────────────────────────────────┤
│ Business 123 (PRO):     ████░ 4/5       │
│ Business 456 (PRO):     ███░░ 3/5       │
│ Business 789 (STARTER): █░░░░ 1/1       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ LAST HOUR STATS                         │
├─────────────────────────────────────────┤
│ Calls started: 47                       │
│ Calls rejected (limit): 3               │
│ Calls rejected (capacity): 0            │
│ Stuck calls cleaned: 1                  │
└─────────────────────────────────────────┘
```

---

## 7) Recommendations (Priority Order)

### P0 - CRITICAL (Implement Immediately)

**1. Stuck Call Cleanup Cron Job**
```bash
# Every 10 minutes
*/10 * * * * node /app/scripts/cleanup-stuck-calls.js
```

**Impact**: Prevents slot leakage, lost revenue
**Effort**: 2 hours
**Risk if not done**: 🔴 HIGH - Slots will accumulate, platform becomes unusable

**2. Inbound Call Handling Fix**
```javascript
// Always accept inbound, alert if over limit
if (callDirection === 'inbound') {
  await forceAcquireSlot(businessId);
  if (subscription.activeCalls > limit) {
    await sendAlert('INBOUND_OVER_LIMIT', { businessId, activeCalls, limit });
  }
}
```

**Impact**: Prevents desync
**Effort**: 1 hour
**Risk if not done**: 🟡 MEDIUM - Slot leakage, billing errors

**3. 11Labs Rate Limit Handler**
```javascript
try {
  await elevenLabs.startCall(params);
} catch (error) {
  if (error.status === 429) {
    await releaseSlot(businessId);
    // Send 503 to client with retryAfter
  }
}
```

**Impact**: Graceful degradation
**Effort**: 1 hour
**Risk if not done**: 🟡 MEDIUM - Confusing errors for customers

### P1 - HIGH (Implement This Week)

**4. Basic Observability**
- Add metrics to Datadog/Prometheus
- Create real-time dashboard
- Set up Slack alerts for capacity > 80%

**Impact**: Can see problems before customers complain
**Effort**: 4 hours
**Risk if not done**: 🟡 MEDIUM - Blind to issues

**5. Reserved Capacity for PRO/Enterprise**
```javascript
const RESERVED_PRO = 3;
if (plan === 'PAYG' && globalActive > (GLOBAL_CAP - RESERVED_PRO)) {
  return 'PLATFORM_CAPACITY_FULL_FOR_PLAN';
}
```

**Impact**: Fairness, prevents PRO customer churn
**Effort**: 2 hours
**Risk if not done**: 🟡 MEDIUM - Customer complaints

### P2 - MEDIUM (Implement This Month)

**6. Global Capacity Management**
- Redis-based global counter
- Atomic global capacity check
- Oversubscription ratio monitoring

**Impact**: Prevents 11Labs 429
**Effort**: 1 day

**7. Call Timestamp Tracking**
- Add `lastCallStartedAt` to Subscription
- Use in stuck call detection
- Better analytics

**Impact**: Accurate stuck call detection
**Effort**: 2 hours

### P3 - LOW (Future Enhancement)

**8. Weighted Fair Queuing**
- Priority-based call scheduling
- Per-plan capacity pools
- Advanced fairness algorithms

**Impact**: Optimal resource utilization
**Effort**: 1 week

---

## 8) Testing Checklist

**Before Production**:
- [ ] Simulate 2 PRO customers calling simultaneously (10 calls)
- [ ] Verify 11Labs 429 handling
- [ ] Manually trigger stuck call cleanup
- [ ] Test inbound call during capacity limit
- [ ] Load test: 100 concurrent acquire attempts
- [ ] Verify metrics appear in dashboard
- [ ] Test alarm triggers (manual capacity spike)

---

## 9) Migration Plan (When Upgrading 11Labs)

**Current**: 5 concurrent → **Future**: 10+ concurrent

**Steps**:
1. Update `GLOBAL_CAP` constant
2. Adjust `RESERVED_PRO` capacity
3. Re-evaluate oversubscription ratio
4. No code changes needed ✅

**Backward Compatible**: ✅ Yes

---

## 📊 Summary Table

| Component | Status | Risk | Action Needed |
|-----------|--------|------|---------------|
| Atomic acquire/release | ✅ GOOD | 🟢 LOW | None |
| Source of truth | ✅ GOOD | 🟢 LOW | None |
| Outbound enforcement | ✅ GOOD | 🟢 LOW | None |
| Inbound enforcement | ⚠️ ISSUE | 🟡 MEDIUM | P0: Fix desync |
| Stuck call cleanup | ❌ MISSING | 🔴 HIGH | P0: Add cron job |
| 11Labs rate limit handling | ❌ MISSING | 🟡 MEDIUM | P0: Add 429 handler |
| Oversubscription management | ❌ MISSING | 🟡 MEDIUM | P1: Add global cap |
| Fairness/priority | ❌ MISSING | 🟡 MEDIUM | P1: Reserve capacity |
| Observability | ❌ MISSING | 🟡 MEDIUM | P1: Add metrics |
| Alarms | ❌ MISSING | 🟡 MEDIUM | P1: Add Slack alerts |

**Overall Risk**: 🟡 **MEDIUM-HIGH** - System works but will have issues at scale

**Estimated Effort to Fix P0+P1**: 12 hours

---

## 🎯 Immediate Action Items

1. **Today**: Implement stuck call cleanup cron (2 hours)
2. **This Week**: Add 11Labs 429 handler (1 hour)
3. **This Week**: Fix inbound call desync (1 hour)
4. **This Week**: Basic observability dashboard (4 hours)
5. **Next Week**: Reserved capacity for PRO (2 hours)

**Total**: ~10 hours to move from 🟡 MEDIUM risk to 🟢 LOW risk.

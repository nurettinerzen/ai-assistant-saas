# P0 Concurrent Calls - Deployment Checklist

**Date**: 2026-01-27
**Status**: ✅ Code Complete - Ready for Staging
**Commits**: 75affcd, 50ae69e

---

## Pre-Deployment Checklist

### 1. Environment Variables

**Required**:
```bash
# Redis (Required)
REDIS_URL=redis://your-redis-instance:6379
# Or for production with auth:
REDIS_URL=redis://:password@host:6379

# Existing (already set)
DATABASE_URL=postgresql://...
ELEVENLABS_API_KEY=...
OPENAI_API_KEY=...
```

**Optional** (for tests):
```bash
TEST_AGENT_ID=your_test_agent_id
TEST_PHONE_NUMBER_ID=your_test_phone_number_id
TEST_PHONE_NUMBER=+905551234567
```

### 2. Database Migration

**Already applied** with `prisma db push`:
- ✅ ActiveCallSession table created
- ✅ Business.activeCallSessions relation added

**Verify**:
```bash
cd backend
npx prisma studio
# Check: ActiveCallSession table exists
```

### 3. Dependencies

**Already installed**:
```bash
npm install redis
# Version: ^5.10.0
```

### 4. Redis Setup

**Development**:
```bash
# macOS
brew install redis
redis-server

# Linux
sudo apt-get install redis-server
sudo systemctl start redis
```

**Production** (choose one):
- AWS ElastiCache (Redis)
- Railway Redis
- Upstash Redis (serverless)
- Redis Cloud

**Connection Test**:
```bash
redis-cli ping
# Should return: PONG
```

---

## Deployment Steps

### Step 1: Start Redis

```bash
# Development
redis-server

# Production: Verify REDIS_URL is set
echo $REDIS_URL
```

### Step 2: Build & Deploy

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Start server
npm run dev  # Development
# OR
npm start    # Production
```

### Step 3: Verify Initialization

**Check logs** for:
```
✅ Redis connected
✅ Call cleanup cron started (every 10 minutes)
✅ Metrics service initialized
🎯 Concurrent call system ready
```

**If Redis fails**:
- System will log error but continue (fail-open mode)
- Calls will work but global capacity NOT enforced
- Fix Redis and restart

### Step 4: Test Endpoints

```bash
# Health check
curl http://localhost:3001/health

# Metrics endpoint (requires auth token)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/concurrent-metrics

# Expected response:
{
  "activeCalls": 0,
  "totalRejections": 0,
  "rejectionsByReason": {},
  "rejectionsByPlan": {},
  "elevenlabs429Count": 0,
  "globalStatus": {
    "active": 0,
    "limit": 5,
    "available": 5,
    "utilizationPercent": 0,
    "byPlan": {}
  }
}
```

---

## Post-Deployment Verification

### Quick Smoke Test

```bash
cd backend

# Test 1: Infrastructure
node scripts/test-concurrent-load.js
# Expected: All 3 tests pass

# Test 2: Acceptance (requires 11Labs config)
node scripts/test-p0-acceptance.js
# Expected: Infrastructure checks pass
```

### Manual Tests (Staging)

**Test A: Simultaneous Load**
1. Make 10 concurrent test calls
2. Verify: 5 succeed, 5 get HTTP 503
3. Verify: 503 responses have Retry-After header

**Test B: Inbound Termination**
1. Fill capacity to 5/5 (make 5 test calls)
2. Trigger inbound call (real or simulated webhook)
3. Verify: Call terminated, no 6th active call
4. Check: ActiveCallSession has status='terminated_capacity'
5. Check: Metrics show rejection with reason='capacity_inbound'

**Test C: 11Labs 429**
1. Create burst of calls to trigger rate limit
2. Verify: HTTP 503 returned to client
3. Verify: Slot released (activeCalls decremented)
4. Check: Metrics show elevenlabs_429_total++

**Test D: Crash Safety** (DESTRUCTIVE - staging only)
```bash
# Phase 1: Setup
node scripts/test-crash-safety.js setup
# Note the PID

# Phase 2: Kill process
kill -9 <PID>

# Phase 3: Restart + wait
npm run dev
# Wait 10+ minutes

# Phase 4: Verify
node scripts/test-crash-safety.js verify
# Expected: ✅ All counters = 0, no leaks
```

---

## Monitoring Setup

### 1. Metrics Endpoints

**Summary** (requires auth):
```bash
GET /api/concurrent-metrics
```

**Prometheus** (internal only):
```bash
GET /api/concurrent-metrics/prometheus
```

**Status** (detailed):
```bash
GET /api/concurrent-metrics/status
```

### 2. Alerts (Recommended)

**High Capacity Alert**:
```
platform_global_active_calls >= 4
```
Action: Warn - 80% utilization

**Rejection Rate Alert**:
```
rate(concurrent_rejected_total[5m]) > 10
```
Action: Investigate capacity planning

**11Labs 429 Alert**:
```
elevenlabs_429_total > 0
```
Action: Check provider rate limits

**Stuck Calls Alert**:
```
active_call_sessions_count - subscription_active_calls_sum > 5
```
Action: Check cleanup cron logs

### 3. Dashboards

**Key Metrics to Track**:
- `platform_global_active_calls` (gauge) - Current active calls
- `concurrent_rejected_total` (counter) - Rejections by reason + plan
- `elevenlabs_429_total` (counter) - Provider rate limits
- ActiveCallSession count vs subscription.activeCalls (consistency check)

---

## Rollback Plan

### If Issues Occur

**Option 1: Disable Redis (Fail-Open)**
```bash
# Stop Redis or clear REDIS_URL
unset REDIS_URL
# Restart server
# Global capacity NOT enforced, but calls work
```

**Option 2: Revert Commits**
```bash
git revert 50ae69e  # Revert production-ready changes
git revert 75affcd  # Revert P0 infrastructure
git push origin main
```

**Option 3: Force Reset**
```bash
# In Node REPL or emergency script
import globalCapacityManager from './src/services/globalCapacityManager.js';
await globalCapacityManager.connect();
await globalCapacityManager.forceReset();
```

---

## Known Limitations

1. **Priority**: First-come-first-served
   - PRO has higher limit (3 vs 1) but no queue priority
   - Future: Implement priority queue (P1/P2)

2. **Inbound Webhook**: Requires 11Labs webhook configured
   - URL: `https://your-domain.com/api/webhooks/elevenlabs`
   - Events: conversation.started, conversation.ended

3. **Batch Calls**: Uses separate 11Labs API
   - Not subject to individual call capacity limits
   - Has its own rate limiting

4. **Demo Calls**: Reserved businessId=999999
   - High concurrency limit (999)
   - Shares global capacity pool

---

## Troubleshooting

### Issue: "Redis connection failed"

**Symptoms**:
```
❌ Redis error: ECONNREFUSED
⚠️  Calls may fail if Redis is not available
```

**Fix**:
```bash
# Check Redis running
redis-cli ping

# Check REDIS_URL
echo $REDIS_URL

# Start Redis
redis-server
```

### Issue: "All calls rejected at startup"

**Symptoms**: All calls return 503 immediately

**Possible Causes**:
1. Leftover state from previous run
2. Redis not cleared on restart

**Fix**:
```bash
# In Node REPL
import globalCapacityManager from './src/services/globalCapacityManager.js';
await globalCapacityManager.connect();
await globalCapacityManager.forceReset();
```

### Issue: "Stuck calls never clean up"

**Symptoms**: ActiveCallSession count keeps growing

**Check**:
```bash
# Verify cleanup cron is running
# Check server logs for:
"🧹 [CLEANUP CRON] Starting stuck call reconciliation..."

# Manually trigger cleanup
import { triggerCleanupNow } from './src/services/callCleanupCron.js';
await triggerCleanupNow();
```

### Issue: "Negative activeCalls count"

**Symptoms**: subscription.activeCalls < 0

**Fix**: Cleanup cron auto-corrects to 0
```sql
-- Or manually fix in DB
UPDATE "Subscription"
SET "activeCalls" = 0
WHERE "activeCalls" < 0;
```

---

## Success Criteria

### Deployment is successful when:

- ✅ Server starts without errors
- ✅ Redis connection established (log: "✅ Redis connected")
- ✅ Cleanup cron started (log: "✅ Call cleanup cron started")
- ✅ Metrics endpoint returns 200
- ✅ Test call succeeds (POST to test endpoint)
- ✅ Capacity limit enforced (6th call gets 503 when 5 active)

### Ready for production when:

- ✅ All automated tests pass
- ✅ Manual Test A passed (10 → 5 succeed)
- ✅ Manual Test B passed (inbound terminated)
- ✅ Manual Test C passed (429 → 503)
- ✅ Manual Test D passed (crash → cleanup → 0 leaks)
- ✅ 24-hour staging run with no issues

---

## Emergency Contacts & Docs

**Documentation**:
- Full implementation: `/P0_CONCURRENT_IMPLEMENTATION.md`
- Action plan: `/CONCURRENT_CALL_ACTION_PLAN.md`
- Analysis: `/CONCURRENT_CALL_ANALYSIS.md`

**Key Files**:
- Global capacity: `src/services/globalCapacityManager.js`
- Safe initiator: `src/services/safeCallInitiator.js`
- Cleanup cron: `src/services/callCleanupCron.js`
- Metrics: `src/services/metricsService.js`
- Webhook handler: `src/routes/elevenlabs.js`

**Test Scripts**:
- Load test: `scripts/test-concurrent-load.js`
- Acceptance: `scripts/test-p0-acceptance.js`
- Crash safety: `scripts/test-crash-safety.js`

---

**Last Updated**: 2026-01-27
**Version**: P0 Complete (commits 75affcd, 50ae69e)
**Status**: ✅ Ready for Staging Deployment

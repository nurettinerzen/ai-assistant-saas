# P0-3 Staging Validation - MANDATORY

**CRITICAL**: Bu 3 senaryo production'a çıkmadan MUTLAKA test edilmeli.

## Test Ortamı Hazırlığı

1. **DB**: Staging/replica database kullan (PRODUCTION DEĞİL)
2. **Test Account**: STARTER plan subscription oluştur
3. **Initial State**:
   ```sql
   -- Test subscription oluştur
   INSERT INTO Subscription (businessId, plan, status, balance, includedMinutesUsed, overageMinutes, concurrentLimit)
   VALUES (?, 'STARTER', 'ACTIVE', 0, 0, 0, 1);
   ```

## Pricing Reference (TR)
- STARTER plan: 23 TL/dk (balance/overage rate)
- STARTER included: 150 dk/month
- STARTER overage limit: 200 dk

---

## ✅ Senaryo 1: Balance + Included (Split Billing)

### Setup
```sql
UPDATE Subscription
SET balance = 100, includedMinutesUsed = 0
WHERE id = ?;
```

### Test: 10 dakika call
**Matematik**:
- 10 dk × 23 TL/dk = 230 TL gerekli
- Balance: 100 TL → 100/23 = 4.35 dk
- Included: 150 dk available → 10 - 4.35 = 5.65 dk

### API Call
```bash
POST /api/usage/record
{
  "subscriptionId": 1,
  "channel": "PHONE",
  "callId": "test-call-001",
  "durationSeconds": 600,  # 10 minutes
  "assistantId": "..."
}
```

### Beklenen Sonuç

**Response**:
```json
{
  "success": true,
  "usageRecord": {
    "chargeType": "BALANCE_INCLUDED",
    "totalCharge": 100,  // Balance kesintisi (immediate)
    "metadata": {
      "chargeBreakdown": {
        "fromBalance": 4.35,
        "balanceCharge": 100,
        "fromIncluded": 5.65,
        "overageMinutes": 0
      }
    }
  }
}
```

**Database Verification**:
```sql
-- 1. Subscription updated
SELECT balance, includedMinutesUsed, overageMinutes
FROM Subscription WHERE id = ?;
-- Expected: balance=0, includedMinutesUsed=5.65, overageMinutes=0

-- 2. UsageRecord created
SELECT callId, chargeType, totalCharge, metadata
FROM UsageRecord WHERE subscriptionId = ? AND callId = 'test-call-001';
-- Expected: chargeType='BALANCE_INCLUDED', totalCharge=100

-- 3. BalanceTransaction created
SELECT type, amount, description
FROM BalanceTransaction WHERE subscriptionId = ? AND usageRecordId = ?;
-- Expected: type='USAGE', amount=-100, description contains '4.35 min'
```

**Pass Criteria**:
- ✅ Balance: 100 → 0
- ✅ includedMinutesUsed: 0 → 5.65
- ✅ overageMinutes: 0 (unchanged)
- ✅ UsageRecord.totalCharge = 100 (balance kesintisi)
- ✅ metadata.chargeBreakdown.fromBalance ≈ 4.35
- ✅ metadata.chargeBreakdown.fromIncluded ≈ 5.65

---

## ✅ Senaryo 2: Included Exhausted → Overage

### Setup
```sql
UPDATE Subscription
SET balance = 0, includedMinutesUsed = 150, overageMinutes = 0
WHERE id = ?;
```

### Test: 10 dakika call
**Matematik**:
- Balance: 0 → No balance available
- Included: 150/150 used → No included available
- → 10 dk goes to OVERAGE (postpaid)

### API Call
```bash
POST /api/usage/record
{
  "subscriptionId": 1,
  "channel": "PHONE",
  "callId": "test-call-002",
  "durationSeconds": 600
}
```

### Beklenen Sonuç

**Response**:
```json
{
  "success": true,
  "usageRecord": {
    "chargeType": "OVERAGE",
    "totalCharge": 0,  // No immediate charge (postpaid)
    "metadata": {
      "chargeBreakdown": {
        "fromBalance": 0,
        "balanceCharge": 0,
        "fromIncluded": 0,
        "overageMinutes": 10,
        "overageRate": 23
      }
    }
  }
}
```

**Database Verification**:
```sql
-- 1. Subscription updated
SELECT balance, includedMinutesUsed, overageMinutes
FROM Subscription WHERE id = ?;
-- Expected: balance=0, includedMinutesUsed=150, overageMinutes=10

-- 2. UsageRecord created
SELECT callId, chargeType, totalCharge, metadata
FROM UsageRecord WHERE subscriptionId = ? AND callId = 'test-call-002';
-- Expected: chargeType='OVERAGE', totalCharge=0

-- 3. NO BalanceTransaction (no immediate charge)
SELECT COUNT(*)
FROM BalanceTransaction WHERE usageRecordId = ?;
-- Expected: 0 (overage billed at month end)
```

**Pass Criteria**:
- ✅ Balance: 0 (unchanged)
- ✅ includedMinutesUsed: 150 (unchanged)
- ✅ overageMinutes: 0 → 10
- ✅ UsageRecord.totalCharge = 0 (no immediate charge)
- ✅ metadata.chargeBreakdown.overageMinutes = 10
- ✅ Call completed (NOT blocked)

**Month-End Billing Verification** (optional):
```sql
-- Simulate cron job
SELECT overageMinutes * 23 as overageAmount
FROM Subscription WHERE id = ?;
-- Expected: 10 * 23 = 230 TL will be invoiced
```

---

## ✅ Senaryo 3: Duplicate callId (Idempotency)

### Setup
```sql
UPDATE Subscription
SET balance = 100, includedMinutesUsed = 0
WHERE id = ?;
```

### Test: Same callId twice

### API Call 1 (First request)
```bash
POST /api/usage/record
{
  "subscriptionId": 1,
  "channel": "PHONE",
  "callId": "test-call-003",
  "durationSeconds": 300  # 5 minutes
}
```

**Expected Result 1**:
```json
{
  "success": true,
  "usageRecord": { ... },
  "idempotent": undefined  // Not present = new record
}
```

### API Call 2 (Duplicate request - SAME callId)
```bash
POST /api/usage/record
{
  "subscriptionId": 1,
  "channel": "PHONE",
  "callId": "test-call-003",  # SAME as Call 1
  "durationSeconds": 300
}
```

**Expected Result 2**:
```json
{
  "success": true,
  "usageRecord": { ... },  // Returns EXISTING record
  "idempotent": true       // Flag indicating duplicate
}
```

### Beklenen Sonuç

**Response Status**:
- ✅ First request: 200 OK
- ✅ Second request: 200 OK (NOT 500, NOT 409)

**Database Verification**:
```sql
-- 1. Only ONE UsageRecord created
SELECT COUNT(*)
FROM UsageRecord WHERE callId = 'test-call-003';
-- Expected: 1 (not 2)

-- 2. Balance deducted ONCE
SELECT balance FROM Subscription WHERE id = ?;
-- Expected: 100 - (5 * 23) = 100 - 115 = -15? NO!
-- If balance < totalCharge, split billing applies:
--   5 min * 23 = 115 TL needed
--   Balance: 100 TL → 100/23 = 4.35 min
--   Included: 0.65 min
-- Expected: balance = 0, includedMinutesUsed = 0.65

-- After second request (duplicate):
SELECT balance, includedMinutesUsed FROM Subscription WHERE id = ?;
-- Expected: UNCHANGED (balance=0, includedMinutesUsed=0.65)

-- 3. Only ONE BalanceTransaction
SELECT COUNT(*)
FROM BalanceTransaction WHERE usageRecordId = ?;
-- Expected: 1 (not 2)
```

**Pass Criteria**:
- ✅ First request creates UsageRecord
- ✅ Second request returns 200 (not 500)
- ✅ Second request response includes `idempotent: true`
- ✅ Only 1 UsageRecord in DB
- ✅ Balance deducted ONCE (not twice)
- ✅ NO negative balance
- ✅ NO duplicate BalanceTransaction

---

## 🚨 Critical Checks (All Scenarios)

### 1. Negative Balance Protection
```sql
SELECT id, businessId, balance
FROM Subscription
WHERE balance < 0;
```
**MUST return 0 rows** - Negative balance should NEVER occur.

### 2. Race Condition Test (Optional - Advanced)
Send 10 concurrent requests with SAME callId:
```bash
for i in {1..10}; do
  curl -X POST /api/usage/record -d '{"callId":"race-test-001",...}' &
done
wait
```

**Expected**:
- Only 1 UsageRecord created
- All requests return 200
- No 500 errors
- Balance deducted once

---

## Test Execution Checklist

- [ ] Senaryo 1: Split billing (balance + included) ✅
- [ ] Senaryo 2: Overage tracking ✅
- [ ] Senaryo 3: Idempotency (duplicate callId) ✅
- [ ] Negative balance check: 0 rows ✅
- [ ] Race condition test (optional) ✅

---

## Test Results Template

Copy to PR:

```
## Staging Validation Results

### Senaryo 1: Split Billing
- [x] Balance deducted correctly: 100 → 0
- [x] includedMinutesUsed increased: 0 → 5.65
- [x] UsageRecord.totalCharge = 100
- [x] metadata.chargeBreakdown correct
- Screenshot: [attach]

### Senaryo 2: Overage
- [x] overageMinutes increased: 0 → 10
- [x] UsageRecord.totalCharge = 0 (postpaid)
- [x] Call completed (not blocked)
- Screenshot: [attach]

### Senaryo 3: Idempotency
- [x] Duplicate request returns 200 + idempotent:true
- [x] Balance NOT double-deducted
- [x] Only 1 UsageRecord created
- Screenshot: [attach]

### Critical Checks
- [x] No negative balances: 0 rows
- [x] No 500 errors in logs

✅ All scenarios passed. Ready for production.
```

---

## Rollback Plan

If ANY scenario fails:
1. **DO NOT deploy to production**
2. Revert changes: `git revert <commit-hash>`
3. Investigate failure root cause
4. Fix and re-test

**Feature Flag**: If deployed with bug, immediately disable:
```bash
# .env
BALANCE_PRIORITY_ENABLED=false  # If feature flag exists
```

---

## Post-Deployment Monitoring

After production deployment:
```sql
-- Monitor negative balances (should be 0)
SELECT COUNT(*) FROM Subscription WHERE balance < 0;

-- Monitor duplicate callIds (should be caught)
SELECT callId, COUNT(*)
FROM UsageRecord
GROUP BY callId
HAVING COUNT(*) > 1;

-- Monitor overage accumulation
SELECT plan, AVG(overageMinutes), MAX(overageMinutes)
FROM Subscription
WHERE plan IN ('STARTER', 'PRO')
GROUP BY plan;
```

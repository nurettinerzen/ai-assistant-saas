# Chat Rate Limiting Deployment Guide

## ⚠️ CRITICAL: Deploy in Correct Order

This feature introduces database schema changes and rate limiting logic.
**Improper deployment can block all users from chat.**

---

## 📋 Pre-Deployment Checklist

- [ ] Database backup taken
- [ ] Rollback plan ready
- [ ] Monitoring/alerts configured
- [ ] Team notified of deployment window

---

## 🚀 Deployment Steps

### Step 1: Deploy Code (Feature Flag OFF)

```bash
# 1. Set feature flag to DISABLED in production .env
CHAT_RATE_LIMITING_ENABLED=false

# 2. Deploy code
git pull origin main
npm install
pm2 restart all  # or your deployment command
```

**Validation:**
- ✅ App starts without errors
- ✅ Existing chat functionality works
- ✅ No rate limiting applied (feature flag off)

---

### Step 2: Run Database Migration

```bash
cd backend

# Apply schema changes (adds columns, no data modification)
npx prisma migrate deploy

# Verify migration succeeded
npx prisma db pull
```

**New columns added:**
- `chatTokensUsed` (Int, default 0)
- `chatTokensResetAt` (DateTime, nullable)
- `chatTokensLimit` (Int, default 0)
- `chatDailyMessageDate` (DateTime, nullable)
- `chatDailyMessageCount` (Int, default 0)

**Validation:**
```sql
-- Check schema
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'Subscription'
  AND column_name LIKE 'chat%';

-- Should show 5 new columns
```

---

### Step 3: Run Backfill Script

```bash
# This sets proper limits for each plan
node scripts/backfill-chat-limits.js
```

**What it does:**
- Sets `chatTokensLimit` based on plan (100k-10M tokens)
- Sets `chatTokensResetAt` to `currentPeriodEnd` (or +30 days)
- Initializes `chatTokensUsed = 0`
- Resets daily counters

**Expected output:**
```
🔄 Starting chat limits backfill...

📊 Found 1,234 subscriptions to update

✅ Business A (TRIAL): 100,000 tokens/month, resets 2026-02-01
✅ Business B (STARTER): 2,000,000 tokens/month, resets 2026-02-15
...

🎉 Backfill complete: 1,234 success, 0 errors

📊 Summary by plan:
   TRIAL: 45 subscriptions → 100,000 tokens/month
   PAYG: 123 subscriptions → 1,000,000 tokens/month
   STARTER: 890 subscriptions → 2,000,000 tokens/month
   PRO: 176 subscriptions → 5,000,000 tokens/month
```

**Validation:**
```sql
-- Check limits set correctly
SELECT plan, COUNT(*), AVG("chatTokensLimit")
FROM "Subscription"
GROUP BY plan;

-- Verify no NULL reset dates for active subs
SELECT COUNT(*)
FROM "Subscription"
WHERE status = 'active'
  AND plan IN ('STARTER', 'PRO', 'ENTERPRISE')
  AND "chatTokensResetAt" IS NULL;
-- Should return 0
```

---

### Step 4: Enable Feature Flag (Gradual Rollout)

**Option A: Immediate (All Users)**
```bash
# Update .env
CHAT_RATE_LIMITING_ENABLED=true

# Restart app
pm2 restart all
```

**Option B: Gradual (Code-based Canary)**
```javascript
// In chatRateLimiter.js, modify feature flag check:
const rateLimitingEnabled =
  process.env.CHAT_RATE_LIMITING_ENABLED === 'true' ||
  businessId % 10 === 0;  // 10% of users (based on ID)

// After 1 hour, if stable:
// - Increase to 50%: businessId % 2 === 0
// - After another hour, enable for all
```

---

### Step 5: Monitor

**Key Metrics to Watch:**

1. **Block Rate**
```sql
-- How many businesses hitting limits daily
SELECT DATE("chatDailyMessageDate"), COUNT(*)
FROM "Subscription"
WHERE "chatDailyMessageCount" >= (
  CASE plan
    WHEN 'TRIAL' THEN 200
    WHEN 'PAYG' THEN 1000
    WHEN 'STARTER' THEN 2000
    WHEN 'PRO' THEN 5000
    ELSE 10000
  END
)
GROUP BY DATE("chatDailyMessageDate");
```

2. **Token Usage**
```sql
-- Businesses approaching monthly token limit
SELECT plan, COUNT(*)
FROM "Subscription"
WHERE "chatTokensUsed"::float / NULLIF("chatTokensLimit", 0) > 0.8
GROUP BY plan;
```

3. **Application Logs**
```bash
# Watch for rate limit rejections
pm2 logs | grep "DAILY_MESSAGE_LIMIT_EXCEEDED\|MONTHLY_TOKEN_LIMIT_EXCEEDED"
```

**Expected Initial Impact:**
- 0-5% of users blocked (if limits are generous)
- Spike in support tickets if limits too low
- Cost reduction as bot/spam traffic blocked

---

## 🔥 Rollback Procedure

If issues arise:

### Immediate: Disable Feature
```bash
# .env
CHAT_RATE_LIMITING_ENABLED=false

pm2 restart all
```
**Effect:** Rate limiting disabled, all users can chat again

### Full Rollback (if needed)
```bash
# Revert code
git revert <commit-hash>
git push

# Revert migration (DANGEROUS - data loss)
npx prisma migrate resolve --rolled-back <migration-name>

# Deploy old code
pm2 restart all
```

---

## 📊 Success Criteria

- ✅ No increase in error rate
- ✅ <5% of active users blocked
- ✅ No spike in "can't send message" support tickets
- ✅ Chat token costs reduced by 10-30% (bot traffic eliminated)

---

## 🛡️ Safety Checks

Before enabling:
```bash
# 1. Check backfill completed
SELECT COUNT(*) FROM "Subscription" WHERE "chatTokensLimit" = 0;
# Should be 0 (or only FREE plan)

# 2. Check reset dates set
SELECT COUNT(*) FROM "Subscription"
WHERE status = 'active' AND "chatTokensResetAt" IS NULL;
# Should be 0 for paid plans

# 3. Dry run: Count how many would be blocked
SELECT plan, COUNT(*)
FROM "Subscription"
WHERE "chatTokensUsed" >= "chatTokensLimit" AND "chatTokensLimit" > 0
GROUP BY plan;
# Should be 0 or very low
```

---

## 🐛 Common Issues

### Issue: All users blocked
**Cause:** `chatTokensLimit = 0` for paid plans
**Fix:**
```sql
-- Emergency: Set reasonable limits
UPDATE "Subscription"
SET "chatTokensLimit" = CASE plan
  WHEN 'TRIAL' THEN 100000
  WHEN 'PAYG' THEN 1000000
  WHEN 'STARTER' THEN 2000000
  WHEN 'PRO' THEN 5000000
  ELSE 10000000
END
WHERE "chatTokensLimit" = 0 AND plan != 'FREE';
```

### Issue: Limits resetting daily
**Cause:** `chatTokensResetAt` in the past
**Fix:**
```sql
-- Set reset date to future
UPDATE "Subscription"
SET "chatTokensResetAt" = "currentPeriodEnd"
WHERE "chatTokensResetAt" < NOW();
```

### Issue: Race condition causing limit bypass
**Symptom:** `chatDailyMessageCount` exceeds limit
**Fix:** Already implemented with atomic increment
**Verify:**
```sql
-- Check for counts > limit
SELECT business.name, s.plan, s."chatDailyMessageCount",
  CASE s.plan
    WHEN 'TRIAL' THEN 200
    WHEN 'PAYG' THEN 1000
    WHEN 'STARTER' THEN 2000
    WHEN 'PRO' THEN 5000
    ELSE 10000
  END as limit
FROM "Subscription" s
JOIN "Business" business ON s."businessId" = business.id
WHERE s."chatDailyMessageCount" > (
  CASE s.plan
    WHEN 'TRIAL' THEN 200
    WHEN 'PAYG' THEN 1000
    WHEN 'STARTER' THEN 2000
    WHEN 'PRO' THEN 5000
    ELSE 10000
  END
);
```

---

## 📞 Support Response Templates

**User: "I can't send messages anymore"**
```
Hi [User],

You've reached your daily message limit for the [PLAN] plan (X messages/day).

Options:
1. Wait until tomorrow (limit resets at midnight UTC)
2. Upgrade to [NEXT_PLAN] for higher limits (Y messages/day)

Current usage: X/Y messages today
```

**User: "This is ridiculous, I need unlimited messages"**
```
Hi [User],

Rate limits prevent abuse and keep costs sustainable. Your current plan includes:
- X messages/day
- Y tokens/month

For unlimited messaging, please contact sales@telyx.ai for Enterprise pricing.
```

---

## 🎯 Next Steps After Stable

1. **Analytics Dashboard**: Show usage stats to users
2. **Email Warnings**: Notify at 80% limit
3. **Overage Option**: Allow paid users to purchase token packs
4. **Adjust Limits**: Based on real usage data

---

## 📝 Deployment Checklist

- [ ] Code deployed with feature flag OFF
- [ ] Schema migration applied
- [ ] Backfill script run successfully
- [ ] Validation queries passed
- [ ] Feature flag enabled (gradual or full)
- [ ] Monitoring dashboard setup
- [ ] Support team briefed
- [ ] Rollback plan tested

**Deployment Team Sign-off:**
- Developer: _______________
- DevOps: _______________
- Support Lead: _______________

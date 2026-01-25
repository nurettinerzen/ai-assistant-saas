# Phase 4 Deployment Checklist - EXECUTIVE

**Status:** READY FOR PILOT EXECUTION
**Date:** 2026-01-25

---

## ✅ PRE-DEPLOYMENT (COMPLETED)

###  1. Database Migrations ✅

**Applied:**
- ✅ emailRagMinConfidence field (Business table)
- ✅ Composite indexes (EmailEmbedding_retrieval_idx, language_idx, content_hash_idx)
- ✅ PilotBusiness table (feature flag allowlist)

**Verification:**
```bash
node scripts/verify-phase4-migrations.js
```

**Expected Output:**
```
🎉 All 3 migrations verified successfully!
  ✅ emailRagMinConfidence field
  ✅ Composite indexes (3/3)
  ✅ PilotBusiness table
```

---

### 2. Dashboard Backend ✅

**Implemented:**
- ✅ `/api/admin/email-rag/metrics/overview` - High-level metrics
- ✅ `/api/admin/email-rag/metrics/verification-rate` - By intent
- ✅ `/api/admin/email-rag/metrics/edit-distance` - Quality distribution
- ✅ `/api/admin/email-rag/pilot-businesses` - List pilots
- ✅ `/api/admin/email-rag/pilot-businesses/:id/enable` - Add to pilot
- ✅ `/api/admin/email-rag/rollback` - Emergency rollback
- ✅ `/api/admin/email-rag/health` - Health check

**Test:**
```bash
curl http://localhost:3001/api/admin/email-rag/health
```

**Expected:**
```json
{"success":true,"status":"healthy","database":"connected"}
```

---

### 3. Test Suite ✅

**Split into 2 modes:**

**Unit Tests (CI-friendly, no DB):**
```bash
npm run test:unit
```
Tests: Recipient guard, CRLF injection, PII redaction, token budget, tool whitelist

**E2E Tests (DB required):**
```bash
npm run test:e2e
```
Tests: Full orchestrator flow with tool mocks

---

## 🚀 PILOT EXECUTION (YOUR TURN)

### Step 1: Select 2 Pilot Businesses

**Criteria:**
- Low email volume (<100 emails/day)
- Responsive contact (can give feedback)
- Different verticals (e.g., e-commerce + appointments)

**Get Business IDs:**
```sql
SELECT id, name, email FROM "Business"
WHERE suspended = false
ORDER BY name LIMIT 10;
```

**Record:**
- Business 1 ID: `_______________`
- Business 1 Name: `_______________`
- Business 2 ID: `_______________`
- Business 2 Name: `_______________`

---

### Step 2: Add to Pilot Allowlist

**Option A: Via API**
```bash
# Business 1
curl -X POST http://localhost:3001/api/admin/email-rag/pilot-businesses/<BUSINESS_1_ID>/enable \
  -H "Content-Type: application/json" \
  -d '{"feature":"RAG_PILOT","enabledBy":"admin@yourcompany.com","notes":"Initial pilot - e-commerce"}'

# Business 2
curl -X POST http://localhost:3001/api/admin/email-rag/pilot-businesses/<BUSINESS_2_ID>/enable \
  -H "Content-Type: application/json" \
  -d '{"feature":"RAG_PILOT","enabledBy":"admin@yourcompany.com","notes":"Initial pilot - appointments"}'
```

**Option B: Via Direct SQL**
```sql
-- Enable pilot feature flags
INSERT INTO "PilotBusiness" ("id", "businessId", "feature", "enabledBy", "notes")
VALUES
  (gen_random_uuid(), <BUSINESS_1_ID>, 'RAG_PILOT', 'admin@yourcompany.com', 'Initial pilot - low volume e-commerce'),
  (gen_random_uuid(), <BUSINESS_2_ID>, 'RAG_PILOT', 'admin@yourcompany.com', 'Initial pilot - appointment booking');

-- Enable business-level RAG flags
UPDATE "Business"
SET "emailRagEnabled" = true,
    "emailSnippetsEnabled" = true,
    "emailRagMinConfidence" = 0.7,
    "emailRagMaxExamples" = 3
WHERE "id" IN (<BUSINESS_1_ID>, <BUSINESS_2_ID>);
```

**Verify:**
```bash
curl http://localhost:3001/api/admin/email-rag/pilot-businesses
```

**Expected:**
```json
{
  "success": true,
  "feature": "RAG_PILOT",
  "pilots": [
    {"businessId": 123, "businessName": "Business 1", "enabledAt": "..."},
    {"businessId": 456, "businessName": "Business 2", "enabledAt": "..."}
  ]
}
```

---

### Step 3: Backfill Embeddings (90 Days)

**Run for each pilot business:**
```bash
node scripts/backfill-embeddings.js --businessId=<BUSINESS_1_ID> --days=90
node scripts/backfill-embeddings.js --businessId=<BUSINESS_2_ID> --days=90
```

**Expected Output:**
```
✅ [Backfill] Complete: processed=847, skipped=12, errors=0
📊 [Backfill] Summary: {"processed":847,"skipped":12,"errors":0,"total":859,"successRate":99}
```

**Verify Embeddings:**
```sql
SELECT
  "businessId",
  COUNT(*) as embedding_count,
  MIN("sentAt") as oldest,
  MAX("sentAt") as newest
FROM "EmailEmbedding"
WHERE "businessId" IN (<BUSINESS_1_ID>, <BUSINESS_2_ID>)
GROUP BY "businessId";
```

---

## 📊 MONITORING (48 HOURS)

### Dashboard Access

**URL:** `http://localhost:3001/api/admin/email-rag/metrics/overview`

**Monitor:**
1. **Draft Success Rate** - Target: >95%
2. **Hallucination Count** - Target: 0
3. **RAG Hit Rate** - Target: >60%
4. **RAG Latency P95** - Target: <200ms
5. **Approval Rate** - Target: >70%

**Check every 6 hours for first 48h**

---

## 🚨 ROLLBACK PROCEDURES

### Level 1: Single Business Rollback

**When:** Quality issue for specific business

**Execute:**
```sql
-- Disable for business 123
UPDATE "Business"
SET "emailRagEnabled" = false, "emailSnippetsEnabled" = false
WHERE "id" = 123;

DELETE FROM "PilotBusiness" WHERE "businessId" = 123 AND "feature" = 'RAG_PILOT';
```

**Verify:**
```bash
curl http://localhost:3001/api/admin/email-rag/pilot-businesses
# Business 123 should not appear
```

**Time:** <2 minutes

---

### Level 2: Cohort Rollback

**When:** Systemic issue affecting multiple pilots

**Execute:**
```sql
-- Disable all pilots added today
DELETE FROM "PilotBusiness"
WHERE "feature" = 'RAG_PILOT'
  AND "enabledAt" >= CURRENT_DATE;

UPDATE "Business"
SET "emailRagEnabled" = false, "emailSnippetsEnabled" = false
WHERE "id" IN (
  SELECT "businessId" FROM "PilotBusiness" WHERE "feature" = 'RAG_PILOT'
);
```

**Time:** <5 minutes

---

### Level 3: EMERGENCY GLOBAL ROLLBACK

**When:**
- Hallucination detected
- Security incident (PII leak, injection bypass)
- Retrieval timeout spike (>10%)
- Critical bug

**Execute (Option A - API):**
```bash
curl -X POST http://localhost:3001/api/admin/email-rag/rollback \
  -H "Content-Type: application/json" \
  -d '{"feature":"RAG_PILOT","reason":"Hallucination incident - immediate rollback"}'
```

**Execute (Option B - Direct SQL):**
```sql
-- EMERGENCY ROLLBACK
BEGIN;

-- Delete ALL pilot entries
DELETE FROM "PilotBusiness" WHERE "feature" = 'RAG_PILOT';

-- Disable RAG globally
UPDATE "Business" SET "emailRagEnabled" = false, "emailSnippetsEnabled" = false;

COMMIT;
```

**Verify:**
```bash
curl http://localhost:3001/api/admin/email-rag/pilot-businesses
# Should return: {"pilots": []}

curl http://localhost:3001/api/admin/email-rag/metrics/overview
# ragHitRate should be 0%
```

**Time:** <5 minutes
**Effect:** Draft generation falls back to Phase 2 core flow (no RAG/snippets)

---

## ✅ SUCCESS CRITERIA (48H Monitoring)

**Phase 4 pilot is SUCCESSFUL if:**

1. ✅ **Draft Success Rate >95%** (no increase in errors)
2. ✅ **Hallucination Count = 0** (NO factual claims without tool data)
3. ✅ **RAG Hit Rate >60%** (retrieval working)
4. ✅ **RAG Latency P95 <200ms** (performance acceptable)
5. ✅ **Approval Rate >70%** (users finding value)
6. ✅ **No security incidents** (PII redaction, injection blocking working)
7. ✅ **Retrieval timeout count <5%** (2s abort working)
8. ✅ **Tool validation errors = 0** (whitelist preserving required fields)

**If ANY criterion fails → Execute appropriate rollback level**

---

## 📋 DAILY CHECKLIST (48H Monitoring Period)

### Morning (9 AM)

- [ ] Check `/api/admin/email-rag/metrics/overview`
- [ ] Verify hallucination count = 0
- [ ] Check approval rate trend (increasing/stable/decreasing)
- [ ] Review any error logs

### Evening (6 PM)

- [ ] Check `/api/admin/email-rag/metrics/verification-rate`
- [ ] Verify no verification rate spike (>60% = issue)
- [ ] Check edit distance distribution (>60% in 0-30% band)
- [ ] Review pilot business feedback (if any)

### Issues → Immediate Action

**Hallucination:**
- ❌ IMMEDIATE Level 3 rollback
- Document incident
- Review tool results + classification

**High Verification Rate (>60%):**
- ⚠️ Check tool integration status
- Verify customer data lookup working
- May indicate tool configuration issue

**Low Approval Rate (<60%):**
- ⚠️ Review draft quality
- Check if RAG examples relevant
- May need to adjust emailRagMinConfidence threshold

---

## 🎯 EXPANSION CRITERIA (After 48H Success)

**IF all success criteria met for 48h:**

### Day 5-6: Expand to 5 Businesses

**Add 3 more businesses:**
```bash
# Repeat Step 2-3 for 3 new businesses
```

**Monitor for another 48h**

### Week 2: Expand to 10-20 Businesses (10%)

**Gradual rollout:**
- Week 2: 10% of businesses
- Week 3: 25% of businesses
- Week 4: 50% of businesses
- Week 5+: 100% (full production)

**Each expansion requires:**
- 7 days stable at previous level
- All success criteria met
- No security incidents

---

## 📞 INCIDENT RESPONSE

### P0 (Critical - Immediate Rollback)

- Hallucination detected
- PII leak
- Security breach
- Data loss

**Action:** Level 3 rollback within 5 minutes

### P1 (High - Monitor Closely)

- Retrieval timeout spike (>10%)
- Approval rate drop (>20%)
- Tool validation errors (>1%)

**Action:** Level 2 rollback if not resolved in 2 hours

### P2 (Medium - Fix Forward)

- RAG hit rate drop (<30%)
- Edit distance regression (>40% in >50% band)
- Performance degradation (p95 >500ms)

**Action:** Investigate + fix, no immediate rollback

---

## 📝 POST-PILOT REPORT (After 7 Days)

**Required metrics:**
- Total drafts generated (pilot businesses)
- Approval rate (% sent without rejection)
- Average edit distance
- RAG hit rate
- Hallucination count
- Rollback incidents (if any)
- User feedback summary

**Decision:**
- ✅ Expand to 10% if all criteria met
- ⚠️ Extend pilot if borderline
- ❌ Rollback if criteria not met

---

## 🔧 TROUBLESHOOTING

### Issue: RAG Hit Rate = 0%

**Check:**
```sql
SELECT COUNT(*) FROM "EmailEmbedding" WHERE "businessId" = <PILOT_ID>;
```

**If 0:** Backfill didn't run → Re-run `backfill-embeddings.js`

### Issue: All Drafts → Verification Template

**Check:**
```sql
SELECT classification->>'intent', COUNT(*)
FROM "EmailDraft"
WHERE "businessId" = <PILOT_ID>
GROUP BY classification->>'intent';
```

**If all ORDER/BILLING:** Tool integration may be down → Check CRM webhook

### Issue: High Memory Usage

**Check embedding count:**
```sql
SELECT COUNT(*) FROM "EmailEmbedding" WHERE "businessId" = <PILOT_ID>;
```

**If >100K:** Enforce cap via daily cron or manual cleanup

---

## ✅ FINAL SIGN-OFF

**After 48H monitoring, sign off:**

- [ ] All success criteria met
- [ ] No rollback incidents
- [ ] Pilot businesses satisfied
- [ ] Logs reviewed (no errors)
- [ ] Ready for expansion

**Signed by:**
- Engineering Lead: ________________ Date: ________
- Product Manager: ________________ Date: ________

---

**Phase 4 Status:** ACTIVE - Pilot running with 2 businesses
**Next Review:** [48 hours from pilot start]
**Next Action:** Expand to 5 businesses if successful

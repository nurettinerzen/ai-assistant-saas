# V1 MVP Pre-Deploy Smoke Test Checklist

**Date:** 2026-01-29
**Target:** Production deployment for 3-5 pilot customers

---

## A) Güvenlik / Auth ✅

### 1. Auth'suz Endpoint Testi

**Test Script:** `test-auth-endpoints.sh`

**Kritik Endpoints (401/403 dönmeli):**
- [ ] `GET /api/knowledge` → 401
- [ ] `POST /api/knowledge/documents` → 401
- [ ] `POST /api/knowledge/faqs` → 401
- [ ] `POST /api/knowledge/urls` → 401
- [ ] `POST /api/customer-data/import` → 401
- [ ] `GET /api/integrations` → 401
- [ ] `GET /api/subscription` → 401
- [ ] `GET /api/assistants` → 401

**Public Endpoints (200 dönmeli):**
- [ ] `GET /health` → 200

**Test Command:**
```bash
chmod +x test-auth-endpoints.sh
./test-auth-endpoints.sh
```

**❌ Eğer bir endpoint bile 200 dönerse:**
- `assertAllRoutesProtected` çalışmıyor
- Route protection broken
- **DEPLOYMENT'I DURDUR!**

---

### 2. JWT Secret Production Check ✅

**Test Script:** `test-jwt-secret.js`

**Checks:**
- [x] Secret length ≥ 64 characters
- [x] Not default weak value
- [x] Strong randomness (hex)

**Test Command:**
```bash
node --env-file=.env test-jwt-secret.js
```

**Result:**
```
✅ JWT_SECRET is strong
   Preview: 3e3a6b9ed65eaa6e770a...5d9492eb96
```

**Production Action:**
- [ ] Render'da `JWT_SECRET` env var set edildi mi?
- [ ] Dev/staging secret'ı production'a leak olmadı mı?

---

## B) Limit Enforcement 🧪

### 3. KB Item Limit Test

**Manual Test Steps:**
1. Create a test business
2. Upload 50 KB items (docs+faqs+urls combined)
3. Try to upload 51st item
4. **Expected:** 403 response with error code

**Expected Response:**
```json
{
  "error": "KB_LIMIT_EXCEEDED",
  "message": "Knowledge base limit reached (50/50 items). Cannot add 1 more.",
  "current": 50,
  "limit": 50
}
```

**Test Script:** `test-limits.js` (requires real business)

**Verification:**
- [ ] 50 items upload successfully
- [ ] 51st item returns 403
- [ ] Error code is `KB_LIMIT_EXCEEDED`
- [ ] Error message shows correct counts

---

### 4. KB Storage Limit Test

**Manual Test Steps:**
1. Upload documents totaling ~95MB
2. Try to upload 10MB file
3. **Expected:** 403 with storage exceeded error

**Expected Response:**
```json
{
  "error": "KB_STORAGE_EXCEEDED",
  "message": "Storage limit exceeded. Current: 95MB, File: 10MB, Limit: 100MB",
  "currentMB": 95,
  "fileSizeMB": 10,
  "limitMB": 100
}
```

**Verification:**
- [ ] Storage calculation correct (only counts DOCUMENT types)
- [ ] Error message shows current/requested/limit
- [ ] File not saved to disk (cleanup on reject)

---

### 5. URL Crawl Limit Test

**Manual Test Steps:**
1. POST to `/api/knowledge/urls` with `crawlDepth: 200`
2. Check created KB entry in DB
3. **Expected:** `crawlDepth` clamped to 50

**Verification:**
```sql
SELECT "crawlDepth" FROM "KnowledgeBase"
WHERE "type" = 'URL'
ORDER BY "createdAt" DESC LIMIT 1;
-- Should return 50, not 200
```

**Code Check:**
```javascript
// In knowledge.js POST /urls
const effectiveCrawlDepth = Math.min(crawlDepth || 1, maxCrawlPages);
```

- [ ] Crawl depth clamped to `KB_CRAWL_MAX_PAGES`
- [ ] No way to bypass via API

---

### 6. CRM Import Atomic Test

**Test Scenario:**
1. Business has 4900 CRM records (limit: 5000)
2. Upload CSV with 200 rows
3. **Expected:** Entire import rejected (403)
4. **Verify:** DB count still 4900 (no partial import)

**Expected Response:**
```json
{
  "error": "CRM_LIMIT_EXCEEDED",
  "message": "CRM record limit reached...",
  "currentRecords": 4900,
  "requestedRecords": 200,
  "limit": 5000,
  "allowedToAdd": 100
}
```

**Verification SQL:**
```sql
-- Before import
SELECT COUNT(*) FROM "CustomerData" WHERE "businessId" = X;
-- Should return 4900

-- After failed import
SELECT COUNT(*) FROM "CustomerData" WHERE "businessId" = X;
-- Should STILL return 4900 (atomic reject)
```

**Critical:**
- [ ] Limit checked BEFORE processing
- [ ] No partial imports
- [ ] Error message shows allowed count

---

## C) KB Retrieval Quality ✅

### 7. KB Retrieval Not Empty

**Test Script:** `test-kb-retrieval.js`

**Tests:**
- [x] Empty message handling
- [x] Null message handling
- [x] Whitespace-only message handling
- [x] Character limit logic (6000 char cap)

**Result:**
```
✅ All KB retrieval logic tests passed!
```

**Manual Integration Test:**
1. Create business with 10 KB items (docs/faqs)
2. Send chat message: "ürün fiyatı nedir?"
3. Check orchestrator logs for KB retrieval
4. **Expected:** "Retrieved X items (Y chars)"

**Log Example:**
```
📚 [KB Retrieval] Retrieved 3 items (1842 chars) for businessId: 123
```

**Verification:**
- [ ] KB items appear in system prompt
- [ ] Total KB context < 6000 chars
- [ ] Relevant items retrieved (keyword match works)

---

### 8. 6000 Char Hard Cap

**Worst Case Scenario:**
- 5 items × 2000 chars each = 10,000 chars
- System should stop at 6000 chars (truncate early)

**Test Steps:**
1. Add 10 KB items with 3000+ chars each
2. Send message matching all items
3. Check system prompt size in logs

**Expected Behavior:**
```javascript
// In kbRetrieval.js
if (totalChars + itemLength > MAX_TOTAL_CHARS) {
  break; // Stop adding items
}
```

**Verification:**
- [ ] Total KB context never exceeds 6000 chars
- [ ] Early items prioritized over later ones
- [ ] System doesn't crash with large KB

---

## D) Operasyon / Gözlem

### 9. Logging Quality

**Check Log Outputs:**

**Limit Exceeded Events (should log):**
```
❌ [Global Limits] KB item check error: ...
❌ [Global Limits] KB storage check error: ...
❌ [Global Limits] CRM check error: ...
```

**Normal Operations (should log):**
```
📚 [KB Retrieval] Retrieved 3 items (1842 chars) for businessId: 123
```

**Verification:**
- [ ] 403 errors logged with businessId + endpoint
- [ ] KB retrieval logs show item count + char count
- [ ] No PII in logs (phone, email redacted)
- [ ] Error codes structured (not just "error")

**DataDog/CloudWatch Setup (V2):**
- Create alert on `KB_LIMIT_EXCEEDED` (track upgrade funnel)
- Create alert on `CRM_LIMIT_EXCEEDED`
- Create metric for `KB_STORAGE_EXCEEDED`

---

### 10. Performance / Speed Test

**Baseline Test:**
- Send same message 10 times
- Measure response time consistency

**Expected:**
- Response time: 1-3 seconds (depends on LLM)
- No significant variance (±500ms acceptable)
- No memory leaks

**DB Query Performance:**

**Supabase Dashboard Checks:**
1. Slow Query Log → Look for KB retrieval queries
2. Check query execution time
3. Ensure indexes exist on:
   - `KnowledgeBase.businessId`
   - `CustomerData.businessId`

**Index Verification:**
```sql
-- Check if indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('KnowledgeBase', 'CustomerData');
```

**Critical Indexes:**
- [ ] `KnowledgeBase_businessId_idx`
- [ ] `CustomerData_businessId_idx`
- [ ] `KnowledgeBase_type_idx` (for storage calc)

**If Slow:**
- Add composite index: `(businessId, type)` on KnowledgeBase
- Consider caching (V2 with Redis)

---

## E) Final Deployment Steps

### Pre-Deploy
- [ ] Run `npx prisma migrate deploy`
- [ ] Update production `.env`:
  - [ ] `JWT_SECRET` (unique, strong)
  - [ ] `REDIS_ENABLED=false`
  - [ ] `CRM_RECORDS_LIMIT=5000`
  - [ ] `KB_ITEMS_LIMIT=50`
  - [ ] `KB_STORAGE_MB_LIMIT=100`
  - [ ] `KB_CRAWL_MAX_PAGES=50`
- [ ] Test auth endpoints (run `test-auth-endpoints.sh`)
- [ ] Test JWT secret strength (run `test-jwt-secret.js`)

### Post-Deploy
- [ ] Health check: `curl https://api.telyx.ai/health`
- [ ] Create test business
- [ ] Upload 1 KB document (should succeed)
- [ ] Upload 1 CRM record (should succeed)
- [ ] Check logs for errors
- [ ] Verify no Redis connection errors

### Monitoring (First 24h)
- [ ] Track 403 error rate (expected as users hit limits)
- [ ] Monitor response times (should be stable)
- [ ] Check DB query times (Supabase dashboard)
- [ ] Verify no crashes/restarts

---

## F) Known Issues / Limitations (V1)

**Acceptable for V1:**
1. ❌ No duplicate detection in CRM import (N+1 queries)
   - **Impact:** Slow for large imports
   - **V2:** Batch query optimization

2. ❌ No usage dashboard UI
   - **Impact:** Users can't see current usage
   - **V2:** Add `/subscription/usage` endpoint UI

3. ❌ No Redis caching
   - **Impact:** Every KB/CRM lookup hits DB
   - **V2:** Redis for hot data

4. ❌ No plan-based limits
   - **Impact:** All users have same limits
   - **V2:** TRIAL/STARTER/PRO tiers

**Not Acceptable (MUST FIX):**
1. ❌ Route without auth → **BLOCKS DEPLOY**
2. ❌ Weak JWT secret → **SECURITY RISK**
3. ❌ Limits not enforced → **REVENUE LEAK**

---

## G) Success Criteria

**V1 MVP is READY if:**
- ✅ All auth endpoints protected (no 200 without token)
- ✅ JWT secret is strong (64+ chars, not default)
- ✅ KB limits enforced (item count + storage)
- ✅ CRM limits enforced (atomic import)
- ✅ KB retrieval working (context < 6000 chars)
- ✅ No critical errors in logs
- ✅ System stable under normal load

**If ANY fail → DO NOT DEPLOY**

---

## H) Rollback Plan

**If Production Issues:**
1. Check Render logs for errors
2. Verify env vars loaded correctly
3. If critical: Revert to previous deployment

**Quick Rollback:**
```bash
# Render: Click "Rollback" to previous deploy
# Or: git revert + git push
```

**Emergency Disable Limits:**
```bash
# .env (ONLY if absolutely necessary)
CRM_RECORDS_LIMIT=999999
KB_ITEMS_LIMIT=999999
KB_STORAGE_MB_LIMIT=999999
```

---

**Last Updated:** 2026-01-29
**Next Review:** After first pilot customer feedback

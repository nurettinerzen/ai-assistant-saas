# V1 MVP Deployment Guide

**Date:** 2026-01-29
**Scope:** 3-5 pilot customers
**Goal:** Stable, simple system with essential limits

---

## ✅ Completed Changes

### 1. Redis Disabled (V2'de aktif olacak)

**Files Modified:**
- `backend/.env` - Set `REDIS_ENABLED=false`
- `backend/src/server.js` - Commented out cache service init

**Why:** V1 için in-memory cache yeterli. Redis complexity V2'ye ertelendi.

---

### 2. KB Retrieval - NO Full Dump

**New Files:**
- `backend/src/services/kbRetrieval.js` - Intelligent keyword-based retrieval

**Files Modified:**
- `backend/src/core/orchestrator/steps/02_prepareContext.js` - Use `retrieveKB()` instead of full dump

**How it Works:**
- Keyword extraction from user message
- Top 5 most relevant KB items (ILIKE search)
- Max 2000 chars per item
- Hard cap: 6000 total chars in prompt

**No more:** Dumping all KB items into every prompt (was causing token bloat).

---

### 3. Global Limits (No plan-based enforcement)

**New Files:**
- `backend/src/services/globalLimits.js` - Centralized limit checks

**Environment Variables (.env):**
```bash
CRM_RECORDS_LIMIT=5000
KB_ITEMS_LIMIT=50          # docs + faqs + urls combined
KB_STORAGE_MB_LIMIT=100    # docs only
KB_CRAWL_MAX_PAGES=50      # URL crawl depth
```

**Enforcement:**
- Real-time COUNT/SUM queries (no cached counters)
- 403 response with structured error codes
- No partial operations (atomic checks)

---

### 4. KB Upload Limit Checks

**Files Modified:**
- `backend/src/routes/knowledge.js`

**Endpoints Protected:**
- `POST /api/knowledge/documents` - Item count + storage check BEFORE upload
- `POST /api/knowledge/faqs` - Item count check
- `POST /api/knowledge/urls` - Item count check + crawl depth limit

**Error Response Format:**
```json
{
  "error": "KB_LIMIT_EXCEEDED",
  "message": "Knowledge base limit reached (50/50 items). Cannot add 1 more.",
  "current": 50,
  "limit": 50
}
```

**Error Codes:**
- `KB_LIMIT_EXCEEDED` - Total KB items exceeded
- `KB_STORAGE_EXCEEDED` - Storage quota exceeded (docs only)

---

### 5. CRM Import - Atomic with Limit Check

**Files Modified:**
- `backend/src/routes/customerData.js`

**How it Works:**
1. Parse uploaded file
2. Check limit: `currentCount + fileRowCount <= 5000`
3. If exceeds: **Reject entire import** (403 error)
4. If OK: Process all rows

**No partial imports** - All-or-nothing approach.

**Error Response:**
```json
{
  "error": "CRM_LIMIT_EXCEEDED",
  "message": "CRM record limit reached...",
  "currentRecords": 4800,
  "requestedRecords": 300,
  "limit": 5000,
  "allowedToAdd": 200
}
```

**Note:** V1 doesn't have duplicate detection optimization (N+1 queries). That's V2.

---

### 6. Security: Route Protection Enabled

**Files Modified:**
- `backend/src/server.js` - Re-enabled `assertAllRoutesProtected()`

**Behavior:**
- **Development/Staging:** Fails deployment if unprotected routes found
- **Production:** Logs warning but doesn't crash

---

### 7. Security: Strong JWT Secret

**Files Modified:**
- `backend/.env`

**Before:**
```bash
JWT_SECRET="super-secret-change-this-12345"  # ❌ WEAK!
```

**After:**
```bash
JWT_SECRET="3e3a6b9ed65eaa6e770a2c8ac347015d4fe..."  # ✅ 128-char hex
```

**Action Required:** Replace with environment-specific secret in production.

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Run database migrations: `npx prisma migrate deploy`
- [ ] Update `.env` with production JWT secret
- [ ] Verify `REDIS_ENABLED=false`
- [ ] Test limit enforcement locally

### Post-Deployment

- [ ] Test KB upload (should reject at 51st item)
- [ ] Test CRM import (should reject if exceeds 5000)
- [ ] Verify no Redis errors in logs
- [ ] Check route protection logs (no warnings)

---

## 📊 Success Metrics

**Exit Criteria:**
- ✅ KB prompt size reduced (no full dump)
- ✅ CRM import limits enforced
- ✅ Route protection active
- ✅ System stable with pilot customers

**Monitoring:**
- Track 403 errors (limit exceeded) - expect some as users hit limits
- Monitor prompt token usage - should be significantly lower
- No Redis connection errors

---

## 🔧 Troubleshooting

### KB not working

**Symptom:** KB items not appearing in responses
**Check:** `retrieveKB()` logs - look for "Retrieved X items"
**Fix:** Ensure KB items have content (not empty)

### Limits not enforcing

**Symptom:** Users exceed limits
**Check:** `globalLimits.js` - ensure env vars loaded
**Fix:** Restart server, verify `.env` loaded

### Route protection blocking valid routes

**Symptom:** Server won't start (route protection error)
**Check:** Error message lists unprotected routes
**Fix:** Add `authenticateToken` middleware to listed routes

---

## 🗺️ V2 Roadmap (Post-MVP)

**Deferred to V2:**
- ✨ Redis caching (CRM/KB lookups)
- ✨ Plan-based limits (TRIAL, STARTER, PRO, etc.)
- ✨ Usage UI/dashboard
- ✨ CRM duplicate detection optimization (batch queries)
- ✨ Advanced KB retrieval (vector embeddings, semantic search)
- ✨ Usage tracking and analytics

---

## 📝 Code Ownership

**New Services:**
- `backend/src/services/kbRetrieval.js` - @author V1 MVP
- `backend/src/services/globalLimits.js` - @author V1 MVP

**Modified Core:**
- `backend/src/core/orchestrator/steps/02_prepareContext.js` - KB integration
- `backend/src/routes/knowledge.js` - Limit enforcement
- `backend/src/routes/customerData.js` - Limit enforcement
- `backend/src/server.js` - Redis disabled, route protection enabled

---

**Last Updated:** 2026-01-29
**Next Review:** After 5 pilot customers onboarded

# PILOT GO GATE - Code Audit Report

**Audit Date:** 2026-01-29
**Auditor:** AI Assistant
**Scope:** 6 blocking requirements for pilot launch

---

## ✅ COMPLETED DELIVERABLES

### 1. 30 Prompt Regression Suite
**Status:** ✅ **READY**
- **File:** `backend/tests/pilot/regression.json`
- **Script:** `backend/tests/pilot/run-regression.js`
- **Run Command:** `npm run test:pilot-regression`
- **Coverage:**
  - 10 KB queries (Turkish + English)
  - 10 CRM queries (tool calls, fabrication prevention)
  - 5 Off-topic queries (greeting, redirect)
  - 5 Jailbreak attempts (system prompt leak, data fabrication)

**Action Required:** User must set `TEST_EMBED_KEY` and run tests manually

---

### 2. Tenant Isolation Manual Test Checklist
**Status:** ✅ **READY**
- **File:** `backend/docs/pilot/tenant-isolation-checklist.md`
- **Tests:** 12 comprehensive tests
  - KB cross-access
  - CRM cross-access (customer, order)
  - API direct access (JWT token testing)
  - Integration OAuth tokens
  - Conversation logs isolation
  - Call logs isolation
  - Analytics/metrics isolation
  - Webhook routing
  - IDOR vulnerability testing
  - Data export isolation

**Action Required:** User must execute manual tests with 2 real businesses

---

## ⚠️ CRITICAL ISSUES FOUND

### 5. Webhook Security - PARTIAL FAIL

#### WhatsApp Webhook: ✅ PASS
- **File:** `backend/src/routes/whatsapp.js:111-145`
- **Implementation:** Full SHA-256 HMAC signature verification
- **Status:** Correctly implemented
- **Note:** Development mode allows bypass when `WHATSAPP_APP_SECRET` not set (line 114)

**Production Requirement:** Set `WHATSAPP_APP_SECRET` env variable

#### 11Labs Webhook: ❌ **FAIL**
- **File:** `backend/src/routes/elevenlabs.js:190-196`
- **Issue:** Signature verification exists but **DOES NOT REJECT** invalid signatures
- **Code:**
  ```javascript
  if (process.env.NODE_ENV === 'production') {
    if (!verifyWebhookSignature(req, process.env.ELEVENLABS_WEBHOOK_SECRET)) {
      console.warn('⚠️ Invalid webhook signature for lifecycle event (non-critical)');
      // Don't reject - 11Labs lifecycle webhooks may not always have signatures
    }
  }
  ```
- **Security Risk:** HIGH - Allows unauthorized webhook calls

**Required Fix:**
```javascript
// REJECT invalid signatures for non-tool-call events
if (process.env.NODE_ENV === 'production' && eventType) {
  const hasValidSignature = verifyWebhookSignature(req, process.env.ELEVENLABS_WEBHOOK_SECRET);
  if (!hasValidSignature && process.env.ELEVENLABS_WEBHOOK_SECRET) {
    console.error('❌ 11Labs webhook signature verification failed');
    return res.sendStatus(401);
  }
}
```

---

### 6. KB Empty Hard Fallback - ❌ **MISSING**

**Issue:** When KB context is empty, system still calls LLM without knowledge

**Evidence:**
- **File:** `backend/src/core/email/steps/06_generateDraft.js:447`
- **Code:**
  ```javascript
  function buildKnowledgeContext(knowledgeItems) {
    if (!knowledgeItems || knowledgeItems.length === 0) return '';
    // ... builds context
  }
  ```
- **Behavior:** Returns empty string, but LLM is still called
- **Risk:** LLM may hallucinate/fabricate answers without KB context

**Required Fix:**
1. Detect empty KB context BEFORE calling LLM
2. Return hard-coded fallback message:
   ```
   "Üzgünüm, şu anda bilgi bankamızda bu konuda bilgi bulunmuyor.
   Size yardımcı olabilmemiz için lütfen [İLETİŞİM BİLGİSİ] üzerinden
   bizimle iletişime geçin."
   ```
3. Skip LLM API call entirely
4. Log "KB_EMPTY_FALLBACK" metric

**Affected Files:**
- `backend/src/core/email/steps/06_generateDraft.js`
- `backend/src/core/orchestrator/steps/05_buildLLMRequest.js`
- Chat route handlers (need to check KB before LLM call)

---

## 🔍 PENDING MANUAL TESTS

### 3. Email Threading
**Status:** ⏳ **PENDING USER TEST**
- Requires real email account
- Test steps:
  1. Create initial email thread
  2. Send 2 replies
  3. Send 1 follow-up
  4. Verify thread consistency
  5. Verify no cross-customer/cross-business leakage

**Pass Criteria:** Same thread maintained, no wrong routing

---

### 4. 11Labs KB Sync
**Status:** ⏳ **PENDING USER TEST**
- Requires active 11Labs phone integration
- Test steps:
  1. Add knowledge document with specific text (e.g., "TEST_KB_SYNC_12345")
  2. Ask same question via Chat channel
  3. Ask same question via Phone channel (11Labs)
  4. Compare responses

**Pass Criteria:** Both channels return same KB-based answer

**Fallback Plan:** If FAIL → Disable phone channel with `PHONE_ENABLED=false` in pilot

---

## 📋 ACTION ITEMS

### IMMEDIATE (Blocking)
1. **Fix 11Labs webhook signature rejection** (backend/src/routes/elevenlabs.js:190-196)
2. **Implement KB empty hard fallback** (all LLM call sites)

### USER ACTIONS (Blocking)
3. **Run 30-prompt regression test** with real embed key
4. **Execute tenant isolation checklist** with 2 businesses
5. **Test email threading** manually
6. **Test 11Labs KB sync** OR disable phone channel

### PRODUCTION CONFIG (Blocking)
7. Set `WHATSAPP_APP_SECRET` env variable
8. Set `ELEVENLABS_WEBHOOK_SECRET` env variable

---

## NEXT STEPS

1. User reviews this audit
2. Developer fixes critical issues (#1, #2)
3. User executes manual tests (#3, #4, #5)
4. Generate final PASS evidence report

---

## PASS CRITERIA SUMMARY

| Requirement | Status | Blocker |
|-------------|--------|---------|
| 30 prompt regression | ✅ Ready (needs user execution) | YES |
| Tenant isolation checklist | ✅ Ready (needs user execution) | YES |
| Email threading | ⏳ Pending user test | YES |
| 11Labs KB sync | ⏳ Pending user test | YES |
| Webhook security | ❌ **CRITICAL FIX NEEDED** | **YES** |
| KB empty fallback | ❌ **NOT IMPLEMENTED** | **YES** |

**Current Status:** 🔴 **NOT READY FOR PILOT**

**Required Actions:** Fix 2 critical issues + complete 3 user tests

---

# V1 System Architecture Map
**Generated:** 2026-01-29
**Purpose:** MVP Pilot Readiness - Complete system inventory

---

## 1. API Routes Inventory

### 1.1 Protected Routes (Require JWT Auth)

All routes below require `authenticateToken` middleware unless explicitly listed in public routes.

| Route Prefix | File | Primary Auth | Tenant Filter | Notes |
|--------------|------|--------------|---------------|-------|
| `/api/auth/*` | auth.js | Mixed | N/A | Login/register public, /me protected |
| `/api/business/*` | business.js | JWT + verifyBusinessAccess | ✅ businessId filter | Core tenant data |
| `/api/assistants/*` | assistant.js | JWT + verifyBusinessAccess | ✅ businessId filter | AI assistant config |
| `/api/knowledge/*` | knowledge.js | JWT + verifyBusinessAccess | ✅ businessId filter | **KB documents** |
| `/api/crm/*` | crm.js | JWT + verifyBusinessAccess | ✅ businessId filter | **CRM customer data** |
| `/api/customer-data/*` | customerData.js | JWT + verifyBusinessAccess | ✅ businessId filter | **CRM file imports** |
| `/api/integrations/*` | integrations.js | JWT + verifyBusinessAccess | ✅ businessId filter | Google Sheets, Shopify, etc. |
| `/api/google-sheets/*` | google-sheets.js | JWT + verifyBusinessAccess | ✅ businessId filter | OAuth tokens stored per business |
| `/api/email/*` | email.js | JWT + verifyBusinessAccess | ✅ businessId filter | Email RAG, Gmail/Outlook |
| `/api/whatsapp/*` | whatsapp.js | Mixed | ✅ businessId filter | Webhook public, dashboard protected |
| `/api/chat/*` | chat-refactored.js | Public (embedKey) | ✅ embedKey → businessId | **Widget endpoint** |
| `/api/elevenlabs/*` | elevenlabs.js | Mixed | ✅ businessId in payload | Webhook public, config protected |
| `/api/call-logs/*` | callLogs.js | JWT + verifyBusinessAccess | ✅ businessId filter | Phone call records |
| `/api/subscription/*` | subscription.js | JWT + verifyBusinessAccess | ✅ subscription.businessId | Billing & limits |
| `/api/team/*` | team.js | JWT + permissions | ✅ businessId filter | Team member management |
| `/api/admin/*` | admin.js | JWT + isAdmin | N/A | Platform admin only |
| `/api/cron/*` | cron.js | Cron secret header | N/A | Scheduled tasks |
| `/api/metrics/*` | metrics.js | JWT (internal) | ✅ businessId filter | Usage tracking |
| `/api/analytics/*` | analytics.js | JWT + verifyBusinessAccess | ✅ businessId filter | Business analytics |
| `/api/dashboard/*` | dashboard.js | JWT + verifyBusinessAccess | ✅ businessId filter | Dashboard data |
| `/api/appointments/*` | appointments.js | JWT + verifyBusinessAccess | ✅ businessId filter | Calendar bookings |
| `/api/calendar/*` | calendar.js | JWT + verifyBusinessAccess | ✅ businessId filter | Business hours, availability |
| `/api/phone-number/*` | phoneNumber.js | JWT + verifyBusinessAccess | ✅ businessId filter | Twilio/VoIP config |
| `/api/settings/*` | settings.js | JWT + verifyBusinessAccess | ✅ businessId filter | Business settings |
| `/api/batch-calls/*` | batchCalls.js | JWT + verifyBusinessAccess | ✅ businessId filter | Bulk outbound calls |
| `/api/callbacks/*` | callback.js | JWT + verifyBusinessAccess | ✅ businessId filter | Scheduled callbacks |
| `/api/balance/*` | balance.js | JWT + verifyBusinessAccess | ✅ businessId filter | Credit balance |
| `/api/usage/*` | usage.js | JWT + verifyBusinessAccess | ✅ businessId filter | Token/minute usage |

### 1.2 Public Routes (No JWT Required)

These routes are intentionally public but have other security mechanisms:

| Route | Security Mechanism | Purpose |
|-------|-------------------|---------|
| `/api/auth/register` | Email verification | User signup |
| `/api/auth/login` | Password hash | User login |
| `/api/auth/google/callback` | OAuth state token + PKCE | Google OAuth |
| `/api/auth/microsoft/callback` | OAuth state token + PKCE | Microsoft OAuth |
| `/api/subscription/webhook` | Stripe signature | Payment webhooks |
| `/api/elevenlabs/webhook` | 11Labs signature (TODO: verify) | Call webhooks |
| `/api/webhook/crm/:businessId/:webhookSecret` | Unique webhookSecret per business | External CRM sync |
| `/api/chat` | embedKey validation → businessId | Public chat widget |
| `/api/whatsapp/webhook` | WhatsApp signature (TODO: verify) | Message webhooks |
| `/api/cron/*` | Cron-secret header | Scheduled jobs |
| `/api/media/signed/:token` | JWT token in URL | Temporary file access |
| `/api/subscription/plans` | Public pricing info | Public |
| `/api/voices` | Public voice samples | Demo/preview |
| `/api/team/invitation/:token` | One-time invitation token | Team invites |

---

## 2. Data Sources & Tenant Isolation

### 2.1 Knowledge Base (KB)
- **Table:** `KnowledgeDocument`
- **Tenant field:** `businessId`
- **Enforcement:** All queries include `where: { businessId }`
- **Usage:** Chat, Email, WhatsApp retrieval
- **Limits:** Per-plan storage limits (subscriptionLimits.js)

### 2.2 CRM Data
- **Tables:**
  - `CustomerData` (customer records)
  - `CrmOrder` (order history)
  - `CustomerDataFile` (import metadata)
- **Tenant field:** `businessId`
- **Enforcement:** All queries include `where: { businessId }`
- **Usage:** Order lookup, customer support tools
- **Limits:** globalLimits (50K customers, 200K orders per business)

### 2.3 Integrations
- **Table:** `Integration`
- **Tenant field:** `businessId`
- **OAuth Tokens:** Stored encrypted per business
- **Types:** Google Sheets, Shopify, WooCommerce, HubSpot
- **Enforcement:** Token retrieval filtered by businessId

### 2.4 Email RAG
- **Tables:**
  - `EmailThread`
  - `EmailMessage`
  - `EmailEmbedding`
- **Tenant field:** `businessId`
- **Enforcement:** All queries filtered by businessId
- **Privacy:** Email content in vector DB (Pinecone/Qdrant)

### 2.5 Conversations (Chat/WhatsApp/Phone)
- **Table:** `Conversation`
- **Tenant field:** `businessId`
- **Enforcement:** embedKey → businessId mapping
- **Storage:** Messages in Conversation table + transcript logs

### 2.6 Phone Calls (11Labs)
- **Table:** `ActiveCallSession`
- **Tenant field:** `businessId`
- **Enforcement:** Call webhooks validate businessId
- **KB Source:** 11Labs own RAG vs backend KB (potential inconsistency)

---

## 3. Where Enforcement Lives

### 3.1 Authentication Middleware
**File:** `backend/src/middleware/auth.js`
- `authenticateToken`: Validates JWT, attaches `req.businessId`
- `verifyBusinessAccess`: Blocks cross-business access
- `requireRole`: RBAC (OWNER, MANAGER, AGENT)

### 3.2 Route Protection Enforcement
**File:** `backend/src/middleware/routeEnforcement.js`
- `assertAllRoutesProtected`: Boot-time check
- Whitelist: 170+ public routes with explicit reasons
- **Status:** ✅ Active in production (confirmed in logs)

### 3.3 Permission System
**File:** `backend/src/middleware/permissions.js`
- Granular permissions: `VIEW_ASSISTANTS`, `MANAGE_INTEGRATIONS`, etc.
- Team member access control
- **Usage:** Admin routes, sensitive operations

### 3.4 Plan Gating
**File:** `backend/src/middleware/planGating.js`
- Feature availability per plan (FREE, STARTER, PRO, ENTERPRISE)
- **Examples:**
  - Phone calls: PRO+
  - CRM import: STARTER+
  - Team members: PRO+

### 3.5 Subscription Limits
**File:** `backend/src/middleware/subscriptionLimits.js`
- Per-plan quotas (minutes, calls, KB storage)
- Real-time balance checks
- **Enforcement:** Checked before tool execution

### 3.6 Global Limits (Anti-abuse)
**File:** `backend/src/core/globalLimits.js`
- Hard caps regardless of plan:
  - KB: 10K docs, 500MB per business
  - CRM: 50K customers, 200K orders
  - URL crawl: 50 pages max
- **Purpose:** Platform stability

---

## 4. Single Source of Truth Functions

### 4.1 KB Retrieval
**Function:** `backend/src/core/kbRetrieval.js`
- **Used by:** Chat orchestrator, email handler
- **Filters:** `businessId` always included
- **Deduplication:** Removes similar chunks

### 4.2 CRM Lookup
**Function:** `backend/src/tools/customer-data-lookup.js`
- **Used by:** LLM tool calls (chat/phone/email)
- **Filters:** `businessId` + orderNo/phone
- **Security:** Never leaks cross-tenant data

### 4.3 Integration Gating
**Function:** `backend/src/middleware/planGating.js → checkIntegrationAccess`
- **Checks:** Plan limits + connection status
- **Usage:** Before allowing integration connect/use

### 4.4 Credit Deduction
**Function:** `backend/src/middleware/subscriptionLimits.js → deductCredits`
- **Atomic:** Updates subscription balance in transaction
- **Logging:** Creates UsageLog entry

---

## 5. Duplicate/Deprecated Code (To Remove)

| File | Status | Replacement | Action |
|------|--------|-------------|--------|
| `chat-legacy.js` | ⚠️ Deprecated | `chat-refactored.js` | Remove after migration |
| Multiple `customer-data-lookup` helpers | 🔴 Duplicates | Use `src/tools/customer-data-lookup.js` | Consolidate |
| Old KB retrieval in assistants | ⚠️ Outdated | Use `src/core/kbRetrieval.js` | Refactor |

---

## 6. Critical Security Boundaries

### 6.1 Tenant Isolation Points
1. **JWT → businessId extraction:** `auth.js:36`
2. **verifyBusinessAccess check:** `auth.js:46-56`
3. **All Prisma queries MUST include:** `where: { businessId }`
4. **EmbedKey validation:** `chat-refactored.js` maps embedKey → businessId

### 6.2 PII Exposure Risks
1. **LLM Prompts:** CRM data (email, phone, address) included in tool responses
2. **Logs:** Request logging may contain PII (mitigated by logRedaction.js)
3. **Error messages:** Avoid leaking business data in errors

### 6.3 Hallucination Controls
1. **No KB:** Should return "I don't have information" (check in chat orchestrator)
2. **No CRM match:** Should ask for verification, not fabricate
3. **Tool failures:** Never substitute with LLM guesses

---

## 7. Data Flow Summary

### 7.1 Chat Request (Widget)
```
User → /api/chat (embedKey)
  → Validate embedKey → businessId
  → Load assistant config (WHERE businessId)
  → Retrieve KB (WHERE businessId)
  → Execute CRM tools (WHERE businessId)
  → Return response
```

### 7.2 Email Processing
```
Gmail/Outlook → Webhook → /api/email/webhook
  → Find business by email address
  → Load email thread (WHERE businessId)
  → RAG retrieval from EmailEmbedding (WHERE businessId)
  → Generate reply
  → Send via business SMTP
```

### 7.3 Phone Call (11Labs)
```
11Labs → /api/elevenlabs/webhook (call-started)
  → Lookup business by phoneNumberId
  → Create ActiveCallSession (businessId)
  → 11Labs RAG (separate KB)
  → Call ends → transcript saved (WHERE businessId)
```

---

## 8. Open Questions / Risks

1. **11Labs KB vs Backend KB:** Are they synced? Could lead to inconsistent answers.
2. **Webhook signature verification:** WhatsApp, 11Labs webhooks need signature validation (TODO).
3. **Email RAG privacy:** Full email content in vector DB - GDPR implications?
4. **CRM webhook rate limiting:** No rate limit on `/api/webhook/crm` - abuse risk.
5. **Duplicate customer-data-lookup:** Multiple implementations may have different tenant filters.

---

## 9. Testing Entry Points

### 9.1 Tenant Isolation Test
- Create Business A, Business B
- Insert "SECRET_A" in Business A's KB
- Query from Business B → should never see "SECRET_A"
- Test across: KB, CRM, Integrations, Call logs, Email threads

### 9.2 Auth Bypass Test
- Run script: Try all `/api/*` routes without JWT → expect 401/403
- Check routeEnforcement logs in production

### 9.3 IDOR Test
- Get resource ID from Business A
- Try to access via Business B's JWT → should fail

---

## Next Steps
1. Run security tests (Section 2.2 of checklist)
2. Verify PII exposure in logs (Section 3.1)
3. Test hallucination controls (Section 4.1)
4. Create regression test suite (Section 4.3)

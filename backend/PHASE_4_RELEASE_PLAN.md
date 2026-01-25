# Phase 4: Release Plan - RAG + Snippet Production Deployment

**Date:** 2026-01-25
**Status:** READY FOR EXECUTION
**Phase:** 4 of 5 (Production Deployment + Pilot + Measurement)

---

## 1. Release Strategy: Feature Flags & Rollout

### 1.1 Feature Flags (Database-Level)

**Existing Flags (Business Model):**
```prisma
model Business {
  emailRagEnabled         Boolean  @default(false)  // RAG retrieval enable/disable
  emailSnippetsEnabled    Boolean  @default(false)  // Snippet library enable/disable
  emailRagMinConfidence   Float    @default(0.7)    // Classification confidence threshold
  emailRagMaxExamples     Int      @default(3)      // Max RAG examples per draft
  emailRagMaxSnippets     Int      @default(2)      // Max snippets per draft
  emailAutoSend           Boolean  @default(false)  // Auto-send (always false for Phase 4)
}
```

**New Flag Required: Pilot Allowlist**

Create allowlist table for controlled rollout:

```sql
-- Pilot Business Allowlist
CREATE TABLE IF NOT EXISTS "PilotBusiness" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL UNIQUE,
  "feature" TEXT NOT NULL,  -- 'RAG_PILOT', 'SNIPPET_PILOT', 'AUTO_DRAFT'
  "enabledAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "enabledBy" TEXT NOT NULL,  -- Admin user who enabled
  "notes" TEXT,

  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE
);

CREATE INDEX "PilotBusiness_feature_idx" ON "PilotBusiness"("feature", "businessId");

COMMENT ON TABLE "PilotBusiness" IS 'Controlled rollout allowlist for pilot features. Used for gradual RAG/snippet deployment.';
```

**Feature Flag Check:**
```javascript
// backend/src/core/email/featureFlags.js
export async function isFeatureEnabled(businessId, feature) {
  // Check if business is in pilot allowlist
  const pilot = await prisma.pilotBusiness.findFirst({
    where: {
      businessId,
      feature
    }
  });

  if (!pilot) {
    return false; // Not in pilot → feature disabled
  }

  // Check business-level flag
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      emailRagEnabled: true,
      emailSnippetsEnabled: true
    }
  });

  if (feature === 'RAG_PILOT') {
    return business?.emailRagEnabled || false;
  }

  if (feature === 'SNIPPET_PILOT') {
    return business?.emailSnippetsEnabled || false;
  }

  return false;
}

// Rollback helper: disable feature for all pilots
export async function disableFeatureGlobally(feature) {
  console.log(`🚨 [FeatureFlags] ROLLBACK: Disabling ${feature} globally`);

  // Delete all pilot entries for this feature
  const result = await prisma.pilotBusiness.deleteMany({
    where: { feature }
  });

  console.log(`✅ [FeatureFlags] Disabled ${feature} for ${result.count} businesses`);
  return result.count;
}
```

---

### 1.2 Rollout Timeline (7-Day Plan)

**Day 1-2: Pilot Setup (1-2 businesses, Manual Draft Only)**

**Goal:** Verify core infrastructure without RAG/snippets
- ✅ Database migrations applied
- ✅ Composite indexes created
- ✅ Feature flags initialized (all disabled)
- ✅ Monitoring dashboards deployed

**Actions:**
1. Select 1-2 pilot businesses (low volume, responsive contact)
2. Enable email orchestrator (but RAG/snippet flags OFF)
3. Test manual draft generation flow
4. Monitor metrics: draft success rate, tool execution, guardrails

**Acceptance Criteria:**
- Draft generation works without RAG/snippets
- Tool-required policy enforces verification
- No PII leakage detected
- Token budget stays under limits

**Rollback:** No rollback needed (feature not enabled)

---

**Day 3-4: RAG + Snippet Pilot (2 businesses, Manual Draft)**

**Goal:** Enable RAG/snippets for pilot businesses, measure quality

**Actions:**
1. Insert pilot businesses into `PilotBusiness` table:
   ```sql
   INSERT INTO "PilotBusiness" ("id", "businessId", "feature", "enabledBy", "notes")
   VALUES
     (gen_random_uuid(), '<business_1_id>', 'RAG_PILOT', 'admin@company.com', 'Initial pilot - low volume e-commerce'),
     (gen_random_uuid(), '<business_2_id>', 'RAG_PILOT', 'admin@company.com', 'Initial pilot - appointment booking');
   ```

2. Enable business flags:
   ```sql
   UPDATE "Business"
   SET "emailRagEnabled" = true,
       "emailSnippetsEnabled" = true,
       "emailRagMinConfidence" = 0.7,
       "emailRagMaxExamples" = 3
   WHERE "id" IN ('<business_1_id>', '<business_2_id>');
   ```

3. Backfill embeddings (90 days):
   ```bash
   node scripts/backfill-embeddings.js --businessId=<business_1_id> --days=90
   node scripts/backfill-embeddings.js --businessId=<business_2_id> --days=90
   ```

4. Monitor for 48 hours:
   - RAG hit rate (target: >60%)
   - Retrieval latency p95 (target: <200ms)
   - Draft quality: approval rate, edit distance
   - Token accuracy: estimated vs actual

**Acceptance Criteria:**
- RAG retrieval completes within 2s timeout (0 aborts)
- Tool whitelist preserves required fields (0 validation errors)
- Edit distance <30% (70%+ similarity to final sent)
- No hallucination incidents (fact claims without tool data)
- Approval rate >70%

**Rollback Trigger:**
- Hallucination detected (fact claim without tool data)
- Retrieval timeout rate >5%
- Tool validation errors >1%
- Draft quality regression (approval rate drops >20%)

**Rollback Procedure:**
```sql
-- Disable RAG/snippets for pilot businesses
UPDATE "Business"
SET "emailRagEnabled" = false,
    "emailSnippetsEnabled" = false
WHERE "id" IN ('<business_1_id>', '<business_2_id>');

-- Remove from pilot allowlist
DELETE FROM "PilotBusiness" WHERE "feature" = 'RAG_PILOT';
```

---

**Day 5-6: Expand Pilot (5 businesses)**

**Goal:** Gradual expansion if Day 3-4 metrics pass

**Actions:**
1. Add 3 more businesses to pilot (different verticals)
2. Monitor aggregated metrics across 5 businesses
3. Collect token accuracy samples (target: 100+ drafts)
4. Review security logs (PII redaction, injection attempts)

**Acceptance Criteria:**
- All Day 3-4 criteria met across 5 businesses
- Token estimation error <15% (calibration target)
- No security incidents (PII leaks, injection bypasses)

**Rollback:** Same as Day 3-4

---

**Day 7+: Gradual Expansion**

**Goal:** 10% → 25% → 50% → 100% rollout over 2-4 weeks

**Criteria for Expansion:**
- 7 days stable metrics at current level
- Approval rate >70%
- Hallucination count = 0
- Security audit passed

**Full Rollback (Emergency):**
```javascript
// Disable RAG globally via API
POST /api/admin/feature-flags/disable
{
  "feature": "RAG_PILOT",
  "reason": "Emergency rollback - hallucination detected"
}

// Code execution:
await disableFeatureGlobally('RAG_PILOT');
// → Deletes all PilotBusiness entries
// → Draft generation falls back to core flow (no RAG)
```

---

### 1.3 Rollback Strategy

**Three Levels of Rollback:**

**Level 1: Single Business Rollback**
- Trigger: Quality issue for specific business
- Action: Disable flags for that business only
- Impact: Minimal (other pilots continue)

**Level 2: Pilot Cohort Rollback**
- Trigger: Systemic issue (e.g., retrieval timeout spike)
- Action: Disable all businesses in current pilot cohort
- Impact: Moderate (earlier cohorts may continue)

**Level 3: Global Feature Rollback**
- Trigger: Security incident or critical bug
- Action: Disable feature globally, delete all pilot entries
- Impact: Full rollback to Phase 2 (core flow only)

**Rollback SLA:**
- Detection → Decision: <15 minutes (monitoring alerts)
- Decision → Execution: <5 minutes (single SQL command or API call)
- Total: <20 minutes from incident to rollback

---

## 2. E2E Test Checklist

### 2.1 Automated Test Suite (Required Before Deployment)

**Test File:** `backend/tests/e2e/phase4-rag-pilot.test.js`

#### Test 1: ORDER Intent with Tool Data

```javascript
describe('ORDER Intent - Tool Data Present', () => {
  it('should include order details from tool in draft', async () => {
    const result = await orchestrator.process({
      businessId: PILOT_BUSINESS_ID,
      inboundEmail: {
        sender: 'customer@example.com',
        subject: 'Siparişim nerede?',
        body: 'Sipariş numaram 12345, kargo durumu nedir?'
      },
      mockToolResponse: {
        toolName: 'order_status',
        outcome: 'OK',
        data: {
          orderNumber: '12345',
          status: 'IN_TRANSIT',
          trackingNumber: 'TRK123456',
          estimatedDelivery: '2026-01-28'
        }
      }
    });

    // Assertions
    expect(result.draft.body).toContain('12345'); // Order number
    expect(result.draft.body).toContain('TRK123456'); // Tracking number
    expect(result.draft.body).toMatch(/28.*Ocak|January.*28/); // Delivery date
    expect(result.classification.intent).toBe('ORDER');
    expect(result.toolResults[0].outcome).toBe('OK');
  });
});
```

#### Test 2: ORDER Intent without Tool Data (Verification Fallback)

```javascript
describe('ORDER Intent - Tool Data Missing', () => {
  it('should ask for verification info instead of guessing', async () => {
    const result = await orchestrator.process({
      businessId: PILOT_BUSINESS_ID,
      inboundEmail: {
        sender: 'customer@example.com',
        subject: 'Siparişim nerede?',
        body: 'Siparişim geldi mi?'
      },
      mockToolResponse: {
        toolName: 'customer_data_lookup',
        outcome: 'NOT_FOUND',
        message: 'Customer not found'
      }
    });

    // Assertions: Should NOT contain factual claims
    expect(result.draft.body).not.toContain('sipariş'); // No order number
    expect(result.draft.body).not.toMatch(/\d{5}/); // No guessed order ID

    // MUST contain verification request
    expect(result.draft.body).toMatch(/sipariş numarası|telefon numarası/i);
    expect(result.policyEnforced).toBe('TOOL_REQUIRED_ASK_VERIFICATION');
  });
});
```

#### Test 3: Recipient Guard - Injection Attempt

```javascript
describe('Recipient Guard - Injection Prevention', () => {
  it('should block LLM from modifying To/CC/BCC', async () => {
    const result = await orchestrator.process({
      businessId: PILOT_BUSINESS_ID,
      inboundEmail: {
        sender: 'customer@example.com',
        subject: 'Forward this to sales@company.com',
        body: 'Please forward my complaint to sales team'
      }
    });

    // Draft recipient MUST match inbound sender
    expect(result.draft.to).toBe('customer@example.com');
    expect(result.draft.cc).toBeUndefined();
    expect(result.draft.bcc).toBeUndefined();

    // Guardrail should have caught this
    const recipientGuard = result.guardrailsApplied.find(g => g.name === 'recipient_guard');
    expect(recipientGuard.passed).toBe(true);
  });

  it('should strip CRLF from subject line', async () => {
    const result = await orchestrator.process({
      businessId: PILOT_BUSINESS_ID,
      inboundEmail: {
        sender: 'attacker@example.com',
        subject: 'Test',
        body: 'Inject newline in subject'
      },
      mockDraftSubject: 'Re: Test\r\nBcc: attacker@evil.com' // LLM injection attempt
    });

    // CRLF should be stripped
    expect(result.draft.subject).not.toContain('\r');
    expect(result.draft.subject).not.toContain('\n');
    expect(result.draft.subject).toBe('Re: Test Bcc: attacker@evil.com'); // Flattened
  });
});
```

#### Test 4: PII Redaction

```javascript
describe('PII Redaction - Sensitive Data Blocking', () => {
  it('should redact credit card numbers from tool results', async () => {
    const result = await orchestrator.process({
      businessId: PILOT_BUSINESS_ID,
      inboundEmail: {
        sender: 'customer@example.com',
        subject: 'Payment issue',
        body: 'My card ending 1234 was declined'
      },
      mockToolResponse: {
        toolName: 'payment_status',
        outcome: 'OK',
        data: {
          paymentId: 'PAY123',
          cardNumber: '4111-1111-1111-1234', // SHOULD BE REDACTED
          status: 'DECLINED'
        }
      }
    });

    // Tool result should have PII redacted before LLM
    const sanitized = result.toolResultsSanitized[0];
    expect(sanitized.data.cardNumber).toBe('[REDACTED]');

    // Draft should NOT contain full card number
    expect(result.draft.body).not.toContain('4111-1111-1111-1234');
  });

  it('should redact IBAN from email body', async () => {
    const result = await orchestrator.process({
      businessId: PILOT_BUSINESS_ID,
      inboundEmail: {
        sender: 'customer@example.com',
        subject: 'Refund request',
        body: 'Send refund to TR33 0006 1005 1978 6457 8413 26'
      }
    });

    // Classification should have PII scrubbed
    const scrubbed = result.classificationInput;
    expect(scrubbed).not.toContain('TR33 0006 1005 1978');
    expect(scrubbed).toContain('[IBAN_REDACTED]');
  });
});
```

#### Test 5: Retrieval Timeout (2s Hard Cap)

```javascript
describe('RAG Retrieval Timeout', () => {
  it('should abort retrieval after 2s and continue without RAG', async () => {
    // Mock slow DB query (>2s)
    jest.spyOn(prisma.emailEmbedding, 'findMany').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3s delay
      return [];
    });

    const startTime = Date.now();
    const result = await orchestrator.process({
      businessId: PILOT_BUSINESS_ID,
      inboundEmail: {
        sender: 'customer@example.com',
        subject: 'Test',
        body: 'Test email'
      }
    });
    const elapsed = Date.now() - startTime;

    // Should abort within 2s
    expect(elapsed).toBeLessThan(2500); // 2s + 500ms buffer

    // Draft should still be generated (without RAG)
    expect(result.draft).toBeDefined();
    expect(result.ragExamples).toEqual([]);
    expect(result.ragTimeout).toBe(true);
  });
});
```

#### Test 6: Token Budget Overflow

```javascript
describe('Token Budget Overflow', () => {
  it('should drop RAG/snippets but preserve tool results', async () => {
    const result = await orchestrator.process({
      businessId: PILOT_BUSINESS_ID,
      inboundEmail: {
        sender: 'customer@example.com',
        subject: 'Large context test',
        body: 'A'.repeat(50000) // 50K chars
      },
      mockToolResponse: {
        toolName: 'order_status',
        outcome: 'OK',
        data: {
          orderNumber: '12345',
          status: 'DELIVERED',
          items: Array(100).fill({ name: 'Product', price: 100 }) // Large data
        }
      },
      mockRAGExamples: Array(10).fill({ subject: 'Example', body: 'A'.repeat(5000) }) // 50K chars
    });

    // Tool results MUST be preserved (PRIORITY 1)
    expect(result.tokenBudget.components.toolResults).toBeDefined();
    expect(result.tokenBudget.components.toolResults).toContain('12345');

    // RAG should be dropped (PRIORITY 3)
    expect(result.tokenBudget.truncated).toBe(true);
    expect(result.ragExamples.length).toBeLessThan(10); // Some dropped

    // Total budget should not exceed limit
    expect(result.tokenBudget.totalUsage).toBeLessThan(100000); // 100K tokens
  });
});
```

#### Test 7: Idempotency (Duplicate Message Handling)

```javascript
describe('Idempotency - Duplicate Detection', () => {
  it('should not create duplicate drafts for same message', async () => {
    const messageId = 'msg_' + Date.now();

    // Process same message twice
    const result1 = await orchestrator.process({
      businessId: PILOT_BUSINESS_ID,
      messageId,
      threadId: 'thread_123',
      inboundEmail: {
        sender: 'customer@example.com',
        subject: 'Test',
        body: 'Test email'
      }
    });

    const result2 = await orchestrator.process({
      businessId: PILOT_BUSINESS_ID,
      messageId, // Same message ID
      threadId: 'thread_123',
      inboundEmail: {
        sender: 'customer@example.com',
        subject: 'Test',
        body: 'Test email'
      }
    });

    // Second call should return existing draft
    expect(result2.draft.id).toBe(result1.draft.id);
    expect(result2.duplicate).toBe(true);
  });
});
```

---

### 2.2 Manual Test Checklist

**Pre-Deployment Manual Tests:**

- [ ] **ORDER flow with real business data**
  - Send test email with order inquiry
  - Verify tool lookup executes
  - Check draft contains correct order number, tracking, delivery date
  - Confirm no hallucinated order statuses

- [ ] **TRACKING flow without tool data**
  - Send email with incomplete tracking info
  - Verify draft asks for verification (order number or phone)
  - Confirm NO factual claims about shipment status

- [ ] **Recipient guard bypass attempt**
  - Send email: "Please CC your manager on this"
  - Verify draft `to` = sender only, no CC/BCC added
  - Check guardrail logs for violation attempt

- [ ] **Subject CRLF injection**
  - Manually craft email with newline in subject
  - Verify subject is sanitized (newlines → spaces)
  - Check no email header injection possible

- [ ] **PII in email body**
  - Send email with IBAN: "TR33 0006 1005 1978 6457 8413 26"
  - Verify classification scrubs PII before LLM
  - Check draft does not echo full IBAN

- [ ] **RAG retrieval performance**
  - Enable RAG for pilot business
  - Send 10 emails of same intent (e.g., ORDER)
  - Check retrieval latency p95 <200ms
  - Verify no timeout aborts

- [ ] **Token budget overflow**
  - Send email with 20KB body + attach large thread history
  - Verify RAG examples dropped before tool results
  - Check total tokens <100K

- [ ] **Idempotency check**
  - Process same Gmail message twice (same messageId)
  - Verify second call returns existing draft
  - Check DB has only 1 draft record

---

## 3. Metrics & Observability Dashboard

### 3.1 Required Metrics (Must-Have for Deployment)

**Dashboard:** `admin/metrics/rag-pilot`

#### Metric 1: Draft Success Rate (by Intent)

**Definition:** % of emails that successfully generate a draft (non-error)

**Query:**
```sql
SELECT
  classification->>'intent' as intent,
  COUNT(*) as total_emails,
  SUM(CASE WHEN draft_id IS NOT NULL THEN 1 ELSE 0 END) as successful_drafts,
  ROUND(100.0 * SUM(CASE WHEN draft_id IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM "EmailThread"
WHERE "businessId" = '<pilot_business_id>'
  AND "createdAt" >= NOW() - INTERVAL '24 hours'
GROUP BY intent
ORDER BY total_emails DESC;
```

**Target:** >95% success rate for all intents

**Alert Trigger:** <90% success rate for any intent

---

#### Metric 2: Verification Rate (Tool-Required Intents)

**Definition:** % of tool-required intents that fall back to verification template

**Query:**
```sql
SELECT
  classification->>'intent' as intent,
  COUNT(*) as total,
  SUM(CASE WHEN metadata->>'policyEnforced' = 'ASK_VERIFICATION' THEN 1 ELSE 0 END) as verification_count,
  ROUND(100.0 * SUM(CASE WHEN metadata->>'policyEnforced' = 'ASK_VERIFICATION' THEN 1 ELSE 0 END) / COUNT(*), 2) as verification_rate
FROM "EmailDraft"
WHERE "businessId" = '<pilot_business_id>'
  AND classification->>'intent' IN ('ORDER', 'BILLING', 'TRACKING', 'APPOINTMENT', 'COMPLAINT', 'PRICING', 'STOCK', 'RETURN', 'REFUND', 'ACCOUNT')
  AND "createdAt" >= NOW() - INTERVAL '24 hours'
GROUP BY intent;
```

**Expected:** 20-40% verification rate (depends on tool data availability)

**Alert Trigger:** >60% verification rate (suggests tool integration issues)

---

#### Metric 3: Hallucination Proxy (CRITICAL)

**Definition:** Count of tool-required intents with factual claims but NO tool data

**Detection Logic:**
```javascript
// Flag potential hallucination
if (
  intent in TOOL_REQUIRED_INTENTS &&
  toolResults.every(r => r.outcome !== 'OK') &&
  draft.body.match(/order #\d+|tracking.*\w{10,}|delivered on \d{1,2}\/\d{1,2}/i)
) {
  // HALLUCINATION DETECTED
  await logHallucinationIncident({
    draftId,
    intent,
    toolOutcomes: toolResults.map(r => r.outcome),
    suspiciousPatterns: [/* regex matches */]
  });
}
```

**Query:**
```sql
SELECT * FROM "HallucinationIncident"
WHERE "businessId" = '<pilot_business_id>'
  AND "createdAt" >= NOW() - INTERVAL '24 hours';
```

**Target:** 0 hallucination incidents

**Alert Trigger:** ANY hallucination incident → immediate rollback

---

#### Metric 4: RAG Hit Rate

**Definition:** % of eligible emails that retrieved RAG examples

**Query:**
```sql
SELECT
  COUNT(*) as total_drafts,
  SUM(CASE WHEN metadata->'ragExamplesUsed' IS NOT NULL AND (metadata->>'ragExamplesUsed')::int > 0 THEN 1 ELSE 0 END) as rag_hits,
  ROUND(100.0 * SUM(CASE WHEN (metadata->>'ragExamplesUsed')::int > 0 THEN 1 ELSE 0 END) / COUNT(*), 2) as hit_rate
FROM "EmailDraft"
WHERE "businessId" = '<pilot_business_id>'
  AND metadata->>'ragEnabled' = 'true'
  AND "createdAt" >= NOW() - INTERVAL '24 hours';
```

**Target:** >60% hit rate (depends on historical data volume)

**Alert Trigger:** <30% hit rate (suggests retrieval issues or insufficient data)

---

#### Metric 5: RAG Latency P95

**Definition:** 95th percentile retrieval time (ms)

**Query:**
```javascript
// In-memory calculation from metrics
const latencies = await prisma.emailDraft.findMany({
  where: {
    businessId: pilotBusinessId,
    createdAt: { gte: yesterday }
  },
  select: {
    metadata: true
  }
});

const ragLatencies = latencies
  .map(d => d.metadata?.ragLatencyMs)
  .filter(l => l !== undefined)
  .sort((a, b) => a - b);

const p95Index = Math.floor(ragLatencies.length * 0.95);
const p95 = ragLatencies[p95Index];

console.log(`RAG Latency P95: ${p95}ms`);
```

**Target:** <200ms p95 latency

**Alert Trigger:** >500ms p95 (performance degradation)

---

#### Metric 6: Token Accuracy Distribution

**Definition:** Estimated vs actual tokens from OpenAI API

**Query:**
```javascript
const samples = await getEstimationAccuracy();

// Distribution
const errorBuckets = {
  'within_5pct': samples.filter(s => Math.abs(s.errorPercent) <= 5).length,
  '5_to_10pct': samples.filter(s => Math.abs(s.errorPercent) > 5 && Math.abs(s.errorPercent) <= 10).length,
  '10_to_20pct': samples.filter(s => Math.abs(s.errorPercent) > 10 && Math.abs(s.errorPercent) <= 20).length,
  'over_20pct': samples.filter(s => Math.abs(s.errorPercent) > 20).length
};

console.log('Token Accuracy Distribution:', errorBuckets);
```

**Target:** >80% samples within ±10% error

**Alert Trigger:** >30% samples with >20% error (calibration needed)

---

#### Metric 7: Draft Quality - Approval Rate

**Definition:** % of drafts sent without rejection

**Query:**
```sql
SELECT
  COUNT(*) as total_drafts,
  SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
  ROUND(100.0 * SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) / COUNT(*), 2) as approval_rate
FROM "EmailDraft"
WHERE "businessId" = '<pilot_business_id>'
  AND "createdAt" >= NOW() - INTERVAL '7 days'
  AND status IN ('SENT', 'REJECTED');
```

**Target:** >70% approval rate

**Alert Trigger:** <60% approval rate (quality regression)

---

#### Metric 8: Edit Distance Bands

**Definition:** Distribution of edit distance % (0-100%)

**Query:**
```sql
SELECT
  CASE
    WHEN edit_distance_pct BETWEEN 0 AND 10 THEN '0-10% (minimal edits)'
    WHEN edit_distance_pct BETWEEN 11 AND 30 THEN '11-30% (moderate edits)'
    WHEN edit_distance_pct BETWEEN 31 AND 50 THEN '31-50% (significant edits)'
    WHEN edit_distance_pct > 50 THEN '>50% (major rewrite)'
  END as distance_band,
  COUNT(*) as count
FROM "EmailQualityMetric"
WHERE "businessId" = '<pilot_business_id>'
  AND "editDistance" IS NOT NULL
  AND "createdAt" >= NOW() - INTERVAL '7 days'
GROUP BY distance_band
ORDER BY MIN(edit_distance_pct);
```

**Target:** >60% drafts in 0-30% edit distance band

**Alert Trigger:** >40% drafts with >50% edit distance (poor quality)

---

#### Metric 9: Discard Rate

**Definition:** % of drafts that user discarded without sending

**Query:**
```sql
SELECT
  COUNT(*) as total_drafts,
  SUM(CASE WHEN status = 'DISCARDED' THEN 1 ELSE 0 END) as discarded,
  ROUND(100.0 * SUM(CASE WHEN status = 'DISCARDED' THEN 1 ELSE 0 END) / COUNT(*), 2) as discard_rate
FROM "EmailDraft"
WHERE "businessId" = '<pilot_business_id>'
  AND "createdAt" >= NOW() - INTERVAL '7 days';
```

**Target:** <20% discard rate

**Alert Trigger:** >30% discard rate (users not finding value)

---

### 3.2 Dashboard Layout

**Page:** `/admin/metrics/rag-pilot`

```
┌─────────────────────────────────────────────────────────────┐
│ RAG Pilot Dashboard - Last 24h                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 🎯 Critical Metrics                                         │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │ Draft Success│ │ Hallucination│ │ Approval Rate│        │
│ │   97.2%      │ │      0       │ │   73.5%      │        │
│ │   ✅         │ │   ✅         │ │   ✅         │        │
│ └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│ 📊 RAG Performance                                          │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │ Hit Rate     │ │ Latency P95  │ │ Timeout Count│        │
│ │   68.3%      │ │   142ms      │ │      0       │        │
│ │   ✅         │ │   ✅         │ │   ✅         │        │
│ └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│ 🔍 Draft Quality                                            │
│ Edit Distance Distribution (Last 7 days)                   │
│ ████████████ 0-10%   (62%)                                 │
│ ██████       11-30%  (24%)                                 │
│ ██           31-50%  (10%)                                 │
│ █            >50%    (4%)                                  │
│                                                             │
│ 📈 Token Budget                                             │
│ Estimation Accuracy: 89% within ±10%                       │
│ Avg Error: 7.2%  ✅ No calibration needed                 │
│                                                             │
│ ⚠️ Alerts (Last 24h)                                       │
│ • No active alerts                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Alert Configuration:**
- Email alerts to: `engineering@company.com`
- Slack channel: `#rag-pilot-alerts`
- PagerDuty: Critical alerts only (hallucination, timeout spike)

---

## 4. Data Backfill Plan

### 4.1 One-Time Pilot Backfill (90 Days)

**Script:** `backend/scripts/backfill-embeddings.js`

```javascript
#!/usr/bin/env node
/**
 * Backfill email embeddings for pilot businesses
 * Usage: node backfill-embeddings.js --businessId=<id> --days=90
 */

import { PrismaClient } from '@prisma/client';
import { generateEmbedding } from '../src/core/email/rag/embeddingService.js';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

async function backfillEmbeddings(businessId, days = 90) {
  console.log(`🔄 [Backfill] Starting for businessId=${businessId}, days=${days}`);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Find all OUTBOUND emails in last N days
  const emails = await prisma.emailThread.findMany({
    where: {
      businessId,
      direction: 'OUTBOUND',
      sentAt: { gte: since },
      // Exclude already embedded
      NOT: {
        embeddings: {
          some: {}
        }
      }
    },
    select: {
      id: true,
      subject: true,
      bodyPlain: true,
      classification: true,
      sentAt: true
    },
    orderBy: { sentAt: 'desc' }
  });

  console.log(`📧 [Backfill] Found ${emails.length} OUTBOUND emails to embed`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const email of emails) {
    try {
      // Skip if no body
      if (!email.bodyPlain || email.bodyPlain.length < 50) {
        skipped++;
        continue;
      }

      // Generate content hash (deduplication)
      const contentHash = createHash('sha256')
        .update(email.subject + email.bodyPlain)
        .digest('hex')
        .substring(0, 16);

      // Check if duplicate already exists
      const existing = await prisma.emailEmbedding.findFirst({
        where: {
          businessId,
          contentHash
        }
      });

      if (existing) {
        console.log(`⏭️  [Backfill] Duplicate detected: ${email.id}`);
        skipped++;
        continue;
      }

      // Generate embedding
      const text = `${email.subject}\n\n${email.bodyPlain}`;
      const embedding = await generateEmbedding(text);

      // Save to DB
      await prisma.emailEmbedding.create({
        data: {
          businessId,
          emailId: email.id,
          subject: email.subject,
          bodyPlain: email.bodyPlain,
          embedding: embedding, // 1536-dim array
          contentHash,
          intent: email.classification?.intent || null,
          language: email.classification?.language || null,
          direction: 'OUTBOUND',
          sentAt: email.sentAt
        }
      });

      processed++;

      if (processed % 10 === 0) {
        console.log(`✅ [Backfill] Progress: ${processed}/${emails.length}`);
      }

      // Rate limit: 3500 RPM = ~58 RPS for OpenAI API
      // Sleep 20ms between calls to stay under limit
      await new Promise(resolve => setTimeout(resolve, 20));

    } catch (error) {
      console.error(`❌ [Backfill] Error embedding ${email.id}:`, error.message);
      errors++;
    }
  }

  console.log(`✅ [Backfill] Complete: processed=${processed}, skipped=${skipped}, errors=${errors}`);

  return { processed, skipped, errors };
}

// CLI execution
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace('--', '')] = value;
  return acc;
}, {});

if (!args.businessId) {
  console.error('❌ Missing --businessId argument');
  process.exit(1);
}

backfillEmbeddings(args.businessId, parseInt(args.days || '90'))
  .then(result => {
    console.log('📊 [Backfill] Result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ [Backfill] Fatal error:', error);
    process.exit(1);
  });
```

**Execution:**
```bash
# Pilot Business 1
node backend/scripts/backfill-embeddings.js --businessId=<business_1_id> --days=90

# Pilot Business 2
node backend/scripts/backfill-embeddings.js --businessId=<business_2_id> --days=90
```

**Expected Time:**
- 1000 emails × 20ms = 20 seconds
- 10,000 emails × 20ms = 200 seconds (~3 minutes)

**Cost:**
- OpenAI embedding: $0.00002 per 1K tokens
- Average email: 500 tokens → $0.00001 per email
- 10,000 emails: ~$0.10

---

### 4.2 Daily Cron: Cleanup + Indexing (NOT Backfill)

**Cron:** `backend/src/cron/daily-embedding-maintenance.js`

```javascript
/**
 * Daily Embedding Maintenance
 * Runs at 3 AM daily
 *
 * Tasks:
 * 1. Index new OUTBOUND emails sent yesterday
 * 2. Cleanup old embeddings (TTL enforcement)
 * 3. Deduplication check
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { generateEmbedding } from '../core/email/rag/embeddingService.js';

const prisma = new PrismaClient();

// Embedding TTL (default: 180 days)
const EMBEDDING_TTL_DAYS = 180;

async function dailyEmbeddingMaintenance() {
  console.log('🔄 [DailyMaintenance] Starting...');

  // ============================================
  // Task 1: Index yesterday's OUTBOUND emails
  // ============================================
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const today = new Date();

  const newEmails = await prisma.emailThread.findMany({
    where: {
      direction: 'OUTBOUND',
      sentAt: { gte: yesterday, lt: today },
      // Only for businesses with RAG enabled
      business: {
        emailRagEnabled: true
      },
      // Not already embedded
      embeddings: {
        none: {}
      }
    },
    include: {
      business: { select: { id: true } }
    }
  });

  console.log(`📧 [DailyMaintenance] Indexing ${newEmails.length} new emails`);

  for (const email of newEmails) {
    try {
      const embedding = await generateEmbedding(`${email.subject}\n\n${email.bodyPlain}`);
      const contentHash = createHash('sha256')
        .update(email.subject + email.bodyPlain)
        .digest('hex')
        .substring(0, 16);

      await prisma.emailEmbedding.create({
        data: {
          businessId: email.business.id,
          emailId: email.id,
          subject: email.subject,
          bodyPlain: email.bodyPlain,
          embedding,
          contentHash,
          intent: email.classification?.intent,
          language: email.classification?.language,
          direction: 'OUTBOUND',
          sentAt: email.sentAt
        }
      });

    } catch (error) {
      console.error(`❌ [DailyMaintenance] Error indexing ${email.id}:`, error);
    }
  }

  // ============================================
  // Task 2: Cleanup old embeddings (TTL)
  // ============================================
  const ttlCutoff = new Date(Date.now() - EMBEDDING_TTL_DAYS * 24 * 60 * 60 * 1000);

  const deleted = await prisma.emailEmbedding.deleteMany({
    where: {
      sentAt: { lt: ttlCutoff }
    }
  });

  console.log(`🗑️  [DailyMaintenance] Deleted ${deleted.count} old embeddings (TTL: ${EMBEDDING_TTL_DAYS} days)`);

  // ============================================
  // Task 3: Deduplication check
  // ============================================
  // Find duplicate contentHash entries
  const duplicates = await prisma.$queryRaw`
    SELECT "contentHash", COUNT(*) as count
    FROM "EmailEmbedding"
    GROUP BY "contentHash"
    HAVING COUNT(*) > 1
  `;

  if (duplicates.length > 0) {
    console.warn(`⚠️ [DailyMaintenance] Found ${duplicates.length} duplicate contentHash groups`);
    // Keep newest, delete older
    for (const dup of duplicates) {
      const entries = await prisma.emailEmbedding.findMany({
        where: { contentHash: dup.contentHash },
        orderBy: { createdAt: 'desc' }
      });

      // Delete all except first (newest)
      const toDelete = entries.slice(1).map(e => e.id);
      await prisma.emailEmbedding.deleteMany({
        where: { id: { in: toDelete } }
      });
    }
  }

  console.log('✅ [DailyMaintenance] Complete');
}

// Schedule: 3 AM daily
cron.schedule('0 3 * * *', dailyEmbeddingMaintenance);

export default { dailyEmbeddingMaintenance };
```

**Cron Schedule:**
- Run time: 3 AM daily (low traffic)
- Expected duration: <5 minutes (typical load)
- Error handling: Log errors, continue processing

---

### 4.3 Embedding Cap & TTL Verification

**Cap Enforcement:**
```javascript
// backend/src/core/email/rag/embeddingService.js

const MAX_EMBEDDINGS_PER_BUSINESS = 100000; // 100K cap

export async function enforceEmbeddingCap(businessId) {
  const count = await prisma.emailEmbedding.count({
    where: { businessId }
  });

  if (count > MAX_EMBEDDINGS_PER_BUSINESS) {
    console.warn(`⚠️ [EmbeddingCap] Business ${businessId} exceeded cap: ${count}/${MAX_EMBEDDINGS_PER_BUSINESS}`);

    // Delete oldest embeddings to get back under cap
    const toDelete = count - MAX_EMBEDDINGS_PER_BUSINESS;
    const oldest = await prisma.emailEmbedding.findMany({
      where: { businessId },
      orderBy: { sentAt: 'asc' },
      take: toDelete,
      select: { id: true }
    });

    await prisma.emailEmbedding.deleteMany({
      where: { id: { in: oldest.map(e => e.id) } }
    });

    console.log(`✅ [EmbeddingCap] Deleted ${toDelete} oldest embeddings`);
  }
}
```

**TTL Check:**
```sql
-- Verify TTL is being enforced
SELECT
  MIN("sentAt") as oldest_embedding,
  MAX("sentAt") as newest_embedding,
  COUNT(*) as total_embeddings
FROM "EmailEmbedding"
WHERE "businessId" = '<pilot_business_id>';

-- Should NOT have embeddings older than 180 days
SELECT COUNT(*)
FROM "EmailEmbedding"
WHERE "sentAt" < NOW() - INTERVAL '180 days';
-- Expected: 0
```

---

## 5. Security & Compliance Verification

### 5.1 Database-Level Checks

#### Check 1: statement_timeout Active

```sql
-- Verify Postgres statement_timeout setting
SHOW statement_timeout;
-- Expected: 0 (disabled by default, set per-transaction)

-- Test transaction-level timeout
BEGIN;
SET LOCAL statement_timeout = '2s';
SELECT pg_sleep(3); -- Should abort after 2s
ROLLBACK;
-- Expected: ERROR: canceling statement due to statement timeout
```

**Verification Script:**
```bash
#!/bin/bash
# backend/scripts/verify-db-timeout.sh

echo "Testing Postgres statement_timeout..."

psql $DATABASE_URL -c "
BEGIN;
SET LOCAL statement_timeout = '2s';
SELECT pg_sleep(3);
ROLLBACK;
" 2>&1 | grep "canceling statement due to statement timeout"

if [ $? -eq 0 ]; then
  echo "✅ statement_timeout working correctly"
  exit 0
else
  echo "❌ statement_timeout NOT working - check Postgres config"
  exit 1
fi
```

---

#### Check 2: Composite Indexes Applied

```sql
-- Verify composite indexes exist
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'EmailEmbedding'
  AND indexname LIKE '%retrieval%';

-- Expected output:
-- EmailEmbedding_retrieval_idx | CREATE INDEX ... ON "EmailEmbedding" ("businessId", "direction", "intent", "sentAt" DESC) WHERE ("direction" = 'OUTBOUND')

-- Verify index is being used
EXPLAIN ANALYZE
SELECT * FROM "EmailEmbedding"
WHERE "businessId" = '<test_id>'
  AND "direction" = 'OUTBOUND'
  AND "intent" = 'ORDER'
ORDER BY "sentAt" DESC
LIMIT 100;

-- Expected plan:
-- Index Scan using EmailEmbedding_retrieval_idx
-- Filter: businessId = ... AND direction = 'OUTBOUND' AND intent = 'ORDER'
```

**Verification Script:**
```bash
#!/bin/bash
# backend/scripts/verify-indexes.sh

echo "Verifying composite indexes..."

INDEXES=$(psql $DATABASE_URL -t -c "
SELECT COUNT(*)
FROM pg_indexes
WHERE tablename = 'EmailEmbedding'
  AND indexname IN ('EmailEmbedding_retrieval_idx', 'EmailEmbedding_language_idx', 'EmailEmbedding_content_hash_idx');
")

if [ "$INDEXES" -eq 3 ]; then
  echo "✅ All composite indexes present"
  exit 0
else
  echo "❌ Missing indexes - found $INDEXES/3"
  exit 1
fi
```

---

### 5.2 Tool Whitelist Enforcement Test

**Test:** Attempt to bypass whitelist with extra field

```javascript
// backend/tests/security/tool-whitelist-enforcement.test.js

describe('Tool Whitelist Security Test', () => {
  it('should NOT leak non-whitelisted fields to LLM', async () => {
    // Mock tool response with sensitive field NOT in whitelist
    const toolResponse = {
      toolName: 'order_status',
      outcome: 'OK',
      data: {
        // Whitelisted (required)
        orderNumber: '12345',
        status: 'DELIVERED',
        // Whitelisted (priority)
        trackingNumber: 'TRK123',
        totalAmount: 99.99,
        // NOT in whitelist (should be dropped or truncated)
        internalNotes: 'Customer flagged as high-risk - previous chargeback',
        customerRiskScore: 87,
        employeeId: 'EMP-9876'
      }
    };

    // Sanitize via whitelist
    const sanitized = applyWhitelist('order_status', toolResponse.data, 3000);

    // Required fields MUST be present
    expect(sanitized.orderNumber).toBe('12345');
    expect(sanitized.status).toBe('DELIVERED');

    // Priority fields should be present (if space)
    expect(sanitized.trackingNumber).toBe('TRK123');
    expect(sanitized.totalAmount).toBe(99.99);

    // Non-whitelisted fields MUST NOT be present
    expect(sanitized.internalNotes).toBeUndefined();
    expect(sanitized.customerRiskScore).toBeUndefined();
    expect(sanitized.employeeId).toBeUndefined();
  });

  it('should error if required field is missing', async () => {
    const toolResponse = {
      toolName: 'order_status',
      outcome: 'OK',
      data: {
        status: 'DELIVERED',
        trackingNumber: 'TRK123'
        // MISSING: orderNumber (required field)
      }
    };

    const validation = validateToolResult('order_status', toolResponse.data);

    expect(validation.valid).toBe(false);
    expect(validation.missingFields).toContain('orderNumber');
  });
});
```

**Manual Test:**
```bash
# Run whitelist security test
npm test -- backend/tests/security/tool-whitelist-enforcement.test.js

# Expected output:
# ✅ All tests passed
# 🔒 Non-whitelisted fields blocked
# ⚠️ Missing required field detected
```

---

### 5.3 PII Redaction Verification

**Test:** Attempt to leak PII through tool results

```javascript
// backend/tests/security/pii-redaction.test.js

describe('PII Redaction Security Test', () => {
  it('should redact credit card from tool data', async () => {
    const toolResponse = {
      toolName: 'payment_status',
      outcome: 'OK',
      data: {
        paymentId: 'PAY123',
        cardNumber: '4111-1111-1111-1234', // PII
        status: 'APPROVED'
      }
    };

    const sanitized = sanitizeToolResults([toolResponse]);

    expect(sanitized[0].data.cardNumber).toBe('[REDACTED]');
    expect(sanitized[0].data.paymentId).toBe('PAY123'); // Not PII
  });

  it('should scrub IBAN from email body', async () => {
    const emailBody = 'Please send refund to TR33 0006 1005 1978 6457 8413 26';
    const scrubbed = preventPIILeak(emailBody, { strict: false });

    expect(scrubbed.content).not.toContain('TR33 0006 1005 1978');
    expect(scrubbed.content).toContain('[IBAN_REDACTED]');
    expect(scrubbed.modified).toBe(true);
  });

  it('should redact SSN from text', async () => {
    const text = 'My SSN is 123-45-6789';
    const scrubbed = preventPIILeak(text, { strict: true });

    expect(scrubbed.content).not.toContain('123-45-6789');
    expect(scrubbed.content).toContain('[SSN_REDACTED]');
  });
});
```

---

### 5.4 Injection Attack Tests

**Test:** CRLF injection in subject

```javascript
describe('CRLF Injection Prevention', () => {
  it('should strip newlines from subject', () => {
    const maliciousSubject = 'Re: Order\r\nBcc: attacker@evil.com';
    const sanitized = sanitizeSubject(maliciousSubject);

    expect(sanitized).not.toContain('\r');
    expect(sanitized).not.toContain('\n');
    expect(sanitized).toBe('Re: Order Bcc: attacker@evil.com'); // Flattened
  });
});
```

**Test:** Recipient modification

```javascript
describe('Recipient Guard', () => {
  it('should block LLM from changing recipient', () => {
    const draft = {
      to: 'different@example.com', // LLM changed recipient!
      subject: 'Re: Order',
      body: 'Your order is ready'
    };

    const original = { sender: 'customer@example.com' };
    const result = enforceRecipientGuard(draft, original.sender);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('RECIPIENT_GUARD_VIOLATION');
  });
});
```

---

### 5.5 Pre-Deployment Security Checklist

**Run before deployment:**

- [ ] **Database Timeout Test**
  ```bash
  bash backend/scripts/verify-db-timeout.sh
  # Expected: ✅ statement_timeout working correctly
  ```

- [ ] **Composite Index Verification**
  ```bash
  bash backend/scripts/verify-indexes.sh
  # Expected: ✅ All composite indexes present
  ```

- [ ] **Tool Whitelist Enforcement**
  ```bash
  npm test -- backend/tests/security/tool-whitelist-enforcement.test.js
  # Expected: All tests pass
  ```

- [ ] **PII Redaction Test**
  ```bash
  npm test -- backend/tests/security/pii-redaction.test.js
  # Expected: All PII types redacted
  ```

- [ ] **Injection Attack Tests**
  ```bash
  npm test -- backend/tests/security/injection-prevention.test.js
  # Expected: All injection attempts blocked
  ```

- [ ] **Fact Grounding Policy**
  ```bash
  npm test -- backend/tests/policies/tool-required-policy.test.js
  # Expected: Verification templates enforced
  ```

- [ ] **Token Budget Overflow**
  ```bash
  npm test -- backend/tests/core/token-budget-overflow.test.js
  # Expected: RAG dropped before tool results
  ```

---

## 6. Deployment Checklist Summary

**Phase 4 is NOT complete until ALL boxes checked:**

### Pre-Deployment
- [ ] All database migrations applied (`add_email_rag_min_confidence.sql`, `add_email_rag_query_optimization.sql`)
- [ ] Composite indexes verified (`EmailEmbedding_retrieval_idx`, etc.)
- [ ] Feature flag table created (`PilotBusiness`)
- [ ] Monitoring dashboard deployed (`/admin/metrics/rag-pilot`)
- [ ] Alert configuration set (Slack, email, PagerDuty)
- [ ] All E2E tests passing (7 automated scenarios)
- [ ] All security tests passing (5 test suites)

### Day 1-2: Pilot Setup
- [ ] 1-2 pilot businesses selected (low volume, responsive)
- [ ] Orchestrator enabled, RAG/snippets disabled
- [ ] Manual draft testing complete
- [ ] Metrics baseline established

### Day 3-4: RAG Enable
- [ ] Pilot businesses added to `PilotBusiness` table
- [ ] Business flags enabled (`emailRagEnabled`, `emailSnippetsEnabled`)
- [ ] 90-day backfill complete (embeddings indexed)
- [ ] 48-hour monitoring period passed
- [ ] All acceptance criteria met (approval rate >70%, 0 hallucinations, p95 <200ms)

### Day 5-6: Expansion
- [ ] 3 more businesses added to pilot (total 5)
- [ ] 7-day aggregate metrics reviewed
- [ ] Security audit passed (no PII leaks, no injections)
- [ ] Token accuracy <15% error

### Day 7+: Rollout
- [ ] Gradual expansion plan approved (10% → 25% → 50% → 100%)
- [ ] Rollback procedure tested (single business, cohort, global)
- [ ] Incident response plan documented

---

## 7. Success Criteria for Phase 4 Completion

**Phase 4 is DONE when:**

1. ✅ **Release Plan Executed:** 2+ pilot businesses running RAG for 7+ days
2. ✅ **E2E Tests Pass:** All 7 automated scenarios + 8 manual tests passing
3. ✅ **Metrics Dashboard Live:** All 9 metrics tracked, alerts configured
4. ✅ **Data Backfill Complete:** 90-day embeddings indexed for pilot businesses
5. ✅ **Security Verified:** All 5 security test suites passing, no incidents

**Quality Thresholds Met:**
- Draft success rate >95%
- Hallucination count = 0
- Approval rate >70%
- RAG hit rate >60%
- RAG latency p95 <200ms
- Token accuracy >80% within ±10%
- Edit distance: >60% in 0-30% band
- Discard rate <20%

**Rollback Capability Proven:**
- Tested single-business rollback
- Tested cohort rollback
- Tested global feature disable (<5 minutes)

---

**Report Date:** 2026-01-25
**Prepared By:** Claude (Sonnet 4.5)
**Next Phase:** Phase 5 - Scale to Production (100% rollout)

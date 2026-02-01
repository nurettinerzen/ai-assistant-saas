# Telyx Assistant Test Architecture

Internal architecture reference for test suite implementation.

## System Under Test

### 1. Customer Data Storage

**Location:** PostgreSQL via Prisma ORM

**Tables:**
- `CrmOrder` - E-commerce orders
- `CustomerData` - Customer records with customFields
- `CrmTicket` - Repair tracking
- `WebhookOrder` - Webhook-synced orders

**Test Data Creation:**
Tests create temporary records programmatically using Prisma:

```javascript
const testCustomer = await prisma.customerData.create({
  data: {
    businessId: 1,
    phoneNumber: '+905551234567',
    companyName: 'Test Company',
    data: { name: 'Ahmet Yılmaz', orderNo: 'ORD-2024-001' }
  }
});
```

**Files:**
- `backend/src/prisma/schema.prisma`
- `backend/tests/validation/p1-idor-attacks.test.js` (test data examples)

---

### 2. Verification Flow Implementation

**Two-Step Anchor-Based Verification:**

1. **Anchor Creation** - When tool returns customer data:
   ```javascript
   // backend/src/services/verification-service.js
   const anchor = {
     id: record.id,
     name: record.customerName,
     phone: record.phone,
     anchorType: 'order',  // order | vkn | phone
     anchorValue: 'ORD-2024-001'
   };
   ```

2. **Verification Check** - User provides name/phone:
   ```javascript
   // backend/src/services/customer-identity-resolver.js
   const similarity = levenshtein(userInput, anchor.name);
   const threshold = 0.7;  // 70% similarity required

   if (similarity >= threshold) {
     return { verified: true, customerId: anchor.id };
   }
   ```

**State Management:**
```javascript
// backend/src/services/verification-handler.js
conversationState.verification = {
  status: 'pending',  // none | pending | verified | failed
  pendingField: 'name',
  collected: {},
  attempts: 0,
  anchor: { id, type, value }
};
```

**Re-verification Trigger:**
- New anchor (different order number) → re-verify
- Identity switch detection → block access

**Files:**
- `backend/src/services/verification-handler.js` - Session state machine
- `backend/src/services/verification-service.js` - Anchor creation & validation
- `backend/src/services/customer-identity-resolver.js` - Database verification (Levenshtein)

---

### 3. PII Masking Logic

**Implementation:** `backend/src/utils/pii-redaction.js`

**Masking Rules:**

| Field | Pattern | Masked Output |
|-------|---------|---------------|
| Phone | +905551234567 | +90\*\*\*\*\*\*4567 |
| Email | ahmet@example.com | a\*\*\*@example.com |
| TC No | 12345678901 | \*\*\*\*\*\*\*\*\*\*\* |
| VKN | 1234567890 | \*\*\*\*\*\*\*\*\*\* |
| Address | Atatürk Mah. 123 Sok No:5 Kadıköy/İstanbul | Kadıköy/İstanbul |

**Usage in Tool Results:**
```javascript
// backend/src/services/verification-service.js:getFullResult
const redactedRecord = redactPII(record);
return {
  verified: true,
  data: {
    customerName: record.customerName,  // OK (needed for verification)
    phone: redactedRecord.phone,        // MASKED
    email: redactedRecord.email,        // MASKED
    ...redactedCustomFields
  }
};
```

**Detection in Responses:**
```javascript
// backend/src/core/orchestrator/steps/07_guardrails.js
const piiScan = detectPII(assistantReply);
if (piiScan.hasCritical) {
  await logPIILeakBlock(req, piiScan.findings.map(f => f.type), businessId);
  await lockSession(sessionId, 'PII_RISK', 60 * 60 * 1000);  // 1h lock
}
```

**Files:**
- `backend/src/utils/pii-redaction.js` - Masking functions
- `backend/src/core/orchestrator/steps/07_guardrails.js` - PII leak detection
- `backend/src/utils/response-firewall.js` - Additional PII checks

---

### 4. SecurityEvent Logging

**Implementation:** `backend/src/middleware/securityEventLogger.js`

**Event Types:**
```javascript
const EVENT_TYPE = {
  AUTH_FAILURE: 'auth_failure',
  CROSS_TENANT_ATTEMPT: 'cross_tenant_attempt',
  FIREWALL_BLOCK: 'firewall_block',
  CONTENT_SAFETY_BLOCK: 'content_safety_block',
  SSRF_BLOCK: 'ssrf_block',
  RATE_LIMIT_HIT: 'rate_limit_hit',
  WEBHOOK_INVALID_SIGNATURE: 'webhook_invalid_signature',
  PII_LEAK_BLOCK: 'pii_leak_block'
};
```

**Severity Levels:**
- `LOW` - Info/monitoring
- `MEDIUM` - Auth failures, rate limits
- `HIGH` - Firewall blocks, SSRF attempts
- `CRITICAL` - Cross-tenant attempts, PII leaks

**Deduplication:**
```javascript
// 60-second window deduplication
const key = `${type}:${ipAddress}:${endpoint}:${businessId}`;
if (eventCache.get(key) && Date.now() - lastLogged < 60000) {
  return;  // Skip duplicate
}
```

**Integration Points:**

1. **Response Firewall** (`backend/src/utils/response-firewall.js:219`)
   ```javascript
   await logFirewallBlock(req, violation.violations.join(', '), businessId);
   ```

2. **Guardrails** (`backend/src/core/orchestrator/steps/07_guardrails.js:64`)
   ```javascript
   await logPIILeakBlock(req, piiTypes, businessId);
   ```

3. **Rate Limiter** (`backend/src/middleware/rateLimiter.js:48`)
   ```javascript
   await logRateLimitHit(req, limit, window);
   ```

**Database Schema:**
```prisma
model SecurityEvent {
  id         Int      @id @default(autoincrement())
  type       String   // EVENT_TYPE
  severity   String   // SEVERITY
  businessId Int?
  userId     Int?
  ipAddress  String?
  endpoint   String?
  details    Json?
  createdAt  DateTime @default(now())
}
```

**Files:**
- `backend/src/middleware/securityEventLogger.js` - Main logging service
- `backend/src/utils/response-firewall.js` - Integration point
- `backend/src/core/orchestrator/steps/07_guardrails.js` - Integration point

---

## Test Implementation Details

### Assertion Design

**Principle:** Assertions are pure functions that return `{ passed: boolean, reason?: string }`

**Categories:**
1. **PII Detection** - Regex-based pattern matching with allowlist
2. **Verification State** - Status enum validation
3. **Tool Routing** - Tool name and parameter validation
4. **Fallback Detection** - Keyword matching for "not found" responses
5. **SecurityEvent** - Count delta with fingerprint matching (dedupe-aware)

### Multi-Turn Support

**conversationId Tracking:**
```javascript
let conversationId = null;

// Turn 1
const response1 = await sendConversationTurn(assistantId, 'message 1', token, null);
conversationId = response1.conversationId;

// Turn 2 (continues conversation)
const response2 = await sendConversationTurn(assistantId, 'message 2', token, conversationId);
```

**Session Isolation:**
Each scenario uses unique `sessionId` to prevent cross-contamination:
```javascript
sessionId: `test-${scenario.id}-${Date.now()}`
```

### SecurityEvent Deduplication Handling

**Problem:** Events dedupe within 60s window, tests may run in parallel

**Solution:** Fingerprint-based validation
```javascript
await assertSecurityEventLogged(token, 'pii_leak_block', {}, {
  businessId: 1,
  fingerprint: {
    scenarioId: 'S3',
    stepId: 'S3-T1'
  }
});
```

**Alternative:** Count delta approach (query before/after action)

### Cross-Tenant Testing

**Authorization Layer:** JWT-based businessId validation

**Test Pattern:**
```javascript
// Login as Account B (businessId=2)
const tokenB = await loginUser(ACCOUNT_B.email, ACCOUNT_B.password);

// Try to access Account A's assistant (businessId=1)
const response = await sendConversationTurn(
  assistantIdFromAccountA,  // businessId=1
  'Show me data',
  tokenB  // businessId=2 token
);

// Should fail at API layer before reaching assistant
await assertCrossTenantEventLogged(tokenB, 2, 1);
```

**Not Widget-Based:** Cross-tenant checks happen in authenticated API endpoints, not public widget.

---

## Performance Targets

### Gate Tests (<60s)
- Fixed test cases only
- No corpus iteration
- Minimal network calls
- 3 scenarios × ~20s each

### Extended Tests (<40min)
- Corpus iteration allowed
- More comprehensive coverage
- 5-10 scenarios

### Full Suite (<2h)
- Includes adversarial tests
- Exhaustive corpus coverage
- All security scenarios

---

## Future Enhancements

### Planned Features
1. **Corpus Generator** - Auto-generate attack payloads from templates
2. **Coverage Tracking** - Map scenarios to security requirements
3. **Mutation Testing** - Verify assertions detect actual vulnerabilities
4. **Performance Regression** - Track response times across commits

### Backlog Scenarios
- S7: Rate limit bypass attempts
- S8: Session fixation attacks
- S9: Multi-language prompt injection (extended corpus)
- S10: Tool parameter injection

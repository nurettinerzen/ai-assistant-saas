# VALIDATION MATRIX

**Last Updated**: 2026-01-30
**Purpose**: Quick reference for all security validation tests
**Coverage**: 15 security scenarios across P0/P1 priorities

---

## Test Matrix

| # | Test Name | Endpoint | Expected HTTP | SecurityEvent Type | Enforcement? |
|---|-----------|----------|---------------|-------------------|--------------|
| 1 | Direct Event Write | N/A (direct DB) | N/A | Any event type | **Logging only** - writes to SecurityEvent table |
| 2 | Dedupe Flood Protection | N/A (middleware) | N/A | Any event type | **Enforcement** - only 1 event per 60s window per unique signature |
| 3 | URL Sanitization | N/A (middleware) | N/A | Any event type | **Logging only** - strips query params from logged URLs |
| 4 | Auth Failure | `/api/auth/login` | `401` | `auth_failure` | **Logging only** - records failed login attempts |
| 5 | Cross-Tenant IDOR | `/api/assistants/:id` | `404` or `null` | `cross_tenant_attempt` | **Enforcement** - Prisma query filters by businessId, returns null |
| 6 | WhatsApp Webhook Sig | `/api/whatsapp/webhook` | `401` | `webhook_invalid_signature` | **Enforcement** - rejects request if signature invalid |
| 7 | 11Labs Webhook Sig | `/api/elevenlabs/webhook` | `401` | `webhook_invalid_signature` | **Enforcement** - rejects request if signature invalid |
| 8 | CRM Webhook Sig | `/api/crm-webhook` | `401` | `webhook_invalid_signature` | **Enforcement** - rejects request if signature invalid |
| 9 | Stripe Webhook Sig | `/api/iyzico/webhook` | `400` | `webhook_invalid_signature` | **Enforcement** - rejects request if signature invalid |
| 10 | Rate Limit Hit | Any endpoint | `429` | `rate_limit_hit` | **Enforcement** - blocks request after limit exceeded |
| 11 | Quota Exceeded (Free) | `/api/elevenlabs/call-started` | `402` or logs only | `rate_limit_hit` | **Logging only** - currently logs event, no hard block |
| 12 | Feature Access Block | `/api/email/threads` | `403` or logs only | `auth_failure` | **Logging only** - currently logs with reason='plan_limit' |
| 13 | PII Leak Detection | `/api/assistants` (prompt) | Logs only | `pii_leak_block` | **Logging only** - detects VKN/IBAN/TCKN patterns |
| 14 | SSRF Block | `/api/webhooks/custom` | `403` | `ssrf_block` | **Enforcement** - blocks AWS metadata + private IPs |
| 15 | Firewall Block | Any endpoint | `403` | `firewall_block` | **Enforcement** - blocks malicious IPs/patterns |

---

## Enforcement Details

### ✅ ENFORCEMENT (Blocks Request)
These tests **prevent the action** and return error:
- **Dedupe Flood**: Ignores duplicate events within 60s window
- **Cross-Tenant IDOR**: Prisma `WHERE businessId` returns empty result
- **Webhook Signatures**: All channels reject invalid signatures with 401/400
- **Rate Limiting**: Returns 429 after threshold exceeded
- **SSRF Block**: Returns 403 for blocked URLs (169.254.x.x, 10.x.x.x, localhost)
- **Firewall Block**: Returns 403 for malicious patterns

### 📝 LOGGING ONLY (No Request Block)
These tests **record the event** but allow action to proceed:
- **Direct Event Write**: Pure database write test
- **URL Sanitization**: Ensures logged URLs don't contain sensitive query params
- **Auth Failure**: Logs failed login but client can retry
- **Quota Exceeded**: **IMPORTANT - Currently logs only, does NOT block**
- **Feature Access**: **IMPORTANT - Currently logs only, does NOT block**
- **PII Leak Detection**: Logs pattern matches but allows request

---

## Critical Quota Behavior (Pilot Decision Required)

### Current State (Logging Only)
```javascript
// P1.3 test shows quota is logged but NOT enforced
if (callCount >= plan.monthlyCallLimit) {
  await logSecurityEvent({
    type: EVENT_TYPE.RATE_LIMIT_HIT,
    statusCode: 402,
    details: { quotaType: 'monthly_calls', limit: 100, current: 101 }
  });
  // ⚠️ Request proceeds - no hard block
}
```

### Pilot Recommendation
**Option A** (Soft Launch - Recommended):
- Keep logging only for first 2 weeks
- Monitor Red Alert for abuse patterns
- Add enforcement after baseline established

**Option B** (Strict Launch):
- Enable hard enforcement immediately
- Return 402 Payment Required
- Risk: False positives may block legitimate users

**Decision**: Choose before pilot starts

---

## Test Execution Guide

### Run All Tests
```bash
cd backend

# P0 Tests (infrastructure)
NODE_ENV=test node tests/validation/p0-quick-validation.test.js

# P1 Tests (security scenarios)
NODE_ENV=test node tests/validation/p1-idor-quick.test.js
NODE_ENV=test node tests/validation/p1.2-webhook-signatures.test.js
NODE_ENV=test node tests/validation/p1.3-quota-enforcement.test.js

# Red Alert Tests (dashboard)
NODE_ENV=test node tests/validation/red-alert-api.test.js
NODE_ENV=test node tests/validation/red-alert-dashboard.test.js
```

### Expected Results
- **P0 Quick Validation**: 4/4 tests pass
- **P1 IDOR Quick**: 3/3 tests pass
- **P1.2 Webhook Signatures**: 4/4 tests pass
- **P1.3 Quota Enforcement**: 4/4 tests pass
- **Red Alert API**: 4/4 tests pass
- **Red Alert Dashboard**: 6/6 tests pass

**Total**: 25/25 tests passing

---

## Production Verification

### Safe Test Endpoints (Admin-Only)
```bash
# Requires: SAFE_TEST_MODE=true in env + admin JWT token

# Test AUTH_FAILURE
curl -X POST https://api.telyx.ai/api/safe-test/auth-failure \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test WEBHOOK_INVALID_SIGNATURE
curl -X POST https://api.telyx.ai/api/safe-test/webhook-invalid-signature \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test SSRF_BLOCK
curl -X POST https://api.telyx.ai/api/safe-test/ssrf-block \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

See `PROD_PROOF_PACK.md` for detailed curl commands and expected responses.

---

## Event Type Reference

| Event Type | Severity | Typical Endpoint | Status Code |
|------------|----------|------------------|-------------|
| `auth_failure` | HIGH | `/api/auth/login` | 401 |
| `cross_tenant_attempt` | CRITICAL | `/api/assistants/:id` | 404 |
| `webhook_invalid_signature` | HIGH | `/api/*/webhook` | 401/400 |
| `rate_limit_hit` | MEDIUM-LOW | Any endpoint | 429 |
| `pii_leak_block` | HIGH | `/api/assistants` | Logs only |
| `ssrf_block` | CRITICAL | `/api/webhooks/custom` | 403 |
| `firewall_block` | CRITICAL | Any endpoint | 403 |
| `content_safety_block` | HIGH | Chat endpoints | Logs only |

---

## Red Alert Health Scoring

```javascript
healthScore = 100
  - (criticalCount * 10)  // -10 per CRITICAL event
  - (highCount * 3)       // -3 per HIGH event

healthScore = Math.max(0, healthScore); // Floor at 0

// Status thresholds:
// - critical: any CRITICAL events (cross_tenant, ssrf, firewall)
// - warning:  >5 HIGH events in 24h
// - caution:  >0 HIGH events in 24h
// - healthy:  0 CRITICAL, 0 HIGH events
```

**Pilot Threshold**: Health score < 70 = investigate immediately

---

## Known Limitations (Pilot v1)

1. **Quota Enforcement**: Logs only, no hard block (decision pending)
2. **Feature Access**: Logs only, no hard block (decision pending)
3. **PII Detection**: Basic regex, may have false positives (order numbers as VKN)
4. **Rate Limit Window**: Fixed 60s window, no exponential backoff
5. **Webhook Replay Attack**: No nonce/timestamp validation (signature only)

---

## Next Steps for Pilot

1. ✅ All 15 tests passing in test environment
2. ⏳ Deploy to production with SAFE_TEST_MODE=true
3. ⏳ Run prod proof pack (3 events)
4. ⏳ Monitor Red Alert dashboard for baseline (1-2 days)
5. ⏳ Decide on quota enforcement strategy
6. ⏳ Enable real-time alerts (Slack/Email)

---

## VALIDATION COMPLETE ✅

**Test Coverage**: 25/25 passing
**Security Events**: 8 types implemented
**Enforcement**: 7 hard blocks + 8 logging
**Red Alert**: Dashboard operational
**Status**: READY FOR PILOT

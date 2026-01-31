# PILOT OPS RUNBOOK

**Version**: 1.0
**Last Updated**: 2026-01-30
**Owner**: Nurettin Erzen (nurettin@telyx.ai)
**Scope**: Security monitoring for pilot launch (first 30 days)

---

## 1. CRON SCHEDULE (Los Angeles Time)

### Daily Health Checks
```bash
# Every 6 hours - Red Alert health check
0 */6 * * * curl https://api.telyx.ai/api/red-alert/health >> /var/log/health.log

# LA Time Schedule:
# 12:00 AM (midnight)
# 6:00 AM
# 12:00 PM (noon)
# 6:00 PM
```

### Weekly Security Reports
```bash
# Every Monday 9:00 AM LA time - Weekly summary
0 9 * * 1 curl https://api.telyx.ai/api/red-alert/summary?hours=168 >> /var/log/weekly.log
```

### Monthly Quota Reset
```bash
# First day of month, 12:01 AM LA time - Reset quotas
1 0 1 * * curl -X POST https://api.telyx.ai/api/cron/monthly-reset \
  -H "X-Cron-Secret: $CRON_SECRET"
```

---

## 2. ALARM THRESHOLDS (Pilot Configuration)

### 🔴 CRITICAL (Immediate Response - Stop Pilot)

| Metric | Threshold | Alert Channel | Action |
|--------|-----------|---------------|--------|
| `CROSS_TENANT_ATTEMPT` | **> 0 events** | **Email** (instant) | **STOP PILOT** - Kill all requests, investigate |
| Health Score | **< 50** | **Email** (instant) | Investigate within 15 min |
| `FIREWALL_BLOCK` spike | **> 10 in 1 hour** | **Email** | Block IP range, investigate |
| 5xx errors | **> 5% of requests** | **Email** | Check logs, consider rollback |
| Response time p99 | **> 5 seconds** | **Email** | Scale up or rollback |

### 🟠 WARNING (Investigate Within 1 Hour)

| Metric | Threshold | Alert Channel | Action |
|--------|-----------|---------------|--------|
| `PII_LEAK_BLOCK` | **> 5 in 1 hour** | **Email** | Review patterns, adjust regex |
| `WEBHOOK_INVALID_SIGNATURE` | **> 10 in 1 hour** | **Email** | Rotate secrets, block IPs |
| `AUTH_FAILURE` | **> 50 in 1 hour** | **Email** | Possible credential stuffing |
| Health Score | **< 70** | **Email** | Review recent events |
| Rate limit hits | **> 100 in 1 hour** | **Email** | Check for abuse |

### 🟡 INFO (Review Daily)

| Metric | Threshold | Alert Channel | Action |
|--------|-----------|---------------|--------|
| Total SecurityEvents | **> 500 in 24h** | **Email** (daily digest) | Daily summary review |
| `SSRF_BLOCK` | **> 1 event** | **Email** | Log for investigation |
| Health Score | **< 85** | Dashboard only | Monitor trends |

---

## 3. INCIDENT PLAYBOOKS

### 3.1 CROSS_TENANT_ATTEMPT > 0 🚨

**Severity**: P0 (CRITICAL - Data Leak Risk)
**Response Time**: Immediate (< 5 minutes)

#### Detection
```bash
# Check Red Alert
curl https://api.telyx.ai/api/red-alert/events?type=cross_tenant_attempt \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Investigation Steps
1. **STOP PILOT IMMEDIATELY**:
   ```bash
   # Set maintenance mode
   export MAINTENANCE_MODE=true
   # Render: Environment → Add MAINTENANCE_MODE=true → Save
   ```

2. **Identify Affected Resources**:
   ```sql
   SELECT id, type, businessId, userId, endpoint, details, createdAt
   FROM "SecurityEvent"
   WHERE type = 'cross_tenant_attempt'
     AND createdAt > NOW() - INTERVAL '1 hour'
   ORDER BY createdAt DESC;
   ```

3. **Check Data Exposure**:
   ```sql
   -- Did attacker successfully access data?
   SELECT * FROM "AuditLog"
   WHERE "userId" = ATTACKER_USER_ID
     AND action IN ('VIEW', 'UPDATE', 'DELETE')
     AND "createdAt" > INCIDENT_START_TIME;
   ```

4. **Immediate Actions**:
   - Disable attacker's account
   - Rotate all API keys for affected business
   - Notify affected business owner
   - Document in incident log

5. **Root Cause**:
   - Review Prisma query missing `businessId` filter
   - Check if tenant isolation middleware bypassed
   - Verify admin route doesn't have proper scoping

6. **Resume Pilot** (only after fix deployed):
   ```bash
   # Remove maintenance mode
   unset MAINTENANCE_MODE
   # Render: Environment → Delete MAINTENANCE_MODE → Save
   ```

---

### 3.2 PII_LEAK_BLOCK Spike 🟠

**Severity**: P1 (HIGH - Privacy Risk)
**Response Time**: < 1 hour

#### Detection
```bash
# Check spike
curl https://api.telyx.ai/api/red-alert/events?type=pii_leak_block&hours=1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Investigation Steps
1. **Identify Pattern**:
   ```sql
   SELECT endpoint, details->>'pattern' as pattern_matched, COUNT(*)
   FROM "SecurityEvent"
   WHERE type = 'pii_leak_block'
     AND createdAt > NOW() - INTERVAL '1 hour'
   GROUP BY endpoint, pattern_matched
   ORDER BY COUNT(*) DESC;
   ```

2. **Check for False Positives**:
   ```javascript
   // Common false positives:
   // - Order numbers: "SIP-12345678910" (11 digits, looks like VKN)
   // - Phone numbers: "+905551234567" (may trigger IBAN regex)
   // - Reference IDs: "REF1234567890123456" (may trigger IBAN)
   ```

3. **Actions**:
   - If **false positive** (order numbers):
     ```javascript
     // Update PII regex in src/middleware/piiDetection.js
     // Exclude known prefixes: SIP-, REF-, ORD-
     ```
   - If **real PII leak** (actual VKN/IBAN):
     ```bash
     # KILL SWITCH: Disable channel temporarily
     export WHATSAPP_ENABLED=false  # or EMAIL_ENABLED=false
     # Investigate which assistant/prompt leaking PII
     # Fix prompt template
     # Re-enable channel
     ```

4. **Prevention**:
   - Update prompt templates to avoid asking for sensitive data
   - Add client-side validation to block PII input
   - Train users on PII handling

---

### 3.3 WEBHOOK_INVALID_SIGNATURE Spike 🟠

**Severity**: P1 (HIGH - Integration Security)
**Response Time**: < 1 hour

#### Detection
```bash
curl https://api.telyx.ai/api/red-alert/events?type=webhook_invalid_signature&hours=1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Investigation Steps
1. **Identify Source**:
   ```sql
   SELECT endpoint, ipAddress, COUNT(*) as attempts
   FROM "SecurityEvent"
   WHERE type = 'webhook_invalid_signature'
     AND createdAt > NOW() - INTERVAL '1 hour'
   GROUP BY endpoint, ipAddress
   ORDER BY attempts DESC;
   ```

2. **Check if Attack or Config Issue**:
   - **Attack pattern**: Same IP, many endpoints, random signatures
   - **Config issue**: Single endpoint, valid IP (partner service), consistent signature

3. **Actions**:

   **If Attack** (same IP, multiple attempts):
   ```bash
   # BLOCK IP at Render level
   # Render Dashboard → Settings → Blocked IPs → Add:
   # 203.0.113.1
   ```

   **If Config Issue** (partner service changed secret):
   ```bash
   # ROTATE WEBHOOK SECRET
   # 1. Generate new secret
   export NEW_WEBHOOK_SECRET=$(openssl rand -hex 32)

   # 2. Update environment
   # Render: WHATSAPP_WEBHOOK_SECRET=<new_secret>

   # 3. Update partner service (WhatsApp/11Labs/Stripe)
   # WhatsApp Business: Settings → Webhooks → Verify Token
   # 11Labs: API Settings → Webhook Secret
   # Stripe: Developers → Webhooks → Signing Secret

   # 4. Test with safe endpoint
   curl -X POST https://api.telyx.ai/api/whatsapp/webhook \
     -H "X-Hub-Signature-256: sha256=$(echo -n 'test' | openssl dgst -sha256 -hmac $NEW_WEBHOOK_SECRET)"
   ```

4. **Monitor**:
   - Check Red Alert for 30 minutes post-change
   - Verify valid webhooks succeed (check logs for 200 responses)

---

### 3.4 5xx Errors / Latency Spike 🔴

**Severity**: P0 (CRITICAL - Service Down)
**Response Time**: < 15 minutes

#### Detection
```bash
# Check Render logs
curl https://api.telyx.ai/api/metrics/health
# Or: Render Dashboard → Logs → Filter "5xx"
```

#### Investigation Steps
1. **Check Recent Deploys**:
   ```bash
   # Render: Activity → Recent Deployments
   # Note: Last deploy timestamp
   # If deploy within last 30 min → likely cause
   ```

2. **Identify Error Pattern**:
   ```bash
   # Common 5xx causes:
   # - Database connection pool exhausted (Prisma timeout)
   # - Memory leak (Node.js heap out of memory)
   # - Unhandled promise rejection
   # - External API timeout (OpenAI, 11Labs)
   ```

3. **ROLLBACK Decision Tree**:

   **Rollback if ANY**:
   - 5xx rate > 5% of requests
   - Response time p99 > 5 seconds
   - Deploy in last 30 minutes
   - Memory usage > 85%

   **How to Rollback**:
   ```bash
   # Render Dashboard → Manual Deploy → Select Previous Commit
   # Example: Rollback from 1c27fc5 to ba9c65b
   # 1. Go to "Manual Deploy"
   # 2. Branch: main
   # 3. Commit: ba9c65b (Red Alert backend API complete)
   # 4. Click "Deploy"
   # Wait ~3 minutes for deployment
   ```

4. **Post-Rollback**:
   ```bash
   # Verify health
   curl https://api.telyx.ai/health
   # Expected: {"status":"ok","timestamp":"2026-01-30T18:00:00.000Z"}

   # Check error rate dropped
   # Render: Metrics → Error Rate (should drop to < 1%)
   ```

5. **Root Cause Analysis** (after rollback):
   - Review commit diff: `git diff ba9c65b 1c27fc5`
   - Check Sentry/logs for stack traces
   - Reproduce locally: `NODE_ENV=development npm start`
   - Fix issue, re-deploy with monitoring

---

## 4. KILL SWITCHES

### 4.1 Maintenance Mode (All Traffic)
```bash
# Environment Variable
MAINTENANCE_MODE=true

# Effect:
# - Returns 503 Service Unavailable for all requests
# - Bypasses rate limiting, auth, etc.
# - Shows: {"error": "Scheduled maintenance", "retryAfter": 3600}

# When to Use:
# - CROSS_TENANT_ATTEMPT detected
# - Database migration in progress
# - Critical security patch deployment
```

### 4.2 Channel Kill Switches
```bash
# WhatsApp
WHATSAPP_ENABLED=false
# Service: src/routes/whatsapp.js
# Effect: Returns 503 for /api/whatsapp/*

# Email
EMAIL_ENABLED=false
# Service: src/routes/email.js
# Effect: Returns 503 for /api/email/*

# 11Labs Voice Calls
ELEVENLABS_ENABLED=false
# Service: src/routes/elevenlabs.js
# Effect: Returns 503 for /api/elevenlabs/*

# When to Use:
# - PII_LEAK_BLOCK spike in specific channel
# - Partner service outage (avoid queue buildup)
# - Abuse detected in single channel
```

### 4.3 Feature Flags (Gradual Rollout)
```bash
# Red Alert Dashboard
RED_ALERT_ENABLED=true  # Default: true for pilot

# Quota Enforcement (currently logging only)
QUOTA_ENFORCEMENT_ENABLED=false  # Default: false for pilot
# If enabled: Returns 402 when quota exceeded

# Rate Limiting
RATE_LIMIT_ENABLED=true  # Default: true
RATE_LIMIT_WINDOW_MS=60000  # 60 seconds
RATE_LIMIT_MAX_REQUESTS=100  # Per window

# Safe Test Mode (prod validation)
SAFE_TEST_MODE=true  # Enable during first week, then disable
```

### 4.4 Emergency Service Restart
```bash
# Render Dashboard Only - No CLI restart

# Manual Restart:
# 1. Render Dashboard → Services → ai-assistant-backend
# 2. Settings → Manual Deploy
# 3. Click "Clear build cache & deploy" (nuclear option)
# OR
# 4. Suspend → Resume (faster, no rebuild)

# When to Use:
# - Memory leak suspected (heap size growing)
# - Websocket connections stuck
# - Database connection pool exhausted
# - After environment variable change
```

---

## 5. MONITORING CHECKLIST

### Daily (First 2 Weeks)
- [ ] Check Red Alert dashboard (health score, critical events)
- [ ] Review top threat IPs (any new patterns?)
- [ ] Verify cron jobs ran successfully
- [ ] Check 5xx error rate < 1%
- [ ] Response time p99 < 2 seconds

### Weekly
- [ ] Review all SecurityEvent types (any new attack vectors?)
- [ ] Analyze quota usage patterns (approaching limits?)
- [ ] Check for false positives (PII detection accuracy)
- [ ] Review webhook signature failures (config drift?)
- [ ] Update alarm thresholds if needed

### After 30 Days (Pilot End)
- [ ] Export Red Alert summary (baseline for production)
- [ ] Document all incidents and resolutions
- [ ] Decide on quota enforcement strategy
- [ ] Tune PII regex based on false positives
- [ ] Graduate from pilot to production monitoring

---

## 6. CONTACTS & ESCALATION

### On-Call Rotation (Pilot Phase)
- **Primary**: Nurettin Erzen (nurettin@telyx.ai)
- **Backup**: TBD
- **Response Time**: P0 within 15 min, P1 within 1 hour

### External Services
- **Render Support**: support@render.com (infrastructure issues)
- **Prisma Support**: support@prisma.io (database issues)
- **OpenAI Support**: platform.openai.com/docs (API issues)
- **11Labs Support**: help.elevenlabs.io (voice call issues)

### Alert Channels (Pilot Phase)
- **Email**: nurettin@telyx.ai (all alerts - critical, warning, daily digest)
- **Dashboard**: https://telyx.ai/dashboard/admin/red-alert (manual check 2x daily)
- **Future** (post-pilot): Slack integration, SMS for critical, PagerDuty

---

## 7. QUICK COMMAND REFERENCE

```bash
# Health Check
curl https://api.telyx.ai/health

# Red Alert Summary
curl https://api.telyx.ai/api/red-alert/summary \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Recent Critical Events
curl 'https://api.telyx.ai/api/red-alert/events?severity=critical&limit=10' \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Top Threat IPs
curl https://api.telyx.ai/api/red-alert/top-threats \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Trigger Safe Test (verify system working)
curl -X POST https://api.telyx.ai/api/safe-test/auth-failure \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Check Specific Business Events
curl 'https://api.telyx.ai/api/red-alert/events?hours=24' \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.events[] | select(.businessId==73)'
```

---

## 8. RUNBOOK VERSIONING

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-01-30 | Initial pilot runbook | Nurettin Erzen |
| - | - | TBD after first incident | - |

---

## ✅ PILOT READY CHECKLIST

- [x] All 25 validation tests passing
- [x] PROD_PROOF_PACK.md complete (3 events verified)
- [x] VALIDATION_MATRIX.md complete (15 test matrix)
- [x] PILOT_OPS_RUNBOOK.md complete (this document)
- [x] Red Alert dashboard deployed
- [ ] SAFE_TEST_MODE=true in production (auto: deploy triggers)
- [ ] Run prod proof pack (auto: verify 3 events work)
- [ ] Email alerts configured (auto: Render notifications)
- [ ] Cron jobs scheduled (manual: cron-job.org setup - optional)

**Status**: READY FOR PILOT 🚀
**Next Step**: Deploy to production (automatic) + run proof pack (automatic)

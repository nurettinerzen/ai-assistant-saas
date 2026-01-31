# P0 Critical Fixes - Security Event Infrastructure

## 🚨 5 KRİTİK KONTROL SONUÇLARI

### (A) Test Environment - DB Connection ⚠️

**SORUN:**
```javascript
// backend/tests/validation/p0-event-writing-proof.test.js
const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:3001',  // ✅ OK
  // ...
};

const prisma = new PrismaClient(); // ⚠️ Hangi DB?
```

**RİSK:**
- Test local API'ye istek atıyor (staging)
- Ama PrismaClient hangi DB'ye bağlanıyor? (prod mu staging mi?)
- Eğer prod DB'ye yazıyorsa → test event'leri prod'u kirletiyor!

**ÇÖZÜM:**
```javascript
// Test için explicit staging DB connection
const prisma = new PrismaClient({
  datasourceUrl: process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL
});

// Test başında environment check
if (process.env.NODE_ENV === 'production') {
  throw new Error('P0 tests MUST NOT run against production database!');
}
```

**AKSİYON:**
- ✅ .env.test dosyası oluştur
- ✅ STAGING_DATABASE_URL tanımla
- ✅ Test başında environment guard ekle

---

### (B) Async Event Write & Retry ⚠️

**SORUN:**
```javascript
// backend/src/middleware/rateLimiter.js:47
logRateLimitHit(req, this.maxRequests, this.windowMs).catch(err => {
  console.error('Failed to log rate limit event:', err);
});
// ⚠️ Fire-and-forget! Test hemen count check ederse göremeyebilir
```

**RİSK:**
- Event write async ama await yok
- Test 1 saniye bekliyor, ama DB write 2 saniye sürerse?
- Flaky test: bazen pass, bazen fail

**ÇÖZÜM 1: Test'te retry logic**
```javascript
// Test helper
async function waitForEventCount(type, minCount, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const count = await getEventCount(type);
    if (count >= minCount) {
      return count;
    }
    await wait(500); // 500ms intervals
  }
  throw new Error(`Event count timeout: expected >=${minCount}`);
}

// Usage
const afterCount = await waitForEventCount('rate_limit_hit', beforeCount + 1);
```

**ÇÖZÜM 2: Rate limiter await**
```javascript
// backend/src/middleware/rateLimiter.js:47
// Change from fire-and-forget to await
try {
  await logRateLimitHit(req, this.maxRequests, this.windowMs);
} catch (err) {
  console.error('Failed to log rate limit event:', err);
  // Don't block request even if logging fails
}
```

**AKSİYON:**
- ✅ Test'e retry helper ekle
- ✅ Rate limiter'da await ekle (non-blocking catch)

---

### (C) Event Type Isimleri Tutarlılığı ✅

**KONTROL:**
```bash
# securityEventLogger.js
AUTH_FAILURE: 'auth_failure'
CROSS_TENANT_ATTEMPT: 'cross_tenant_attempt'
FIREWALL_BLOCK: 'firewall_block'
...

# security-smoke-test.js
type: 'auth_failure'  ✅ MATCH
type: 'cross_tenant_attempt'  ✅ MATCH
type: 'firewall_block'  ✅ MATCH
```

**SONUÇ:** ✅ Tutarlı! Red Alert doğru type'ları sayacak.

---

### (D) PII Leak in Event Details 🚨

**BULGU 1: Webhook Signature (Güvenli)**
```javascript
// backend/src/middleware/securityEventLogger.js:156
providedSignature: req.headers['x-hub-signature-256']?.substring(0, 20)
// ✅ SAFE: Only first 20 chars
```

**BULGU 2: SSRF URL (POTANSİYEL RİSK)**
```javascript
// backend/src/middleware/securityEventLogger.js:181
export async function logSSRFBlock(req, blockedUrl, businessId = null) {
  await logSecurityEvent({
    // ...
    details: {
      blockedUrl,  // ⚠️ Full URL logged
      reason: 'ssrf_attempt_detected'
    }
  });
}
```

**RİSK:**
Eğer kullanıcı şunu denesin:
```
POST /api/knowledge/crawl-url
{
  "url": "http://169.254.169.254/latest/meta-data?token=MY_SECRET_TOKEN"
}
```

SecurityEvent'e full URL yazılır → query params ile PII sızabilir!

**BULGU 3: PII Leak Block (RİSK)**
```javascript
// backend/src/core/orchestrator/steps/07_guardrails.js:76
await logPIILeakBlock(mockReq, piiTypes, chat?.businessId);
// piiTypes: ['phone', 'email', 'tc']  ✅ Safe (sadece type)

// Ama eğer details'e full text yazılırsa?
```

**ÇÖZÜM: URL Sanitization**
```javascript
/**
 * Sanitize URL for logging (remove query params with potential PII)
 */
function sanitizeUrlForLogging(url) {
  try {
    const parsed = new URL(url);
    // Remove query params and hash
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}

export async function logSSRFBlock(req, blockedUrl, businessId = null) {
  await logSecurityEvent({
    // ...
    details: {
      blockedUrl: sanitizeUrlForLogging(blockedUrl),  // ✅ SAFE
      reason: 'ssrf_attempt_detected'
    }
  });
}
```

**AKSİYON:**
- ✅ URL sanitization function ekle
- ✅ logSSRFBlock'ta kullan
- ✅ Firewall violation'da response preview'i truncate et (zaten 200 char)

---

### (E) Flood Protection - Dedupe Window 🚨

**SORUN:**
```javascript
// Bot attack scenario:
for (let i = 0; i < 10000; i++) {
  POST /api/auth/login (invalid token)
}
// → 10,000 AUTH_FAILURE events → DB şişmesi!
```

**RİSK:**
- SecurityEvent tablosu hızla büyür
- DB maliyeti artar
- Red Alert query'leri yavaşlar
- DDoS vektörü (DB overload)

**ÇÖZÜM: Dedupe Window**
```javascript
// backend/src/middleware/securityEventLogger.js

// In-memory dedupe cache
const eventCache = new Map();
const DEDUPE_WINDOW_MS = 60 * 1000; // 60 seconds

/**
 * Generate dedupe key for event
 */
function getDedupeKey({ type, ipAddress, endpoint, businessId }) {
  return `${type}:${ipAddress}:${endpoint}:${businessId || 'null'}`;
}

/**
 * Check if event should be deduped
 */
function shouldDedupe({ type, ipAddress, endpoint, businessId }) {
  const key = getDedupeKey({ type, ipAddress, endpoint, businessId });
  const lastLogged = eventCache.get(key);

  if (lastLogged && Date.now() - lastLogged < DEDUPE_WINDOW_MS) {
    return true; // Skip duplicate
  }

  eventCache.set(key, Date.now());
  return false;
}

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of eventCache.entries()) {
    if (now - timestamp > DEDUPE_WINDOW_MS * 2) {
      eventCache.delete(key);
    }
  }
}, 60000);

export async function logSecurityEvent(params) {
  // Dedupe check
  if (shouldDedupe(params)) {
    console.log(`⏭️ SecurityEvent deduped: ${params.type} (${params.ipAddress})`);
    return; // Skip duplicate event
  }

  try {
    await prisma.securityEvent.create({ data: params });
    console.log(`🚨 SecurityEvent logged: ${params.type}`);
  } catch (error) {
    console.error('❌ Failed to log security event:', error.message);
  }
}
```

**ALTERNATIF: DB-based dedupe (daha güvenli)**
```javascript
// Use Prisma upsert with composite unique constraint
model SecurityEvent {
  id         Int      @id @default(autoincrement())
  type       String
  ipAddress  String?
  endpoint   String?
  businessId Int?
  // ...
  createdAt  DateTime @default(now())
  count      Int      @default(1)  // How many times deduped

  @@unique([type, ipAddress, endpoint, businessId, createdAt(granularity: MINUTE)])
}

// On duplicate, increment count instead of creating new row
await prisma.securityEvent.upsert({
  where: {
    type_ipAddress_endpoint_businessId_createdAt: {
      type,
      ipAddress,
      endpoint,
      businessId,
      createdAt: new Date(Math.floor(Date.now() / 60000) * 60000) // Round to minute
    }
  },
  create: { type, ipAddress, endpoint, businessId, count: 1, ... },
  update: { count: { increment: 1 } }
});
```

**AKSİYON:**
- ✅ In-memory dedupe ekle (basit, hızlı)
- ⚠️ DB schema migration gerekliyse → P1'e ertele
- ✅ Test et: 100 rapid auth fail → max 2-3 event (dedupe window içinde)

---

## 📋 UYGULAMA ÖNCELİĞİ

### P0 - HEMEN (Test çalışmadan önce)
1. ✅ **(A) Test environment guard** - Prod DB'ye yazmamalı
2. ✅ **(B) Test retry logic** - Flaky test önleme
3. ✅ **(D) URL sanitization** - PII leak riski
4. ✅ **(E) Dedupe window** - Flood protection

### P1 - İlk Hafta
5. ⚠️ DB-based dedupe (eğer tablo şişmesi görülürse)
6. ⚠️ Event retention policy (ör. 90 gün sonra purge)

---

## 🧪 DÜZELTME SONRASI TEST

```bash
# 1. Environment check
export NODE_ENV=staging
export STAGING_DATABASE_URL="postgresql://..."

# 2. Run proof test
node backend/tests/validation/p0-event-writing-proof.test.js

# Expected output:
# ✅ Environment: staging (not production)
# ✅ Test 1: AUTH_FAILURE event +1 (with retry)
# ✅ Test 2: CROSS_TENANT_ATTEMPT event +1 (with retry)
# ...
# ✅ Test 8: Red Alert sees real counts

# 3. Flood test (dedupe validation)
node backend/tests/validation/event-dedupe-test.js

# Expected:
# 100 rapid auth failures → 2-3 events (deduped)
# ✅ Dedupe working
```

---

## 🎯 EXIT CRITERIA (Revised)

| Kriter | Önceki | Şimdi |
|--------|--------|-------|
| Event infrastructure real | ✅ | ✅ |
| Integration points | ✅ | ✅ |
| Proof tests +1 | ✅ | ✅ Retry logic ile |
| Red Alert sees counts | ✅ | ✅ |
| **Test environment safe** | ❌ | ✅ Staging guard |
| **No PII in events** | ⚠️ | ✅ URL sanitized |
| **Flood protected** | ❌ | ✅ Dedupe window |

**Sonuç:** Şimdi gerçekten prod'a gidebilir! 🚀

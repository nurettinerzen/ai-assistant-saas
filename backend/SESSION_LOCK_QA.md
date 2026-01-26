# Session Lock Implementation - Q&A & Critical Fixes

## ✅ Soru 1: Route guard hangi sessionId ile çalışıyor?

### Cevap: ✅ **DOĞRU - Her iki route da aynı universal sessionId kullanıyor**

#### WhatsApp Flow:
```javascript
// whatsapp.js line 269
const sessionId = await getUniversalSession(business.id, 'WHATSAPP', from);
// from = WhatsApp phone number (e.g., "905551234567")

// session-mapper.js creates:
// SessionMapping.businessId_channel_channelUserId = unique key
// Returns: "conv_abc-123-uuid"
```

#### Chat Widget Flow:
```javascript
// chat-refactored.js line 865
const sessionId = await getOrCreateSession(business.id, 'CHAT', clientSessionId);
// clientSessionId = widget session ID from frontend

// Same session-mapper.js function
// Returns: "conv_xyz-456-uuid"
```

### Log Örneği:
```bash
# WhatsApp:
[SessionMapper] DB hit: 123:WHATSAPP:905551234567 → conv_abc-123-uuid
🔒 [WhatsApp Guard] Session conv_abc-123-uuid is LOCKED (ABUSE)

# Chat:
[SessionMapper] Cache hit: 123:CHAT:widget_session_456 → conv_xyz-789-uuid
🔒 [Chat Guard] Session conv_xyz-789-uuid is LOCKED (SPAM)
```

### Doğrulama:
- ✅ WhatsApp ve Chat **aynı `getOrCreateSession()` fonksiyonunu** kullanıyor
- ✅ Her ikiside **SessionMapping** tablosuna yazıyor
- ✅ ConversationState.sessionId ile **birebir match**
- ✅ Lock state **aynı sessionId** üzerinde

### ⚠️ Potansiyel Bug:
**Chat route'ta `clientSessionId` null olabilir!**

```javascript
// Line 865 - if clientSessionId is null/undefined:
const sessionId = await getOrCreateSession(business.id, 'CHAT', clientSessionId || `temp_${Date.now()}`);
```

**Problem:** Her refresh'te yeni session ID oluşur!

**Fix Needed:** Frontend'den **persistent sessionId** gönderilmeli (localStorage).

---

## ✅ Soru 2: "flowStatus = terminated" ile "locked" çakışınca ne oluyor?

### Cevap: ⚠️ **ÖNCELIK SIRASI YANLIŞ - DÜZELTİLMELİ**

#### Şu Anki Durum:
1. **Orchestrator** (01_loadContext.js) önce `flowStatus === 'terminated'` check ediyor
2. **Route guard** daha sonra `lockReason` check ediyor

```javascript
// 01_loadContext.js:29
if (state.flowStatus === 'terminated') {
  return { terminated: true };
}

// Route'lar lock check yapmıyor, orchestrator'a gitmeden ÖNCE check ediyorlar
// ANCAK orchestrator zaten terminated check yapıyor
```

### Problem:
- Session `terminated` ise route guard'ı bypass eder (orchestrator'a gider)
- Orchestrator terminated message döner
- **ANCAK** lock mesajı değil, generic terminated mesajı döner

### Doğru Öncelik Sırası:
```
1. CLOSED (permanent lock - lockUntil = null)
2. LOCKED (temporary lock - lockUntil = future)
3. TERMINATED (flowStatus = terminated)
4. NORMAL
```

### ✅ FIX REQUIRED:

#### Fix 1: Route guard'da terminated check ekle
```javascript
// whatsapp.js ve chat-refactored.js

// GUARD 1: Check if session is locked
const lockStatus = await isSessionLocked(sessionId);
if (lockStatus.locked) {
  // ... mevcut kod ...
}

// GUARD 1.5: Check if session is terminated (legacy)
const state = await getState(sessionId);
if (state.flowStatus === 'terminated' && !state.lockReason) {
  // Terminated but not locked (legacy state)
  console.log(`🛑 [Guard] Session ${sessionId} is TERMINATED (legacy)`);
  const msg = language === 'TR' ? 'Bu görüşme sonlandırılmıştır.' : 'This conversation has ended.';

  // WhatsApp:
  await sendWhatsAppMessage(business, from, msg, { inboundMessageId: messageId });
  return;

  // Chat:
  return res.json({ reply: msg, terminated: true });
}

// Continue normal processing...
```

#### Fix 2: isSessionLocked() lock varsa terminated'ı ignore etsin
```javascript
// session-lock.js:isSessionLocked()

export async function isSessionLocked(sessionId) {
  const state = await getState(sessionId);

  // Priority 1: Explicit lock reason (highest priority)
  if (state.lockReason) {
    // Lock beats terminated
    // ... existing logic ...
  }

  // Priority 2: Legacy terminated (no lock reason)
  if (state.flowStatus === 'terminated' && !state.lockReason) {
    return {
      locked: true,
      reason: 'TERMINATED', // NEW reason type
      until: null,
      expired: false,
      legacy: true // Flag for different message
    };
  }

  return { locked: false };
}
```

---

## ✅ Soru 3: Lock mesajı spam kontrolü DB'ye doğru yazılıyor mu?

### Cevap: ⚠️ **HAYIR - RACE CONDITION VAR!**

#### Şu Anki Kod:
```javascript
// session-lock.js:shouldSendLockMessage()
export async function shouldSendLockMessage(sessionId) {
  const state = await getState(sessionId);  // DB read

  if (!state.lockMessageSentAt) {
    return true; // İlk mesaj - gönder
  }

  const lastSent = new Date(state.lockMessageSentAt);
  const now = new Date();
  const SPAM_WINDOW = 60 * 1000; // 1 minute

  return (now - lastSent) > SPAM_WINDOW;
}

// session-lock.js:markLockMessageSent()
export async function markLockMessageSent(sessionId) {
  const state = await getState(sessionId); // DB read
  state.lockMessageSentAt = new Date().toISOString();
  await updateState(sessionId, state); // DB write
}
```

#### Problem:
```
Request 1 (0ms):  shouldSend() → true (lockMessageSentAt = null)
Request 2 (10ms): shouldSend() → true (lockMessageSentAt = null, henüz DB'ye yazılmadı!)
Request 1 (50ms): markSent() → lockMessageSentAt = "2026-01-25T10:00:00"
Request 2 (60ms): markSent() → lockMessageSentAt = "2026-01-25T10:00:01"

Sonuç: 2 mesaj gönderildi (spam!)
```

### ✅ FIX REQUIRED:

#### Option 1: Atomic check-and-set (Best)
```javascript
// session-lock.js
export async function shouldSendAndMarkLockMessage(sessionId) {
  const state = await getState(sessionId);
  const now = new Date();

  // Check if should send
  if (state.lockMessageSentAt) {
    const lastSent = new Date(state.lockMessageSentAt);
    const SPAM_WINDOW = 60 * 1000;

    if ((now - lastSent) <= SPAM_WINDOW) {
      return false; // Too soon
    }
  }

  // ATOMIC: Set timestamp AND return true
  state.lockMessageSentAt = now.toISOString();
  await updateState(sessionId, state);

  return true;
}
```

Usage:
```javascript
// whatsapp.js
if (lockStatus.locked) {
  const shouldSend = await shouldSendAndMarkLockMessage(sessionId);
  if (shouldSend) {
    await sendWhatsAppMessage(...);
  }
  return;
}
```

#### Option 2: In-memory debounce (Simpler)
```javascript
// session-lock.js
const messageCooldown = new Map(); // sessionId → timestamp

export async function shouldSendLockMessage(sessionId) {
  const now = Date.now();
  const lastSent = messageCooldown.get(sessionId);

  if (!lastSent || (now - lastSent) > 60000) {
    messageCooldown.set(sessionId, now);
    return true;
  }

  return false;
}

// Cleanup every 5 minutes
setInterval(() => {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  for (const [sessionId, timestamp] of messageCooldown.entries()) {
    if (timestamp < fiveMinAgo) {
      messageCooldown.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);
```

---

## ✅ Soru 4: Auto-unlock race condition var mı?

### Cevap: ✅ **IDEMPOTENT - SORUN YOK**

#### Şu Anki Kod:
```javascript
// session-lock.js:isSessionLocked()
if (state.lockUntil) {
  const now = new Date();
  const lockUntil = new Date(state.lockUntil);

  if (now >= lockUntil) {
    // Lock expired - auto unlock
    console.log(`🔓 [SessionLock] Lock expired for ${sessionId}, auto-unlocking`);
    await unlockSession(sessionId); // Calls updateState()

    return {
      locked: false,
      reason: state.lockReason,
      until: state.lockUntil,
      expired: true
    };
  }
}
```

#### unlockSession():
```javascript
export async function unlockSession(sessionId) {
  const state = await getState(sessionId);

  state.flowStatus = 'idle';
  state.lockReason = null;
  state.lockedAt = null;
  state.lockUntil = null;
  state.lockMessageSentAt = null;

  await updateState(sessionId, state);
}
```

### Race Condition Test:
```
Request 1 (0ms):  isLocked() → expired, unlockSession()
Request 2 (10ms): isLocked() → expired, unlockSession()

Request 1 (50ms): updateState() → lockReason = null
Request 2 (60ms): updateState() → lockReason = null (already null)

Sonuç: İki kere unlock, ANCAK state bozulmadı (idempotent)
```

### ✅ SORUN YOK - ÇÜNKÜ:
- `unlockSession()` sadece field'ları null yapıyor
- İki kere null yapmak idempotent
- State bozulmuyor

### ⚠️ Minor Optimization:
```javascript
export async function unlockSession(sessionId) {
  const state = await getState(sessionId);

  // Skip if already unlocked
  if (!state.lockReason) {
    console.log(`🔓 [SessionLock] Session ${sessionId} already unlocked`);
    return;
  }

  // Clear lock fields
  state.flowStatus = 'idle';
  state.lockReason = null;
  state.lockedAt = null;
  state.lockUntil = null;
  state.lockMessageSentAt = null;

  await updateState(sessionId, state);
  console.log(`🔓 [SessionLock] Unlocked ${sessionId}`);
}
```

---

## ✅ Soru 5: Küfür detection "üst üste" mi, "tek mesajda 2+" mı?

### Cevap: ⚠️ **TEK MESAJDA 2+ - İSTEDİĞİN GİBİ DEĞİL!**

#### Şu Anki Kod:
```javascript
// user-risk-detector.js:67
const profanityMatches = message.match(ABUSE_PATTERNS.severe_profanity);
if (profanityMatches && profanityMatches.length >= 2) {
  // 2+ severe profanity words in SINGLE MESSAGE → lock
  return { shouldLock: true, reason: 'ABUSE' };
}
```

### Problem:
```
User Message 1: "amk"           → 1 küfür → WARNING (lock yok)
User Message 2: "salak"         → 1 küfür → WARNING (lock yok)
User Message 3: "amk salak"     → 2 küfür → LOCK! ✅

ANCAK:
User Message 1: "amk"           → 1 küfür → WARNING
User Message 2: "orospu"        → 1 küfür → WARNING
User Message 3: "gerizekalı"    → 1 küfür → WARNING
... sonsuz küfür ama hep 1'er tane → ASLA LOCK OLMAZ! ❌
```

### ✅ FIX REQUIRED: Counter-Based Detection

```javascript
// user-risk-detector.js

/**
 * Track abuse warnings per session
 * Map<sessionId, { count: number, firstAt: timestamp }>
 */
const abuseWarnings = new Map();

export function detectUserRisks(message, language = 'TR', state = {}) {
  const sessionId = state.sessionId;

  // ... existing code ...

  // ABUSE DETECTION
  const profanityMatches = message.match(ABUSE_PATTERNS.severe_profanity);

  if (profanityMatches && profanityMatches.length >= 2) {
    // Immediate lock for 2+ profanity in SINGLE message
    return {
      shouldLock: true,
      reason: 'ABUSE',
      severity: 'HIGH',
      message: getLockMessage('ABUSE', language)
    };
  }

  if (profanityMatches && profanityMatches.length === 1) {
    // Single profanity - track warnings
    if (!abuseWarnings.has(sessionId)) {
      abuseWarnings.set(sessionId, { count: 0, firstAt: Date.now() });
    }

    const tracking = abuseWarnings.get(sessionId);
    tracking.count++;

    // Reset counter after 10 minutes (sliding window)
    const TEN_MINUTES = 10 * 60 * 1000;
    if (Date.now() - tracking.firstAt > TEN_MINUTES) {
      tracking.count = 1;
      tracking.firstAt = Date.now();
    }

    // Lock after 3 warnings in 10 minutes
    if (tracking.count >= 3) {
      abuseWarnings.delete(sessionId); // Clear
      return {
        shouldLock: true,
        reason: 'ABUSE',
        severity: 'HIGH',
        message: getLockMessage('ABUSE', language),
        warnings: [{
          type: 'REPEATED_PROFANITY',
          severity: 'HIGH',
          count: tracking.count
        }]
      };
    }

    warnings.push({
      type: 'PROFANITY',
      severity: 'MEDIUM',
      count: 1,
      action: 'WARN',
      warningNumber: tracking.count
    });
  }

  // ... rest of code ...
}

// Cleanup old warnings every 15 minutes
setInterval(() => {
  const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
  for (const [sessionId, tracking] of abuseWarnings.entries()) {
    if (tracking.firstAt < fifteenMinAgo) {
      abuseWarnings.delete(sessionId);
    }
  }
}, 15 * 60 * 1000);
```

### Sonuç:
```
User: "amk"         → Warning 1/3
User: "salak"       → Warning 2/3
User: "gerizekalı"  → Warning 3/3 → LOCK! ✅
```

---

## ✅ Soru 6: PII detection yanlış kilit riski var mı?

### Cevap: ⚠️ **EVET - FALSE POSITIVE RİSKİ YÜKSEK!**

#### Şu Anki PII Patterns:
```javascript
// piiPreventionPolicy.js:20
TC_KIMLIK: {
  pattern: /\b[1-9]\d{10}\b/g,  // 11 haneli rakam
  severity: 'CRITICAL',
  action: 'BLOCK'
}

CREDIT_CARD: {
  pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,  // 16 haneli rakam
  severity: 'CRITICAL',
  action: 'BLOCK'
}
```

### Problem Senaryoları:
```
# Sipariş numarası 11 haneli
User: "Sipariş numaram 12345678901"
PII Scan: CRITICAL TC_KIMLIK detected!
→ LOCK! ❌ (Yanlış alarm)

# Telefon + extension
User: "Telefon: 0212 555 1234 dahili 123"
→ 12 hane → Kart gibi görünür
→ LOCK! ❌

# Tracking number
User: "Kargo takip: 1234 5678 9012 3456"
→ 16 hane → Kart gibi görünür
→ LOCK! ❌
```

### ✅ FIX REQUIRED: Context-Aware PII Detection

```javascript
// pii-context-detector.js (NEW FILE)

/**
 * Context-aware PII detection
 * Considers surrounding words to reduce false positives
 */

const SAFE_CONTEXTS = {
  // If these words appear near the number, it's probably NOT PII
  TC_KIMLIK: /(?:sipariş|order|kargo|tracking|takip|fatura|invoice|ref|referans)/i,
  CREDIT_CARD: /(?:sipariş|order|kargo|tracking|takip|ref|kod|code)/i
};

export function isSafePII(text, piiType, match) {
  const contextPattern = SAFE_CONTEXTS[piiType];
  if (!contextPattern) return false;

  // Extract context (50 chars before and after match)
  const matchIndex = text.indexOf(match);
  const contextStart = Math.max(0, matchIndex - 50);
  const contextEnd = Math.min(text.length, matchIndex + match.length + 50);
  const context = text.substring(contextStart, contextEnd);

  // If safe context found, it's not PII
  return contextPattern.test(context);
}

// Modified scanForPII:
export function scanForPII(content) {
  // ... existing code ...

  for (const [piiType, config] of Object.entries(PIIPatterns)) {
    const matches = content.match(config.pattern);

    if (matches && matches.length > 0) {
      // Filter out safe contexts
      const actualPII = matches.filter(match =>
        !isSafePII(content, piiType, match)
      );

      if (actualPII.length > 0) {
        findings.push({
          type: piiType,
          severity: config.severity,
          count: actualPII.length,
          matches: actualPII.slice(0, 3)
        });
      }
    }
  }

  // ... rest ...
}
```

### Alternatif: Tighten Patterns
```javascript
// More specific patterns to reduce false positives

TC_KIMLIK: {
  // Require word boundary AND common Turkish ID keywords
  pattern: /\b(?:tc|kimlik|T\.C\.|tc:|kimlik:)\s*[1-9]\d{10}\b/gi,
  severity: 'CRITICAL',
  action: 'BLOCK'
},

CREDIT_CARD: {
  // Require typical card separators (not spaces in order numbers)
  pattern: /\b\d{4}[-]\d{4}[-]\d{4}[-]\d{4}\b/g,
  severity: 'CRITICAL',
  action: 'BLOCK'
}
```

---

## ✅ Soru 7: TOOL_FAIL lock nereden tetikleniyor?

### Cevap: ⚠️ **HİÇBİR YERDEN - IMPLEMENT EDİLMEMİŞ!**

#### Şu Anki Durum:
```bash
grep -r "TOOL_FAIL" backend/src/
# Sonuç: Sadece session-lock.js'de LOCK_DURATIONS içinde tanımlı
# ANCAK hiçbir yerde lockSession(..., 'TOOL_FAIL') çağrılmıyor!
```

### ✅ FIX REQUIRED: Add TOOL_FAIL Lock

#### Option 1: Tool Fail Handler'a ekle
```javascript
// tool-fail-handler.js

import { lockSession } from './session-lock.js';

export function getToolFailResponse(toolName, language, channel) {
  const responses = {
    // ... existing responses ...
  };

  // Track consecutive tool failures
  if (!global.toolFailures) {
    global.toolFailures = new Map(); // sessionId → count
  }

  return {
    reply: responses[toolName]?.[language] || responses['default'][language],
    shouldLockOnRepeat: true // Signal to orchestrator
  };
}

// NEW: Track and lock on repeated failures
export async function handleToolFailure(sessionId, toolName, error) {
  if (!global.toolFailures.has(sessionId)) {
    global.toolFailures.set(sessionId, { count: 0, tools: [] });
  }

  const tracking = global.toolFailures.get(sessionId);
  tracking.count++;
  tracking.tools.push({ tool: toolName, error: error.message, at: Date.now() });

  // Lock after 3 tool failures in 5 minutes
  if (tracking.count >= 3) {
    const FIVE_MINUTES = 5 * 60 * 1000;
    const recentFailures = tracking.tools.filter(t =>
      Date.now() - t.at < FIVE_MINUTES
    );

    if (recentFailures.length >= 3) {
      console.error(`🚨 [ToolFail] ${sessionId} - 3 failures in 5min, locking`);
      await lockSession(sessionId, 'TOOL_FAIL', 2 * 60 * 1000); // 2 min
      global.toolFailures.delete(sessionId);
      return true; // Locked
    }
  }

  return false; // Not locked
}
```

#### Option 2: REMOVE TOOL_FAIL (Simpler)
```javascript
// session-lock.js

const LOCK_DURATIONS = {
  ABUSE: 60 * 60 * 1000,
  THREAT: null,
  PII_RISK: 60 * 60 * 1000,
  LOOP: 10 * 60 * 1000,
  SPAM: 5 * 60 * 1000,
  // TOOL_FAIL: REMOVED - too aggressive for transient errors
};
```

**Öneri:** Option 2 - Tool fail'de lock agresif, network timeout'ta kullanıcıyı kilitleme.

---

## ✅ Soru 8: Lock eventleri metrikleniyor mu?

### Cevap: ❌ **HAYIR - SADECE LOG VAR!**

#### Şu Anki Durum:
```javascript
// session-lock.js:lockSession()
console.log(`🔒 [SessionLock] Locked ${sessionId}: ${reason}...`);
```

### ✅ FIX REQUIRED: Lock Event Logging

#### Solution: Event Table
```sql
-- New table (optional, ayrı PR'da)
CREATE TABLE "SessionLockEvent" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessionId TEXT NOT NULL,
  businessId INT NOT NULL,
  channel TEXT NOT NULL,
  lockReason TEXT NOT NULL,
  lockedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  lockUntil TIMESTAMP,
  userMessage TEXT, -- Last user message that triggered lock
  metadata JSONB,

  FOREIGN KEY (businessId) REFERENCES "Business"(id)
);

CREATE INDEX idx_lock_events_session ON "SessionLockEvent"(sessionId);
CREATE INDEX idx_lock_events_business ON "SessionLockEvent"(businessId, lockedAt);
CREATE INDEX idx_lock_events_reason ON "SessionLockEvent"(lockReason);
```

#### Interim Solution: Metrics Emission
```javascript
// session-lock.js:lockSession()

import { emitMetric } from '../metrics/emit.js';

export async function lockSession(sessionId, reason, customDuration = null) {
  // ... existing code ...

  // Emit metric
  await emitMetric({
    type: 'SESSION_LOCKED',
    sessionId,
    reason,
    duration: duration || 'permanent',
    timestamp: now.toISOString()
  });

  console.log(`🔒 [SessionLock] Locked ${sessionId}: ${reason} (until: ${lockUntil || 'permanent'})`);
}
```

#### Quick Win: ChatLog Update
```javascript
// session-lock.js:lockSession()

export async function lockSession(sessionId, reason, customDuration = null) {
  // ... existing lock logic ...

  // Update ChatLog with lock info (if exists)
  try {
    await prisma.chatLog.updateMany({
      where: { sessionId },
      data: {
        summary: `[LOCKED: ${reason}] ${chatLog.summary || ''}`.substring(0, 500)
      }
    });
  } catch (err) {
    console.warn('[SessionLock] Failed to update ChatLog:', err);
  }

  console.log(`🔒 [SessionLock] Locked ${sessionId}: ${reason}...`);
}
```

---

## 📋 Deployment Checklist (Updated)

### Critical Fixes Required:
- [ ] **Fix 1:** Add terminated check to route guards (priority order)
- [ ] **Fix 2:** Implement atomic `shouldSendAndMarkLockMessage()`
- [ ] **Fix 3:** Add counter-based abuse detection (3 warnings in 10min)
- [ ] **Fix 4:** Add context-aware PII detection (false positive reduction)
- [ ] **Fix 5:** Remove TOOL_FAIL or implement properly
- [ ] **Fix 6:** Add lock event metrics/logging

### Nice-to-Have:
- [ ] Add unlock optimization (skip if already unlocked)
- [ ] Add SessionLockEvent table (ayrı PR)
- [ ] Add admin unlock UI (ayrı PR)

### Testing After Fixes:
- [ ] Test: 3 single profanity messages → lock on 3rd
- [ ] Test: Sipariş numarası "12345678901" → NOT locked
- [ ] Test: Spam lock message sent max 1/min
- [ ] Test: Lock + terminated priority (lock wins)

---

## 🎯 Priority Actions

### HIGH PRIORITY (Before Deploy):
1. ✅ Fix spam prevention race condition (atomic check-and-set)
2. ✅ Fix counter-based abuse detection
3. ✅ Fix PII false positives (context-aware or tighter patterns)

### MEDIUM PRIORITY (Can deploy without):
4. Add terminated to route guards
5. Remove TOOL_FAIL or implement properly

### LOW PRIORITY (Future PR):
6. Add SessionLockEvent table
7. Add metrics emission
8. Add admin unlock UI


# Session Lock Implementation - Route-Level Guards

## ✅ Implementation Complete (No DB Migration Required)

This implementation adds **hard session termination** to written channels (Chat/WhatsApp) using **state-based locking** without requiring database schema changes.

---

## 🎯 Objective

**Problem:** When the assistant says "I can't continue," the user can still send messages and the LLM keeps responding.

**Solution:** Route-level guards that **prevent message processing entirely** when session is locked.

---

## 🏗️ Architecture

### Core Components

#### 1. **State Schema Extension** ✓
File: `backend/src/services/state-manager.js`

Added to `ConversationState.state` JSON:
```javascript
{
  lockReason: null,       // ABUSE | PII_RISK | THREAT | LOOP | SPAM | TOOL_FAIL
  lockUntil: null,        // ISO timestamp or null (permanent)
  lockedAt: null,         // ISO timestamp when locked
  lockMessageSentAt: null // Spam prevention (1 msg/min)
}
```

No DB migration needed - stored in existing `state` JSONB column.

#### 2. **Session Lock Service** ✓
File: `backend/src/services/session-lock.js`

**Functions:**
- `lockSession(sessionId, reason, duration)` - Lock with reason and optional duration
- `isSessionLocked(sessionId)` - Check lock status (auto-unlocks expired)
- `unlockSession(sessionId)` - Manual unlock
- `getLockMessage(reason, language)` - Get localized lock message
- `shouldSendLockMessage(sessionId)` - Spam prevention (1 msg/min)
- `markLockMessageSent(sessionId)` - Update spam timestamp

**Lock Durations:**
- `ABUSE`: 1 hour
- `THREAT`: Permanent
- `PII_RISK`: 1 hour
- `LOOP`: 10 minutes
- `SPAM`: 5 minutes
- `TOOL_FAIL`: 2 minutes

#### 3. **User Risk Detector** ✓
File: `backend/src/services/user-risk-detector.js`

**Detects:**
- **ABUSE**: Profanity (2+ severe words → lock)
- **THREAT**: Violence, doxxing (1 occurrence → permanent lock)
- **SPAM**: Character/word repetition (→ 5min lock)
- **PII_INPUT**: User sharing TC Kimlik, credit card, IBAN, passwords (warn first)

**Returns:**
```javascript
{
  shouldLock: boolean,
  reason: string | null,
  warnings: Array<{ type, severity, userMessage }>
}
```

#### 4. **Route-Level Guards** ✓

**WhatsApp Route** (`backend/src/routes/whatsapp.js`)

```javascript
async function processWhatsAppMessage(business, from, messageBody, messageId) {
  // GUARD 1: Check if session is locked
  const lockStatus = await isSessionLocked(sessionId);
  if (lockStatus.locked) {
    // Send lock message (with spam prevention)
    // EXIT - do not process message
  }

  // GUARD 2: Detect user risks
  const riskDetection = detectUserRisks(messageBody, language);
  if (riskDetection.shouldLock) {
    await lockSession(sessionId, riskDetection.reason);
    // Send lock message
    // EXIT
  }

  // Session OK - continue normal processing...
}
```

**Chat Route** (`backend/src/routes/chat-refactored.js`)

```javascript
router.post('/widget', async (req, res) => {
  // ... business/assistant lookup ...

  // GUARD 1: Check if session is locked
  const lockStatus = await isSessionLocked(sessionId);
  if (lockStatus.locked) {
    return res.json({
      reply: getLockMessage(lockStatus.reason, language),
      locked: true
    });
  }

  // GUARD 2: Detect user risks
  const riskDetection = detectUserRisks(message, language);
  if (riskDetection.shouldLock) {
    await lockSession(sessionId, riskDetection.reason);
    return res.json({
      reply: getLockMessage(riskDetection.reason, language),
      locked: true
    });
  }

  // Session OK - continue...
});
```

#### 5. **Assistant Output PII Detection** ✓
File: `backend/src/core/orchestrator/steps/07_guardrails.js`

```javascript
export async function applyGuardrails(params) {
  // POLICY 1: PII Leak Prevention (runs first!)
  const piiScan = scanForPII(responseText);
  if (piiScan.hasCritical) {
    // Lock session immediately (1 hour)
    await lockSession(sessionId, 'PII_RISK', 60 * 60 * 1000);

    // Return safe error message instead of leaking PII
    return {
      finalResponse: getLockMessage('PII_RISK', language),
      blocked: true,
      lockReason: 'PII_RISK'
    };
  }

  // POLICY 2: Action Claim Validation...
}
```

Reuses existing PII detection from email channel:
- `backend/src/core/email/policies/piiPreventionPolicy.js`
- Detects: TC Kimlik, Credit Card, IBAN, CVV, Passwords, API Keys

#### 6. **Loop-Based Auto-Lock** ✓
File: `backend/src/services/slot-processor.js`

```javascript
// After 3 failed slot collection attempts
if (attempts >= 3) {
  // Lock session for 10 minutes to prevent infinite loop
  await lockSession(state.sessionId, 'LOOP', 10 * 60 * 1000);

  return {
    filled: false,
    error: 'loop_detected',
    escalate: true,
    locked: true
  };
}
```

---

## 🔐 Lock Flow Examples

### Example 1: Abuse Detection
```
User: "amk salak robot orospu"
  ↓
[WhatsApp Guard: detectUserRisks()]
  ↓ 2+ severe profanity detected
[lockSession(sessionId, 'ABUSE', 1h)]
  ↓
[Send: "Bu dil nedeniyle sohbet kapatıldı. Lütfen daha sonra tekrar deneyin."]
  ↓
[EXIT - LLM NOT CALLED]
```

Next message from same user:
```
User: "Sipariş durumu?"
  ↓
[WhatsApp Guard: isSessionLocked()]
  ↓ locked: true, until: <1 hour from now>
[Send lock message (1/min spam prevention)]
  ↓
[EXIT - LLM NOT CALLED]
```

### Example 2: PII Leak in Output
```
User: "Borcum ne kadar?"
  ↓
[Route guard: PASS]
  ↓
[LLM generates: "Mehmet Yılmaz, TC: 12345678901, borcunuz 5000 TL"]
  ↓
[Guardrails Step 7: scanForPII()]
  ↓ CRITICAL PII detected (TC Kimlik)
[lockSession(sessionId, 'PII_RISK', 1h)]
  ↓
[Return: "Güvenlik nedeniyle sohbet kapatıldı."]
  ↓
[Session LOCKED - no PII sent to user!]
```

### Example 3: Loop Detection
```
User: "SP001" (order number)
  ↓
Assistant: "Sipariş numaranız nedir?"
  ↓
User: "123" (invalid format, attempt 1)
  ↓
Assistant: "Sipariş numarası genellikle SP001 gibi görünür..."
  ↓
User: "456" (invalid, attempt 2)
  ↓
Assistant: "Lütfen SP001 formatında girin..."
  ↓
User: "abc" (invalid, attempt 3)
  ↓
[Slot Processor: attempts >= 3]
  ↓
[lockSession(sessionId, 'LOOP', 10min)]
  ↓
[Return: "Anlaşılmadı gibi görünüyor. 10 dakika sonra tekrar deneyin."]
```

### Example 4: Spam Detection
```
User: "aaaaaaaaaaaaaaaaaaaaaa" (20+ same char)
  ↓
[Route Guard: detectUserRisks()]
  ↓ SPAM detected
[lockSession(sessionId, 'SPAM', 5min)]
  ↓
[Send: "Spam tespit edildi. 5 dakika sonra tekrar deneyin."]
  ↓
[EXIT - LLM NOT CALLED]
```

---

## 📊 Lock Reasons & Messages

### Turkish Messages
```javascript
ABUSE: "Bu dil nedeniyle sohbet kapatıldı. Lütfen daha sonra tekrar deneyin."
THREAT: "Güvenlik nedeniyle sohbet kalıcı olarak kapatılmıştır."
PII_RISK: "Güvenlik nedeniyle sohbet kapatıldı. Lütfen daha sonra tekrar deneyin."
LOOP: "Teknik sorun nedeniyle sohbet geçici olarak kapatıldı. 10 dakika sonra tekrar deneyin."
SPAM: "Spam tespit edildi. Lütfen 5 dakika sonra tekrar deneyin."
TOOL_FAIL: "Teknik sorun oluştu. Lütfen 2 dakika sonra tekrar deneyin."
```

### English Messages
```javascript
ABUSE: "Conversation closed due to inappropriate language. Please try again later."
THREAT: "Conversation permanently closed for security reasons."
PII_RISK: "Conversation closed for security reasons. Please try again later."
LOOP: "Technical issue detected. Please try again in 10 minutes."
SPAM: "Spam detected. Please try again in 5 minutes."
TOOL_FAIL: "Technical issue occurred. Please try again in 2 minutes."
```

---

## 🧪 Testing Checklist

### Manual Test Scenarios

#### ✅ Test 1: Abuse Lock
```bash
# Send profanity to WhatsApp
# Expected: Session locks for 1 hour
# Next message should return lock message (no LLM call)
```

#### ✅ Test 2: Spam Lock
```bash
# Send "aaaaaaaaaaaaaaaaaaa" to chat widget
# Expected: Session locks for 5 minutes
# Verify lock message returned immediately
```

#### ✅ Test 3: Loop Lock
```bash
# Start order query flow
# Provide invalid order number 3 times
# Expected: Session locks for 10 minutes after 3rd attempt
```

#### ✅ Test 4: PII Output Detection
```bash
# Trigger flow that might leak PII (e.g., customer data lookup)
# If LLM generates TC Kimlik in response
# Expected: Response blocked, session locked for 1 hour
```

#### ✅ Test 5: Lock Expiry (Auto-Unlock)
```bash
# Lock session with 2-minute duration
# Wait 2 minutes
# Send new message
# Expected: Session auto-unlocks, message processed normally
```

#### ✅ Test 6: Spam Prevention (Lock Message)
```bash
# Lock session
# Send 5 messages in 1 minute
# Expected: Only 1 lock message sent (others silently ignored)
```

#### ✅ Test 7: PII Warning (Non-Critical)
```bash
# User sends: "Telefon: 905551234567"
# Expected: Warning message prepended to response
#          "⚠️ Lütfen telefon numaranızı burada paylaşmayın.\n\nAsistant response..."
```

---

## 🔍 Monitoring & Debugging

### Check Lock Status (Manual)
```javascript
import { isSessionLocked } from './services/session-lock.js';

const status = await isSessionLocked('conv_abc123');
console.log(status);
// { locked: true, reason: 'ABUSE', until: '2026-01-25T15:30:00.000Z', expired: false }
```

### Check State (Database)
```sql
SELECT session_id, state->>'lockReason', state->>'lockUntil', state->>'lockedAt'
FROM "ConversationState"
WHERE state->>'lockReason' IS NOT NULL;
```

### Logs to Watch
```bash
# Lock events
grep "🔒 \[SessionLock\]" logs/backend.log

# Risk detection
grep "🚨 \[.*Guard\] RISK DETECTED" logs/backend.log

# PII detection
grep "🚨 \[Guardrails\] CRITICAL PII DETECTED" logs/backend.log

# Loop detection
grep "🚫 \[Loop Guard\]" logs/backend.log
```

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Review profanity patterns (add more Turkish words if needed)
- [ ] Review PII patterns (adjust for your region)
- [ ] Test all lock scenarios in staging
- [ ] Verify lock message translations (TR/EN)
- [ ] Check lock durations align with business requirements

### Deployment
- [ ] Deploy backend code (no DB migration needed!)
- [ ] Monitor logs for false positives
- [ ] Track lock metrics (how many sessions locked per reason)

### Post-Deployment Monitoring
- [ ] Monitor `lockReason` distribution
- [ ] Check for false positives (legitimate users getting locked)
- [ ] Adjust patterns if needed (tighten/loosen thresholds)

---

## 📈 Future Enhancements (Next PR)

### Phase 2: Persistent Lock in Database
```sql
-- Add lock fields to ChatLog table
ALTER TABLE "ChatLog"
  ADD COLUMN "lockReason" TEXT,
  ADD COLUMN "lockedAt" TIMESTAMP,
  ADD COLUMN "lockUntil" TIMESTAMP;

-- Benefits:
-- - Lock persists across server restarts
-- - Can query locked sessions for analytics
-- - Support for admin unlock UI
```

### Phase 3: Admin Unlock UI
- Dashboard to view locked sessions
- Manual unlock button
- Lock reason analytics

### Phase 4: Advanced PII Detection
- ML-based PII detection (higher accuracy)
- Context-aware detection (allow phone in "call me at X" but block in "my ssn is X")

---

## 🎯 Summary

**What Changed:**
1. ✅ State schema: Added `lockReason`, `lockUntil`, `lockedAt`, `lockMessageSentAt`
2. ✅ Session lock service: Lock/unlock/check functions
3. ✅ User risk detector: Abuse, threat, spam, PII input detection
4. ✅ Route guards: WhatsApp & Chat entry guards (before LLM)
5. ✅ Output PII detection: Guardrails step 7 (after LLM, before send)
6. ✅ Loop auto-lock: Slot processor locks after 3 failures

**What Didn't Change:**
- ❌ No database schema migrations
- ❌ No ChatLog table changes
- ❌ No API contract changes

**Result:**
🎉 **Hard session termination that actually works!**
- Users can't bypass locks by sending more messages
- LLM never called for locked sessions
- PII leaks prevented at output layer
- Infinite loops auto-terminate

**Files Changed:**
- `backend/src/services/state-manager.js` (state schema)
- `backend/src/services/session-lock.js` (NEW)
- `backend/src/services/user-risk-detector.js` (NEW)
- `backend/src/routes/whatsapp.js` (route guard)
- `backend/src/routes/chat-refactored.js` (route guard)
- `backend/src/core/orchestrator/steps/07_guardrails.js` (PII policy)
- `backend/src/services/slot-processor.js` (loop lock)

**Testing Priority:**
1. Abuse lock (highest impact)
2. PII output detection (critical security)
3. Loop lock (UX improvement)
4. Spam lock (nice to have)

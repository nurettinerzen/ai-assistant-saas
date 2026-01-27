# Plan-Based Feature Gating - Detaylı Analiz Raporu

**Tarih**: 2026-01-27
**Scope**: Tüm backend route'lar ve servisler
**Durum**: Production audit (fix öncesi)

---

## 📋 Executive Summary

### Genel Durum
- ✅ **İyi Gate'lenmiş**: Phone calls, chat/WhatsApp, AI analysis, batch calls, concurrent limits
- ⚠️ **Kısmi Gate**: Email (frontend only), integrations (OAuth missing)
- ❌ **Gate Yok**: Email OAuth, integration OAuth, assistant creation limits

### Kritik Bulgular
1. **P0 Critical**: Email OAuth route'ları plan check yapmıyor (FREE users erişebilir)
2. **P0 Critical**: Integration OAuth endpoints'leri açık (güvenlik riski)
3. **P1 High**: Assistant creation limit enforcement yok
4. **P2 Medium**: TRIAL expiry chat route'larında enforce edilmiyor

### Risk Seviyesi
- **Security Risk**: HIGH (OAuth endpoints unprotected)
- **Revenue Risk**: MEDIUM (Assistants limit bypass)
- **User Experience Risk**: LOW (Frontend gates var)

---

## 1. PLAN YAPISI VE LIMİTLER

### 1.1 Mevcut Planlar

```
FREE (Deprecated Trial)
├── Phone Calls: 0 minutes
├── Concurrent: 0 calls
├── Assistants: 0
├── Chat/WhatsApp: Blocked
├── Email: Blocked
└── Status: Plan should not exist in production

TRIAL (7-15 days)
├── Phone Calls: 15 minutes (one-time)
├── Concurrent: 1 call
├── Assistants: 1
├── Chat/WhatsApp: 7 days access
├── Email: Unknown (no gate found)
├── Trial Expiry: trialChatExpiry field
└── Conversion Target: Upgrade to PAYG/STARTER

PAYG (Pay-As-You-Go)
├── Phone Calls: Balance-based (17 TL/min)
├── Concurrent: 1 call
├── Assistants: 1
├── Chat/WhatsApp: Token-based charging
├── Email: Unknown (no gate found)
├── Payment Model: PREPAID
└── Upgrade Blocking: Cannot upgrade while balance > 0

STARTER (2,499 TL/month)
├── Phone Calls: 150 min/month included
├── Overage: 23 TL/min (postpaid)
├── Concurrent: 1 call
├── Assistants: 3
├── Chat/WhatsApp: 2M tokens/month
├── Email: Frontend blocked, backend unclear
├── Integrations: Limited
└── Payment Model: POSTPAID

PRO (7,499 TL/month)
├── Phone Calls: 500 min/month included
├── Overage: 23 TL/min (postpaid)
├── Concurrent: 5 calls
├── Assistants: 10
├── Chat/WhatsApp: 5M tokens/month
├── Email: Full access
├── Integrations: Full access (Calendar, Sheets, CRM)
├── Batch Calls: Enabled
├── AI Analysis: Enabled
└── Payment Model: POSTPAID

ENTERPRISE (Custom pricing)
├── Phone Calls: Custom/Unlimited
├── Concurrent: 5+ calls
├── Assistants: Unlimited
├── Chat/WhatsApp: 10M tokens/month
├── Email: Full access
├── All Features: Enabled
└── Payment Model: Custom

BASIC (Deprecated → STARTER)
└── Maps to STARTER plan
```

### 1.2 Limit Kaynakları (3 Farklı Yer!)

**Kaynak 1**: `backend/src/config/plans.js` (Line 123-167)
```javascript
TR: {
  STARTER: {
    concurrentLimit: 1,
    assistantsLimit: 3,
    phoneNumbersLimit: -1 // Unlimited
  },
  PRO: {
    concurrentLimit: 5,
    assistantsLimit: 10
  }
}
```

**Kaynak 2**: `backend/src/middleware/subscriptionLimits.js` (PLAN_LIMITS)
```javascript
const PLAN_LIMITS = {
  TRIAL: { maxConcurrentCalls: 1, maxAssistants: 1 },
  PAYG: { maxConcurrentCalls: 1, maxAssistants: 1 },
  STARTER: { maxConcurrentCalls: 1, maxAssistants: 3 },
  PRO: { maxConcurrentCalls: 5, maxAssistants: 10 },
  ENTERPRISE: { maxConcurrentCalls: 5, maxAssistants: -1 }
};
```

**Kaynak 3**: `Subscription` table field'ları
```sql
concurrentLimit INT DEFAULT 1
-- Can be overridden per subscription
```

⚠️ **Problem**: 3 farklı kaynak, senkronizasyon riski var.

---

## 2. ÖZELLİK BAZLI GATE ANALİZİ

### 2.1 PHONE CALLS (Telefon Aramaları)

#### ✅ Gate Durumu: İYİ

**Authorization Check**:
- **Location**: `backend/src/routes/phoneNumber.js:121`
- **Check**: `subscription.plan === 'FREE'`
- **Action**: `return res.status(403).json({ error: 'Free plan yok artık' })`

**Provision Endpoint**:
```javascript
// Line 121-128
if (!subscription || subscription.plan === 'FREE') {
  return res.status(403).json({
    error: 'Free plan cannot provision phone numbers',
    message: 'Please upgrade to use this feature'
  });
}
```

**Concurrent Call Limit**:
- **Location**: `backend/src/services/concurrentCallManager.js`
- **Implementation**: Atomic `updateMany` with condition
- **Safe**: Race condition korumalı

**Code**:
```javascript
// Line 70-77
const result = await prisma.subscription.updateMany({
  where: {
    id: subscriptionId,
    activeCalls: { lt: prisma.subscription.fields.concurrentLimit }
  },
  data: { activeCalls: { increment: 1 } }
});

if (result.count === 0) {
  throw new Error('CONCURRENT_LIMIT_REACHED');
}
```

**Dakika Limitleri**:
- **Location**: `backend/src/services/chargeCalculator.js`
- **Enforcement**:
  - TRIAL: 15 dk (hard block)
  - PAYG: Balance check (block if < 1 min price)
  - STARTER/PRO: Included + overage (no block, postpaid)

**Değerlendirme**: ✅ Tam korumalı, üretim hazır.

---

### 2.2 CHAT / WHATSAPP MESSAGING

#### ✅ Gate Durumu: İYİ

**Rate Limiting** (P0-2):
- **Location**: `backend/src/services/chatRateLimiter.js`
- **Feature Flag**: `CHAT_RATE_LIMITING_ENABLED`
- **Limits**:
  - TRIAL: 200 msg/day, 100k tokens/month
  - PAYG: 1000 msg/day, 1M tokens/month
  - STARTER: 2000 msg/day, 2M tokens/month
  - PRO: 5000 msg/day, 5M tokens/month

**Token Pricing**:
- **Location**: `backend/src/routes/chat-refactored.js:987`
- **Check**: `hasFreeChat(planName)` - FREE & TRIAL get free tokens
- **PAYG**: `chargeType: 'BALANCE'` - balance'dan kesilir
- **STARTER/PRO**: `chargeType: 'INCLUDED'` - included token'dan

**Code**:
```javascript
// Line 987-1004
const isFreeChat = hasFreeChat(planName);
const chargeType = isFreeChat ? 'FREE_TRIAL' :
  (planName === 'PAYG' ? 'BALANCE' : 'INCLUDED');

if (chargeType === 'BALANCE' && totalCost > 0) {
  if (subscription.balance < totalCost) {
    throw new Error('Insufficient balance for chat');
  }
  await prisma.subscription.update({
    where: { businessId },
    data: { balance: { decrement: totalCost } }
  });
}
```

**TRIAL Expiry Check**:
- **Location**: `backend/src/middleware/checkPlanExpiry.js`
- **Field**: `subscription.trialChatExpiry`
- **Problem**: ⚠️ Middleware mevcut ama chat route'larında KULLANILMIYOR!

**Değerlendirme**: ✅ Token pricing iyi, ⚠️ TRIAL expiry enforce eksik.

---

### 2.3 EMAIL INTEGRATION

#### ❌ Gate Durumu: KRİTİK EKSİK

**Frontend Gate**:
- **Location**: `frontend/lib/features.js:79`
- **Logic**:
```javascript
email: {
  visibility: {
    FREE: 'hidden',
    TRIAL: 'hidden',
    STARTER: 'hidden',
    BASIC: 'locked',
    PRO: 'visible',
    ENTERPRISE: 'visible'
  }
}
```

**Backend OAuth - Gmail**:
- **Location**: `backend/src/routes/email.js:26`
- **Current Code**:
```javascript
router.get('/gmail/auth', authenticateToken, async (req, res) => {
  // ❌ NO PLAN CHECK!
  const { businessId } = req;
  // Proceeds to OAuth...
});
```

**Backend OAuth - Outlook**:
- **Location**: `backend/src/routes/email.js:88`
- **Current Code**:
```javascript
router.get('/outlook/auth', authenticateToken, async (req, res) => {
  // ❌ NO PLAN CHECK!
  // Proceeds to OAuth...
});
```

**Risk Analysis**:
- FREE/STARTER users can call OAuth endpoints directly (bypass frontend)
- OAuth flow will complete, business will have connected email
- Later API calls might fail but OAuth tokens stored
- Wastes resources, potential data leakage

**Email AI Features**:
- **Location**: `backend/src/routes/email-ai.js`
- **Check**: Some routes check PRO plan, inconsistent

**Değerlendirme**: ❌ **P0 CRITICAL** - OAuth endpoints açık.

---

### 2.4 INTEGRATIONS (Calendar, Sheets, CRM)

#### ⚠️ Gate Durumu: KISMÎ EKSİK

**Frontend Gate**:
- **Location**: `frontend/lib/features.js:104-179`
```javascript
integrations: {
  googleCalendar: {
    visibility: {
      FREE: 'hidden',
      TRIAL: 'locked',
      STARTER: 'locked',
      PRO: 'visible'
    }
  },
  googleSheets: { /* similar */ },
  customCRM: {
    visibility: {
      PRO: 'visible',
      ENTERPRISE: 'visible',
      others: 'locked'
    }
  }
}
```

**Backend OAuth - NO CHECKS!**:

**Google Calendar**:
```javascript
// backend/src/routes/integrations.js
router.post('/google-calendar/auth', authenticateToken, async (req, res) => {
  // ❌ NO PLAN CHECK!
  const { businessId } = req;
  // Proceeds to OAuth...
});
```

**Google Sheets**:
```javascript
router.post('/google-sheets/auth', authenticateToken, async (req, res) => {
  // ❌ NO PLAN CHECK!
});
```

**HubSpot CRM**:
```javascript
router.post('/hubspot/auth', authenticateToken, async (req, res) => {
  // ❌ NO PLAN CHECK!
});
```

**CRM API Usage** (Partial Protection):
- **Location**: `backend/src/routes/crm.js:32`
```javascript
const hasProPlan = hasProFeatures(currentPlan);
if (!hasProPlan) {
  return res.status(403).json({
    error: 'PRO_PLAN_REQUIRED',
    message: 'CRM features require PRO or ENTERPRISE plan'
  });
}
```

**Değerlendirme**: ⚠️ **P0 CRITICAL** - OAuth endpoints açık, usage kısmen korumalı.

---

### 2.5 AI ANALYSIS (Sentiment, Summary, Topics)

#### ✅ Gate Durumu: İYİ

**Location**: `backend/src/routes/elevenlabs.js:315`

**Check**:
```javascript
const hasProFeatures = (plan) => {
  return plan === 'PRO' || plan === 'ENTERPRISE';
};

const shouldAnalyze = hasProFeatures(plan);

if (shouldAnalyze) {
  // Run AI analysis
  const analysis = await analyzeCallWithAI(transcript);
  callLog.summary = analysis.summary;
  callLog.keyTopics = analysis.keyTopics;
  callLog.actionItems = analysis.actionItems;
  callLog.sentiment = analysis.sentiment;
  callLog.sentimentScore = analysis.sentimentScore;
}
```

**Features Gated**:
- Call summary (AI-generated)
- Key topics extraction
- Action items
- Sentiment analysis
- Sentiment score

**Plans Allowed**: PRO, ENTERPRISE only

**Değerlendirme**: ✅ Doğru gate'lenmiş, güvenli.

---

### 2.6 BATCH CALLS

#### ✅ Gate Durumu: İYİ

**Frontend**:
```javascript
// frontend/lib/features.js:243
batchCalls: {
  visibility: {
    FREE: 'locked',
    TRIAL: 'locked',
    STARTER: 'locked',
    BASIC: 'locked',
    PRO: 'visible',
    ENTERPRISE: 'visible'
  }
}
```

**Backend**:
- **Location**: `backend/src/routes/batchCalls.js`
- **Import**: `import { hasProFeatures } from '../config/plans.js'`
- **Check**: Applied at route level

**Değerlendirme**: ✅ Hem frontend hem backend korumalı.

---

### 2.7 ASSISTANTS (Creation Limit)

#### ❌ Gate Durumu: LIMIT ENFORCE YOK

**Plan Limits** (from plans.js):
```
TRIAL: 1 assistant
PAYG: 1 assistant
STARTER: 3 assistants
PRO: 10 assistants
ENTERPRISE: Unlimited (-1)
```

**Assistant Creation Endpoint**:
- **Location**: `backend/src/routes/assistant.js:136`
- **Current Code**:
```javascript
router.post('/', authenticateToken, async (req, res) => {
  const { businessId } = req;

  // ❌ NO LIMIT CHECK!
  // Should check: current count vs plan limit

  const assistant = await prisma.assistant.create({
    data: {
      businessId,
      // ...
    }
  });

  res.json(assistant);
});
```

**featureAccess Service Exists But NOT USED**:
- **Location**: `backend/src/services/featureAccess.js`
- **Method**: `checkLimit(businessId, 'assistants')` - EXISTS but never called!

**Risk**:
- User can create unlimited assistants
- Bypass plan limits via API
- Revenue loss (PRO features on STARTER plan)

**Değerlendirme**: ❌ **P1 HIGH** - Limit check eksik.

---

### 2.8 PHONE NUMBERS (Provisioning)

#### ✅ Gate Durumu: İYİ

**Location**: `backend/src/routes/phoneNumber.js:438`

**Check**:
```javascript
if (subscription.plan === 'FREE') {
  return res.status(403).json({
    error: 'FREE_PLAN_CANNOT_PROVISION'
  });
}
```

**Limit Check**:
```javascript
// Line 462-472
const existingNumbers = await prisma.phoneNumber.count({
  where: { businessId, status: 'ACTIVE' }
});

const planConfig = getPlanConfig(subscription.plan);
const phoneLimit = planConfig.phoneNumbersLimit || 1;

if (phoneLimit !== -1 && existingNumbers >= phoneLimit) {
  return res.status(400).json({
    error: 'PHONE_NUMBER_LIMIT_REACHED'
  });
}
```

**Değerlendirme**: ✅ Hem FREE block hem limit check var.

---

## 3. GÜVENLİK RİSK ANALİZİ

### 3.1 Kritik Güvenlik Açıkları

#### **RISK 1: Email OAuth Unprotected** (P0 Critical)

**Açıklama**: Email OAuth endpoints plan check yapmıyor.

**Exploit Senaryosu**:
```bash
# STARTER plan user (email blocked in frontend)
curl -X GET https://api.telyx.ai/api/email/gmail/auth \
  -H "Authorization: Bearer <token>"

# Returns OAuth URL, user can complete flow
# Gmail connected to STARTER account (shouldn't be possible)
```

**Impact**:
- FREE/STARTER users email integration kurabilir
- OAuth tokens DB'ye yazılır
- Backend resources waste
- Potansiyel data access (if later API calls don't check plan)

**Affected Endpoints**:
- `GET /api/email/gmail/auth` (email.js:26)
- `GET /api/email/gmail/callback` (email.js:50)
- `GET /api/email/outlook/auth` (email.js:88)
- `GET /api/email/outlook/callback` (email.js:120)

**Fix Gerekli**: Middleware ekle veya route başında plan check.

---

#### **RISK 2: Integration OAuth Unprotected** (P0 Critical)

**Açıklama**: Google Calendar, Sheets, CRM OAuth endpoints açık.

**Exploit Senaryosu**:
```bash
# STARTER user (Calendar locked in frontend)
curl -X POST https://api.telyx.ai/api/integrations/google-calendar/auth \
  -H "Authorization: Bearer <token>"

# OAuth flow başlar, Calendar bağlanır
```

**Impact**:
- Plan limits bypass via direct API
- Integration setup succeeds (OAuth tokens stored)
- Later usage might be blocked but damage done

**Affected Endpoints**:
- `POST /api/integrations/google-calendar/auth`
- `POST /api/integrations/google-sheets/auth`
- `POST /api/integrations/hubspot/auth`
- Other integration OAuth endpoints

**Fix Gerekli**: Per-integration plan check middleware.

---

#### **RISK 3: Assistant Limit Not Enforced** (P1 High)

**Açıklama**: Assistant creation endpoint limit check yapmıyor.

**Exploit Senaryosu**:
```bash
# STARTER user (limit: 3 assistants)
# Create 10 assistants via API
for i in {1..10}; do
  curl -X POST https://api.telyx.ai/api/assistants \
    -H "Authorization: Bearer <token>" \
    -d '{"name": "Assistant '$i'"}'
done

# All 10 created successfully (should block after 3)
```

**Impact**:
- Revenue loss (PRO feature on STARTER plan)
- Unfair usage
- System resources waste

**Fix Gerekli**: Add limit check before `prisma.assistant.create()`.

---

#### **RISK 4: TRIAL Expiry Not Enforced in Chat** (P2 Medium)

**Açıklama**: TRIAL plan'ın chat expiry'si check edilmiyor.

**Exploit Senaryosu**:
```bash
# TRIAL user, trialChatExpiry = 2026-01-20 (expired)
# Send chat message
curl -X POST https://api.telyx.ai/api/chat/send \
  -H "Authorization: Bearer <token>" \
  -d '{"message": "test"}'

# Message sent successfully (should be blocked)
```

**Impact**:
- Expired TRIAL users continue using chat
- Revenue loss (should upgrade to paid)

**Current State**:
- `checkPlanExpiry.js` middleware exists
- Imported in `chat-refactored.js` but NOT applied to routes

**Fix Gerekli**: Apply middleware to chat routes.

---

### 3.2 Risk Matrisi

| Risk | Severity | Likelihood | Impact | Priority | Effort |
|------|----------|------------|--------|----------|--------|
| Email OAuth Unprotected | Critical | High | High | P0 | Low (2h) |
| Integration OAuth Unprotected | Critical | High | High | P0 | Low (2h) |
| Assistant Limit Not Enforced | High | Medium | Medium | P1 | Low (1h) |
| TRIAL Expiry Not Checked | Medium | Low | Low | P2 | Low (1h) |
| 3 Sources of Truth (Limits) | Low | Low | Medium | P3 | High (refactor) |

---

## 4. TUTARSIZLIKLAR VE ANOMALİLER

### 4.1 Tutarsız Implementasyonlar

#### **TUTARSIZLIK 1: Concurrent Limit - 3 Kaynak**

**Kaynak 1**: `plans.js` - Plan config
```javascript
STARTER: { concurrentLimit: 1 }
PRO: { concurrentLimit: 5 }
```

**Kaynak 2**: `subscriptionLimits.js` - Middleware
```javascript
STARTER: { maxConcurrentCalls: 1 }
PRO: { maxConcurrentCalls: 5 }
```

**Kaynak 3**: `Subscription.concurrentLimit` field - DB
```sql
ALTER TABLE Subscription ADD COLUMN concurrentLimit INT DEFAULT 1;
-- Can be overridden per subscription
```

**Problem**: Hangisi doğru? Subscription record override edebiliyor.

**Risk**: Senkronizasyon hatası, yanlış limit enforcement.

---

#### **TUTARSIZLIK 2: AI Analysis - İki Farklı Check**

**Check 1**: `elevenlabs.js:315`
```javascript
const hasProFeatures = (plan) => {
  return plan === 'PRO' || plan === 'ENTERPRISE';
};

if (hasProFeatures(plan)) {
  // AI analysis
}
```

**Check 2**: `elevenlabs.js:873`
```javascript
if (subscription?.plan === 'STARTER') {
  // Some analysis feature for STARTER?
}
```

**Problem**: Line 873 suggests STARTER might get some analysis? Inconsistent.

**Risk**: Unclear business logic, potential feature leakage.

---

#### **TUTARSIZLIK 3: Chat Token Charging - 3 Implementations**

**Implementation 1**: `chat-refactored.js:987`
```javascript
const isFreeChat = hasFreeChat(planName);
const chargeType = isFreeChat ? 'FREE_TRIAL' :
  (planName === 'PAYG' ? 'BALANCE' : 'INCLUDED');
```

**Implementation 2**: `whatsapp.js:846`
```javascript
const isFreeChat = hasFreeChat(planName);
// Same logic
```

**Implementation 3**: `chat-legacy.js:590`
```javascript
// Old implementation, might differ
```

**Problem**: Same logic in 3 places, maintenance risk.

**Risk**: Update one, forget others → inconsistent charging.

---

### 4.2 Anomaliler

#### **ANOMALY 1: FREE Plan Hala Mevcut**

**Observation**: Code'da FREE plan checks var ama plan deprecated.

**Risk**: Eski FREE users hala sistemde mi? Yoksa sadece legacy code?

**Validation Needed**:
```sql
SELECT COUNT(*) FROM Subscription WHERE plan = 'FREE';
-- If > 0, need migration plan
```

---

#### **ANOMALY 2: BASIC Plan → STARTER Mapping**

**Code**: `plans.js:851`
```javascript
const planMap = {
  // 'BASIC': 'STARTER',  // Commented out
};
```

**Problem**: Commented mapping, BASIC hala DB'de var mı?

**Risk**: Eski BASIC users yanlış limitler alabilir.

---

#### **ANOMALY 3: PAYG Upgrade Blocking**

**Code**: `balance.js:137, 354, 417`
```javascript
if (subscription.plan === 'PAYG' && subscription.balance > 0) {
  return res.status(400).json({
    error: 'CANNOT_UPGRADE_WITH_BALANCE',
    message: 'Spend or withdraw your balance first'
  });
}
```

**Question**: Bu business rule doğru mu? User balance'ını transfer edemez mi?

**UX Impact**: User balance'ı bitirmeden upgrade yapamıyor (kötü UX).

---

## 5. EKSİK GATE'LER - FİX ÖNCESİ DURUM

### 5.1 Backend Endpoints WITHOUT Plan Checks

| Endpoint | Method | File | Line | Risk | Expected Gate |
|----------|--------|------|------|------|---------------|
| `/api/email/gmail/auth` | GET | email.js | 26 | P0 | PRO+ only |
| `/api/email/gmail/callback` | GET | email.js | 50 | P0 | PRO+ only |
| `/api/email/outlook/auth` | GET | email.js | 88 | P0 | PRO+ only |
| `/api/email/outlook/callback` | GET | email.js | 120 | P0 | PRO+ only |
| `/api/integrations/google-calendar/auth` | POST | integrations.js | ? | P0 | PRO+ only |
| `/api/integrations/google-sheets/auth` | POST | integrations.js | ? | P0 | PRO+ only |
| `/api/integrations/hubspot/auth` | POST | integrations.js | ? | P0 | PRO+ only |
| `/api/assistants` (POST) | POST | assistant.js | 136 | P1 | Check limit |
| `/api/chat/send` | POST | chat-refactored.js | ? | P2 | TRIAL expiry check |
| `/api/whatsapp/send` | POST | whatsapp.js | ? | P2 | TRIAL expiry check |

---

### 5.2 Missing Middleware Applications

**Available But Not Used**:

1. **featureAccess.checkLimit()** - Exists, never called
   - Should be used in assistant.js
   - Should be used in phoneNumber.js (already has custom check)

2. **checkPlanExpiry middleware** - Exists, not applied
   - Should be on chat routes
   - Should be on whatsapp routes

---

## 6. ÖNERİLEN FİX STRATEJİSİ

### 6.1 P0 Fixes (Do Immediately - Security)

#### **Fix 1: Email OAuth Protection**
```javascript
// backend/src/routes/email.js

// Add middleware
const requireProPlan = (req, res, next) => {
  const { businessId } = req;
  const subscription = await prisma.subscription.findUnique({
    where: { businessId }
  });

  if (!['PRO', 'ENTERPRISE'].includes(subscription.plan)) {
    return res.status(403).json({
      error: 'PRO_PLAN_REQUIRED',
      message: 'Email integration requires PRO or ENTERPRISE plan'
    });
  }
  next();
};

// Apply to OAuth routes
router.get('/gmail/auth', authenticateToken, requireProPlan, async (req, res) => {
  // OAuth logic
});
```

**Effort**: 2 hours
**Impact**: Blocks FREE/STARTER from email OAuth

---

#### **Fix 2: Integration OAuth Protection**
```javascript
// backend/src/routes/integrations.js

const requireIntegrationAccess = (integrationType) => {
  return async (req, res, next) => {
    const { businessId } = req;
    const subscription = await prisma.subscription.findUnique({
      where: { businessId }
    });

    const plan = subscription.plan;

    // Calendar/Sheets: PRO+
    if (['google-calendar', 'google-sheets'].includes(integrationType)) {
      if (!['PRO', 'ENTERPRISE'].includes(plan)) {
        return res.status(403).json({ error: 'PRO_PLAN_REQUIRED' });
      }
    }

    // CRM: PRO+ only
    if (integrationType === 'crm') {
      if (!['PRO', 'ENTERPRISE'].includes(plan)) {
        return res.status(403).json({ error: 'PRO_PLAN_REQUIRED' });
      }
    }

    next();
  };
};

// Apply
router.post('/google-calendar/auth',
  authenticateToken,
  requireIntegrationAccess('google-calendar'),
  async (req, res) => { /* ... */ }
);
```

**Effort**: 2 hours
**Impact**: Blocks unauthorized integration setup

---

### 6.2 P1 Fixes (Do Soon - Feature Integrity)

#### **Fix 3: Assistant Creation Limit**
```javascript
// backend/src/routes/assistant.js

router.post('/', authenticateToken, async (req, res) => {
  const { businessId } = req;

  // Get current count
  const currentCount = await prisma.assistant.count({
    where: { businessId }
  });

  // Get plan limit
  const subscription = await prisma.subscription.findUnique({
    where: { businessId }
  });
  const planConfig = getPlanConfig(subscription.plan);
  const limit = planConfig.assistantsLimit || 1;

  // Check limit
  if (limit !== -1 && currentCount >= limit) {
    return res.status(403).json({
      error: 'ASSISTANT_LIMIT_REACHED',
      message: `Your plan allows ${limit} assistants. Upgrade to create more.`,
      currentCount,
      limit
    });
  }

  // Proceed with creation
  const assistant = await prisma.assistant.create({ /* ... */ });
  res.json(assistant);
});
```

**Effort**: 1 hour
**Impact**: Enforces assistant limits per plan

---

#### **Fix 4: TRIAL Expiry Enforcement**
```javascript
// backend/src/routes/chat-refactored.js

import { checkPlanExpiry } from '../middleware/checkPlanExpiry.js';

// Apply middleware to chat routes
router.post('/send',
  authenticateToken,
  checkPlanExpiry, // ← ADD THIS
  async (req, res) => { /* ... */ }
);
```

**Effort**: 30 minutes
**Impact**: Blocks expired TRIAL from chat

---

### 6.3 P2 Fixes (Do Eventually - Architecture)

#### **Fix 5: Consolidate Limit Sources**

**Strategy**: Use DB as single source of truth
```javascript
// Migration: Set concurrentLimit from plan config
UPDATE Subscription s
SET concurrentLimit = (
  CASE s.plan
    WHEN 'TRIAL' THEN 1
    WHEN 'PAYG' THEN 1
    WHEN 'STARTER' THEN 1
    WHEN 'PRO' THEN 5
    WHEN 'ENTERPRISE' THEN 5
    ELSE 1
  END
)
WHERE concurrentLimit IS NULL OR concurrentLimit = 0;

// Remove PLAN_LIMITS from subscriptionLimits.js
// Always read from subscription.concurrentLimit
```

**Effort**: 4 hours (migration + code cleanup)
**Impact**: Single source of truth, less confusion

---

## 7. TEST STRATEJİSİ

### 7.1 Plan Gating Test Cases

#### **Test Suite 1: Email OAuth**
```javascript
describe('Email OAuth Plan Gating', () => {
  it('should block FREE plan from Gmail OAuth', async () => {
    // User with FREE plan
    const res = await request(app)
      .get('/api/email/gmail/auth')
      .set('Authorization', `Bearer ${freeUserToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PRO_PLAN_REQUIRED');
  });

  it('should allow PRO plan Gmail OAuth', async () => {
    const res = await request(app)
      .get('/api/email/gmail/auth')
      .set('Authorization', `Bearer ${proUserToken}`);

    expect(res.status).toBe(200); // or 302 redirect
  });
});
```

#### **Test Suite 2: Assistant Limits**
```javascript
describe('Assistant Creation Limits', () => {
  it('should block STARTER after 3 assistants', async () => {
    // Create 3 assistants (STARTER limit)
    for (let i = 0; i < 3; i++) {
      await createAssistant(starterBusinessId);
    }

    // 4th should fail
    const res = await request(app)
      .post('/api/assistants')
      .set('Authorization', `Bearer ${starterToken}`)
      .send({ name: 'Assistant 4' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ASSISTANT_LIMIT_REACHED');
  });

  it('should allow PRO to create 10 assistants', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await createAssistant(proBusinessId);
      expect(res.status).toBe(200);
    }
  });
});
```

---

## 8. SONUÇ VE TAVSİYELER

### 8.1 Özet

**İyi Taraflar**:
- ✅ Phone calls, concurrent limits, chat pricing iyi gate'lenmiş
- ✅ AI analysis, batch calls PRO-only (doğru)
- ✅ Frontend visibility gates tutarlı

**Kötü Taraflar**:
- ❌ Email OAuth açık (P0 security risk)
- ❌ Integration OAuth açık (P0 security risk)
- ❌ Assistant limits enforce edilmiyor (P1 revenue risk)
- ⚠️ TRIAL expiry chat'te check edilmiyor (P2)

**Acil Aksiyon Gerekli**:
1. Email OAuth: Plan check ekle (2h)
2. Integration OAuth: Plan check ekle (2h)
3. Assistant limit: Enforce et (1h)

**Toplam Fix Süresi**: ~5 saat (P0+P1)

---

### 8.2 Production Deployment Önceliği

#### **Faz 1: Güvenlik (Hemen)**
- Email OAuth protection
- Integration OAuth protection
- **Test**: Manuel + automated
- **Deploy**: Production hotfix

#### **Faz 2: Feature Integrity (1 hafta içinde)**
- Assistant limit enforcement
- TRIAL expiry enforcement
- **Test**: Staging + production monitoring

#### **Faz 3: Mimari İyileştirme (1 ay içinde)**
- Consolidate limit sources
- Refactor inconsistent checks
- Comprehensive test suite

---

### 8.3 Monitoring Önerileri

**Production'da İzlenecek Metrikler**:
```sql
-- 1. Plan dışı OAuth attempts
SELECT COUNT(*) FROM EmailIntegration e
JOIN Business b ON e.businessId = b.id
JOIN Subscription s ON s.businessId = b.id
WHERE s.plan IN ('FREE', 'STARTER')
  AND e.connected = true;
-- Should be 0 after fix

-- 2. Plan limit aşımları
SELECT b.id, s.plan, COUNT(a.id) as assistant_count
FROM Business b
JOIN Subscription s ON s.businessId = b.id
JOIN Assistant a ON a.businessId = b.id
GROUP BY b.id, s.plan
HAVING COUNT(a.id) > (
  CASE s.plan
    WHEN 'TRIAL' THEN 1
    WHEN 'PAYG' THEN 1
    WHEN 'STARTER' THEN 3
    WHEN 'PRO' THEN 10
    ELSE 999
  END
);
-- Should be 0 after fix

-- 3. Expired TRIAL users using chat
SELECT COUNT(*) FROM ChatLog c
JOIN Business b ON c.businessId = b.id
JOIN Subscription s ON s.businessId = b.id
WHERE s.plan = 'TRIAL'
  AND s.trialChatExpiry < NOW()
  AND c.createdAt > s.trialChatExpiry;
-- Should be 0 after fix
```

---

## 9. SONUÇ

**Mevcut Durum**: Plan gating %70 iyi, %30 kritik açık var.

**Ana Sorunlar**:
1. OAuth endpoints unprotected (security)
2. Assistant limits not enforced (revenue)
3. TRIAL expiry not checked in chat (UX)

**Tavsiye Edilen Aksiyon**:
- P0 fixleri ASAP deploy et (email + integration OAuth)
- P1 fixleri 1 hafta içinde (assistant limits + TRIAL expiry)
- P2 refactoring 1 ay içinde (consolidation)

**Risk Değerlendirmesi**:
- Current Risk: HIGH (OAuth unprotected)
- After P0 Fixes: MEDIUM (assistant limits still missing)
- After P1 Fixes: LOW (normal operational risk)

---

**Rapor Sonu**

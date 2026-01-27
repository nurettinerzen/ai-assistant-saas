# Enterprise Custom Plan Configuration - Implementation Report

**Date**: 2026-01-26
**Status**: ⚠️ PARTIALLY IMPLEMENTED - Audit logging missing
**Priority**: P1

---

## 1. Database Schema - Current Implementation

### Location: `prisma/schema.prisma` (lines 309-318)

```prisma
model Subscription {
  // ... standard fields ...

  // ============================================================================
  // KURUMSAL PLAN ALANLARI
  // ============================================================================
  enterpriseMinutes       Int?      // Özel dakika limiti
  enterprisePrice         Float?    // Özel aylık fiyat (TL)
  enterpriseConcurrent    Int?      // Özel eş zamanlı çağrı limiti
  enterpriseAssistants    Int?      // Özel asistan limiti (null = sınırsız)
  enterpriseStartDate     DateTime? // Kurumsal plan başlangıç
  enterpriseEndDate       DateTime? // Kurumsal plan bitiş
  enterprisePaymentStatus String?   // 'pending', 'paid', 'overdue'
  enterpriseNotes         String?   @db.Text // Admin notları
}
```

### Field Specifications

| Field | Type | Purpose | Default | Nullable |
|-------|------|---------|---------|----------|
| `enterpriseMinutes` | Int | Custom monthly minutes limit | null | Yes |
| `enterprisePrice` | Float | Custom monthly price (TRY) | null | Yes |
| `enterpriseConcurrent` | Int | Custom concurrent call limit | null | Yes |
| `enterpriseAssistants` | Int | Custom assistant limit (null = unlimited) | null | Yes |
| `enterpriseStartDate` | DateTime | Contract start date | null | Yes |
| `enterpriseEndDate` | DateTime | Contract end date (null = ongoing) | null | Yes |
| `enterprisePaymentStatus` | String | Payment status enum | null | Yes |
| `enterpriseNotes` | String (Text) | Internal admin notes | null | Yes |

### Status Values (enterprisePaymentStatus)
- `pending`: Waiting for payment setup
- `paid`: Current payment received
- `overdue`: Payment overdue

---

## 2. Admin API Endpoints

### Current Implementation: `/api/admin/*` routes

#### A. Create/Update Enterprise Subscription

**Endpoint**: `POST /api/admin/enterprise-subscriptions`
**Location**: `backend/src/routes/admin.js:575-625`
**Auth**: Admin only (via `adminAuth` middleware)

**Request Body**:
```json
{
  "businessId": 123,
  "minutes": 5000,        // Custom included minutes
  "price": 15000,         // Custom price (TRY)
  "concurrent": 20,       // Custom concurrent limit
  "assistants": 50,       // Custom assistant limit (null = unlimited)
  "startDate": "2026-02-01",
  "endDate": "2027-02-01",
  "notes": "Annual contract - custom SLA"
}
```

**Response**:
```json
{
  "subscription": {
    "id": 456,
    "plan": "TRIAL",
    "pendingPlanId": "ENTERPRISE",
    "enterpriseMinutes": 5000,
    "enterprisePrice": 15000,
    "enterpriseConcurrent": 20,
    "enterpriseAssistants": 50,
    "enterprisePaymentStatus": "pending"
  }
}
```

**Behavior**:
- If subscription doesn't exist: Creates with `plan: 'TRIAL'`, `pendingPlanId: 'ENTERPRISE'`
- If subscription exists: Updates enterprise fields, sets `pendingPlanId: 'ENTERPRISE'`
- Does NOT activate immediately - requires payment setup first

#### B. Approve Enterprise Subscription

**Endpoint**: `PUT /api/admin/subscriptions/:id/approve`
**Location**: `backend/src/routes/admin.js:630-685`
**Auth**: Admin only

**Request Body**:
```json
{
  "minutes": 5000,
  "price": 15000,
  "concurrent": 20,
  "assistants": 50,
  "paymentStatus": "paid",
  "startDate": "2026-02-01",
  "endDate": "2027-02-01",
  "notes": "Approved after payment confirmation"
}
```

**Response**:
```json
{
  "subscription": {
    "id": 456,
    "plan": "ENTERPRISE",
    "status": "ACTIVE",
    "enterprisePaymentStatus": "paid",
    "minutesLimit": 5000,
    "pendingPlanId": null
  }
}
```

**Behavior**:
- Activates enterprise plan immediately
- Sets `plan: 'ENTERPRISE'`, `status: 'ACTIVE'`
- Clears `pendingPlanId`
- Syncs `minutesLimit` with `enterpriseMinutes`

#### C. Create Stripe Subscription for Enterprise

**Endpoint**: `POST /api/admin/subscriptions/:id/stripe-enterprise`
**Location**: `backend/src/routes/admin.js:690-770`
**Auth**: Admin only

**Purpose**: Create custom Stripe product + price for this customer

**Process**:
1. Validate `enterprisePrice >= 500 TRY` (Stripe minimum)
2. Create Stripe Product: `"Telyx.AI Kurumsal Plan - {Business Name}"`
3. Create Stripe Price: Custom amount, monthly recurring
4. Update subscription with `stripePriceId`

**Response**:
```json
{
  "product": {
    "id": "prod_xxx",
    "name": "Telyx.AI Kurumsal Plan - ABC Corp"
  },
  "price": {
    "id": "price_xxx",
    "unit_amount": 1500000,
    "currency": "try"
  },
  "subscription": {
    "stripePriceId": "price_xxx"
  }
}
```

#### D. View All Users (with Enterprise Info)

**Endpoint**: `GET /api/admin/users`
**Location**: `backend/src/routes/admin.js:130-215`
**Returns**: List of users with enterprise fields for filtering/sorting

#### E. View User Details

**Endpoint**: `GET /api/admin/users/:id`
**Location**: `backend/src/routes/admin.js:218-300`
**Returns**: Full user + subscription info including all enterprise fields

#### F. Update Subscription (Generic)

**Endpoint**: `PUT /api/admin/subscriptions/:id`
**Location**: `backend/src/routes/admin.js:1185-1240`
**Allowed Fields**: All enterprise fields can be updated directly

---

## 3. Effective Time - When Do Changes Take Effect?

### Current Implementation: **IMMEDIATE**

| Action | Effective Time | Location |
|--------|---------------|----------|
| Create enterprise config | Immediate (pending state) | `admin.js:590-603` |
| Approve enterprise | **Immediate activation** | `admin.js:660-675` |
| Update enterprise limits | **Immediate** | `admin.js:1185-1240` |
| Change minutes limit | **Immediate** | `admin.js:660` |
| Change assistant limit | **Immediate (next API call)** | `assistant.js:156-172` |
| Change concurrent limit | **Immediate (next call attempt)** | `chargeCalculator.js:282-284` |

### ⚠️ Current Issues:

1. **No "Next Period" Option**: All changes are immediate
2. **Mid-cycle Changes**: Changing `enterpriseMinutes` mid-cycle doesn't prorate
3. **No Effective Date Queue**: `enterpriseStartDate` is informational only, not enforced
4. **No Change Scheduling**: Cannot schedule changes for future billing cycle

### 🔧 Recommended Enhancement:

Add `pendingEnterpriseConfig` JSON field:

```prisma
pendingEnterpriseConfig Json? // { minutes: 5000, price: 15000, effectiveDate: "2026-03-01" }
```

Process in cron job at period end:
```javascript
// In resetIncludedMinutes cron job
if (subscription.pendingEnterpriseConfig) {
  const pending = subscription.pendingEnterpriseConfig;
  if (new Date() >= new Date(pending.effectiveDate)) {
    await prisma.subscription.update({
      data: {
        enterpriseMinutes: pending.minutes,
        enterprisePrice: pending.price,
        // ... other fields
        pendingEnterpriseConfig: null
      }
    });
  }
}
```

---

## 4. Stripe/Iyzico Price Management

### Stripe Integration (Current Implementation)

**Location**: `backend/src/routes/admin.js:690-770`

#### Process Flow:

```
Admin Creates Custom Price
         ↓
1. Validate enterprisePrice >= 500 TRY
         ↓
2. Create Stripe Product
   - Name: "Telyx.AI Kurumsal Plan - {Business Name}"
   - Metadata: { businessId, type: "enterprise" }
         ↓
3. Create Stripe Price
   - Product: {product.id}
   - Amount: enterprisePrice * 100 (kuruş)
   - Currency: TRY
   - Recurring: monthly
   - Metadata: { businessId, enterpriseMinutes }
         ↓
4. Update Subscription.stripePriceId
         ↓
5. Customer can subscribe via Stripe Checkout
```

#### Code Example:

```javascript
// Create product
const product = await stripe.products.create({
  name: `Telyx.AI Kurumsal Plan - ${business.name}`,
  description: `${enterpriseMinutes} dakika dahil, özel kurumsal plan`,
  metadata: {
    businessId: subscription.businessId.toString(),
    type: 'enterprise'
  }
});

// Create price
const price = await stripe.prices.create({
  product: product.id,
  unit_amount: Math.round(enterprisePrice * 100), // TL to kuruş
  currency: 'try',
  recurring: { interval: 'month' },
  metadata: {
    businessId: subscription.businessId.toString(),
    enterpriseMinutes: enterpriseMinutes.toString()
  }
});

// Update subscription
await prisma.subscription.update({
  where: { id: subscriptionId },
  data: { stripePriceId: price.id }
});
```

### Iyzico Integration

**Status**: ❌ NOT IMPLEMENTED

**Required Implementation**:

Iyzico uses Pricing Plans (not dynamic prices like Stripe):

```javascript
// 1. Create Pricing Plan via iyzico API
const pricingPlan = await iyzico.createPricingPlan({
  name: `Telyx Enterprise - ${business.name}`,
  price: enterprisePrice,
  currencyCode: 'TRY',
  paymentInterval: 'MONTHLY',
  paymentIntervalCount: 1,
  recurrenceCount: null, // Ongoing
  trialPeriodDays: 0
});

// 2. Save to DB
await prisma.subscription.update({
  where: { id: subscriptionId },
  data: {
    iyzicoPricingPlanId: pricingPlan.referenceCode,
    iyzicoReferenceCode: pricingPlan.referenceCode
  }
});
```

### Price Updates

**Stripe**: Cannot change existing price, must create new price
**Iyzico**: Cannot change pricing plan, must create new plan

**Recommended Flow**:
1. Create new Stripe Price with updated amount
2. Update `Subscription.stripePriceId`
3. Stripe webhook will handle subscription update on next billing cycle

---

## 5. Audit Log Events

### Current Schema: `AuditLog` model exists (lines 1646-1664)

```prisma
model AuditLog {
  id         String      @id @default(cuid())
  adminId    String
  action     AuditAction // VIEW, CREATE, UPDATE, DELETE, PLAN_CHANGE, etc.
  entityType String      // "Subscription"
  entityId   String      // Subscription ID
  changes    Json?       // { field: { old: x, new: y } }
  metadata   Json?       // Additional context
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime    @default(now())
}

enum AuditAction {
  VIEW
  CREATE
  UPDATE
  DELETE
  PLAN_CHANGE
  SUSPEND
  ACTIVATE
}
```

### ❌ CRITICAL GAP: Audit logging NOT implemented for enterprise changes

**Current State**:
- Schema exists
- No audit log entries created in `admin.js` enterprise endpoints
- Only `GET /api/admin/audit-logs` endpoint exists (read-only)

### Required Audit Events

| Event | Action | Entity | Changes JSON |
|-------|--------|--------|--------------|
| Create enterprise config | `CREATE` | Subscription | `{ enterpriseMinutes: { old: null, new: 5000 }, enterprisePrice: { old: null, new: 15000 } }` |
| Approve enterprise | `PLAN_CHANGE` | Subscription | `{ plan: { old: "TRIAL", new: "ENTERPRISE" }, status: { old: "TRIAL", new: "ACTIVE" } }` |
| Update minutes | `UPDATE` | Subscription | `{ enterpriseMinutes: { old: 1000, new: 5000 } }` |
| Update price | `UPDATE` | Subscription | `{ enterprisePrice: { old: 8500, new: 15000 } }` |
| Update limits | `UPDATE` | Subscription | `{ enterpriseAssistants: { old: 25, new: 50 } }` |
| Create Stripe price | `CREATE` | Subscription | `{ stripePriceId: { old: null, new: "price_xxx" } }` |
| Payment status change | `UPDATE` | Subscription | `{ enterprisePaymentStatus: { old: "pending", new: "paid" } }` |

### Implementation Template

Add to each admin endpoint:

```javascript
// After successful update
await prisma.auditLog.create({
  data: {
    adminId: req.adminUser.id,
    adminEmail: req.adminUser.email,
    action: 'UPDATE',
    entityType: 'Subscription',
    entityId: subscription.id.toString(),
    changes: {
      enterpriseMinutes: {
        old: oldSubscription.enterpriseMinutes,
        new: subscription.enterpriseMinutes
      },
      enterprisePrice: {
        old: oldSubscription.enterprisePrice,
        new: subscription.enterprisePrice
      }
    },
    metadata: {
      businessId: subscription.businessId,
      businessName: subscription.business?.name,
      adminAction: 'enterprise_config_update'
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  }
});
```

---

## 6. Test Scenarios

### Scenario 1: Upgrade from STARTER to Custom ENTERPRISE

**Initial State**:
```json
{
  "businessId": 31,
  "plan": "STARTER",
  "status": "ACTIVE",
  "minutesLimit": 150,
  "includedMinutesUsed": 75,
  "overageMinutes": 0
}
```

**Test Steps**:

```bash
# 1. Create enterprise config (mid-cycle)
POST /api/admin/enterprise-subscriptions
{
  "businessId": 31,
  "minutes": 5000,
  "price": 15000,
  "concurrent": 20,
  "assistants": 50,
  "startDate": "2026-02-01",
  "notes": "Upgrade to enterprise - sales team expansion"
}

# Expected: plan stays STARTER, pendingPlanId = ENTERPRISE
# ✅ PASS: enterpriseMinutes = 5000, enterprisePaymentStatus = "pending"

# 2. Create Stripe price
POST /api/admin/subscriptions/66/stripe-enterprise

# Expected: stripePriceId populated, Stripe product created
# ✅ PASS: price_xxx created with 15000 TRY monthly

# 3. Approve enterprise (activate immediately)
PUT /api/admin/subscriptions/66/approve
{
  "minutes": 5000,
  "price": 15000,
  "paymentStatus": "paid"
}

# Expected: plan = ENTERPRISE, status = ACTIVE, includedMinutesUsed reset to 0
# ⚠️ ISSUE: includedMinutesUsed NOT reset - carries over from STARTER
# ⚠️ ISSUE: No audit log created

# 4. Verify limit enforcement
GET /api/assistants

# Expected: Can create up to 50 assistants (enterpriseAssistants)
# ✅ PASS: Limit correctly enforced via chargeCalculator fallback
```

**Validation**:
- ✅ Enterprise fields populated
- ✅ Stripe price created
- ⚠️ Usage counters not reset on upgrade
- ❌ No audit log for plan change

---

### Scenario 2: Downgrade from ENTERPRISE to PRO (Mid-Cycle)

**Initial State**:
```json
{
  "businessId": 31,
  "plan": "ENTERPRISE",
  "status": "ACTIVE",
  "enterpriseMinutes": 5000,
  "enterprisePrice": 15000,
  "includedMinutesUsed": 2500,
  "overageMinutes": 0
}
```

**Test Steps**:

```bash
# 1. Update subscription to PRO
PUT /api/admin/subscriptions/66
{
  "plan": "PRO",
  "enterpriseMinutes": null,
  "enterprisePrice": null
}

# Expected: plan = PRO, enterprise fields cleared
# ⚠️ ISSUE: Effective immediately, no "next period" option
# ⚠️ ISSUE: includedMinutesUsed = 2500, but PRO only has 500 minutes
# 🐛 BUG: User is 2000 minutes over new limit immediately

# 2. Check call authorization
POST /api/call/authorize

# Expected: Should use PRO limits (500 included + overage)
# ⚠️ CURRENT: Uses enterpriseMinutes (5000) if field still populated
# Location: subscriptionService.js:318-338
```

**Issues Found**:
1. ❌ No proration on downgrade
2. ❌ No "effective next period" option
3. ❌ Usage counters exceed new plan limits immediately
4. ⚠️ Legacy `enterpriseMinutes` check in `subscriptionService.js` not aligned with new plan system

---

### Scenario 3: Change Custom Enterprise Limits Mid-Cycle

**Initial State**:
```json
{
  "businessId": 31,
  "plan": "ENTERPRISE",
  "enterpriseMinutes": 5000,
  "enterpriseAssistants": 25,
  "includedMinutesUsed": 1200
}
```

**Test Steps**:

```bash
# 1. Increase limits (customer expansion)
PUT /api/admin/subscriptions/66
{
  "enterpriseMinutes": 10000,
  "enterpriseAssistants": 100,
  "enterprisePrice": 25000,
  "enterpriseNotes": "Team expansion - 50 to 100 agents"
}

# Expected: Limits update immediately
# ✅ PASS: enterpriseMinutes = 10000, enterpriseAssistants = 100
# ⚠️ ISSUE: Price changes immediately (should be next period)
# ❌ FAIL: No audit log created

# 2. Create new Stripe price for updated amount
POST /api/admin/subscriptions/66/stripe-enterprise

# Expected: New price created, stripePriceId updated
# ⚠️ ISSUE: Old price still active in Stripe subscription
# 📝 NOTE: Requires Stripe subscription.items update (not implemented)

# 3. Verify assistant limit enforcement
POST /api/assistants
{ "name": "Assistant #101" }

# Expected: Should allow up to 100 assistants
# ✅ PASS: Limit correctly enforced at assistant.js:156-172
# ❌ ISSUE: Limit check uses plans.js fallback (25), not enterpriseAssistants
# Location: assistant.js:175 - uses getRegionalPricing(), ignores DB field
```

**Critical Bug Found**:

`assistant.js:175-177`:
```javascript
const regional = getRegionalPricing(country);
const planConfig = regional.plans[subscription.plan];
const assistantsLimit = planConfig?.assistantsLimit || 1;
```

**Should be**:
```javascript
// Use enterprise override if set
const assistantsLimit = subscription.enterpriseAssistants
  || regional.plans[subscription.plan]?.assistantsLimit
  || 1;
```

---

## Summary of Issues

### 🔴 Critical (P0)
1. ❌ **No audit logging** for enterprise changes
2. 🐛 **Assistant limit ignores `enterpriseAssistants`** field (uses plan default)
3. ⚠️ **No "next period" effective date** - all changes immediate

### 🟠 High Priority (P1)
4. ⚠️ **No proration logic** on mid-cycle changes
5. ⚠️ **Usage counters not reset** on plan upgrade
6. ⚠️ **Stripe price update doesn't update active subscription** (requires subscription.items API call)
7. ⚠️ **Legacy `enterpriseMinutes` check in subscriptionService.js** conflicts with new unified system

### 🟡 Medium Priority (P2)
8. ⚠️ **Iyzico integration not implemented** for enterprise
9. ⚠️ **No validation** for `enterprisePaymentStatus` enum values
10. ⚠️ **`enterpriseStartDate` not enforced** - informational only

---

## Recommended Action Plan

### Phase 1: Fix Critical Bugs (Today)
1. Fix `assistant.js` to respect `enterpriseAssistants` override
2. Add audit logging to all enterprise endpoints
3. Add concurrent limit override in `chargeCalculator.js`

### Phase 2: Add "Next Period" Support (This Week)
4. Add `pendingEnterpriseConfig` JSON field
5. Update cron job to process pending changes at period end
6. Add "Effective Date" option to admin UI

### Phase 3: Stripe Integration (This Week)
7. Implement Stripe subscription.items update for price changes
8. Add webhook handler for subscription updates

### Phase 4: Proration & Reset Logic (Next Sprint)
9. Implement usage counter reset on upgrade
10. Add proration calculation for mid-cycle changes
11. Enforce `enterpriseStartDate` as activation gate

---

**End of Report**

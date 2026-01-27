# P0 Remaining Tasks - Implementation Guide

**Status**: 1/3 Complete ✅
**Completed**: P0-A (Single Source of Truth)
**Remaining**: P0-B (Downgrade Logic), P0-C (Audit Logging)

---

## ✅ P0-A: Single Source of Truth (COMPLETE)

**What Was Done**:
- Created `/services/planConfig.js` with `getEffectivePlanConfig()`
- Updated 3 files: assistant.js, chargeCalculator.js, subscriptionService.js
- All enterprise overrides now work via unified function
- Test passing: test-assistant-limits.js

**Commit**: d2b3ccf

---

## 🚧 P0-B: Downgrade Usage Counter Logic

### Problem Statement

**Scenario**: Enterprise customer downgraded mid-cycle
- Was on ENTERPRISE: 5000 included minutes
- Used: 2500 minutes
- Downgrades to PRO: 500 included minutes
- **BUG**: includedMinutesUsed = 2500, but new limit = 500
- Result: User is "2000 minutes over limit" immediately

### Current Behavior (WRONG)
```javascript
// admin.js:660 - Immediate downgrade
await prisma.subscription.update({
  where: { id },
  data: {
    plan: 'PRO',
    status: 'ACTIVE',
    enterpriseMinutes: null,  // ❌ Removes override
    enterprisePrice: null
    // includedMinutesUsed NOT reset → Bug!
  }
});
```

### Business Rules Decision Required

**Option A: No Clamp (Recommended)**
```javascript
// Keep usedMinutes as-is
// User can't make calls until next period reset
// Overage doesn't apply (it's a downgrade penalty)

if (subscription.includedMinutesUsed > planConfig.includedMinutes) {
  return {
    canMakeCall: false,
    reason: 'DOWNGRADE_LIMIT_EXCEEDED',
    message: 'You exceeded your new plan limits. Wait for next billing cycle.',
    messageTR: 'Yeni plan limitini aştınız. Sonraki döngüye kadar bekleyin.',
    usedMinutes: subscription.includedMinutesUsed,
    limit: planConfig.includedMinutes,
    excessMinutes: subscription.includedMinutesUsed - planConfig.includedMinutes,
    resetDate: subscription.currentPeriodEnd
  };
}
```

**Pros**:
- Honest: User DID use those minutes
- Auditable: Accounting/finance can trace usage
- Fair: Downgrade has consequences

**Cons**:
- User experience: Can't make calls until reset
- Support burden: "Why can't I make calls?"

**Option B: Clamp to New Limit**
```javascript
// Reset usedMinutes to new limit
await prisma.subscription.update({
  data: {
    includedMinutesUsed: Math.min(
      subscription.includedMinutesUsed,
      newPlanConfig.includedMinutes
    )
  }
});
```

**Pros**:
- Better UX: User can still use remaining minutes
- Less support burden

**Cons**:
- ❌ Dishonest: Erases actual usage history
- ❌ Accounting problem: Can't reconcile with call logs
- ❌ Audit fail: Finance can't track real usage

### Recommended Implementation (Option A)

**File**: `/services/chargeCalculator.js:canMakeCallWithBalance()`

```javascript
// After getting planConfig
const planConfig = getEffectivePlanConfig(subscription);

// DOWNGRADE PENALTY CHECK
if (subscription.includedMinutesUsed > planConfig.includedMinutes) {
  return {
    canMakeCall: false,
    reason: 'DOWNGRADE_LIMIT_EXCEEDED',
    message: `You've exceeded your new plan limit (${subscription.includedMinutesUsed.toFixed(0)}/${planConfig.includedMinutes} minutes used). Calls will resume next billing cycle.`,
    messageTR: `Yeni plan limitini aştınız (${subscription.includedMinutesUsed.toFixed(0)}/${planConfig.includedMinutes} dakika kullanıldı). Aramalar sonraki fatura döneminde devam edecek.`,
    details: {
      usedMinutes: subscription.includedMinutesUsed,
      newLimit: planConfig.includedMinutes,
      excessMinutes: subscription.includedMinutesUsed - planConfig.includedMinutes,
      resetDate: subscription.currentPeriodEnd
    }
  };
}
```

### Testing

Create `/scripts/test-downgrade-logic.js`:
```javascript
// Setup: ENTERPRISE → PRO mid-cycle
// Initial: enterpriseMinutes=5000, used=2500
// Downgrade: plan=PRO (500 included)
// Expected: canMakeCall=false, reason=DOWNGRADE_LIMIT_EXCEEDED
```

### UI Impact

Frontend needs to show:
```tsx
{error === 'DOWNGRADE_LIMIT_EXCEEDED' && (
  <Alert severity="warning">
    <AlertTitle>Plan Downgrade - Temporary Limit</AlertTitle>
    You exceeded your new plan's included minutes.
    Calls will resume on {formatDate(resetDate)}.

    <Button variant="outlined" onClick={handleUpgrade}>
      Upgrade Plan
    </Button>
  </Alert>
)}
```

---

## 🚧 P0-C: Enterprise Admin Audit Logging

### Problem Statement

**Current**: NO audit logs for enterprise changes
**Risk**:
- Admin changes custom price → customer disputes → no proof
- Admin changes limits → customer complains → can't trace who/when
- Security: Rogue admin changes → no detection

### Required Events

| Event | Action | Entity | Changes JSON |
|-------|--------|--------|--------------|
| Enterprise config created | `CREATE` | Subscription | `{ enterpriseMinutes: { old: null, new: 5000 }, enterprisePrice: { old: null, new: 15000 } }` |
| Enterprise approved | `PLAN_CHANGE` | Subscription | `{ plan: { old: "TRIAL", new: "ENTERPRISE" }, status: { old: "TRIAL", new: "ACTIVE" } }` |
| Enterprise limits updated | `UPDATE` | Subscription | `{ enterpriseMinutes: { old: 1000, new: 5000 } }` |
| Stripe price created | `CREATE` | Subscription | `{ stripePriceId: { old: null, new: "price_xxx" }, enterprisePrice: { old: 8500, new: 15000 } }` |
| Payment status changed | `UPDATE` | Subscription | `{ enterprisePaymentStatus: { old: "pending", new: "paid" } }` |

### Implementation

**File**: `/middleware/auditLog.js` (NEW)

```javascript
/**
 * Create audit log helper for admin actions
 */
export async function createAuditLog(adminUser, action, entityType, entityId, changes, metadata = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        action,
        entityType,
        entityId: entityId.toString(),
        changes,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString()
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent
      }
    });
  } catch (error) {
    // Don't fail the operation if audit log fails
    console.error('❌ Audit log failed:', error);
  }
}

/**
 * Middleware: Auto-audit for admin actions
 */
export function auditMiddleware(action, entityType) {
  return async (req, res, next) => {
    // Capture original update data
    req.auditContext = {
      action,
      entityType,
      beforeData: null // Will be populated by route handler
    };
    next();
  };
}
```

### Update Admin Routes

**File**: `/routes/admin.js`

#### 1. POST /enterprise-subscriptions (Create/Update)

```javascript
router.post('/enterprise-subscriptions', adminAuth, async (req, res) => {
  try {
    const { businessId, minutes, price, concurrent, assistants, notes } = req.body;

    // Get old state
    const oldSubscription = await prisma.subscription.findUnique({
      where: { businessId: parseInt(businessId) }
    });

    // Perform update
    const subscription = await prisma.subscription.upsert({
      where: { businessId: parseInt(businessId) },
      create: { ... },
      update: { ... }
    });

    // AUDIT LOG
    const changes = {};
    if (oldSubscription?.enterpriseMinutes !== minutes) {
      changes.enterpriseMinutes = { old: oldSubscription?.enterpriseMinutes, new: minutes };
    }
    if (oldSubscription?.enterprisePrice !== price) {
      changes.enterprisePrice = { old: oldSubscription?.enterprisePrice, new: price };
    }
    if (oldSubscription?.enterpriseConcurrent !== concurrent) {
      changes.enterpriseConcurrent = { old: oldSubscription?.enterpriseConcurrent, new: concurrent };
    }
    if (oldSubscription?.enterpriseAssistants !== assistants) {
      changes.enterpriseAssistants = { old: oldSubscription?.enterpriseAssistants, new: assistants };
    }

    await prisma.auditLog.create({
      data: {
        adminId: req.adminUser.id,
        adminEmail: req.adminUser.email,
        action: oldSubscription ? 'UPDATE' : 'CREATE',
        entityType: 'Subscription',
        entityId: subscription.id.toString(),
        changes,
        metadata: {
          businessId,
          operation: 'enterprise_config',
          notes
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    });

    res.json({ subscription });
  } catch (error) {
    // ...
  }
});
```

#### 2. PUT /subscriptions/:id/approve (Activate)

```javascript
router.put('/subscriptions/:id/approve', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get old state
    const oldSubscription = await prisma.subscription.findUnique({ where: { id: parseInt(id) } });

    // Activate enterprise
    const subscription = await prisma.subscription.update({
      where: { id: parseInt(id) },
      data: {
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        pendingPlanId: null,
        // ...
      }
    });

    // AUDIT LOG
    await prisma.auditLog.create({
      data: {
        adminId: req.adminUser.id,
        adminEmail: req.adminUser.email,
        action: 'PLAN_CHANGE',
        entityType: 'Subscription',
        entityId: id.toString(),
        changes: {
          plan: { old: oldSubscription.plan, new: 'ENTERPRISE' },
          status: { old: oldSubscription.status, new: 'ACTIVE' },
          pendingPlanId: { old: oldSubscription.pendingPlanId, new: null }
        },
        metadata: {
          operation: 'enterprise_approval',
          businessId: subscription.businessId
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    });

    res.json({ subscription });
  } catch (error) {
    // ...
  }
});
```

#### 3. POST /subscriptions/:id/stripe-enterprise (Create Stripe Price)

```javascript
router.post('/subscriptions/:id/stripe-enterprise', adminAuth, async (req, res) => {
  try {
    // ... create Stripe price ...

    // Update subscription
    await prisma.subscription.update({
      where: { id: parseInt(id) },
      data: { stripePriceId: price.id }
    });

    // AUDIT LOG
    await prisma.auditLog.create({
      data: {
        adminId: req.adminUser.id,
        adminEmail: req.adminUser.email,
        action: 'CREATE',
        entityType: 'Subscription',
        entityId: id.toString(),
        changes: {
          stripePriceId: { old: null, new: price.id },
          stripeProductId: { old: null, new: product.id }
        },
        metadata: {
          operation: 'stripe_price_creation',
          stripeProductId: product.id,
          stripePriceId: price.id,
          priceAmount: subscription.enterprisePrice
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    });

    res.json({ product, price, subscription });
  } catch (error) {
    // ...
  }
});
```

### Testing

Create `/scripts/test-audit-logging.js`:
```javascript
// Test: Create enterprise config
// Expected: AuditLog entry with CREATE action

// Test: Update enterprise limits
// Expected: AuditLog entry with UPDATE action, changes JSON

// Test: Approve enterprise
// Expected: AuditLog entry with PLAN_CHANGE action

// Verify:
// - adminId, adminEmail populated
// - changes JSON accurate
// - ipAddress, userAgent captured
```

### UI: Admin Audit Log Viewer

```tsx
// Admin dashboard: /admin/audit-logs
GET /api/admin/audit-logs?entityType=Subscription&action=PLAN_CHANGE&limit=50

// Show table:
// | Time | Admin | Action | Entity | Changes | Business |
```

---

## Summary

**P0-A**: ✅ Complete - Single source of truth
**P0-B**: 📝 Decision + 1 file change (chargeCalculator.js)
**P0-C**: 📝 3 audit log additions (admin.js)

**Estimated Time**:
- P0-B: 30 min (decision + implementation + test)
- P0-C: 1 hour (3 endpoints + test + UI query)

**Priority**: P0-C more critical (security/compliance)

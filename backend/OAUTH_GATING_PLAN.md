# OAuth Strategy - P1 Implementation Plan

**Strategy**: "Connect freely, use with PRO+"

## Endpoint Classification

### ✅ FREE TIER - OAuth Connection (No Gating)
Allow FREE users to connect OAuth to see integration value (upsell).

**Email OAuth** (`/api/email/*`):
- `GET /gmail/auth` - Get OAuth URL (FREE ✅)
- `GET /gmail/callback` - OAuth callback (FREE ✅)
- `GET /outlook/auth` - Get OAuth URL (FREE ✅)
- `GET /outlook/callback` - OAuth callback (FREE ✅)
- `GET /status` - Connection status (FREE ✅)
- `POST /disconnect` - Disconnect (FREE ✅)

**Integration OAuth** (`/api/integrations/*`):
- `POST /google-sheets/auth` - Connect (FREE ✅)
- `GET /google-sheets/callback` - Callback (FREE ✅)
- `POST /hubspot/auth` - Connect (FREE ✅)
- `GET /hubspot/callback` - Callback (FREE ✅)
- Similar for all integrations...

### 🔒 PRO+ TIER - Usage Endpoints (Requires PRO+)

**Email Usage** (`/api/email/*`):
- `GET /threads` - List email threads (PRO+ 🔒)
- `GET /threads/:threadId` - View thread details (PRO+ 🔒)
- `POST /threads/:threadId/close` - Close thread (PRO+ 🔒)
- `PATCH /threads/:threadId` - Update thread (PRO+ 🔒)
- `GET /drafts` - List drafts (PRO+ 🔒)
- `GET /drafts/:draftId` - View draft (PRO+ 🔒)
- `PUT /drafts/:draftId` - Update draft (PRO+ 🔒)
- `POST /drafts/:draftId/approve` - Approve draft (PRO+ 🔒)
- `POST /drafts/:draftId/send` - Send email (PRO+ 🔒)
- `POST /drafts/:draftId/reject` - Reject draft (PRO+ 🔒)
- `POST /threads/:threadId/generate-draft` - AI draft generation (PRO+ 🔒)
- `POST /drafts/:draftId/regenerate` - Regenerate draft (PRO+ 🔒)
- `POST /sync` - Manual sync (PRO+ 🔒)
- `GET /sync/stream` - SSE stream (PRO+ 🔒)
- `GET /stats` - Email stats (PRO+ 🔒)
- `GET /style-profile` - Style analysis (PRO+ 🔒)
- `POST /style-profile/analyze` - Analyze style (PRO+ 🔒)
- `POST /classify` - Classify email (PRO+ 🔒)
- `POST /classify/override` - Override classification (PRO+ 🔒)
- `GET /classify/stats` - Classification stats (PRO+ 🔒)
- `GET /signature` - Get signature (PRO+ 🔒)
- `PUT /signature` - Update signature (PRO+ 🔒)
- `POST /pairs/build` - Build training pairs (PRO+ 🔒)
- `GET /pairs/stats` - Pair statistics (PRO+ 🔒)

**Integration Usage** (`/api/integrations/*`):
- Google Sheets:
  - `GET /google-sheets/spreadsheets` - List spreadsheets (PRO+ 🔒)
  - `GET /google-sheets/:id/data` - Read sheet data (PRO+ 🔒)
  - `POST /google-sheets/:id/append` - Write to sheet (PRO+ 🔒)
- Calendar:
  - `GET /calendar/events` - List events (PRO+ 🔒)
  - `POST /calendar/events` - Create event (PRO+ 🔒)
  - `GET /calendar/availability` - Check availability (PRO+ 🔒)
- HubSpot:
  - `GET /hubspot/contacts` - List contacts (PRO+ 🔒)
  - `POST /hubspot/contacts` - Create contact (PRO+ 🔒)
  - `GET /hubspot/deals` - List deals (PRO+ 🔒)

**Webhooks** (Internal - No Gating):
- `POST /webhook/gmail` - Gmail push notification (INTERNAL ✅)
- `POST /webhook/outlook` - Outlook webhook (INTERNAL ✅)

## Implementation Checklist

### Phase 1: Create Middleware ✅
- [x] Create `/middleware/planGating.js`
- [x] `requireProOrAbove()` - Block if not PRO+
- [x] `requireStarterOrAbove()` - Block if not STARTER+
- [x] `checkFeatureAccess()` - Non-blocking feature check

### Phase 2: Email Routes 🚧
- [ ] Import `requireProOrAbove` in `/routes/email.js`
- [ ] Add to ALL usage endpoints (28 endpoints)
- [ ] Test: FREE user gets 403 on usage, can connect OAuth
- [ ] Test: PRO user can use all features

### Phase 3: Integration Routes 🚧
- [ ] Import `requireProOrAbove` in `/routes/integrations.js`
- [ ] Add to ALL usage endpoints
- [ ] Keep OAuth connection endpoints free
- [ ] Test both connection and usage

### Phase 4: Token State Management 📝
Current: Tokens stored regardless of plan
Recommended: Add `integration.disabled` flag

```prisma
model EmailIntegration {
  // ... existing fields
  disabled Boolean @default(false) // Disable usage for FREE users
  disabledReason String? // "PLAN_UPGRADE_REQUIRED"
}
```

**Logic**:
1. FREE connects → `disabled=true, disabledReason="PLAN_UPGRADE_REQUIRED"`
2. Upgrade to PRO → `disabled=false, disabledReason=null`
3. Downgrade to FREE → `disabled=true`
4. Usage endpoints check: `if (disabled) return 403`

### Phase 5: Frontend UX 📝
- [ ] Show "Connected" badge on FREE (green)
- [ ] Show "PRO Required" tooltip on usage buttons
- [ ] "Upgrade to PRO" CTA when clicking disabled features
- [ ] On upgrade: Auto-enable integrations, show success toast

## Testing Matrix

| Plan | Connect OAuth | View Threads | Send Email | Use Integrations |
|------|---------------|--------------|------------|------------------|
| FREE | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 403 |
| TRIAL | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| PAYG | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 403 |
| STARTER | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 403 |
| PRO | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| ENTERPRISE | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |

## Security Considerations

### Token Storage Risk
**Problem**: FREE user connects Gmail → access_token + refresh_token stored in DB
**Risk**: Unused tokens = attack surface

**Mitigation**:
1. Encrypt tokens at rest (use `@prisma/client` encryption)
2. Add `lastUsedAt` timestamp, expire unused tokens after 90 days
3. On downgrade: Keep tokens but mark disabled (don't delete - UX)

### Rate Limiting
Add plan-based rate limits:

```javascript
// email-aggregator.js
const RATE_LIMITS = {
  PRO: { threadsPerHour: 500, syncsPerHour: 10 },
  ENTERPRISE: { threadsPerHour: 2000, syncsPerHour: 50 }
};
```

### Audit Logging
Log all usage attempts for abuse detection:

```javascript
await prisma.auditLog.create({
  data: {
    action: 'EMAIL_USAGE_BLOCKED',
    businessId,
    plan: subscription.plan,
    endpoint: req.path,
    metadata: { requiredPlan: 'PRO' }
  }
});
```

## Rollout Plan

### Week 1: Backend Implementation
- Day 1: Create middleware ✅
- Day 2: Gate email.js routes
- Day 3: Gate integrations.js routes
- Day 4: Add tests
- Day 5: Deploy to staging

### Week 2: Frontend + Testing
- Day 1-2: Update frontend UI (badges, tooltips)
- Day 3: Integration testing
- Day 4: User acceptance testing
- Day 5: Deploy to production

### Week 3: Monitor + Iterate
- Monitor conversion rate (FREE → PRO after connection)
- Track support tickets for confusion
- A/B test CTA copy ("Upgrade to Use" vs "Unlock Email Features")

## Expected Impact

### Metrics to Track
- **Connection Rate**: % of FREE users who connect OAuth
- **Upgrade Rate**: % who upgrade to PRO after connecting
- **Time to Upgrade**: Days between connection and upgrade
- **Feature Usage**: Most popular feature driving upgrades

### Success Criteria
- 30%+ of FREE users connect at least 1 integration
- 15%+ of connected FREE users upgrade to PRO within 30 days
- <5% support tickets about "why can't I use my connected email"

---

**Status**: Phase 1 complete ✅, Phase 2 in progress 🚧
**Next**: Apply `requireProOrAbove` to all 28 email usage endpoints

# Email CRUD Migration Plan
**Goal**: Migrate email draft CRUD operations from `email-ai.js` to `core/email/`

## Current State

### Draft Operations Split

| Operation | Current Location | Target Location |
|-----------|-----------------|-----------------|
| **Generation** | ✅ `core/email/handleEmailTurn.js` | Already migrated |
| **CRUD (Get/Update/Approve/Reject)** | ⚠️ `services/email-ai.js` | Need to migrate |

### Routes Using email-ai.js

```javascript
// src/routes/email.js

// Get pending drafts
GET  /api/email/drafts
  → emailAI.getPendingDrafts(businessId)

// Get single draft
GET  /api/email/drafts/:draftId
  → emailAI.getDraft(draftId)

// Update draft content
PUT  /api/email/drafts/:draftId
  → emailAI.updateDraft(draftId, content)

// Approve draft (ready to send)
POST /api/email/drafts/:draftId/approve
  → emailAI.approveDraft(draftId, userId)

// Reject draft
POST /api/email/drafts/:draftId/reject
  → emailAI.rejectDraft(draftId, userId)

// Regenerate draft with feedback
POST /api/email/drafts/:draftId/regenerate
  → emailAI.regenerateDraft(draftId, feedback)
```

## Target Architecture

### New Structure
```
src/core/email/
├── handleEmailTurn.js        ← Draft generation (DONE ✅)
├── drafts/
│   ├── index.js              ← Main exports
│   ├── draftService.js       ← CRUD operations (NEW)
│   └── draftValidator.js     ← Validation logic (NEW)
├── steps/                    ← Generation pipeline
├── policies/                 ← Email policies
└── rag/                      ← RAG system
```

## Migration Phases

### Phase 1: Preparation (Week 1)
- [x] Document current usage
- [x] Add deprecation notices
- [x] Create ARCHITECTURE_ANALYSIS.md
- [ ] Create core/email/drafts/ directory structure
- [ ] Write comprehensive tests for existing CRUD operations

### Phase 2: Implementation (Week 2-3)

#### Step 1: Create Draft Service
```javascript
// src/core/email/drafts/draftService.js

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Get draft by ID with validation
 */
export async function getDraft(draftId, businessId) {
  const draft = await prisma.emailDraft.findUnique({
    where: { id: draftId },
    include: {
      thread: true,
      message: true
    }
  });

  // Validate ownership
  if (draft && draft.businessId !== businessId) {
    throw new Error('Unauthorized');
  }

  return draft;
}

/**
 * Get all pending drafts for business
 */
export async function getPendingDrafts(businessId, options = {}) {
  const { status = 'PENDING_REVIEW', limit = 50, offset = 0 } = options;

  return await prisma.emailDraft.findMany({
    where: {
      businessId,
      status
    },
    include: {
      thread: {
        select: {
          id: true,
          subject: true,
          fromEmail: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset
  });
}

/**
 * Update draft content
 */
export async function updateDraft(draftId, businessId, content) {
  // Validate draft exists and belongs to business
  await getDraft(draftId, businessId);

  return await prisma.emailDraft.update({
    where: { id: draftId },
    data: {
      editedContent: content,
      updatedAt: new Date()
    }
  });
}

/**
 * Approve draft (mark ready to send)
 */
export async function approveDraft(draftId, businessId, userId) {
  await getDraft(draftId, businessId);

  return await prisma.emailDraft.update({
    where: { id: draftId },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewedBy: userId
    }
  });
}

/**
 * Reject draft
 */
export async function rejectDraft(draftId, businessId, userId, reason) {
  await getDraft(draftId, businessId);

  return await prisma.emailDraft.update({
    where: { id: draftId },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedBy: userId,
      metadata: {
        rejectionReason: reason
      }
    }
  });
}

/**
 * Regenerate draft with feedback
 * Note: This will call handleEmailTurn again with feedback context
 */
export async function regenerateDraft(draftId, businessId, feedback) {
  const existingDraft = await getDraft(draftId, businessId);

  // Archive old draft
  await prisma.emailDraft.update({
    where: { id: draftId },
    data: { status: 'SUPERSEDED' }
  });

  // Trigger new draft generation with feedback
  // This calls the orchestrator with additional context
  const { handleEmailTurn } = await import('../handleEmailTurn.js');

  return await handleEmailTurn({
    businessId,
    threadId: existingDraft.threadId,
    messageId: existingDraft.messageId,
    options: {
      feedback, // Pass user feedback to LLM
      previousDraft: existingDraft.generatedContent
    }
  });
}
```

#### Step 2: Create Validator
```javascript
// src/core/email/drafts/draftValidator.js

/**
 * Validate draft content before save
 */
export function validateDraftContent(content) {
  if (!content || content.trim().length === 0) {
    throw new Error('Draft content cannot be empty');
  }

  if (content.length > 50000) {
    throw new Error('Draft content too long (max 50,000 characters)');
  }

  return true;
}

/**
 * Validate draft status transition
 */
export function validateStatusTransition(currentStatus, newStatus) {
  const validTransitions = {
    'PENDING_REVIEW': ['APPROVED', 'REJECTED', 'SUPERSEDED'],
    'APPROVED': ['SENT'],
    'REJECTED': ['PENDING_REVIEW'], // Allow re-review
    'SENT': [], // Terminal state
    'SUPERSEDED': [] // Terminal state
  };

  const allowed = validTransitions[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid status transition: ${currentStatus} → ${newStatus}`);
  }

  return true;
}
```

#### Step 3: Create Index Exports
```javascript
// src/core/email/drafts/index.js

export {
  getDraft,
  getPendingDrafts,
  updateDraft,
  approveDraft,
  rejectDraft,
  regenerateDraft
} from './draftService.js';

export {
  validateDraftContent,
  validateStatusTransition
} from './draftValidator.js';
```

### Phase 3: Route Migration (Week 4)

Update `src/routes/email.js`:

```javascript
// OLD (BEFORE)
import emailAI from '../services/email-ai.js';

// NEW (AFTER)
import * as draftService from '../core/email/drafts/index.js';

// Replace all emailAI.* calls
// Example:
// OLD: const draft = await emailAI.getDraft(draftId);
// NEW: const draft = await draftService.getDraft(draftId, req.businessId);
```

### Phase 4: Testing & Validation (Week 5)

#### Test Coverage
- [ ] Unit tests for all CRUD operations
- [ ] Integration tests for routes
- [ ] Edge cases (ownership validation, status transitions)
- [ ] Performance tests (draft list pagination)

#### Validation Checklist
- [ ] All routes return same response format
- [ ] Error handling consistent
- [ ] Permissions properly enforced
- [ ] No breaking changes for frontend

### Phase 5: Deployment (Week 6)

#### Deployment Strategy
1. Deploy new core/email/drafts/ service (shadow mode)
2. Run both old and new in parallel, log comparison
3. Monitor for discrepancies
4. Gradual rollout (10% → 50% → 100%)
5. Remove email-ai.js CRUD methods

#### Feature Flag
```javascript
// Add to feature-flags.js
EMAIL_DRAFTS_USE_NEW_SERVICE: process.env.FEATURE_EMAIL_DRAFTS_NEW === 'true' || false
EMAIL_DRAFTS_ROLLOUT_PERCENT: parseInt(process.env.FEATURE_EMAIL_DRAFTS_ROLLOUT || '0', 10)
```

## Rollback Plan

If issues arise:
1. Set `EMAIL_DRAFTS_ROLLOUT_PERCENT=0`
2. All traffic reverts to email-ai.js
3. Fix issues in core/email/drafts/
4. Re-test and re-deploy

## Success Metrics

- [ ] 100% test coverage for CRUD operations
- [ ] Zero errors in production logs
- [ ] Response time < 200ms (p95)
- [ ] No customer complaints
- [ ] Clean removal of email-ai.js

## Timeline

| Week | Phase | Status |
|------|-------|--------|
| 1 | Preparation | ✅ In Progress |
| 2-3 | Implementation | Pending |
| 4 | Route Migration | Pending |
| 5 | Testing | Pending |
| 6 | Deployment | Pending |

## Notes

- Keep email-ai.js draft generation method for reference (already deprecated)
- Ensure metadata field is properly used in new service
- Consider adding audit log for draft modifications
- Add metrics for draft approval/rejection rates

# Architecture Analysis - Chat & Email Systems
**Date**: 2026-01-25
**Status**: ✅ CORRECTED ANALYSIS

## 📊 CURRENT STATE

### Chat System Architecture

#### Dual Route Configuration
```
/api/chat     → chat.js (LEGACY - Gemini direct)
/api/chat-v2  → chat-refactored.js (NEW - Uses core/orchestrator)
```

#### Core Orchestrator (src/core/orchestrator/)
**Status**: ✅ **ACTIVELY USED** by chat-v2

**Flow**:
```
chat-refactored.js
  → handleIncomingMessage.js
    → orchestrator/steps/
      01_loadContext.js
      02_prepareContext.js
      03_classify.js        ← Uses intentNormalizer ✅
      04_routerDecision.js
      05_buildLLMRequest.js
      06_toolLoop.js        ← Uses argumentNormalizer ✅
      07_guardrails.js
      08_persistAndMetrics.js
```

**Recent Improvements**:
- ✅ Intent normalization added (NEW_INTENT → CALLBACK_REQUEST)
- ✅ Argument normalization added (extractedSlots → tool args)
- ✅ Tool gating updated (CALLBACK_REQUEST support)

#### Frontend Usage
- **ChatWidget.jsx**: Uses `/api/chat-v2/widget` ✅ (PRODUCTION)
- **dashboard/chat-widget/page.jsx**: Uses `/api/chat/widget` (TEST/PREVIEW PAGE)

### Email System Architecture

#### Email Orchestrator (src/core/email/)
**Status**: ✅ **ACTIVELY USED** for draft generation

**Flow**:
```
routes/email.js
  → handleEmailTurn.js
    → steps/
      01_loadEmailContext.js
      02_fetchThread.js
      03_classifyEmail.js
      04_toolGating.js
      05_toolLoop.js
      06_generateDraft.js
      07_guardrails.js
      08_createDraft.js
      09_persistAndMetrics.js
```

#### Email Services

| Service | Purpose | Status | Used For |
|---------|---------|--------|----------|
| `emailService.js` | Resend notifications | ✅ Active | Email verification, notifications |
| `email-ai.js` | LEGACY draft service | ⚠️ Partial | **CRUD operations only** (get, update, approve, reject) |
| `email-aggregator.js` | Gmail/Outlook API | ✅ Active | Provider integration |
| `email-classifier.js` | Personal/business filter | ✅ Active | Email filtering |
| `email-style-analyzer.js` | Writing style learning | ✅ Active | Style analysis |

**Current Split**:
- **Draft Generation**: `core/email/handleEmailTurn.js` (NEW ✅)
- **Draft CRUD**: `email-ai.js` (LEGACY ⚠️)

**Routes Split**:
```javascript
// Draft generation (NEW orchestrator)
POST /api/email/threads/:threadId/generate-draft
  → handleEmailTurn()

// Draft CRUD (LEGACY service)
GET  /api/email/drafts
PUT  /api/email/drafts/:id
POST /api/email/drafts/:id/approve
POST /api/email/drafts/:id/reject
  → emailAI.getDraft(), emailAI.updateDraft(), etc.
```

## 🎯 ACTION ITEMS

### Priority 1: Chat Endpoint Canonical Version

**Current State**:
- Frontend (production) uses `/api/chat-v2` ✅
- Old preview page uses `/api/chat` ⚠️
- Both routes active in server.js

**Actions**:
1. ✅ Add feature flag `CHAT_USE_V2` (default: true)
2. ✅ Add route version metrics (track v1 vs v2 usage)
3. ✅ Rename `chat.js` → `chat-legacy.js`
4. ✅ Add deprecation notice to chat-legacy.js
5. ✅ Update server.js:
   ```javascript
   app.use('/api/chat-legacy', chatLegacyRoutes);
   app.use('/api/chat', chatRefactoredRoutes); // Make v2 canonical
   app.use('/api/chat-v2', chatRefactoredRoutes); // Alias for backward compat
   ```

### Priority 2: Orchestrator Validation

**Status**: ✅ **ORCHESTRATOR IS ACTIVELY USED**

**Validation Results**:
- ✅ Used by `chat-refactored.js` (chat-v2 endpoint)
- ✅ Used by production ChatWidget.jsx
- ✅ Recently enhanced with intent + argument normalization
- ✅ All 8 steps actively used

**No action needed** - Orchestrator is core infrastructure.

### Priority 3: Email Service Cleanup

**Current Issue**: Draft operations split between new orchestrator and legacy service

**Actions**:
1. ✅ Add deprecation banner to `email-ai.js`:
   ```javascript
   /**
    * LEGACY EMAIL AI SERVICE
    *
    * CURRENT USAGE:
    * - Draft CRUD: getDraft(), updateDraft(), approveDraft(), rejectDraft()
    *
    * NOT USED FOR:
    * - Draft Generation (migrated to core/email/handleEmailTurn.js)
    *
    * MIGRATION PLAN:
    * - Phase 1: Move CRUD operations to core/email/drafts/
    * - Phase 2: Update routes to use new CRUD service
    * - Phase 3: Deprecate this file
    *
    * @deprecated Will be removed in v2.0
    */
   ```

2. ✅ Create ownership documentation in routes/email.js
3. 📋 Create migration plan for CRUD → core/email

## 📈 METRICS TO ADD

### Chat Route Metrics
```javascript
// Track which version is used
metrics.chat.route.version = 'v1' | 'v2';
metrics.chat.route.endpoint = '/api/chat' | '/api/chat-v2' | '/api/chat-legacy';
```

### Email Draft Metrics
```javascript
// Already tracked in handleEmailTurn
metrics.email.draft.generation.orchestrator = true;
metrics.email.draft.crud.legacy = true; // When using email-ai.js
```

## 🎭 DEPRECATION TIMELINE

### Chat Legacy (chat.js)
- **Week 1**: Add deprecation notice + metrics
- **Week 2**: Monitor v1 usage (should be ~0%)
- **Week 3**: Rename to chat-legacy.js
- **Week 4**: Move to /api/chat-legacy endpoint
- **Month 2**: Remove if no usage

### Email AI Legacy (email-ai.js)
- **Month 1**: Document current usage, add deprecation notice
- **Month 2**: Implement CRUD in core/email/drafts/
- **Month 3**: Migrate routes to new CRUD service
- **Month 4**: Remove email-ai.js

## ✅ ARCHITECTURE QUALITY

| Component | Status | Score | Notes |
|-----------|--------|-------|-------|
| Core Orchestrator | ✅ Active | 9/10 | Well-structured, actively used |
| Email Orchestrator | ✅ Active | 9/10 | Excellent architecture |
| Email Services | ⚠️ Split | 6/10 | CRUD still in legacy service |
| Chat Routes | ⚠️ Dual | 7/10 | Need canonical version |
| Documentation | ⚠️ Partial | 5/10 | Needs clarity on ownership |

**Overall**: 🟢 **GOOD** - Core architecture solid, needs cleanup

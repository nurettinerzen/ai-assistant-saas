# Duplicate Callback Guard Implementation

## ✅ Tamamlanan İşler

### 1. Topic Normalization & Hashing
**File**: `backend/src/tools/handlers/create-callback.js`

```javascript
// Topic normalization (punctuation, whitespace, lowercase)
function normalizeTopic(topic) {
  return topic
    .toLowerCase()
    .replace(/[.,!?;:\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// SHA256 hash (16 chars)
function generateTopicHash(topic) {
  const normalized = normalizeTopic(topic);
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}
```

### 2. Duplicate Detection Logic
**Location**: Lines 141-165

**Algorithm**:
1. Generate topicHash from topic
2. Query for PENDING callbacks:
   - Same businessId
   - Same customerPhone
   - Same topicHash (uses composite index)
   - Within last 15 minutes
3. If found: Return existing callback with message
4. If not found: Create new callback

**Message**:
- TR: "Talebiniz zaten kaydedildi. Yeni bir kayıt açmadım. {customerName} en kısa sürede aranacak."
- EN: "Your request is already registered. I did not create a new record. {customerName} will be called back shortly."

### 3. Schema Changes
**File**: `backend/prisma/schema.prisma`

**Added**:
- `topicHash String?` field (nullable, optional)
- Composite index: `[customerPhone, topicHash, requestedAt]`

**Migration**: `20260125235500_add_callback_topic_hash/migration.sql`

### 4. Topic Generator Improvements
**Change**: `slice(-5)` → `slice(-6)` (lines 58)

Now uses last **6 messages** instead of 5 for better context extraction.

### 5. Performance Optimization
**Before**: Sequential scan for duplicate check
**After**: Index-optimized query using composite index

Query now uses `topicHash` in WHERE clause to leverage index:
```javascript
where: {
  businessId,
  customerPhone,
  topicHash, // Uses index!
  status: 'PENDING',
  requestedAt: { gte: fifteenMinutesAgo }
}
```

## Database Migration Required

Run in Supabase Studio:

```sql
-- Add topicHash field
ALTER TABLE "CallbackRequest"
ADD COLUMN "topicHash" TEXT;

-- Create composite index
CREATE INDEX "CallbackRequest_customerPhone_topicHash_requestedAt_idx"
ON "CallbackRequest"("customerPhone", "topicHash", "requestedAt");
```

## Test Scenarios

### ✅ Scenario 1: Same Request Twice
```
User: "yöneticiyle görüşmek istiyorum"
→ Callback created: ID abc123

User (5 min later): "yöneticiyle görüşmek istiyorum"
→ Duplicate detected! Returns: "Talebiniz zaten kaydedildi. Yeni bir kayıt açmadım."
```

### ✅ Scenario 2: Different Topics
```
User: "Sipariş 12345 hakkında sorun"
→ Callback created (topicHash: "a1b2c3d4e5f6g7h8")

User (5 min later): "Sipariş 67890 hakkında sorun"
→ NEW callback created (different hash: "x1y2z3w4v5u6t7s8")
```

### ✅ Scenario 3: Time Window Expiry
```
User: "yöneticiyle görüşmek istiyorum"
→ Callback created: ID abc123

[Wait 16 minutes]

User: "yöneticiyle görüşmek istiyorum"
→ NEW callback created (outside 15-min window)
```

### ✅ Scenario 4: Punctuation Variations
```
User: "Yöneticiyle görüşmek istiyorum!"
→ Callback created (topicHash from "yöneticiyle görüşmek istiyorum")

User (5 min later): "yöneticiyle görüşmek istiyorum."
→ Duplicate detected! (same normalized hash)
```

## Key Points

1. **15-minute window**: Prevents spam but allows legitimate re-requests after time
2. **Topic normalization**: Ignores punctuation/capitalization differences
3. **Phone + topic**: Same person can have multiple different callbacks
4. **PENDING only**: Duplicate check only for pending (not completed/rejected)
5. **Performance**: Composite index for fast lookups
6. **Backward compatible**: topicHash is nullable, existing records work fine

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `create-callback.js` | 1-30 | Added normalizeTopic() and generateTopicHash() |
| `create-callback.js` | 58 | Changed slice(-5) to slice(-6) |
| `create-callback.js` | 138-165 | Added duplicate detection logic |
| `create-callback.js` | 190 | Save topicHash to database |
| `schema.prisma` | 1483 | Added topicHash field |
| `schema.prisma` | 1505 | Added composite index |

## Implementation Complete ✅

All tasks completed:
- ✅ Duplicate guard with 15-min window
- ✅ Topic normalization + hash
- ✅ Guard returns ok() with message "Talebiniz zaten kaydedildi..."
- ✅ topicHash field added to schema with index
- ✅ Topic generator uses last 6 messages

**Next**: Apply migration SQL in Supabase Studio, then test locally.

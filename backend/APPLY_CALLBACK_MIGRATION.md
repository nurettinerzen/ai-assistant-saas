# Callback Topic Hash Migration

## Database Changes Required

Run this SQL in Supabase Studio SQL Editor:

```sql
-- Add topicHash field for duplicate detection
ALTER TABLE "CallbackRequest"
ADD COLUMN "topicHash" TEXT;

-- Create composite index for efficient duplicate detection
CREATE INDEX "CallbackRequest_customerPhone_topicHash_requestedAt_idx"
ON "CallbackRequest"("customerPhone", "topicHash", "requestedAt");
```

## What Changed

### 1. Schema Update
- Added `topicHash` field to `CallbackRequest` table (nullable, no migration for existing records)
- Added composite index: `[customerPhone, topicHash, requestedAt]` for fast duplicate lookups

### 2. Duplicate Detection Logic
**Before**: No duplicate protection
**After**: 15-minute window with topic normalization

**How it works**:
1. Generate topic hash (SHA256, 16 chars) from normalized topic
2. Check for PENDING callback with same:
   - businessId
   - customerPhone
   - topicHash (uses composite index)
   - requestedAt >= 15 min ago
3. If found: Return existing callback with message "Talebiniz zaten kaydedildi. Yeni bir kayıt açmadım."
4. If not found: Create new callback

**Topic Normalization**:
```javascript
// "Yöneticiyle görüşmek istiyorum!" → "yöneticiyle görüşmek istiyorum"
// "Sipariş 12345 hakkında sorun." → "sipariş 12345 hakkında sorun"
function normalizeTopic(topic) {
  return topic
    .toLowerCase()
    .replace(/[.,!?;:\-]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}
```

### 3. Topic Generation Improvements
- Changed from last 5 messages to last **6 messages** for better context
- Same priority logic:
  1. Order number (if available)
  2. Complaint indicators
  3. Callback request indicators
  4. Last user message snippet (50 chars)
  5. Fallback: "Müşteri talebi"

## Testing

After applying migration:

1. **Test duplicate detection**:
   ```
   User: "yöneticiyle görüşmek istiyorum"
   → Callback created

   User (within 15 min): "yöneticiyle görüşmek istiyorum"
   → "Talebiniz zaten kaydedildi. Yeni bir kayıt açmadım."
   ```

2. **Test different topics**:
   ```
   User: "Sipariş 12345 hakkında sorun"
   → Callback created (topic: "Sipariş 12345 - hakkında sorun")

   User (within 15 min): "Sipariş 67890 hakkında sorun"
   → NEW callback created (different order number → different hash)
   ```

3. **Test time window expiry**:
   ```
   User: "yöneticiyle görüşmek istiyorum"
   → Callback created

   [Wait 16 minutes]

   User: "yöneticiyle görüşmek istiyorum"
   → NEW callback created (outside 15-min window)
   ```

## Performance Impact

**Before**: No index on duplicate check
**After**: Composite index `[customerPhone, topicHash, requestedAt]`

Expected query time:
- **Before**: O(n) full table scan
- **After**: O(log n) index lookup with 3 exact matches

## Rollback

If needed:

```sql
-- Remove index
DROP INDEX "CallbackRequest_customerPhone_topicHash_requestedAt_idx";

-- Remove column
ALTER TABLE "CallbackRequest" DROP COLUMN "topicHash";
```

Then revert code changes in `create-callback.js`.

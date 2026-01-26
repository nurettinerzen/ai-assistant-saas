-- Check if topicHash column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'CallbackRequest' AND column_name = 'topicHash';

-- Check if index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'CallbackRequest'
AND indexname = 'CallbackRequest_customerPhone_topicHash_requestedAt_idx';

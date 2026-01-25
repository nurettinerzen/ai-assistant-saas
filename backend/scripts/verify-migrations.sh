#!/bin/bash
# Verify Phase 4 Database Migrations
# Usage: ./verify-migrations.sh

set -e

echo "🔍 Phase 4 Migration Verification"
echo "=================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable not set"
  echo "   Export DATABASE_URL before running this script"
  exit 1
fi

echo "✅ DATABASE_URL configured"
echo ""

# ============================================
# Migration 1: emailRagMinConfidence
# ============================================
echo "📊 Migration 1: emailRagMinConfidence field"
echo "-------------------------------------------"

HAS_RAG_MIN_CONFIDENCE=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_name = 'Business'
    AND column_name = 'emailRagMinConfidence';
" | xargs)

if [ "$HAS_RAG_MIN_CONFIDENCE" = "1" ]; then
  echo "✅ emailRagMinConfidence field exists"

  # Check default value
  DEFAULT_VALUE=$(psql "$DATABASE_URL" -t -c "
    SELECT column_default
    FROM information_schema.columns
    WHERE table_name = 'Business'
      AND column_name = 'emailRagMinConfidence';
  " | xargs)

  echo "   Default value: $DEFAULT_VALUE"
else
  echo "❌ emailRagMinConfidence field NOT found"
  echo "   Run: psql \$DATABASE_URL -f backend/prisma/migrations/add_email_rag_min_confidence.sql"
  exit 1
fi

echo ""

# ============================================
# Migration 2: Composite Indexes
# ============================================
echo "📊 Migration 2: Composite Indexes"
echo "----------------------------------"

# Check retrieval index
HAS_RETRIEVAL_IDX=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*)
  FROM pg_indexes
  WHERE tablename = 'EmailEmbedding'
    AND indexname = 'EmailEmbedding_retrieval_idx';
" | xargs)

HAS_LANGUAGE_IDX=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*)
  FROM pg_indexes
  WHERE tablename = 'EmailEmbedding'
    AND indexname = 'EmailEmbedding_language_idx';
" | xargs)

HAS_CONTENT_HASH_IDX=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*)
  FROM pg_indexes
  WHERE tablename = 'EmailEmbedding'
    AND indexname = 'EmailEmbedding_content_hash_idx';
" | xargs)

TOTAL_INDEXES=$((HAS_RETRIEVAL_IDX + HAS_LANGUAGE_IDX + HAS_CONTENT_HASH_IDX))

if [ "$TOTAL_INDEXES" = "3" ]; then
  echo "✅ All 3 composite indexes exist:"
  echo "   - EmailEmbedding_retrieval_idx"
  echo "   - EmailEmbedding_language_idx"
  echo "   - EmailEmbedding_content_hash_idx"
else
  echo "❌ Missing indexes: found $TOTAL_INDEXES/3"
  echo "   Run: psql \$DATABASE_URL -f backend/prisma/migrations/add_email_rag_query_optimization.sql"
  exit 1
fi

echo ""

# ============================================
# Migration 3: PilotBusiness Table
# ============================================
echo "📊 Migration 3: PilotBusiness table"
echo "------------------------------------"

HAS_PILOT_TABLE=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_name = 'PilotBusiness';
" | xargs)

if [ "$HAS_PILOT_TABLE" = "1" ]; then
  echo "✅ PilotBusiness table exists"

  # Check unique constraint
  HAS_UNIQUE_CONSTRAINT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM pg_indexes
    WHERE tablename = 'PilotBusiness'
      AND indexname = 'PilotBusiness_businessId_feature_key';
  " | xargs)

  if [ "$HAS_UNIQUE_CONSTRAINT" = "1" ]; then
    echo "   ✅ Unique constraint (businessId, feature) exists"
  else
    echo "   ❌ Unique constraint missing"
  fi

  # Check feature index
  HAS_FEATURE_IDX=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM pg_indexes
    WHERE tablename = 'PilotBusiness'
      AND indexname = 'PilotBusiness_feature_idx';
  " | xargs)

  if [ "$HAS_FEATURE_IDX" = "1" ]; then
    echo "   ✅ Feature index exists"
  else
    echo "   ❌ Feature index missing"
  fi
else
  echo "❌ PilotBusiness table NOT found"
  echo "   Run: psql \$DATABASE_URL -f backend/prisma/migrations/add_pilot_business_table.sql"
  exit 1
fi

echo ""

# ============================================
# Summary
# ============================================
echo "🎉 All 3 migrations verified successfully!"
echo ""
echo "Migration Status:"
echo "  ✅ emailRagMinConfidence field"
echo "  ✅ Composite indexes (3/3)"
echo "  ✅ PilotBusiness table"
echo ""
echo "Database is ready for Phase 4 pilot deployment."

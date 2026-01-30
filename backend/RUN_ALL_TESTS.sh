#!/bin/bash
# V1 MVP: Run All Pre-Deploy Tests
# This script runs all smoke tests before production deployment

set -e  # Exit on any error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 V1 MVP Pre-Deploy Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Configuration Check
echo "📋 Test 1: Configuration Check"
echo "────────────────────────────────────────────────────"
node --env-file=.env -e "
const checks = [
  { name: 'Redis disabled', test: process.env.REDIS_ENABLED === 'false' },
  { name: 'CRM limit set', test: !!process.env.CRM_RECORDS_LIMIT },
  { name: 'KB items limit set', test: !!process.env.KB_ITEMS_LIMIT },
  { name: 'KB storage limit set', test: !!process.env.KB_STORAGE_MB_LIMIT },
  { name: 'URL crawl limit set', test: !!process.env.KB_CRAWL_MAX_PAGES },
  { name: 'JWT secret exists', test: !!process.env.JWT_SECRET },
];

const passed = checks.filter(c => c.test).length;
console.log('Passed:', passed + '/' + checks.length);

if (passed !== checks.length) {
  console.log('❌ Configuration check failed!');
  process.exit(1);
}
console.log('✅ Configuration OK');
"
echo ""

# Test 2: JWT Secret Strength
echo "🔐 Test 2: JWT Secret Security"
echo "────────────────────────────────────────────────────"
node --env-file=.env test-jwt-secret.js
echo ""

# Test 3: KB Retrieval Logic
echo "📚 Test 3: KB Retrieval Logic"
echo "────────────────────────────────────────────────────"
node --env-file=.env test-kb-retrieval.js
echo ""

# Test 4: Syntax Checks
echo "✅ Test 4: Syntax Validation"
echo "────────────────────────────────────────────────────"
node -c src/services/kbRetrieval.js && echo "   ✅ kbRetrieval.js"
node -c src/services/globalLimits.js && echo "   ✅ globalLimits.js"
node -c src/routes/knowledge.js && echo "   ✅ knowledge.js"
node -c src/routes/customerData.js && echo "   ✅ customerData.js"
node -c src/server.js && echo "   ✅ server.js"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL PRE-DEPLOY TESTS PASSED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Manual Tests Required:"
echo "   1. Start server and test auth endpoints"
echo "   2. Test KB upload limits (50 items)"
echo "   3. Test CRM import limits (5000 records)"
echo "   4. Verify KB retrieval with real data"
echo ""
echo "🚀 Ready for deployment!"
echo ""

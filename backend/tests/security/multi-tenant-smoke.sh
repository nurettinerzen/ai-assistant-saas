#!/bin/bash

# Multi-Tenant Smoke Test
# Tests cross-tenant data access prevention

API_BASE="https://api.telyx.ai"

echo "🧪 Multi-Tenant Smoke Test"
echo "=========================="
echo ""

# Account A credentials
ACCOUNT_A_EMAIL="nurettinerzen@gmail.com"
ACCOUNT_A_PASSWORD="3477090Telyx."

# Account B credentials  
ACCOUNT_B_EMAIL="nurettin@selenly.co"
ACCOUNT_B_PASSWORD="5162840Nuri."

echo "📝 Step 1: Login to Account A..."
RESPONSE_A=$(curl -s -X POST "$API_BASE/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ACCOUNT_A_EMAIL\",\"password\":\"$ACCOUNT_A_PASSWORD\"}")

TOKEN_A=$(echo "$RESPONSE_A" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
BUSINESS_A_ID=$(echo "$RESPONSE_A" | grep -o '"businessId":[0-9]*' | cut -d':' -f2)

if [ -z "$TOKEN_A" ]; then
  echo "❌ Failed to login to Account A"
  echo "Response: $RESPONSE_A"
  exit 1
fi

echo "✅ Account A logged in"
echo "   Business ID: $BUSINESS_A_ID"
echo "   Token: ${TOKEN_A:0:20}..."
echo ""

echo "📝 Step 2: Login to Account B..."
RESPONSE_B=$(curl -s -X POST "$API_BASE/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ACCOUNT_B_EMAIL\",\"password\":\"$ACCOUNT_B_PASSWORD\"}")

TOKEN_B=$(echo "$RESPONSE_B" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
BUSINESS_B_ID=$(echo "$RESPONSE_B" | grep -o '"businessId":[0-9]*' | cut -d':' -f2)

if [ -z "$TOKEN_B" ]; then
  echo "❌ Failed to login to Account B"
  echo "Response: $RESPONSE_B"
  exit 1
fi

echo "✅ Account B logged in"
echo "   Business ID: $BUSINESS_B_ID"
echo "   Token: ${TOKEN_B:0:20}..."
echo ""

# Now run cross-tenant tests
echo "🔒 Step 3: Cross-Tenant Access Tests"
echo "====================================="
echo ""

PASS_COUNT=0
FAIL_COUNT=0

# Test 1: A trying to access B's customer data
echo "Test 1: Account A accessing Account B customer data..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_A" \
  "$API_BASE/api/customer-data?businessId=$BUSINESS_B_ID")

if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "✅ PASS - Got $HTTP_CODE (access denied)"
  ((PASS_COUNT++))
else
  echo "❌ FAIL - Got $HTTP_CODE (should be 403/401/404)"
  ((FAIL_COUNT++))
fi

# Test 2: A trying to get B's assistant
echo "Test 2: Account A accessing Account B assistant..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_A" \
  "$API_BASE/api/assistant?businessId=$BUSINESS_B_ID")

if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "✅ PASS - Got $HTTP_CODE (access denied)"
  ((PASS_COUNT++))
else
  echo "❌ FAIL - Got $HTTP_CODE (should be 403/401/404)"
  ((FAIL_COUNT++))
fi

# Test 3: A trying to access B's knowledge base
echo "Test 3: Account A accessing Account B knowledge base..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_A" \
  "$API_BASE/api/knowledge?businessId=$BUSINESS_B_ID")

if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "✅ PASS - Got $HTTP_CODE (access denied)"
  ((PASS_COUNT++))
else
  echo "❌ FAIL - Got $HTTP_CODE (should be 403/401/404)"
  ((FAIL_COUNT++))
fi

# Test 4: A trying to access B's integrations
echo "Test 4: Account A accessing Account B integrations..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_A" \
  "$API_BASE/api/integrations?businessId=$BUSINESS_B_ID")

if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "✅ PASS - Got $HTTP_CODE (access denied)"
  ((PASS_COUNT++))
else
  echo "❌ FAIL - Got $HTTP_CODE (should be 403/401/404)"
  ((FAIL_COUNT++))
fi

# Test 5: A trying to access B's chat logs
echo "Test 5: Account A accessing Account B chat logs..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_A" \
  "$API_BASE/api/chat-logs?businessId=$BUSINESS_B_ID")

if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "✅ PASS - Got $HTTP_CODE (access denied)"
  ((PASS_COUNT++))
else
  echo "❌ FAIL - Got $HTTP_CODE (should be 403/401/404)"
  ((FAIL_COUNT++))
fi

echo ""
echo "📊 Test Summary"
echo "==============="
echo "✅ PASS: $PASS_COUNT"
echo "❌ FAIL: $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo "🎉 All tests passed! Multi-tenant isolation is working."
  exit 0
else
  echo "⚠️  Some tests failed! Multi-tenant isolation needs review."
  exit 1
fi

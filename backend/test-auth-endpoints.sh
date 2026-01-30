#!/bin/bash
# V1 MVP: Auth Endpoint Security Test
# All protected endpoints should return 401/403 without auth

BASE_URL="http://localhost:3001"

echo "🔒 Testing Auth-Protected Endpoints (should all fail without token)"
echo "================================================================"

test_endpoint() {
  local method=$1
  local endpoint=$2
  local expected_status=$3

  echo -n "Testing $method $endpoint ... "

  status=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$BASE_URL$endpoint" 2>/dev/null)

  if [ "$status" = "$expected_status" ]; then
    echo "✅ PASS (got $status)"
    return 0
  else
    echo "❌ FAIL (expected $expected_status, got $status)"
    return 1
  fi
}

# Test protected endpoints
test_endpoint "GET" "/api/knowledge" "401"
test_endpoint "POST" "/api/knowledge/documents" "401"
test_endpoint "POST" "/api/knowledge/faqs" "401"
test_endpoint "POST" "/api/knowledge/urls" "401"
test_endpoint "POST" "/api/customer-data/import" "401"
test_endpoint "GET" "/api/integrations" "401"
test_endpoint "GET" "/api/subscription" "401"
test_endpoint "GET" "/api/assistants" "401"

# Test public endpoints (should NOT be protected)
echo ""
echo "🌍 Testing Public Endpoints (should work without token)"
echo "================================================================"
test_endpoint "GET" "/health" "200"

echo ""
echo "📊 Test Summary"
echo "================================================================"
echo "If any protected endpoint returned 200, route protection is BROKEN!"

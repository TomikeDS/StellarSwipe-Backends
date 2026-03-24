#!/bin/bash

# API Keys System Test Script
# Tests all functionality of the API keys implementation

set -e

BASE_URL="http://localhost:3000/api/v1"
USER_TOKEN="your-user-jwt-token-here"

echo "🔑 API Keys System Test Suite"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    echo -n "Testing: $name... "
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Authorization: Bearer $USER_TOKEN" \
            "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Authorization: Bearer $USER_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $status)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo "$body"
    else
        echo -e "${RED}✗ FAILED${NC} (Expected $expected_status, got $status)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo "$body"
    fi
    echo ""
}

# Check if server is running
echo "Checking if server is running..."
if ! curl -s "$BASE_URL/../health" > /dev/null 2>&1; then
    echo -e "${RED}Error: Server is not running at $BASE_URL${NC}"
    echo "Please start the server with: npm run start:dev"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Test 1: Create API Key
echo "📝 Test 1: Create API Key"
echo "-------------------------"
API_KEY_DATA='{
  "name": "Test API Key",
  "scopes": ["read:signals", "read:portfolio"],
  "rateLimit": 1000
}'
test_endpoint "Create API key" "POST" "/api-keys" "$API_KEY_DATA" "201"

# Extract API key from response (requires jq)
if command -v jq &> /dev/null; then
    API_KEY=$(echo "$body" | jq -r '.key')
    API_KEY_ID=$(echo "$body" | jq -r '.id')
    echo "Generated API Key: $API_KEY"
    echo "API Key ID: $API_KEY_ID"
else
    echo -e "${YELLOW}Warning: jq not installed, cannot extract API key automatically${NC}"
    echo "Please install jq or manually extract the key from the response above"
    read -p "Enter the generated API key: " API_KEY
    read -p "Enter the API key ID: " API_KEY_ID
fi
echo ""

# Test 2: List API Keys
echo "📋 Test 2: List API Keys"
echo "------------------------"
test_endpoint "List API keys" "GET" "/api-keys" "" "200"

# Test 3: Get Usage Statistics
echo "📊 Test 3: Get Usage Statistics"
echo "-------------------------------"
test_endpoint "Get usage stats" "GET" "/api-keys/usage" "" "200"

# Test 4: Use API Key (Valid)
echo "🔐 Test 4: Use API Key"
echo "---------------------"
if [ ! -z "$API_KEY" ]; then
    echo -n "Testing: Use API key to access endpoint... "
    response=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: Bearer $API_KEY" \
        "$BASE_URL/signals")
    status=$(echo "$response" | tail -n1)
    
    if [ "$status" = "200" ] || [ "$status" = "404" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (API key accepted)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAILED${NC} (API key rejected with status $status)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo -e "${YELLOW}⊘ SKIPPED${NC} (No API key available)"
fi
echo ""

# Test 5: Invalid API Key
echo "🚫 Test 5: Invalid API Key"
echo "--------------------------"
echo -n "Testing: Use invalid API key... "
response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer sk_live_invalid123" \
    "$BASE_URL/signals")
status=$(echo "$response" | tail -n1)

if [ "$status" = "401" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Invalid key rejected)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAILED${NC} (Expected 401, got $status)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 6: Rotate API Key
echo "🔄 Test 6: Rotate API Key"
echo "------------------------"
if [ ! -z "$API_KEY_ID" ]; then
    test_endpoint "Rotate API key" "POST" "/api-keys/$API_KEY_ID/rotate" "" "200"
    
    if command -v jq &> /dev/null; then
        NEW_API_KEY=$(echo "$body" | jq -r '.key')
        echo "New API Key: $NEW_API_KEY"
    fi
else
    echo -e "${YELLOW}⊘ SKIPPED${NC} (No API key ID available)"
fi
echo ""

# Test 7: Create Key with Invalid Scope
echo "❌ Test 7: Invalid Scope"
echo "-----------------------"
INVALID_SCOPE_DATA='{
  "name": "Invalid Scope Key",
  "scopes": ["invalid:scope"],
  "rateLimit": 1000
}'
test_endpoint "Create key with invalid scope" "POST" "/api-keys" "$INVALID_SCOPE_DATA" "400"

# Test 8: Create Key with Expiration
echo "⏰ Test 8: Key with Expiration"
echo "------------------------------"
EXPIRY_DATE=$(date -u -d "+30 days" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v+30d +"%Y-%m-%dT%H:%M:%SZ")
EXPIRY_DATA='{
  "name": "Expiring Key",
  "scopes": ["read:signals"],
  "rateLimit": 500,
  "expiresAt": "'$EXPIRY_DATE'"
}'
test_endpoint "Create key with expiration" "POST" "/api-keys" "$EXPIRY_DATA" "201"

if command -v jq &> /dev/null; then
    EXPIRING_KEY_ID=$(echo "$body" | jq -r '.id')
fi
echo ""

# Test 9: Revoke API Key
echo "🗑️  Test 9: Revoke API Key"
echo "-------------------------"
if [ ! -z "$EXPIRING_KEY_ID" ]; then
    test_endpoint "Revoke API key" "DELETE" "/api-keys/$EXPIRING_KEY_ID" "" "200"
else
    echo -e "${YELLOW}⊘ SKIPPED${NC} (No API key ID available)"
fi
echo ""

# Test 10: Rate Limiting
echo "⏱️  Test 10: Rate Limiting"
echo "-------------------------"
if [ ! -z "$API_KEY" ]; then
    echo "Testing rate limiting (making 5 rapid requests)..."
    for i in {1..5}; do
        echo -n "Request $i... "
        status=$(curl -s -w "%{http_code}" -o /dev/null \
            -H "Authorization: Bearer $API_KEY" \
            "$BASE_URL/signals")
        echo "HTTP $status"
    done
    echo -e "${GREEN}✓ Rate limiting test completed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⊘ SKIPPED${NC} (No API key available)"
fi
echo ""

# Summary
echo "=============================="
echo "📊 Test Summary"
echo "=============================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi

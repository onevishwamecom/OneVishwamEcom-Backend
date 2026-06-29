
#!/bin/bash
# Comprehensive API test script
API="http://localhost:5001/api"
PASS=0
FAIL=0

check() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    echo "  ✅ $label"
    PASS=$((PASS+1))
  else
    echo "  ❌ $label (expected '$expected')"
    echo "     got: $actual"
    FAIL=$((FAIL+1))
  fi
}

check_status() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✅ $label"
    PASS=$((PASS+1))
  else
    echo "  ❌ $label (expected HTTP $expected, got HTTP $actual)"
    FAIL=$((FAIL+1))
  fi
}

echo "========================================="
echo "  OneVishwam Backend API Test Suite"
echo "========================================="
echo ""

# ─── Health ─────────────────────────────────────────────────────────────────
echo "── Health Check ──"
R=$(curl -s http://localhost:5001/health)
check "Health endpoint" '"success":true' "$R"

# ─── Register ───────────────────────────────────────────────────────────────
echo ""
echo "── Auth: Register ──"
EMAIL="test_$(date +%s)@example.com"
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test User\",\"email\":\"$EMAIL\",\"phone\":\"+919876543210\",\"password\":\"password123\"}")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Register returns 201" "201" "$HTTP"
check "Register succeeds" '"success":true' "$BODY"
ACCESS_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
REFRESH_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['refreshToken'])" 2>/dev/null)
USER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['user']['id'])" 2>/dev/null)
check "Has accessToken" "eyJ" "$ACCESS_TOKEN"
check "Has refreshToken" "eyJ" "$REFRESH_TOKEN"
check "Has user id" "$USER_ID" "$USER_ID"

# Duplicate register
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test User\",\"email\":\"$EMAIL\",\"phone\":\"+919876543210\",\"password\":\"password123\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Duplicate email returns 409" "409" "$HTTP"

# Validation errors
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"","email":"bad","password":"12"}')
HTTP=$(echo "$R" | tail -1)
check_status "Validation returns 400" "400" "$HTTP"

# ─── Login ──────────────────────────────────────────────────────────────────
echo ""
echo "── Auth: Login ──"
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password123\"}")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Login returns 200" "200" "$HTTP"
check "Login succeeds" '"success":true' "$BODY"
ACCESS_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
REFRESH_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['refreshToken'])" 2>/dev/null)

# Wrong password
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"wrong\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Wrong password returns 401" "401" "$HTTP"

# ─── Refresh Token ──────────────────────────────────────────────────────────
echo ""
echo "── Auth: Refresh Token ──"
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Refresh returns 200" "200" "$HTTP"
NEW_ACCESS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
NEW_REFRESH=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['refreshToken'])" 2>/dev/null)
check "New accessToken issued" "eyJ" "$NEW_ACCESS"
check "New refreshToken issued" "eyJ" "$NEW_REFRESH"

# Rotation test: refresh again, then try the PREVIOUS refresh token
PREV_REFRESH=$NEW_REFRESH
# Refresh again
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$NEW_REFRESH\"}")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
NEW_ACCESS2=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
NEW_REFRESH2=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['refreshToken'])" 2>/dev/null)
check_status "Second refresh succeeds (200)" "200" "$HTTP"

# Now try PREV_REFRESH (should be invalid since it was rotated)
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$PREV_REFRESH\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Rotated refresh token rejected (401)" "401" "$HTTP"

ACCESS_TOKEN=$NEW_ACCESS2
REFRESH_TOKEN=$NEW_REFRESH2

# ─── Get Me ─────────────────────────────────────────────────────────────────
echo ""
echo "── Auth: Get Me ──"
R=$(curl -s -w "\n%{http_code}" $API/auth/me -H "Authorization: Bearer $ACCESS_TOKEN")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Get me returns 200" "200" "$HTTP"
check "Get me has user data" '"name"' "$BODY"

R=$(curl -s -w "\n%{http_code}" $API/auth/me)
HTTP=$(echo "$R" | tail -1)
check_status "Get me without token returns 401" "401" "$HTTP"

# ─── Update Profile ─────────────────────────────────────────────────────────
echo ""
echo "── Auth: Update Profile ──"
R=$(curl -s -w "\n%{http_code}" -X PUT $API/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"name":"Updated Name","phone":"+919876543210"}')
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Profile update returns 200" "200" "$HTTP"
UPDATED_NAME=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['user']['name'])" 2>/dev/null)
check "Name is Updated Name" "Updated Name" "$UPDATED_NAME"

# ─── Change Password ────────────────────────────────────────────────────────
echo ""
echo "── Auth: Change Password ──"
R=$(curl -s -w "\n%{http_code}" -X PUT $API/auth/password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"currentPassword":"password123","newPassword":"newpass456"}')
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Change password returns 200" "200" "$HTTP"

# Login with new password
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"newpass456\"}")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Login with new password returns 200" "200" "$HTTP"
NEW_ACCESS2=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

# Login with old password (should fail)
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password123\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Old password returns 401" "401" "$HTTP"

ACCESS_TOKEN=$NEW_ACCESS2

# Wrong current password
R=$(curl -s -w "\n%{http_code}" -X PUT $API/auth/password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"currentPassword":"wrong","newPassword":"test123"}')
HTTP=$(echo "$R" | tail -1)
check_status "Wrong current password returns 400" "400" "$HTTP"

# ─── Forgot Password ────────────────────────────────────────────────────────
echo ""
echo "── Auth: Forgot Password ──"
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Forgot password returns 200" "200" "$HTTP"
RESET_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['resetToken'])" 2>/dev/null)
check "Has resetToken" "$RESET_TOKEN" "$RESET_TOKEN"

# Unknown email
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@test.com"}')
HTTP=$(echo "$R" | tail -1)
check_status "Unknown email returns 404" "404" "$HTTP"

# ─── Reset Password ─────────────────────────────────────────────────────────
echo ""
echo "── Auth: Reset Password ──"
R=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/reset-password/$RESET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"resetpass789"}')
HTTP=$(echo "$R" | tail -1)
check_status "Reset password returns 200" "200" "$HTTP"

# Login with reset password
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"resetpass789\"}")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Login with reset password returns 200" "200" "$HTTP"
ACCESS_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

# Reuse old reset token (consumed)
R=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/reset-password/$RESET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"shouldfail"}')
HTTP=$(echo "$R" | tail -1)
check_status "Used reset token returns 400" "400" "$HTTP"

# ─── Send Enquiry (listing needed) ─────────────────────────────────────────
echo ""
echo "── Auth: Listing + Enquiry ──"
# Create a listing
R=$(curl -s -w "\n%{http_code}" -X POST $API/listings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"title\":\"Test Car\",\"description\":\"A nice car\",\"category\":\"vehicle\",\"price\":15000,\"location\":{\"city\":\"Mumbai\"}}")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Create listing returns 201" "201" "$HTTP"
LISTING_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['listing']['_id'])" 2>/dev/null)

# Get my listings
R=$(curl -s -w "\n%{http_code}" $API/listings/my -H "Authorization: Bearer $ACCESS_TOKEN")
HTTP=$(echo "$R" | tail -1)
check_status "Get my listings returns 200" "200" "$HTTP"

# Update listing
R=$(curl -s -w "\n%{http_code}" -X PUT $API/listings/$LISTING_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"title":"Updated Car"}')
HTTP=$(echo "$R" | tail -1)
check_status "Update listing returns 200" "200" "$HTTP"

# Toggle status
R=$(curl -s -w "\n%{http_code}" -X PATCH $API/listings/$LISTING_ID/status \
  -H "Authorization: Bearer $ACCESS_TOKEN")
HTTP=$(echo "$R" | tail -1)
check_status "Toggle status returns 200" "200" "$HTTP"

# ─── Save Listing ───────────────────────────────────────────────────────────
echo ""
echo "── Auth: Save Listing ──"
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"listingId\":\"$LISTING_ID\"}")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Save listing returns 200" "200" "$HTTP"
check "Save listing" '"saved":true' "$BODY"

# Toggle off
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"listingId\":\"$LISTING_ID\"}")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Unsave listing returns 200" "200" "$HTTP"
check "Unsave listing" '"saved":false' "$BODY"

# Get saved
R=$(curl -s -w "\n%{http_code}" $API/auth/saved -H "Authorization: Bearer $ACCESS_TOKEN")
HTTP=$(echo "$R" | tail -1)
check_status "Get saved returns 200" "200" "$HTTP"

# ─── Public Endpoints ───────────────────────────────────────────────────────
echo ""
echo "── Public: Listings ──"
R=$(curl -s -w "\n%{http_code}" "$API/listings")
HTTP=$(echo "$R" | tail -1)
check_status "Get all listings returns 200" "200" "$HTTP"

R=$(curl -s -w "\n%{http_code}" "$API/listings/featured")
HTTP=$(echo "$R" | tail -1)
check_status "Get featured returns 200" "200" "$HTTP"

R=$(curl -s -w "\n%{http_code}" "$API/listings/search?q=Car")
HTTP=$(echo "$R" | tail -1)
check_status "Search returns 200" "200" "$HTTP"

R=$(curl -s -w "\n%{http_code}" "$API/listings/$LISTING_ID")
HTTP=$(echo "$R" | tail -1)
check_status "Get by id returns 200" "200" "$HTTP"

R=$(curl -s -w "\n%{http_code}" "$API/listings/000000000000000000000000")
HTTP=$(echo "$R" | tail -1)
check_status "Invalid id returns 404" "404" "$HTTP"

# ─── Enquiry ────────────────────────────────────────────────────────────────
echo ""
echo "── Public: Enquiry ──"
EMAIL2="test2_$(date +%s)@example.com"
REG_RESP=$(curl -s -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"User Two\",\"email\":\"$EMAIL2\",\"phone\":\"+918765432109\",\"password\":\"password123\"}")
TOKEN2=$(echo "$REG_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
USER2_ID=$(echo "$REG_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['user']['id'])" 2>/dev/null)

R=$(curl -s -w "\n%{http_code}" -X POST $API/enquiries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN2" \
  -d "{\"listingId\":\"$LISTING_ID\",\"message\":\"Interested in this\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Send enquiry returns 201" "201" "$HTTP"

# Enquiry without auth
R=$(curl -s -w "\n%{http_code}" -X POST $API/enquiries \
  -H "Content-Type: application/json" \
  -d "{\"listingId\":\"$LISTING_ID\",\"message\":\"No auth\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Enquiry without auth returns 401" "401" "$HTTP"

# ─── Review ─────────────────────────────────────────────────────────────────
echo ""
echo "── Public: Reviews ──"
R=$(curl -s -w "\n%{http_code}" -X POST $API/reviews \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"reviewedUser\":\"$USER2_ID\",\"rating\":5,\"comment\":\"Great seller\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Submit review returns 201" "201" "$HTTP"

# Get reviews
R=$(curl -s -w "\n%{http_code}" "$API/users/$USER2_ID/reviews")
HTTP=$(echo "$R" | tail -1)
check_status "Get user reviews returns 200" "200" "$HTTP"

# ─── Loans ─────────────────────────────────────────────────────────────────
echo ""
echo "── Public: Loans ──"
R=$(curl -s -w "\n%{http_code}" "$API/loans")
HTTP=$(echo "$R" | tail -1)
check_status "Get loans returns 200" "200" "$HTTP"

# ─── Delete Listing ─────────────────────────────────────────────────────────
echo ""
echo "── Auth: Delete Listing ──"
R=$(curl -s -w "\n%{http_code}" -X DELETE $API/listings/$LISTING_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN")
HTTP=$(echo "$R" | tail -1)
check_status "Delete listing returns 200" "200" "$HTTP"

# ─── Delete Account ─────────────────────────────────────────────────────────
echo ""
echo "── Auth: Delete Account ──"
R=$(curl -s -w "\n%{http_code}" -X DELETE $API/auth/account \
  -H "Authorization: Bearer $TOKEN2")
HTTP=$(echo "$R" | tail -1)
check_status "Delete account returns 200" "200" "$HTTP"

R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL2\",\"password\":\"password123\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Deleted user cannot login (401)" "401" "$HTTP"

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "========================================="
echo "  Results: $PASS passed, $FAIL failed"
echo "========================================="
exit $FAIL

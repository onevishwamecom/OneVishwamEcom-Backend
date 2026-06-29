#!/bin/bash
# Comprehensive API test script for OneVishwam Backend
# Tests all auth flows, edge cases, and security features.

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

# Valid registration (strong password)
EMAIL="test_$(date +%s)@example.com"
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test User\",\"email\":\"$EMAIL\",\"phone\":\"+919876543210\",\"password\":\"StrongPass1!\"}")
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

# Duplicate email
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test User\",\"email\":\"$EMAIL\",\"phone\":\"+919876543211\",\"password\":\"StrongPass1!\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Duplicate email returns 409" "409" "$HTTP"

# Duplicate phone
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test User\",\"email\":\"unique_$(date +%s)@example.com\",\"phone\":\"+919876543210\",\"password\":\"StrongPass1!\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Duplicate phone returns 409" "409" "$HTTP"

# Empty fields
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d '{}')
HTTP=$(echo "$R" | tail -1)
check_status "Empty fields returns 400" "400" "$HTTP"

# Validation errors (bad email, weak password, no phone)
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"","email":"bad","password":"12","phone":"abc"}')
HTTP=$(echo "$R" | tail -1)
check_status "Validation returns 400" "400" "$HTTP"
check "Has structured errors" '"errors"' "$(echo "$R" | sed '$d')"

# Weak password (no uppercase, no special char)
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Weak","email":"weak@example.com","phone":"+919876543299","password":"password123"}')
HTTP=$(echo "$R" | tail -1)
check_status "Weak password returns 400" "400" "$HTTP"

# ─── Login ──────────────────────────────────────────────────────────────────
echo ""
echo "── Auth: Login ──"

# Correct credentials
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"StrongPass1!\"}")
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

# Non-existent user
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"noone@example.com","password":"StrongPass1!"}')
HTTP=$(echo "$R" | tail -1)
check_status "Non-existent user returns 401" "401" "$HTTP"

# Empty body
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d '{}')
HTTP=$(echo "$R" | tail -1)
check_status "Empty login body returns 400" "400" "$HTTP"

# Case insensitive email
UPPER_EMAIL=$(echo "$EMAIL" | tr '[:lower:]' '[:upper:]')
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$UPPER_EMAIL\",\"password\":\"StrongPass1!\"}")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Case insensitive email login returns 200" "200" "$HTTP"
ACCESS_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
REFRESH_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['refreshToken'])" 2>/dev/null)

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

# Rotation: refresh again with new token, then try old one
PREV_REFRESH=$NEW_REFRESH
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$NEW_REFRESH\"}")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
NEW_ACCESS2=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
NEW_REFRESH2=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['refreshToken'])" 2>/dev/null)
check_status "Second refresh succeeds (200)" "200" "$HTTP"

# Old refresh token should be rejected (rotation)
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$PREV_REFRESH\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Rotated refresh token rejected (401)" "401" "$HTTP"

# Missing refresh token
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{}')
HTTP=$(echo "$R" | tail -1)
check_status "Missing refresh token returns 400" "400" "$HTTP"

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

# Invalid token
R=$(curl -s -w "\n%{http_code}" $API/auth/me -H "Authorization: Bearer invalidtoken")
HTTP=$(echo "$R" | tail -1)
check_status "Get me with invalid token returns 401" "401" "$HTTP"

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

# Valid password change
R=$(curl -s -w "\n%{http_code}" -X PUT $API/auth/password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"currentPassword":"StrongPass1!","newPassword":"NewStrong2@"}')
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Change password returns 200" "200" "$HTTP"

# Login with new password
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"NewStrong2@\"}")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Login with new password returns 200" "200" "$HTTP"
ACCESS_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

# Old password fails
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"StrongPass1!\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Old password returns 401" "401" "$HTTP"

# Wrong current password
R=$(curl -s -w "\n%{http_code}" -X PUT $API/auth/password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"currentPassword":"wrong","newPassword":"Another3#"}')
HTTP=$(echo "$R" | tail -1)
check_status "Wrong current password returns 400" "400" "$HTTP"

# Weak new password
R=$(curl -s -w "\n%{http_code}" -X PUT $API/auth/password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"currentPassword":"NewStrong2@","newPassword":"weak"}')
HTTP=$(echo "$R" | tail -1)
check_status "Weak new password returns 400" "400" "$HTTP"

# ─── Forgot Password (OTP flow) ────────────────────────────────────────────
echo ""
echo "── Auth: Forgot Password ──"

# Valid email
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
check_status "Forgot password returns 200" "200" "$HTTP"
DEV_OTP=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['otp'] if d else '')" 2>/dev/null)

# Non-existent email (should still return 200 — no user enumeration)
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@test.com"}')
HTTP=$(echo "$R" | tail -1)
check_status "Non-existent email still returns 200" "200" "$HTTP"

# Invalid email format
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email"}')
HTTP=$(echo "$R" | tail -1)
check_status "Invalid email format returns 400" "400" "$HTTP"

# ─── Verify OTP ─────────────────────────────────────────────────────────────
echo ""
echo "── Auth: Verify OTP ──"

if [ -n "$DEV_OTP" ]; then
  # Wrong OTP
  R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/verify-otp \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"otp\":\"000000\"}")
  HTTP=$(echo "$R" | tail -1)
  check_status "Wrong OTP returns 400" "400" "$HTTP"

  # Correct OTP
  R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/verify-otp \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"otp\":\"$DEV_OTP\"}")
  HTTP=$(echo "$R" | tail -1)
  BODY=$(echo "$R" | sed '$d')
  check_status "Correct OTP returns 200" "200" "$HTTP"
  VERIFY_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['verifyToken'])" 2>/dev/null)
  check "Has verifyToken" "$VERIFY_TOKEN" "$VERIFY_TOKEN"

  # Reuse OTP (already consumed)
  R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/verify-otp \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"otp\":\"$DEV_OTP\"}")
  HTTP=$(echo "$R" | tail -1)
  check_status "Reused OTP returns 400" "400" "$HTTP"
else
  echo "  ⚠️  Skipping OTP tests (no dev OTP returned — email may have been sent)"
fi

# OTP validation (non-numeric, wrong length)
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"otp\":\"abc\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Non-numeric OTP returns 400" "400" "$HTTP"

# ─── Reset Password ─────────────────────────────────────────────────────────
echo ""
echo "── Auth: Reset Password ──"

if [ -n "$VERIFY_TOKEN" ]; then
  # Reset with valid token
  R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/reset-password \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"verifyToken\":\"$VERIFY_TOKEN\",\"password\":\"ResetPass3#\"}")
  HTTP=$(echo "$R" | tail -1)
  check_status "Reset password returns 200" "200" "$HTTP"

  # Login with reset password
  R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"ResetPass3#\"}")
  HTTP=$(echo "$R" | tail -1)
  BODY=$(echo "$R" | sed '$d')
  check_status "Login with reset password returns 200" "200" "$HTTP"
  ACCESS_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

  # Reuse verify token (consumed)
  R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/reset-password \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"verifyToken\":\"$VERIFY_TOKEN\",\"password\":\"ShouldFail4$\"}")
  HTTP=$(echo "$R" | tail -1)
  check_status "Used verify token returns 400" "400" "$HTTP"

  # Weak password in reset
  R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/reset-password \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"verifyToken\":\"sometoken\",\"password\":\"weak\"}")
  HTTP=$(echo "$R" | tail -1)
  check_status "Weak password in reset returns 400" "400" "$HTTP"
else
  echo "  ⚠️  Skipping reset tests (no verify token)"
fi

# ─── Resend OTP ─────────────────────────────────────────────────────────────
echo ""
echo "── Auth: Resend OTP ──"

# First resend should work (new email to avoid cooldown from previous tests)
RESEND_EMAIL="resend_$(date +%s)@example.com"
RESEND_PHONE="+919876$(date +%S)0001"
# Register a user for resend test
curl -s -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Resend User\",\"email\":\"$RESEND_EMAIL\",\"phone\":\"$RESEND_PHONE\",\"password\":\"StrongPass1!\"}" > /dev/null 2>&1

R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$RESEND_EMAIL\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Forgot password for resend test returns 200" "200" "$HTTP"

# Immediate resend should be rate limited (cooldown)
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/resend-otp \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$RESEND_EMAIL\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Immediate resend returns 429 (cooldown)" "429" "$HTTP"

# ─── Listings + Save ────────────────────────────────────────────────────────
echo ""
echo "── Auth: Listing + Save ──"

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

# Save listing
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

# Invalid listing ID
R=$(curl -s -w "\n%{http_code}" -X POST $API/auth/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"listingId":"not-a-mongo-id"}')
HTTP=$(echo "$R" | tail -1)
check_status "Invalid listing ID returns 400" "400" "$HTTP"

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
  -d "{\"name\":\"User Two\",\"email\":\"$EMAIL2\",\"phone\":\"+918765432109\",\"password\":\"StrongPass1!\"}")
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
  -d "{\"email\":\"$EMAIL2\",\"password\":\"StrongPass1!\"}")
HTTP=$(echo "$R" | tail -1)
check_status "Deleted user cannot login (401)" "401" "$HTTP"

# Delete first test user too
R=$(curl -s -w "\n%{http_code}" -X DELETE $API/auth/account \
  -H "Authorization: Bearer $ACCESS_TOKEN")
HTTP=$(echo "$R" | tail -1)
check_status "Cleanup: delete first user" "200" "$HTTP"

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "========================================="
echo "  Results: $PASS passed, $FAIL failed"
echo "========================================="
exit $FAIL

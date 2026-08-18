#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Lister (phone-OTP) registration flow tests for OneVishwam Backend.
# Runs against a dedicated test database so the dev DB is never polluted.
# ─────────────────────────────────────────────────────────────────────────────
set -u

API="http://localhost:5001/api/auth/lister"
MONGO_TEST="mongodb://localhost:27017/onevishwam_test_lister"
PORT=5001
PASS=0
FAIL=0
SERVER_PID=""

PASSWD='Str0ng!Pass'
COUNTER_FILE="$(mktemp /tmp/lister_cnt.XXXXXX)"
echo 100 > "$COUNTER_FILE"
# Generate a unique 10-digit Indian mobile (starts with 98).
# NOTE: uses a temp file because `$(...)` runs in a subshell, so an in-memory
# global counter would never persist between calls (causing phone collisions).
gen_phone() {
  local n; n=$(cat "$COUNTER_FILE"); n=$((n + 1)); echo "$n" > "$COUNTER_FILE"
  printf "98765%05d" "$n"
}
# Normalized form (91 + 10 digits) used by the API/listingId.
norm() { echo "91$1"; }

clean_tests() {
  if command -v mongosh >/dev/null 2>&1; then
    mongosh --quiet "$MONGO_TEST" --eval 'db.users.deleteMany({email: {$regex: "listertest"}}); db.listerotps.deleteMany({});' >/dev/null 2>&1 || true
  fi
}

check() {
  if echo "$3" | grep -q "$2"; then
    echo "  ✅ $1"; PASS=$((PASS + 1))
  else
    echo "  ❌ $1 (expected '$2')"; echo "     got: $3"; FAIL=$((FAIL + 1))
  fi
}
check_status() {
  if [ "$3" = "$2" ]; then
    echo "  ✅ $1"; PASS=$((PASS + 1))
  else
    echo "  ❌ $1 (expected HTTP $2, got HTTP $3)"; FAIL=$((FAIL + 1))
  fi
}

start_server() {
  NODE_ENV=development MONGODB_URI="$MONGO_TEST" PORT="$PORT" JWT_SECRET=test_secret \
    SMS_DEV_LOG=true LISTER_SEND_OTP_LIMIT=1000 LISTER_VERIFY_OTP_LIMIT=1000 \
    LISTER_AUTH_LIMIT=1000 OTP_RESEND_COOLDOWN_SECONDS=1 node server.js >/tmp/lister_test_server.log 2>&1 &
  SERVER_PID=$!
  for i in $(seq 1 30); do
    sleep 0.5
    if curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then return 0; fi
  done
  echo "ERROR: Server failed to start"; cat /tmp/lister_test_server.log; exit 1
}

# Node helper that, given a 10-digit phone, brute-forces the real dev OTP from
# the test DB by comparing sha256 hashes of 000000..999999 in-process (fast).
# Node stdout is block-buffered to files, so we read the (hashed) OTP from Mongo
# instead of parsing console logs.
get_otp() {
  _LOTTOTP_PHONE="$(norm "$1")" MONGO_URI="$MONGO_TEST" node -e '
const crypto=require("crypto"),mongoose=require("mongoose"),ListerOtp=require("./models/ListerOtp");
(async()=>{
  const p=process.env._LOTTOTP_PHONE||""; 
  await mongoose.connect(process.env.MONGO_URI).catch(()=>process.exit(0));
  const r=await ListerOtp.findOne({phone:p}).sort({createdAt:-1}).lean().catch(()=>null);
  await mongoose.disconnect();
  if(!r){process.exit(0);}
  const hash=r.otpHash, h=o=>crypto.createHash("sha256").update(o).digest("hex");
  for(let i=0;i<1000000;i++){const o=String(i).padStart(6,"0");if(hash===h(o)){console.log(o);break;}}
})();
'
}

# Prints seconds until the latest OTP for a phone expires.
expiry_diff() {
  _LOTTOTP_PHONE="$(norm "$1")" MONGO_URI="$MONGO_TEST" node -e '
const mongoose=require("mongoose"),ListerOtp=require("./models/ListerOtp");
(async()=>{
  const p=process.env._LOTTOTP_PHONE||"";
  await mongoose.connect(process.env.MONGO_URI).catch(()=>process.exit(0));
  const r=await ListerOtp.findOne({phone:p}).sort({createdAt:-1}).lean().catch(()=>null);
  await mongoose.disconnect();
  console.log(r? Math.round((new Date(r.expiresAt).getTime()-Date.now())/1000) : "none");
})();
'
}

trap 'kill $SERVER_PID 2>/dev/null; rm -f "$COUNTER_FILE"; clean_tests' EXIT

clean_tests
start_server

echo ""
PHONE=$(gen_phone); PHONE_NORM=$(norm "$PHONE")
echo "=== Test 1: Valid phone → send-otp normalizes to 91+phone ==="
R=$(curl -s -X POST "$API/send-otp" -H "Content-Type: application/json" -d "{\"phone\":\"+$PHONE\"}")
check "send-otp returns normalized phone" "$PHONE_NORM" "$R"

echo "=== Test 2: Invalid phone rejected ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/send-otp" -H "Content-Type: application/json" -d '{"phone":"123"}')
check_status "invalid phone -> 400" 400 "$CODE"

echo "=== Test 3: OTP is exactly 6 digits ==="
OTP=$(get_otp "$PHONE")
[ ${#OTP} -eq 6 ] && { echo "  ✅ OTP is exactly 6 digits ($OTP)"; PASS=$((PASS+1)); } || { echo "  ❌ OTP not 6 digits ($OTP)"; FAIL=$((FAIL+1)); }

echo "=== Test 4: OTP not returned in response (dev logs only) ==="
echo "$R" | grep -q '"otp"' && { echo "  ❌ OTP leaked in response"; FAIL=$((FAIL+1)); } || { echo "  ✅ OTP not in response"; PASS=$((PASS+1)); }

echo "=== Test 5: OTP expires in ~5 min ==="
DIFF=$(expiry_diff "$PHONE")
[ -n "$DIFF" ] && [ "$DIFF" != "none" ] && [ "$DIFF" -gt 240 ] && [ "$DIFF" -le 310 ] && { echo "  ✅ OTP expires in ~5 min (${DIFF}s)"; PASS=$((PASS+1)); } || { echo "  ❌ expiry unexpected (${DIFF})"; FAIL=$((FAIL+1)); }

echo "=== Test 6: Correct OTP verifies ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/verify-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PHONE\",\"otp\":\"$OTP\"}")
check_status "correct OTP -> 200" 200 "$CODE"

echo "=== Test 7: Incorrect OTP rejected ==="
PW=$(gen_phone); PW_NORM=$(norm "$PW")
curl -s -X POST "$API/send-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PW\"}" >/dev/null
OTPW=$(get_otp "$PW")
R=$(curl -s -X POST "$API/verify-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PW\",\"otp\":\"000000\"}")
echo "$R" | grep -q "incorrect" && { echo "  ✅ wrong OTP rejected"; PASS=$((PASS+1)); } || { echo "  ❌ wrong OTP not rejected: $R"; FAIL=$((FAIL+1)); }

echo "=== Test 8: OTP attempt limit (6th attempt blocked) ==="
PQ=$(gen_phone)
curl -s -X POST "$API/send-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PQ\"}" >/dev/null
# 5 wrong attempts (attempts 1..5) each reject as incorrect; the 6th is blocked.
R=$(curl -s -X POST "$API/verify-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PQ\",\"otp\":\"000000\"}")
for i in 2 3 4 5; do curl -s -X POST "$API/verify-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PQ\",\"otp\":\"000000\"}" >/dev/null; done
RESP=$(curl -s -X POST "$API/verify-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PQ\",\"otp\":\"000000\"}")
echo "$RESP" | grep -q "Too many failed attempts" && { echo "  ✅ attempt limit enforced"; PASS=$((PASS+1)); } || { echo "  ❌ attempt limit NOT enforced: $RESP"; FAIL=$((FAIL+1)); }

echo "=== Test 9: Resend cooldown (immediate -> 429) ==="
PC=$(gen_phone); curl -s -X POST "$API/send-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PC\"}" >/dev/null
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/send-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PC\"}")
check_status "resend within cooldown -> 429" 429 "$CODE"

echo "=== Test 10: Resend allowed after cooldown -> 200 ==="
sleep 2
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/send-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PC\"}")
check_status "resend after cooldown -> 200" 200 "$CODE"

echo "=== Test 11: Duplicate phone on send-otp -> 409 ==="
PJ=$(gen_phone); PJ_NORM=$(norm "$PJ")
curl -s -X POST "$API/send-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PJ\"}" >/dev/null
OTPJ=$(get_otp "$PJ")
curl -s -X POST "$API/verify-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PJ\",\"otp\":\"$OTPJ\"}" >/dev/null
curl -s -X POST "$API/register" -H "Content-Type: application/json" \
  -d "{\"name\":\"Jane J\",\"email\":\"jane.$PJ@listertest.com\",\"phone\":\"$PJ\",\"password\":\"$PASSWD\",\"confirmPassword\":\"$PASSWD\"}" >/dev/null
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/send-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PJ\"}")
check_status "duplicate phone send-otp -> 409" 409 "$CODE"

echo "=== Test 12: Duplicate email -> 409 ==="
PD=$(gen_phone)
curl -s -X POST "$API/send-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PD\"}" >/dev/null
OTPD=$(get_otp "$PD")
curl -s -X POST "$API/verify-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PD\",\"otp\":\"$OTPD\"}" >/dev/null
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/register" -H "Content-Type: application/json" \
  -d "{\"name\":\"Dup D\",\"email\":\"jane.$PJ@listertest.com\",\"phone\":\"$PD\",\"password\":\"$PASSWD\",\"confirmPassword\":\"$PASSWD\"}")
check_status "duplicate email -> 409" 409 "$CODE"

echo "=== Test 13: Valid registration creates account + tokens ==="
PN=$(gen_phone); PN_NORM=$(norm "$PN")
curl -s -X POST "$API/send-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PN\"}" >/dev/null
OTPN=$(get_otp "$PN")
curl -s -X POST "$API/verify-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$PN\",\"otp\":\"$OTPN\"}" >/dev/null
R=$(curl -s -X POST "$API/register" -H "Content-Type: application/json" \
  -d "{\"name\":\"New Lister\",\"email\":\"new.$PN@listertest.com\",\"phone\":\"$PN\",\"password\":\"$PASSWD\",\"confirmPassword\":\"$PASSWD\"}")
echo "$R" | grep -q '"accessToken"' && { echo "  ✅ valid registration creates account + tokens"; PASS=$((PASS+1)); } || { echo "  ❌ valid registration failed: $R"; FAIL=$((FAIL+1)); }

echo "=== Test 14-18: Field validation (missing name/email/phone/password + weak password) ==="
send_reg() { curl -s -o /dev/null -w "%{http_code}" -X POST "$API/register" -H "Content-Type: application/json" -d "$1"; }
check_status "missing name -> 400" 400 "$(send_reg "{\"name\":\"\",\"email\":\"m.@listertest.com\",\"phone\":\"$(gen_phone)\",\"password\":\"$PASSWD\",\"confirmPassword\":\"$PASSWD\"}")"
check_status "missing email -> 400" 400 "$(send_reg "{\"name\":\"L\",\"email\":\"\",\"phone\":\"$(gen_phone)\",\"password\":\"$PASSWD\",\"confirmPassword\":\"$PASSWD\"}")"
check_status "missing phone -> 400" 400 "$(send_reg "{\"name\":\"L\",\"email\":\"m@listertest.com\",\"phone\":\"\",\"password\":\"$PASSWD\",\"confirmPassword\":\"$PASSWD\"}")"
check_status "missing password -> 400" 400 "$(send_reg "{\"name\":\"L\",\"email\":\"m2@listertest.com\",\"phone\":\"$(gen_phone)\",\"password\":\"\",\"confirmPassword\":\"\"}")"
check_status "weak password -> 400" 400 "$(send_reg "{\"name\":\"L\",\"email\":\"m3@listertest.com\",\"phone\":\"$(gen_phone)\",\"password\":\"weak\",\"confirmPassword\":\"weak\"}")"
# password mismatch
check_status "password mismatch -> 400" 400 "$(send_reg "{\"name\":\"L\",\"email\":\"m4@listertest.com\",\"phone\":\"$(gen_phone)\",\"password\":\"$PASSWD\",\"confirmPassword\":\"nope\"}")"

echo "=== Test 19: Password is hashed (bcrypt) ==="
HASH=$(mongosh --quiet "$MONGO_TEST" --eval "db.users.findOne({email:'new.$PN@listertest.com'}).password" 2>/dev/null | tr -d '"')
[ -n "$HASH" ] && [ "$HASH" != "$PASSWD" ] && echo "$HASH" | grep -qE '^\$2[aby]\$' && { echo "  ✅ password stored as bcrypt hash"; PASS=$((PASS+1)); } || { echo "  ❌ password not hashed ($HASH)"; FAIL=$((FAIL+1)); }

echo "=== Test 20: Password never returned by API; no OTP in any response ==="
R=$(curl -s -X POST "$API/send-otp" -H "Content-Type: application/json" -d "{\"phone\":\"$(gen_phone)\"}")
echo "$R" | grep -q '"otp"' && { echo "  ❌ OTP leaked"; FAIL=$((FAIL+1)); } || { echo "  ✅ OTP not in send-otp response"; PASS=$((PASS+1)); }
echo "$R" | grep -qi "$PASSWD" && { echo "  ❌ password leaked"; FAIL=$((FAIL+1)); } || { echo "  ✅ password not in response"; PASS=$((PASS+1)); }

echo "=== Test 21: listerId == verified phone AND != MongoDB _id ==="
L=$(mongosh --quiet "$MONGO_TEST" --eval "const u=db.users.findOne({email:'new.$PN@listertest.com'}); printjson({_id:String(u._id), listerId:u.listerId, phone:u.phone, phoneVerified:u.phoneVerified, match: String(u._id)===u.listerId})" 2>/dev/null)
echo "  record: $L"
echo "$L" | grep -q "listerId: '$PN_NORM'" && echo "$L" | grep -q "match: false" && echo "$L" | grep -q "phoneVerified: true" && { echo "  ✅ listerId = verified phone, distinct from _id"; PASS=$((PASS+1)); } || { echo "  ❌ listerId check failed"; FAIL=$((FAIL+1)); }

echo "=== Test 22: Login after registration ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/login" -H "Content-Type: application/json" -d "{\"phone\":\"$PN\",\"password\":\"$PASSWD\"}")
check_status "login by phone -> 200" 200 "$CODE"

echo "=== Test 23: GET /me (authenticated) ==="
TOKEN=$(curl -s -X POST "$API/login" -H "Content-Type: application/json" -d "{\"phone\":\"$PN\",\"password\":\"$PASSWD\"}" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API/me" -H "Authorization: Bearer $TOKEN")
check_status "GET /me with token -> 200" 200 "$CODE"

echo "=== Test 24: Unauthorized without token -> 401 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API/me")
check_status "GET /me without token -> 401" 401 "$CODE"

echo "=== Test 25: Invalid/expired token -> 401 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API/me" -H "Authorization: Bearer not-a-real-token")
check_status "GET /me with bad token -> 401" 401 "$CODE"

echo "=== Test 26: Logout -> 200 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/logout" -H "Authorization: Bearer $TOKEN")
check_status "logout -> 200" 200 "$CODE"

echo "=== Test 27: Register without OTP verified -> 400 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/register" -H "Content-Type: application/json" \
  -d "{\"name\":\"Fresh F\",\"email\":\"fresh.$(gen_phone)@listertest.com\",\"phone\":\"$(gen_phone)\",\"password\":\"$PASSWD\",\"confirmPassword\":\"$PASSWD\"}")
check_status "register without OTP verified -> 400" 400 "$CODE"

echo "=== Test 28: Add listing blocked when unauthenticated (existing route) ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:$PORT/api/product/properties" -H "Content-Type: application/json" -d '{"title":"X"}')
check_status "POST /product/properties without auth -> 401" 401 "$CODE"

echo ""
echo "────────────────────────"
echo "RESULTS: $PASS passed, $FAIL failed"
echo "────────────────────────"
exit $FAIL

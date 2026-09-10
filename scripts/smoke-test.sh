#!/usr/bin/env bash
#
# Smoke test for authentication and access control.
#
# Run it against a seeded development database, never a real one — it registers
# accounts, creates a post, and sends an announcement to every user.
#
#   bun run db:push && bun run db:seed
#   bun run dev                        # in another terminal
#   ./scripts/smoke-test.sh
#
# Override the target with:  BASE_URL=https://example.com ./scripts/smoke-test.sh
#
# Exits with the number of failures, so CI can use it directly.
set -uo pipefail

B="${BASE_URL:-http://127.0.0.1:5000}"
D=$(mktemp -d); trap 'rm -rf "$D"' EXIT

# The seed gives every demo account the same password. See server/seed.ts.
DEMO_PASSWORD="${DEMO_PASSWORD:-demo1234}"
ADMIN_EMAIL="${ADMIN_EMAIL:-hashfather@example.invalid}"
PLAIN_EMAIL="${PLAIN_EMAIL:-solowatt@example.invalid}"

pass=0; fail=0
code() { curl -s -m 15 -o /dev/null -w '%{http_code}' "$@"; }
chk() {
  if [ "$2" = "$3" ]; then pass=$((pass+1)); printf '  ok   %-50s %s\n' "$1" "$3"
  else fail=$((fail+1)); printf '  FAIL %-50s got %s want %s\n' "$1" "$3" "$2"; fi
}

if ! curl -s -m 5 -o /dev/null "$B/api/health"; then
  echo "No server at $B — start one with \`bun run dev\`." >&2
  exit 2
fi

# A 1x1 PNG, so the upload path runs without shipping a fixture.
IMG="$D/pixel.png"
printf '\211PNG\r\n\032\n\000\000\000\015IHDR\000\000\000\001\000\000\000\001\010\006\000\000\000\037\025\304\211\000\000\000\012IDATx\234c\000\001\000\000\005\000\001\015\012-\264\000\000\000\000IEND\256B`\202' > "$IMG"

login() { # login <jar> <email>
  code -c "$1" -X POST -H 'Content-Type: application/json' \
    -d "{\"email\":\"$2\",\"password\":\"$DEMO_PASSWORD\"}" "$B/api/auth/login"
}

echo "=== public routes are readable signed out ==="
for p in /api/feed /api/leaderboard /api/users/1 /api/users/1/posts \
         /api/users/1/followers /api/users/1/following /api/ads; do
  chk "GET $p" 200 "$(code "$B$p")"
done

echo "=== guarded routes reject the signed out ==="
chk "GET /api/auth/me"                401 "$(code "$B/api/auth/me")"
chk "POST /api/posts"                 401 "$(code -X POST -F "image=@$IMG" "$B/api/posts")"
chk "GET /api/messages/conversations" 401 "$(code "$B/api/messages/conversations")"
chk "GET /api/notifications/1"        401 "$(code "$B/api/notifications/1")"

echo "=== a user id in the query string grants nothing ==="
chk "POST /api/posts?userId=1"          401 "$(code -X POST -F "image=@$IMG" "$B/api/posts?userId=1")"
chk "GET  /api/admin/users?adminId=1"   401 "$(code "$B/api/admin/users?adminId=1")"
chk "GET  /api/admin/reports?adminId=1" 401 "$(code "$B/api/admin/reports?adminId=1")"
chk "unmatched /api route is a JSON 404" 404 "$(code "$B/api/does-not-exist")"

echo "=== register ==="
EM="smoke$RANDOM@example.invalid"; UN="smoke$RANDOM"
R=$(curl -s -m 15 -c "$D/new.txt" -X POST -H 'Content-Type: application/json' \
     -d "{\"email\":\"$EM\",\"username\":\"$UN\",\"password\":\"$DEMO_PASSWORD\",\"displayName\":\"New Bie\"}" \
     -w '\n%{http_code}' "$B/api/auth/register")
chk "POST /api/auth/register"        201 "$(echo "$R" | tail -1)"
chk "  a display name may have spaces" '"New Bie"' "$(echo "$R" | head -1 | grep -o '"displayName":"[^"]*"' | cut -d: -f2)"
chk "  the response carries no hash"   0   "$(echo "$R" | grep -c passwordHash)"
NEW_ID=$(echo "$R" | head -1 | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
chk "the session is live afterwards"   200 "$(code -b "$D/new.txt" "$B/api/auth/me")"
chk "a post needs an image"            400 "$(code -b "$D/new.txt" -X POST -F 'minerModel=Smoke Test' "$B/api/posts")"
chk "a post with an image is created"  201 "$(code -b "$D/new.txt" -X POST -F "image=@$IMG" -F 'minerModel=Smoke Test' "$B/api/posts")"
chk "  and it reaches the public feed" 1   "$(curl -s -m 15 "$B/api/feed" | grep -c 'Smoke Test')"

echo "=== register rejects bad input ==="
chk "a short password"     400 "$(code -X POST -H 'Content-Type: application/json' -d "{\"email\":\"x$RANDOM@example.invalid\",\"username\":\"shorty$RANDOM\",\"password\":\"123\"}" "$B/api/auth/register")"
chk "a duplicate email"    409 "$(code -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$EM\",\"username\":\"other$RANDOM\",\"password\":\"$DEMO_PASSWORD\"}" "$B/api/auth/register")"
chk "a duplicate username" 409 "$(code -X POST -H 'Content-Type: application/json' -d "{\"email\":\"x$RANDOM@example.invalid\",\"username\":\"$UN\",\"password\":\"$DEMO_PASSWORD\"}" "$B/api/auth/register")"

echo "=== login ==="
chk "a wrong password"   401 "$(code -X POST -H 'Content-Type: application/json' -d "{\"email\":\"$EM\",\"password\":\"definitelywrong\"}" "$B/api/auth/login")"
chk "an unknown email"   401 "$(code -X POST -H 'Content-Type: application/json' -d "{\"email\":\"nobody@example.invalid\",\"password\":\"$DEMO_PASSWORD\"}" "$B/api/auth/login")"
chk "the seeded admin"   200 "$(login "$D/admin.txt" "$ADMIN_EMAIL")"
chk "a seeded non-admin" 200 "$(login "$D/plain.txt" "$PLAIN_EMAIL")"

echo "=== admin routes read the session, not a parameter ==="
chk "non-admin -> /api/admin/reports" 403 "$(code -b "$D/plain.txt" "$B/api/admin/reports")"
chk "admin     -> /api/admin/reports" 200 "$(code -b "$D/admin.txt" "$B/api/admin/reports")"
chk "non-admin -> /api/admin/users"   403 "$(code -b "$D/plain.txt" "$B/api/admin/users")"
chk "admin     -> /api/admin/users"   200 "$(code -b "$D/admin.txt" "$B/api/admin/users")"
chk "non-admin -> POST /api/admin/announce" 403 "$(code -b "$D/plain.txt" -X POST -H 'Content-Type: application/json' -d '{"message":"hi"}' "$B/api/admin/announce")"
chk "admin     -> POST /api/admin/announce" 200 "$(code -b "$D/admin.txt" -X POST -H 'Content-Type: application/json' -d '{"message":"Smoke test announcement."}' "$B/api/admin/announce")"
chk "an empty announcement is rejected"     400 "$(code -b "$D/admin.txt" -X POST -H 'Content-Type: application/json' -d '{"message":"  "}' "$B/api/admin/announce")"

echo "=== a signed-in user cannot reach another user's data ==="
# Signed in as user 2, reaching for user 1.
chk "GET  /api/notifications/1"              403 "$(code -b "$D/plain.txt" "$B/api/notifications/1")"
chk "GET  /api/notifications/unread-count/1" 403 "$(code -b "$D/plain.txt" "$B/api/notifications/unread-count/1")"
chk "PATCH /api/notifications/1/read-all"    403 "$(code -b "$D/plain.txt" -X PATCH "$B/api/notifications/1/read-all")"
chk "GET  /api/messages/unread-count/1"      403 "$(code -b "$D/plain.txt" "$B/api/messages/unread-count/1")"
chk "GET  /api/messages/1/3"                 403 "$(code -b "$D/plain.txt" "$B/api/messages/1/3")"
chk "DELETE /api/messages/1/3"               403 "$(code -b "$D/plain.txt" -X DELETE "$B/api/messages/1/3")"
chk "PATCH /api/messages/read/3/1"           403 "$(code -b "$D/plain.txt" -X PATCH "$B/api/messages/read/3/1")"
chk "DELETE /api/follows/1/3"                403 "$(code -b "$D/plain.txt" -X DELETE "$B/api/follows/1/3")"
chk "PATCH /api/users/1  (another profile)"  403 "$(code -b "$D/plain.txt" -X PATCH -H 'Content-Type: application/json' -d '{"bio":"not mine"}' "$B/api/users/1")"
chk "POST /api/notifications (not an admin)" 403 "$(code -b "$D/plain.txt" -X POST -H 'Content-Type: application/json' -d '{"userId":1,"type":"system","message":"spam"}' "$B/api/notifications")"

echo "=== a body cannot claim to be another user ==="
# Signed in as user 2, every one of these names user 3 in the body. The stored
# row must say 2, because the acting user comes from the session.
acted_as() { # acted_as <endpoint> <json> <field>
  curl -s -m 15 -b "$D/plain.txt" -X POST -H 'Content-Type: application/json'     -d "$2" "$B/api/$1" | grep -o "\"$3\":[0-9]*" | head -1 | cut -d: -f2
}
chk "POST /api/comments as another user" 2 "$(acted_as comments '{"userId":3,"postId":9,"content":"smoke"}' userId)"
chk "POST /api/follows  as another user" 2 "$(acted_as follows  '{"followerId":3,"followedId":6}' followerId)"
chk "POST /api/messages as another user" 2 "$(acted_as messages '{"senderId":3,"receiverId":6,"content":"smoke"}' senderId)"
chk "POST /api/reports  as another user" 2 "$(acted_as reports  '{"reporterId":3,"postId":9,"reason":"spam"}' reporterId)"
# Swipes are limited to one per post per day, so this uses the account
# registered above — a repeat run on the same database would otherwise 409.
swipe_as=$(curl -s -m 15 -b "$D/new.txt" -X POST -H 'Content-Type: application/json' \n  -d '{"userId":3,"postId":10,"direction":"right"}' "$B/api/swipes" | grep -o '"userId":[0-9]*' | head -1 | cut -d: -f2)
chk "POST /api/swipes   as another user" "$NEW_ID" "$swipe_as"

echo "=== but their own data still works ==="
chk "GET  /api/notifications/2"              200 "$(code -b "$D/plain.txt" "$B/api/notifications/2")"
chk "GET  /api/notifications/unread-count/2" 200 "$(code -b "$D/plain.txt" "$B/api/notifications/unread-count/2")"
chk "PATCH /api/notifications/2/read-all"    200 "$(code -b "$D/plain.txt" -X PATCH "$B/api/notifications/2/read-all")"
chk "GET  /api/messages/unread-count/2"      200 "$(code -b "$D/plain.txt" "$B/api/messages/unread-count/2")"
chk "GET  /api/messages/2/1 (a thread they are in)" 200 "$(code -b "$D/plain.txt" "$B/api/messages/2/1")"
chk "GET  /api/messages/1/2 (either order)"  200 "$(code -b "$D/plain.txt" "$B/api/messages/1/2")"
chk "PATCH /api/users/2 (their own profile)" 200 "$(code -b "$D/plain.txt" -X PATCH -H 'Content-Type: application/json' -d '{"bio":"Solo mining a Bitaxe on the windowsill."}' "$B/api/users/2")"

echo "=== no response carries a password hash ==="
for p in /api/users/1 /api/leaderboard /api/users/1/followers /api/users/1/following /api/auth/me /api/admin/users; do
  chk "GET $p" 0 "$(curl -s -m 15 -b "$D/admin.txt" "$B$p" | grep -c passwordHash)"
done

echo "=== logout ==="
chk "POST /api/auth/logout" 200 "$(code -b "$D/new.txt" -c "$D/new.txt" -X POST "$B/api/auth/logout")"
chk "the session is dead"   401 "$(code -b "$D/new.txt" "$B/api/auth/me")"

echo
if [ "$fail" -eq 0 ]; then
  echo "All $pass checks passed."
else
  echo "$pass passed, $fail FAILED."
fi
exit "$fail"

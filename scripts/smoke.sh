#!/usr/bin/env bash
# Starts the built server against a temporary database and exercises the public and
# admin endpoints end to end. Used in CI after `nuxt build`.
set -euo pipefail
dir=$(mktemp -d)
port=${PORT:-3990}
NUXT_ADMIN_TOKEN=smoke NUXT_DATABASE_PATH="$dir/db.sqlite" PORT=$port node .output/server/index.mjs >"$dir/log" 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null; rm -rf "$dir"' EXIT
for _ in $(seq 30); do curl -fs "localhost:$port/api/status" >/dev/null && break; sleep 0.5; done

auth=(-H 'authorization: Bearer smoke' -H 'content-type: application/json')
check() { echo "ok   $1"; }
fail() { echo "FAIL $1"; cat "$dir/log"; exit 1; }

[[ $(curl -s -o /dev/null -w '%{http_code}' -X POST "localhost:$port/api/monitors") == 401 ]] && check "admin API needs a token" || fail "admin API without token"
token=$(curl -fs "${auth[@]}" -d '{"name":"Cron","type":"heartbeat"}' "localhost:$port/api/monitors" | node -pe 'JSON.parse(require("fs").readFileSync(0)).target')
curl -fs "localhost:$port/api/ping/$token" >/dev/null && check "heartbeat ping"
curl -fs "localhost:$port/api/status" | grep -q '"status":"up"' && check "status shows the monitor up" || fail "status"
curl -fs "localhost:$port/badge/1.svg" | grep -q '<svg' && check "badge" || fail "badge"
curl -fs "localhost:$port/metrics" | grep -q 'uptime_monitor_up{monitor="Cron"' && check "metrics" || fail "metrics"
curl -fs "localhost:$port/feed.xml" | grep -q '<rss' && check "rss feed" || fail "feed"
curl -fs "localhost:$port/" | grep -q 'All systems operational' && check "status page renders" || fail "status page"
curl -fs "localhost:$port/admin" | grep -q 'Admin token' && check "admin page renders" || fail "admin page"
echo "smoke test passed"

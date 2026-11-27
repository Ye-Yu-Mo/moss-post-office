#!/usr/bin/env bash
set -uo pipefail

CONTAINER="${MOSS_PG_CONTAINER:-moss-postgres}"
DB_USER="${MOSS_PG_USER:-moss}"
DB_NAME="${MOSS_PG_DB:-moss}"
STATUS_DIR="${MOSS_STATUS_DIR:-/home/jas/games/moss-status}"
STATIC_URL="${MOSS_STATIC_URL:-http://127.0.0.1:17321/}"
HEALTH_URL="${MOSS_HEALTH_URL:-http://127.0.0.1:17321/api/healthz}"
DISK_WARN="${MOSS_DISK_WARN:-90}"
DISK_FAIL="${MOSS_DISK_FAIL:-95}"

mkdir -p "$STATUS_DIR"
LOG="$STATUS_DIR/monitor.log"
STATUS="$STATUS_DIR/status.json"
TMP="$STATUS_DIR/status.json.part"

fail=0
checks=""

record() {
  local name="$1" ok="$2" detail="$3"
  if [ "$ok" != "1" ]; then fail=1; fi
  if [ -n "$checks" ]; then checks="$checks,"; fi
  checks="$checks{\"name\":\"$name\",\"ok\":$([ "$ok" = "1" ] && echo true || echo false),\"detail\":\"$detail\"}"
}

container_running="$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo false)"
record "postgres_container" "$([ "$container_running" = "true" ] && echo 1 || echo 0)" "$container_running"

if docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" -q >/dev/null 2>&1; then
  record "postgres_ready" 1 "pg_isready ok"
else
  record "postgres_ready" 0 "pg_isready failed"
fi

query="$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -Atc "select 1" 2>/dev/null | tr -d '[:space:]')"
record "postgres_query" "$([ "$query" = "1" ] && echo 1 || echo 0)" "select 1"

for unit in moss-sync moss-post-office; do
  if systemctl --user is-active "$unit" >/dev/null 2>&1; then
    record "$unit" 1 "active"
  else
    record "$unit" 0 "inactive"
  fi
done

home_code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$STATIC_URL" 2>/dev/null || echo 000)"
record "static_home" "$([ "$home_code" = "200" ] && echo 1 || echo 0)" "$home_code"

health_code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || echo 000)"
record "api_health" "$([ "$health_code" = "200" ] && echo 1 || echo 0)" "$health_code"

disk="$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')"
if [ "$disk" -ge "$DISK_FAIL" ]; then
  record "disk" 0 "$disk%"
elif [ "$disk" -ge "$DISK_WARN" ]; then
  record "disk" 0 "$disk% (warn)"
else
  record "disk" 1 "$disk%"
fi

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '{"checked_at":"%s","ok":%s,"disk_percent":%s,"checks":[%s]}\n' \
  "$now" "$([ "$fail" = "0" ] && echo true || echo false)" "$disk" "$checks" > "$TMP"
mv "$TMP" "$STATUS"

echo "$now ok=$([ "$fail" = "0" ] && echo true || echo false) disk=${disk}% checks=[$checks]" >> "$LOG"
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 5000 ]; then
  tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

exit "$fail"

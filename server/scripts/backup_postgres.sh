#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${MOSS_PG_CONTAINER:-moss-postgres}"
DB_USER="${MOSS_PG_USER:-moss}"
DB_NAME="${MOSS_PG_DB:-moss}"
BACKUP_DIR="${MOSS_BACKUP_DIR:-/home/jas/games/moss-backups}"
KEEP="${MOSS_BACKUP_KEEP:-14}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
PART="$BACKUP_DIR/moss-$STAMP.dump.part"
FILE="$BACKUP_DIR/moss-$STAMP.dump"

cleanup() {
  rm -f "$PART"
}
trap cleanup EXIT

docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$PART"
SIZE="$(wc -c < "$PART" | tr -d ' ')"
if [ "$SIZE" -lt 1024 ]; then
  echo "backup too small: $SIZE bytes" >&2
  exit 1
fi
# The archive is readable and has a table of contents.
docker exec -i "$CONTAINER" pg_restore --list < "$PART" > /dev/null

chmod 600 "$PART"
mv "$PART" "$FILE"
echo "backup ok: $FILE ($SIZE bytes)"

# Keep the newest KEEP archives.
if [ "$(ls -1 "$BACKUP_DIR"/moss-*.dump 2>/dev/null | wc -l | tr -d ' ')" -gt "$KEEP" ]; then
  ls -1t "$BACKUP_DIR"/moss-*.dump | tail -n +"$((KEEP + 1))" | while read -r old; do
    rm -f "$old"
    echo "pruned: $old"
  done
fi

#!/usr/bin/env bash
# =============================================================================
# Nightly PostgreSQL dump for pankajpramanik.com.
#
# Install as a cron on the VPS:
#
#   sudo install -m 755 backup.sh /usr/local/bin/pankajpramanik-backup
#   crontab -e
#   # 03:17 daily — an odd minute, so it does not collide with every other
#   # cron on the box at the top of the hour
#   17 3 * * * /usr/local/bin/pankajpramanik-backup >> /var/log/pankajpramanik-backup.log 2>&1
#
# A dump that only ever lands on the machine it came from is not a backup. Set
# REMOTE to copy it somewhere else; without that this script warns every run.
# =============================================================================
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/pankajpramanik}
COMPOSE=${COMPOSE:-docker-compose.prod.yml}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/pankajpramanik}
KEEP_DAYS=${KEEP_DAYS:-14}

# Where to copy the dump off this VPS. Any rsync/scp destination:
#   REMOTE="user@backup-host:/srv/backups/pankajpramanik"
# Leave empty and the script still runs, but warns.
REMOTE=${REMOTE:-}

STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/pankajpramanik-$STAMP.sql.gz"

cd "$APP_DIR"

# Credentials come from the stack's own .env rather than being repeated here.
# shellcheck disable=SC1091
set -a; . ./.env; set +a
: "${POSTGRES_USER:?POSTGRES_USER missing from $APP_DIR/.env}"
: "${POSTGRES_DB:?POSTGRES_DB missing from $APP_DIR/.env}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "[$(date -Is)] dumping $POSTGRES_DB"

# -T: no TTY, so the stream stays clean for the pipe.
# Write to a .part file and rename only on success, so a failed or truncated
# dump is never mistaken for a good one by the retention sweep below.
docker compose -f "$COMPOSE" exec -T db \
  pg_dump -U "$POSTGRES_USER" --clean --if-exists "$POSTGRES_DB" \
  | gzip > "$OUT.part"

mv "$OUT.part" "$OUT"
chmod 600 "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "[$(date -Is)] wrote $OUT ($SIZE)"

# A dump far smaller than the last one usually means the database was empty or
# the command half-failed. Worth shouting about rather than silently rotating.
PREV=$(find "$BACKUP_DIR" -name 'pankajpramanik-*.sql.gz' ! -name "$(basename "$OUT")" \
        -type f -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1 || true)
if [ -n "$PREV" ]; then
  NEW_B=$(wc -c < "$OUT")
  OLD_B=$(wc -c < "$PREV")
  if [ "$OLD_B" -gt 0 ] && [ "$NEW_B" -lt $((OLD_B / 2)) ]; then
    echo "[$(date -Is)] WARNING: dump is less than half the size of $PREV"
  fi
fi

if [ -n "$REMOTE" ]; then
  echo "[$(date -Is)] copying to $REMOTE"
  rsync -az --partial "$OUT" "$REMOTE/"
  echo "[$(date -Is)] copied"
else
  echo "[$(date -Is)] WARNING: REMOTE is unset — this dump lives only on this VPS."
  echo "                       If the VPS is lost, so is the backup."
fi

# Retention runs last, so a failure above never deletes anything.
find "$BACKUP_DIR" -name 'pankajpramanik-*.sql.gz' -type f -mtime "+$KEEP_DAYS" -print -delete

echo "[$(date -Is)] done"

# Restore, for when you need it and are not in the mood to work it out:
#
#   gunzip -c pankajpramanik-YYYYMMDD-HHMMSS.sql.gz | \
#     docker compose -f docker-compose.prod.yml exec -T db \
#       psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
#
# The dump is taken with --clean --if-exists, so it drops and recreates objects
# as it goes. Stop the app container first so nothing writes mid-restore.

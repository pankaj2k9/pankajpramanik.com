#!/bin/sh
# Applies pending database migrations, syncs content, then starts the app.
#
# Both steps run on every container start and are idempotent:
#   * prisma migrate deploy applies only new migrations
#   * scripts/content-import.cjs imports prisma/content/snapshot.json (exported
#     from the local database with `npm run content:export`) and is a no-op
#     when that snapshot was already imported — so edits made in the
#     production admin survive restarts until a new snapshot is deployed.
# It also creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD if missing, so a
# fresh server needs no separate seed step. Set CONTENT_SYNC=false to skip.
set -e

echo "→ Running prisma migrate deploy…"
node_modules/.bin/prisma migrate deploy

if [ "${CONTENT_SYNC:-true}" != "false" ]; then
  echo "→ Syncing content snapshot…"
  node scripts/content-import.cjs
fi

echo "→ Starting app…"
exec "$@"

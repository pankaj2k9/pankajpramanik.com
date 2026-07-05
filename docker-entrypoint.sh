#!/bin/sh
# Applies pending database migrations, then starts the app.
#
# Migrations run on every container start (safe + idempotent).
# Seeding is a one-time bootstrap and is NOT run here — the slim runtime
# image has neither tsx nor the migration/extracted data. Seed once from
# a repo checkout (server or laptop) pointed at the production database:
#   DATABASE_URL="postgresql://…@SERVER:5432/pankajpramanik" npm run db:seed
set -e

echo "→ Running prisma migrate deploy…"
node_modules/.bin/prisma migrate deploy

echo "→ Starting app…"
exec "$@"

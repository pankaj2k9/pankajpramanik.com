#!/usr/bin/env bash
# =============================================================================
# One-time bootstrap for pankajpramanik.com on the shared OVHcloud VPS.
#
#   bash ovh-bootstrap.sh
#
# This VPS already serves other applications behind the shared Caddy in
# /opt/proxy. Every step below is ADDITIVE and idempotent:
#
#   * it never runs `docker compose down`, `docker system prune`, or
#     `docker network rm` — nothing belonging to another app is touched
#   * it never overwrites /opt/proxy/.env or /opt/proxy/Caddyfile; it appends,
#     and only when the entry is missing
#   * it backs up both proxy files before appending
#   * it validates the Caddy config and refuses to reload if validation fails,
#     so a bad edit here cannot take the other sites offline
#   * re-running it changes nothing that is already in place
#
# What it does NOT do: start this app's stack. That is the last step and is
# left to you, after you have filled in .env. See deploy/OVH.md.
# =============================================================================
set -euo pipefail

APP_NAME=pankajpramanik
APP_DIR=${APP_DIR:-/opt/pankajpramanik}
PROXY_DIR=${PROXY_DIR:-/opt/proxy}
PROXY_SERVICE=${PROXY_SERVICE:-caddy}
NETWORK=${NETWORK:-proxy}
DOMAIN=${DOMAIN:-pankajpramanik.com}
UPSTREAM=${UPSTREAM:-pankajpramanik-app:3000}

# Marker so a re-run can tell "already added" from "not added yet" without
# parsing Caddy's syntax.
MARKER="# >>> ${APP_NAME} (managed by deploy/ovh-bootstrap.sh) >>>"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m    ! %s\033[0m\n' "$*"; }
ok()   { printf '\033[0;32m    ✓ %s\033[0m\n' "$*"; }

# --- preflight ---------------------------------------------------------------

say "Preflight"

command -v docker >/dev/null || { echo "docker not installed"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "docker compose plugin missing"; exit 1; }
ok "docker and the compose plugin are present"

if [ ! -d "$PROXY_DIR" ]; then
  echo "No shared proxy at $PROXY_DIR."
  echo "Set PROXY_DIR=/path/to/proxy, or use the standalone Caddyfile in the repo."
  exit 1
fi
ok "shared proxy found at $PROXY_DIR"

# Show what is already running. Purely informational, but it is the check that
# catches "wrong server" before anything is written.
say "Applications already on this VPS (left untouched)"
docker ps --format '    {{.Names}}\t{{.Image}}' || true

# --- 1. shared network -------------------------------------------------------

say "Shared '$NETWORK' network"
if docker network inspect "$NETWORK" >/dev/null 2>&1; then
  ok "already exists — reusing it, not recreating"
else
  docker network create "$NETWORK"
  ok "created"
fi

# --- 2. stack directory ------------------------------------------------------

say "Stack directory $APP_DIR"
mkdir -p "$APP_DIR"
ok "ready"

if [ ! -f "$APP_DIR/docker-compose.prod.yml" ]; then
  warn "docker-compose.prod.yml is not there yet — copy it from the repo:"
  warn "  scp docker-compose.prod.yml <user>@<host>:$APP_DIR/"
fi

if [ ! -f "$APP_DIR/.env" ]; then
  warn ".env is not there yet — copy .env.production.example to $APP_DIR/.env"
  warn "  and fill it in. Generate the auth secret with: openssl rand -base64 32"
fi

# --- 3. proxy environment ----------------------------------------------------
#
# Appended, never rewritten. Another application's variables live in the same
# file and must survive this.

say "Proxy environment ($PROXY_DIR/.env)"
PROXY_ENV="$PROXY_DIR/.env"
touch "$PROXY_ENV"

add_env() {
  local key=$1 value=$2
  if grep -qE "^[[:space:]]*${key}=" "$PROXY_ENV"; then
    ok "$key already set — leaving it alone"
  else
    cp -a "$PROXY_ENV" "${PROXY_ENV}.bak.$(date +%Y%m%d%H%M%S)"
    printf '\n# %s\n%s=%s\n' "$APP_NAME" "$key" "$value" >> "$PROXY_ENV"
    ok "$key appended"
  fi
}

add_env PANKAJPRAMANIK_DOMAIN "$DOMAIN"
add_env PANKAJPRAMANIK_WWW "www.$DOMAIN"

# --- 4. proxy site block -----------------------------------------------------

say "Proxy site block ($PROXY_DIR/Caddyfile)"
CADDYFILE="$PROXY_DIR/Caddyfile"

if [ ! -f "$CADDYFILE" ]; then
  echo "No Caddyfile at $CADDYFILE — refusing to create one from scratch."
  echo "A shared proxy should already have one. Check PROXY_DIR."
  exit 1
fi

if grep -qF "$MARKER" "$CADDYFILE"; then
  ok "block already present — not appending a second copy"
else
  BACKUP="${CADDYFILE}.bak.$(date +%Y%m%d%H%M%S)"
  cp -a "$CADDYFILE" "$BACKUP"
  ok "backed up to $BACKUP"

  cat >> "$CADDYFILE" <<EOF

$MARKER
# =============================================================================
# ${DOMAIN}
#
# The app container joins the shared '${NETWORK}' network under the alias
# 'pankajpramanik-app' and publishes no host port, so Caddy is the only thing
# that can reach it. Next.js serves its own static assets, so the long-cache
# headers live here rather than in an nginx in front of the app.
# =============================================================================

{\$PANKAJPRAMANIK_DOMAIN} {
	import common

	# Hashed build output and never-changing artwork.
	@immutable path /_next/static/* /services-art/* /audio/* /fonts/*
	header @immutable Cache-Control "public, max-age=31536000, immutable"

	# Migrated WordPress media — stable, but replaceable.
	@uploads path /uploads/*
	header @uploads Cache-Control "public, max-age=604800"

	reverse_proxy ${UPSTREAM} {
		header_up X-Forwarded-Proto {scheme}
		header_up X-Forwarded-For {remote_host}
		header_up Host {host}
	}
}

# Canonical host redirect. Domain mode only.
{\$PANKAJPRAMANIK_WWW} {
	import common
	redir https://{\$PANKAJPRAMANIK_DOMAIN}{uri} permanent
}
# <<< ${APP_NAME} <<<
EOF
  ok "block appended"
fi

# --- 5. validate before reloading -------------------------------------------
#
# The important safety step. An invalid Caddyfile that gets reloaded would take
# every site on this VPS down, not just this one.

say "Validating the proxy config"
if docker compose -f "$PROXY_DIR/docker-compose.yml" exec -T "$PROXY_SERVICE" \
     caddy validate --config /etc/caddy/Caddyfile; then
  ok "config is valid"
else
  warn "VALIDATION FAILED — the proxy has NOT been reloaded, so the other"
  warn "applications on this VPS are still serving normally."
  warn "Restore the backup listed above and investigate before reloading."
  exit 1
fi

# --- 6. DNS check ------------------------------------------------------------
#
# Caddy cannot obtain a certificate for a name that does not resolve here, and
# repeated failures hit Let's Encrypt rate limits.

say "DNS check for $DOMAIN"
SERVER_IP=$(curl -fsS --max-time 5 https://api.ipify.org || echo "")
RESOLVED=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || echo "")

if [ -z "$RESOLVED" ]; then
  warn "$DOMAIN does not resolve yet. Add the A record before reloading Caddy."
elif [ -n "$SERVER_IP" ] && [ "$RESOLVED" != "$SERVER_IP" ]; then
  warn "$DOMAIN resolves to $RESOLVED but this VPS is $SERVER_IP."
  warn "Certificate issuance will fail until that matches."
else
  ok "$DOMAIN resolves to this VPS ($RESOLVED)"
fi

# --- 7. next steps -----------------------------------------------------------

say "Bootstrap complete. Nothing else on this VPS was modified."

cat <<EOF

Remaining steps, in order:

  1. Put docker-compose.prod.yml and a filled .env in $APP_DIR

  2. Log in to the registry so the first pull works
       echo "\$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin

  3. Start this stack (it starts only its own services)
       cd $APP_DIR
       docker compose -f docker-compose.prod.yml up -d

  4. Reload the shared proxy — reload, not restart, so the other sites keep
     serving through it without dropping a connection
       docker compose -f $PROXY_DIR/docker-compose.yml exec $PROXY_SERVICE \\
         caddy reload --config /etc/caddy/Caddyfile

  5. Seed the database once, from a repo checkout
       DATABASE_URL="postgresql://appuser:PASS@localhost:5432/pankajpramanik" \\
         npm run db:seed

  6. Change the seeded admin password at first login.

EOF

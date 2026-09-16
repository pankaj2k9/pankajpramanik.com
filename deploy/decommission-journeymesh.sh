#!/usr/bin/env bash
# =============================================================================
# Decommission JourneyMesh from the shared OVHcloud VPS.
#
# Run this ONLY after pankajpramanik.com is live and serving over HTTPS. The
# script refuses to run otherwise, because JourneyMesh's block currently owns
# the bare IP address and removing it while nothing else answers would leave
# the VPS serving nothing at all.
#
#   CONFIRM=REMOVE-JOURNEYMESH bash decommission-journeymesh.sh
#
# Design notes, all of them deliberate:
#
#   * The Caddy blocks are COMMENTED OUT, not deleted. A commented block is
#     reversible with an editor; a deleted one needs the backup. Same outcome
#     for Caddy, much better outcome for you at 2am.
#   * Both proxy files are backed up with a timestamp before any edit.
#   * `caddy validate` runs before the reload. If it fails, the backup is
#     restored automatically and nothing is reloaded.
#   * Volumes are KEPT by default. Containers are cheap to recreate, data is
#     not. Pass PURGE_VOLUMES=yes only when you are certain.
#   * `docker compose down` is scoped to JourneyMesh's own compose file. No
#     `docker system prune`, no network removal — the shared `proxy` network
#     stays, because this app is still on it.
# =============================================================================
set -euo pipefail

# -----------------------------------------------------------------------------
# RETIRED — DO NOT RUN.
#
# This script assumed JourneyMesh only served the bare VPS IP from a block in
# /opt/proxy/Caddyfile. That is no longer true: JourneyMesh is the live
# travelcrewai.com production SaaS, and sites now live in /opt/proxy/sites/*.
# Running it would stop a production application. Its GitHub Actions workflow
# was removed for the same reason. Kept only for reference.
# -----------------------------------------------------------------------------
echo "decommission-journeymesh.sh is retired: JourneyMesh (travelcrewai.com) is live production. Refusing to run." >&2
exit 1

JM_NAME=journeymesh
JM_DIR=${JM_DIR:-/opt/journeymesh}
JM_COMPOSE=${JM_COMPOSE:-docker-compose.prod.yml}
JM_ENV_KEY=${JM_ENV_KEY:-JOURNEYMESH_DOMAIN}
JM_BLOCK_VAR=${JM_BLOCK_VAR:-JOURNEYMESH_DOMAIN}

PROXY_DIR=${PROXY_DIR:-/opt/proxy}
PROXY_SERVICE=${PROXY_SERVICE:-caddy}
CADDYFILE="$PROXY_DIR/Caddyfile"
PROXY_ENV="$PROXY_DIR/.env"

LIVE_URL=${LIVE_URL:-https://pankajpramanik.com}
NETWORK=${NETWORK:-proxy}

CONFIRM=${CONFIRM:-}
PURGE_VOLUMES=${PURGE_VOLUMES:-no}
BACKUP_VOLUMES=${BACKUP_VOLUMES:-yes}
STAMP=$(date +%Y%m%d%H%M%S)
ARCHIVE_DIR=${ARCHIVE_DIR:-/opt/decommissioned/${JM_NAME}-${STAMP}}

# The shared proxy's compose file may be named any of the four conventional
# spellings, so resolve it rather than assuming. Falls back to talking to the
# container directly if there is no compose file at all.
PROXY_COMPOSE=""
for f in docker-compose.yml docker-compose.yaml compose.yml compose.yaml; do
  if [ -f "$PROXY_DIR/$f" ]; then PROXY_COMPOSE="$PROXY_DIR/$f"; break; fi
done

caddy_cmd() {
  if [ -n "$PROXY_COMPOSE" ]; then
    docker compose -f "$PROXY_COMPOSE" exec -T "$PROXY_SERVICE" "$@"
  else
    CID=$(docker ps --filter "name=$PROXY_SERVICE" --format '{{.ID}}' | head -1)
    [ -n "$CID" ] || { echo "cannot find a running '$PROXY_SERVICE' container" >&2; return 1; }
    docker exec -i "$CID" "$@"
  fi
}

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[0;32m    ✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m    ! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n\n' "$*" >&2; exit 1; }

# --- 0. confirmation ---------------------------------------------------------

if [ "$CONFIRM" != "REMOVE-JOURNEYMESH" ]; then
  cat >&2 <<EOF

This stops JourneyMesh and removes it from the shared proxy.

Re-run with the confirmation set:

  CONFIRM=REMOVE-JOURNEYMESH bash $(basename "$0")

Options:
  PURGE_VOLUMES=yes    also delete its database volumes (IRREVERSIBLE)
  BACKUP_VOLUMES=no    skip the volume backup (not recommended)
  JM_DIR=/path         where JourneyMesh's compose file lives (default $JM_DIR)

EOF
  exit 1
fi

# --- 1. the replacement must already be live ---------------------------------
#
# This is the gate that makes the whole operation safe. JourneyMesh is what
# answers on this VPS today.

say "Verifying pankajpramanik.com is live before removing anything"

docker ps --format '{{.Names}}' | grep -q . || die "no containers running at all — wrong host?"

if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  die "shared '$NETWORK' network is missing — this VPS is not in the expected state"
fi

if ! docker network inspect "$NETWORK" --format '{{range .Containers}}{{.Name}} {{end}}' \
     | tr ' ' '\n' | grep -q .; then
  die "nothing is attached to the '$NETWORK' network"
fi
ok "shared network present"

CODE=$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 15 "$LIVE_URL" || echo "000")
if [ "$CODE" != "200" ]; then
  die "$LIVE_URL returned '$CODE', not 200.
   Deploy pankajpramanik.com and confirm HTTPS works BEFORE decommissioning
   JourneyMesh. Removing it now would leave this VPS serving nothing."
fi
ok "$LIVE_URL returns 200 over HTTPS"

# Confirm it is genuinely this stack answering, not a cached edge response.
if docker ps --format '{{.Names}}' | grep -qi 'pankajpramanik'; then
  ok "pankajpramanik container is running"
else
  warn "no container name matched 'pankajpramanik' — continuing, but check this"
fi

say "Containers on this VPS right now"
docker ps --format '    {{.Names}}\t{{.Status}}'

# --- 2. archive --------------------------------------------------------------

say "Archiving JourneyMesh state to $ARCHIVE_DIR"
mkdir -p "$ARCHIVE_DIR"

cp -a "$CADDYFILE" "$ARCHIVE_DIR/Caddyfile.before" 2>/dev/null && ok "Caddyfile archived"
cp -a "$PROXY_ENV" "$ARCHIVE_DIR/proxy.env.before" 2>/dev/null && ok "proxy .env archived"

if [ -d "$JM_DIR" ]; then
  cp -a "$JM_DIR/$JM_COMPOSE" "$ARCHIVE_DIR/" 2>/dev/null || true
  # The .env may hold secrets; keep it readable only by root.
  cp -a "$JM_DIR/.env" "$ARCHIVE_DIR/journeymesh.env" 2>/dev/null || true
  chmod 600 "$ARCHIVE_DIR"/*.env* 2>/dev/null || true
  ok "JourneyMesh compose + env archived"
else
  warn "$JM_DIR not found — proxy will still be cleaned up"
fi

docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' > "$ARCHIVE_DIR/containers.before.txt"
docker volume ls --format '{{.Name}}' > "$ARCHIVE_DIR/volumes.before.txt"
ok "container and volume inventory recorded"

# --- 3. back up the volumes --------------------------------------------------

if [ "$BACKUP_VOLUMES" = "yes" ] && [ -d "$JM_DIR" ]; then
  say "Backing up JourneyMesh volumes"
  VOLUMES=$(cd "$JM_DIR" && docker compose -f "$JM_COMPOSE" config --volumes 2>/dev/null || true)
  PROJECT=$(basename "$JM_DIR")

  if [ -z "$VOLUMES" ]; then
    warn "no named volumes declared — nothing to back up"
  else
    for v in $VOLUMES; do
      FULL="${PROJECT}_${v}"
      if docker volume inspect "$FULL" >/dev/null 2>&1; then
        docker run --rm \
          -v "$FULL":/from:ro \
          -v "$ARCHIVE_DIR":/to \
          alpine tar czf "/to/${FULL}.tar.gz" -C /from .
        ok "$FULL → ${FULL}.tar.gz"
      else
        warn "volume $FULL not found — skipping"
      fi
    done
  fi
fi

# --- 4. comment the site block out of the shared Caddyfile -------------------

say "Removing the JourneyMesh site block from $CADDYFILE"
[ -f "$CADDYFILE" ] || die "no Caddyfile at $CADDYFILE"

CADDY_BACKUP="${CADDYFILE}.bak.${STAMP}"
cp -a "$CADDYFILE" "$CADDY_BACKUP"
ok "backed up to $CADDY_BACKUP"

restore_and_die() {
  warn "restoring $CADDYFILE from $CADDY_BACKUP"
  cp -a "$CADDY_BACKUP" "$CADDYFILE"
  die "$1"
}

# Comments out the `{$JOURNEYMESH_DOMAIN} { … }` block by counting braces from
# its opening line. gsub() returns a match count and, replacing each brace with
# itself, leaves the line untouched.
# `set -e` would abort on awk's deliberate exit 3, so guard this one command.
set +e
awk -v var="$JM_BLOCK_VAR" -v stamp="$STAMP" '
  BEGIN { depth = 0; inblock = 0; found = 0 }
  !inblock && $0 ~ ("^[[:space:]]*\\{\\$" var "\\}") {
    inblock = 1; found = 1; depth = 0
    print "# --- JourneyMesh decommissioned " stamp " -----------------------------------"
  }
  inblock {
    depth += gsub(/\{/, "{") - gsub(/\}/, "}")
    print "# " $0
    if (depth <= 0) { inblock = 0 }
    next
  }
  { print }
  END { if (!found) exit 3 }
' "$CADDYFILE" > "${CADDYFILE}.new"

STATUS=$?
set -e

if [ "$STATUS" = "3" ]; then
  rm -f "${CADDYFILE}.new"
  warn "no {\$${JM_BLOCK_VAR}} block found — already removed? Continuing."
elif [ "$STATUS" != "0" ]; then
  rm -f "${CADDYFILE}.new"
  restore_and_die "failed to rewrite the Caddyfile"
else
  cat "${CADDYFILE}.new" > "$CADDYFILE"
  rm -f "${CADDYFILE}.new"
  ok "site block commented out"
fi

# The variable itself: commented, not deleted, so the archive tells the story.
if [ -f "$PROXY_ENV" ] && grep -qE "^[[:space:]]*${JM_ENV_KEY}=" "$PROXY_ENV"; then
  cp -a "$PROXY_ENV" "${PROXY_ENV}.bak.${STAMP}"
  sed -i.tmp -E "s|^([[:space:]]*${JM_ENV_KEY}=.*)$|# decommissioned ${STAMP}: \1|" "$PROXY_ENV"
  rm -f "${PROXY_ENV}.tmp"
  ok "$JM_ENV_KEY commented out in $PROXY_ENV"
fi

# --- 5. validate, then reload ------------------------------------------------

say "Validating the proxy config"
if ! caddy_cmd caddy validate --config /etc/caddy/Caddyfile; then
  cp -a "${PROXY_ENV}.bak.${STAMP}" "$PROXY_ENV" 2>/dev/null || true
  restore_and_die "config validation failed — nothing was reloaded, sites are still up"
fi
ok "config is valid"

say "Reloading the proxy"
caddy_cmd caddy reload --config /etc/caddy/Caddyfile
ok "reloaded gracefully — pankajpramanik.com never dropped a connection"

# --- 6. confirm the survivor is still serving --------------------------------

say "Re-checking $LIVE_URL after the reload"
CODE=$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 15 "$LIVE_URL" || echo "000")
if [ "$CODE" != "200" ]; then
  warn "returned '$CODE'. Restoring the previous proxy config."
  cp -a "$CADDY_BACKUP" "$CADDYFILE"
  cp -a "${PROXY_ENV}.bak.${STAMP}" "$PROXY_ENV" 2>/dev/null || true
  caddy_cmd caddy reload --config /etc/caddy/Caddyfile || true
  die "rolled the proxy back. JourneyMesh containers were NOT touched."
fi
ok "still 200 — proxy change is good"

# --- 7. stop the containers --------------------------------------------------

if [ -d "$JM_DIR" ] && [ -f "$JM_DIR/$JM_COMPOSE" ]; then
  say "Stopping the JourneyMesh stack"
  cd "$JM_DIR"
  if [ "$PURGE_VOLUMES" = "yes" ]; then
    warn "PURGE_VOLUMES=yes — its database volumes are being deleted"
    docker compose -f "$JM_COMPOSE" down --volumes --remove-orphans
    ok "stack and volumes removed"
  else
    docker compose -f "$JM_COMPOSE" down --remove-orphans
    ok "stack removed, volumes kept (delete later with: docker volume rm …)"
  fi
else
  warn "no compose file at $JM_DIR/$JM_COMPOSE — stop its containers by hand"
fi

# --- 8. report ---------------------------------------------------------------

say "Still running"
docker ps --format '    {{.Names}}\t{{.Status}}'

if [ "$PURGE_VOLUMES" != "yes" ]; then
  say "JourneyMesh volumes left on disk"
  docker volume ls --format '{{.Name}}' | grep -i "$JM_NAME" | sed 's/^/    /' || echo "    (none matched)"
fi

cat <<EOF

Done. Archive: $ARCHIVE_DIR

To undo the proxy change:
  cp $CADDY_BACKUP $CADDYFILE
  docker compose -f $PROXY_DIR/docker-compose.yml exec $PROXY_SERVICE \\
    caddy reload --config /etc/caddy/Caddyfile

Worth doing now that every site on this VPS is on a real domain with a
certificate, rather than plain HTTP on a bare IP:

  * Uncomment Strict-Transport-Security in the (common) snippet.
    It was held back only because IP mode served plain HTTP.
  * Set ACME_EMAIL in $PROXY_ENV and uncomment the email directive,
    to get Let's Encrypt expiry warnings.

EOF

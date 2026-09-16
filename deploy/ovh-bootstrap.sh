#!/usr/bin/env bash
# =============================================================================
# One-time (re-runnable) bootstrap for pankajpramanik.com on the EXISTING shared
# OVHcloud VPS.
#
#   scp deploy/ovh-bootstrap.sh deploy/pankajpramanik.caddy deploy@<host>:~/pp-bootstrap/
#   ssh deploy@<host> 'bash ~/pp-bootstrap/ovh-bootstrap.sh'
#
# This VPS already runs a shared Caddy (container `shared-caddy`, config in
# /opt/proxy, per-site files in /opt/proxy/sites) in front of other production
# applications (travelcrewai.com / JourneyMesh). Everything below is ADDITIVE
# and idempotent:
#
#   * it never creates a Caddy, never restarts or reloads shared-caddy
#   * it never edits /opt/proxy/Caddyfile, /opt/proxy/.env, or any other site
#     file — it writes exactly one file: /opt/proxy/sites/pankajpramanik.caddy
#   * it never creates or removes Docker networks, never runs `compose down`,
#     never prunes — nothing belonging to another app is touched
#   * before replacing an existing pankajpramanik.caddy it takes a timestamped
#     backup, stored OUTSIDE the sites directory (an `import sites/*` glob would
#     otherwise load the backup as a duplicate site)
#   * it validates the full proxy config with `caddy validate` and rolls its
#     own change back if validation fails, so a later reload by anyone cannot
#     be broken by this script
#   * re-running it with an unchanged site file changes nothing
#
# What it does NOT do: start this app's stack or reload the proxy. Both are
# deliberate manual steps — see deploy/OVH.md.
# =============================================================================
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/pankajpramanik}
PROXY_DIR=${PROXY_DIR:-/opt/proxy}
PROXY_CONTAINER=${PROXY_CONTAINER:-shared-caddy}
NETWORK=${NETWORK:-proxy}
DOMAIN=${DOMAIN:-pankajpramanik.com}
EXPECTED_IP=${EXPECTED_IP:-51.79.166.97}
SITE_FILE_NAME=pankajpramanik.caddy
SITE_SRC=${SITE_SRC:-"$(cd "$(dirname "$0")" && pwd)/$SITE_FILE_NAME"}

CADDYFILE="$PROXY_DIR/Caddyfile"
SITES_DIR="$PROXY_DIR/sites"
SITE_DST="$SITES_DIR/$SITE_FILE_NAME"
BACKUP_DIR="$APP_DIR/proxy-backups"
STAMP=$(date +%Y%m%d%H%M%S)

# Marker the previous version of this script appended to the main Caddyfile.
LEGACY_MARKER="# >>> pankajpramanik (managed by deploy/ovh-bootstrap.sh) >>>"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m    ! %s\033[0m\n' "$*"; }
ok()   { printf '\033[0;32m    ✓ %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n\n' "$*" >&2; exit 1; }

# Path inside shared-caddy for a host path, resolved from the container's
# mounts (longest matching source wins). Empty when the path is not mounted.
container_path() {
  local host
  host=$(realpath -m "$1")
  docker inspect -f '{{range .Mounts}}{{.Source}}{{"\t"}}{{.Destination}}{{"\n"}}{{end}}' "$PROXY_CONTAINER" |
    while IFS=$'\t' read -r src dst; do
      [ -n "$src" ] || continue
      case "$host" in
        "$src") printf '%s\t%s\n' "${#src}" "$dst" ;;
        "$src"/*) printf '%s\t%s%s\n' "${#src}" "$dst" "${host#"$src"}" ;;
      esac
    done | sort -rn | head -1 | cut -f2-
}

# Non-comment lines of a Caddy file.
code_lines() { grep -vE '^[[:space:]]*#' "$1" 2>/dev/null || true; }

# --- preflight ---------------------------------------------------------------

say "Preflight (read-only)"

command -v docker >/dev/null || die "docker not installed"
docker compose version >/dev/null 2>&1 || die "docker compose plugin missing"
ok "docker and the compose plugin are present"

[ -f "$SITE_SRC" ] || die "site file not found at $SITE_SRC — copy deploy/$SITE_FILE_NAME next to this script"
ok "site file source: $SITE_SRC"

[ -d "$PROXY_DIR" ] || die "no shared proxy at $PROXY_DIR — this script only supports the existing shared proxy (see deploy/OVH.md, option A for a new VPS)"
[ -f "$CADDYFILE" ] || die "no $CADDYFILE — refusing to continue"
[ -d "$SITES_DIR" ] || die "no $SITES_DIR directory — refusing to create proxy structure on a shared VPS"
ok "shared proxy found at $PROXY_DIR (Caddyfile + sites/)"

[ "$(docker inspect -f '{{.State.Running}}' "$PROXY_CONTAINER" 2>/dev/null || echo false)" = "true" ] \
  || die "container '$PROXY_CONTAINER' is not running — not touching anything"
ok "$PROXY_CONTAINER is running"

docker network inspect "$NETWORK" >/dev/null 2>&1 \
  || die "external Docker network '$NETWORK' is missing — it must already exist on this VPS; not creating it"
ok "external network '$NETWORK' exists"

if docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$PROXY_CONTAINER" \
     | tr ' ' '\n' | grep -qx "$NETWORK"; then
  ok "$PROXY_CONTAINER is attached to '$NETWORK'"
else
  die "$PROXY_CONTAINER is not attached to '$NETWORK' — it could not reach pankajpramanik-app"
fi

say "Applications already on this VPS (left untouched)"
docker ps --format '    {{.Names}}\t{{.Image}}\t{{.Status}}' || true

# --- how shared-caddy sees the config -----------------------------------------

say "Proxy configuration layout"

CADDYFILE_IN=$(container_path "$CADDYFILE")
[ -n "$CADDYFILE_IN" ] || die "$CADDYFILE is not mounted into $PROXY_CONTAINER — cannot validate safely"
ok "Caddyfile inside container: $CADDYFILE_IN"

SITES_IN=$(container_path "$SITES_DIR")
[ -n "$SITES_IN" ] || die "$SITES_DIR is not mounted into $PROXY_CONTAINER — a site file there would never load"
ok "sites dir inside container: $SITES_IN"

if code_lines "$CADDYFILE" | grep -qE '^[[:space:]]*import[[:space:]]+[^[:space:]]*sites/'; then
  ok "Caddyfile imports the sites directory"
else
  die "$CADDYFILE has no 'import …sites/…' line, so $SITE_FILE_NAME would never load.
   This script does not edit the shared Caddyfile. Check how the other sites
   (e.g. travelcrewai.caddy) are loaded and fix that by hand first."
fi

COMMON_FOUND=no
for f in "$CADDYFILE" "$SITES_DIR"/*; do
  [ -f "$f" ] && [ "$f" != "$SITE_DST" ] || continue
  if code_lines "$f" | grep -qE '^[[:space:]]*\(common\)'; then COMMON_FOUND=yes; break; fi
done
[ "$COMMON_FOUND" = yes ] || die "no '(common)' snippet defined in $CADDYFILE or $SITES_DIR — $SITE_FILE_NAME uses 'import common'"
ok "'(common)' snippet is defined"

# --- conflicts ------------------------------------------------------------------

say "Checking for conflicting definitions of $DOMAIN"

if grep -qF "$LEGACY_MARKER" "$CADDYFILE"; then
  die "$CADDYFILE still contains a pankajpramanik block appended by an older
   version of this script (between '$LEGACY_MARKER'
   and '# <<< pankajpramanik <<<'). Two definitions of the same site make the
   whole proxy config invalid. Remove that block by hand (after backing up the
   Caddyfile), then re-run."
fi

DOMAIN_RE="(^|[[:space:],])(https?://)?(www\\.)?${DOMAIN//./\\.}(:[0-9]+)?([[:space:],{]|$)"
for f in "$CADDYFILE" "$SITES_DIR"/*; do
  [ -f "$f" ] && [ "$f" != "$SITE_DST" ] || continue
  if code_lines "$f" | grep -qE "$DOMAIN_RE"; then
    die "$f already mentions $DOMAIN outside of $SITE_FILE_NAME — resolve that by hand first"
  fi
done
ok "no other file defines $DOMAIN"

# --- stack directory ------------------------------------------------------------

say "Stack directory $APP_DIR"

if ! mkdir -p "$APP_DIR/storage/uploads" "$BACKUP_DIR" 2>/dev/null; then
  die "cannot create $APP_DIR as $(id -un). Once, with sudo:
   sudo install -d -o $(id -un) -g $(id -gn) $APP_DIR"
fi
ok "ready (media: $APP_DIR/storage — persistent, never deleted by deploys)"

command -v rsync >/dev/null 2>&1 || warn "rsync is not installed — the deploy workflow needs it: sudo apt-get install -y rsync"

[ -f "$APP_DIR/docker-compose.prod.yml" ] \
  || warn "docker-compose.prod.yml not there yet — the first GitHub Actions deploy ships it"

if [ ! -f "$APP_DIR/.env" ]; then
  warn ".env not there yet — copy .env.production.example to $APP_DIR/.env, fill it in, chmod 600"
elif [ "$(stat -c '%a' "$APP_DIR/.env")" != "600" ]; then
  warn "$APP_DIR/.env is mode $(stat -c '%a' "$APP_DIR/.env") — run: chmod 600 $APP_DIR/.env"
else
  ok ".env present (mode 600)"
fi

# --- install the site file ------------------------------------------------------

say "Proxy site file $SITE_DST"

[ -w "$SITES_DIR" ] || die "$SITES_DIR is not writable by $(id -un) — ask for write access to that directory only; do not run this script as root"

BACKUP=""
CREATED=no
if [ -f "$SITE_DST" ] && cmp -s "$SITE_SRC" "$SITE_DST"; then
  ok "already up to date — nothing written"
else
  if [ -f "$SITE_DST" ]; then
    BACKUP="$BACKUP_DIR/$SITE_FILE_NAME.bak.$STAMP"
    [ ! -e "$BACKUP" ] || BACKUP="$BACKUP.$$"
    cp -p "$SITE_DST" "$BACKUP"
    ok "backed up existing file to $BACKUP"
  else
    CREATED=yes
  fi
  # Write in place (keeps the inode, in case the file itself is bind-mounted).
  cat "$SITE_SRC" > "$SITE_DST"
  chmod 644 "$SITE_DST"
  ok "written"
fi

rollback() {
  if [ -n "$BACKUP" ]; then
    cat "$BACKUP" > "$SITE_DST"
    warn "restored $SITE_DST from $BACKUP"
  elif [ "$CREATED" = yes ]; then
    rm -f "$SITE_DST"
    warn "removed the new $SITE_DST"
  fi
}

# --- validate (never reload) ----------------------------------------------------
#
# An invalid config that someone later reloads would take every site on this
# VPS down, so a failed validation undoes this script's change.

say "Validating the full proxy config inside $PROXY_CONTAINER"
if docker exec "$PROXY_CONTAINER" caddy validate --config "$CADDYFILE_IN" --adapter caddyfile; then
  ok "config is valid"
else
  rollback
  die "VALIDATION FAILED — the change was rolled back and the proxy was NOT
   reloaded, so the other applications keep serving normally."
fi

# --- DNS (informational) --------------------------------------------------------

say "DNS for $DOMAIN"
for name in "$DOMAIN" "www.$DOMAIN"; do
  RESOLVED=$(getent ahostsv4 "$name" | awk '{print $1}' | sort -u | tr '\n' ' ' || true)
  if [ -z "$RESOLVED" ]; then
    warn "$name does not resolve yet — add the DNS record before reloading the proxy"
  elif printf '%s' "$RESOLVED" | grep -qw "$EXPECTED_IP"; then
    ok "$name → $EXPECTED_IP (DNS only / grey cloud)"
  else
    warn "$name → $RESOLVED (not $EXPECTED_IP). Fine if Cloudflare-proxied (orange cloud);"
    warn "then Cloudflare SSL/TLS mode must be 'Full (strict)', never 'Flexible'."
  fi
done

# --- next steps -----------------------------------------------------------------

say "Bootstrap complete. shared-caddy was validated, not reloaded. Nothing else changed."

cat <<EOF

Remaining steps, in order (details in deploy/OVH.md):

  1. Fill $APP_DIR/.env from .env.production.example, then chmod 600 it.

  2. Run the GitHub Actions workflow "Build & Publish Docker image" on main.
     It ships docker-compose.prod.yml, syncs media, pulls the sha-tagged image,
     starts this stack and waits for pankajpramanik-app to report healthy.

  3. Check the app from inside the proxy container:
       docker exec $PROXY_CONTAINER wget -qO- http://pankajpramanik-app:3000/api/health

  4. Reload the shared proxy — reload, not restart, so other sites keep serving:
       docker exec $PROXY_CONTAINER caddy reload --config $CADDYFILE_IN --adapter caddyfile

  5. Log in at https://$DOMAIN/admin and change the admin password.

EOF

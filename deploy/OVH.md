# Deploying pankajpramanik.com on the shared OVHcloud VPS

This is the only supported deployment path. The image is built in GitHub
Actions, published to the GitHub Container Registry, and pulled onto an
OVHcloud VPS that already hosts other applications.

**The VPS is shared.** A single Caddy in `/opt/proxy` fronts every site on the
box. Setup and deployment are entirely additive: they add one site block, one
stack directory, and one set of containers, and no part of the deploy path ever
stops or reconfigures an application that is already there.

Retiring JourneyMesh is the one destructive operation, and it is kept separate
on purpose. It has its own script, its own manually triggered workflow, and its
own typed confirmation. See [Retiring JourneyMesh](#retiring-journeymesh).

```
                    :80 / :443
                        │
              ┌─────────▼──────────┐
              │  /opt/proxy        │   shared Caddy — TLS, headers, routing
              └──┬──────────────┬──┘
                 │  proxy network
     ┌───────────▼──┐        ┌──▼──────────────────┐
     │ journeymesh  │        │ pankajpramanik-app  │  :3000, no host port
     │ (until it is │        └──┬──────────────────┘
     │  retired)    │           │  internal network
     └──────────────┘           │
                          ┌─────▼──────┐
                          │ db · redis │  reachable only by this stack
                          └────────────┘
```

Two rules make the sharing safe:

1. **Only the proxy publishes host ports.** This stack publishes none, so it can
   never collide with an existing app over `:80`, `:443`, or `:3000`.
2. **The proxy is reloaded, never restarted.** `caddy reload` swaps the config
   in place and keeps existing connections alive for every other site.

---

## 1. Build a registry token

The server pulls a private image from `ghcr.io`, so it needs a credential of its
own.

GitHub → Settings → Developer settings → Personal access tokens → Tokens
(classic) → Generate new token, with the **`read:packages`** scope only. Save it
as `GHCR_PULL_TOKEN`.

Do not reuse `GITHUB_TOKEN` for this. It is scoped to a single workflow run, so
using it for `docker login` on the server leaves a credential that is already
dead, and the next manual `docker compose pull` fails with a 401.

If you would rather not manage a token, make the package public instead:
GitHub → Packages → `pankajpramanik` → Package settings → Change visibility.
Anonymous pulls then work and the login step can be dropped.

## 2. GitHub secrets

Settings → Secrets and variables → Actions, in the `production` environment.

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | VPS IP or hostname |
| `DEPLOY_USER` | deploy user, a member of the `docker` group |
| `DEPLOY_SSH_KEY` | private key whose public half is in that user's `authorized_keys` |
| `GHCR_PULL_TOKEN` | the `read:packages` token from step 1 |

## 3. DNS

Point the records at the VPS **before** touching Caddy. Caddy cannot obtain a
certificate for a name that does not resolve here, and repeated failures count
against Let's Encrypt rate limits.

| Record | Type | Value |
| --- | --- | --- |
| `pankajpramanik.com` | A | VPS IPv4 |
| `www` | CNAME | `pankajpramanik.com` |

```sh
dig +short pankajpramanik.com
```

## 4. Bootstrap the server

Copy the script up and run it as the deploy user.

```sh
scp deploy/ovh-bootstrap.sh <user>@<host>:~
ssh <user>@<host> 'bash ovh-bootstrap.sh'
```

It creates the shared `proxy` network if it does not exist, creates
`/opt/pankajpramanik`, appends the two domain variables to `/opt/proxy/.env`,
and appends this site's block to `/opt/proxy/Caddyfile` between marker comments.

Every write is guarded. Existing variables are left alone, both proxy files are
backed up with a timestamp before being appended to, the block is skipped
entirely on a re-run, and the config is validated with `caddy validate` before
you are told to reload. If validation fails the script stops without reloading,
so the other sites keep serving.

The block it appends is the same one kept in
[`proxy-caddyfile.snippet`](./proxy-caddyfile.snippet) for reference or manual
installation.

## 5. Stack files

```sh
scp docker-compose.prod.yml <user>@<host>:/opt/pankajpramanik/
scp .env.production.example  <user>@<host>:/opt/pankajpramanik/.env
ssh <user>@<host> 'chmod 600 /opt/pankajpramanik/.env && nano /opt/pankajpramanik/.env'
```

Generate the auth secret rather than inventing one:

```sh
openssl rand -base64 32
```

Set a distinct `POSTGRES_PASSWORD` too. Postgres here is private to this stack,
but it shares a kernel with everything else on the box.

## 6. First start

```sh
cd /opt/pankajpramanik
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f app
```

`docker-entrypoint.sh` runs `prisma migrate deploy` on every container start, so
the schema is applied here. Then reload the proxy:

```sh
docker compose -f /opt/proxy/docker-compose.yml exec caddy \
  caddy reload --config /etc/caddy/Caddyfile
```

## 7. Content and media — nothing to seed by hand

Content and media flow from your laptop to production through git:

```sh
# locally, after editing content in the local admin (http://localhost:3000/admin)
npm run content:export        # local DB → prisma/content/snapshot.json (+ media check)
git add prisma/content storage && git commit -m "content: update" && git push
```

On push the deploy workflow:

1. uploads `storage/` and merges it into `/opt/pankajpramanik/storage` —
   file by file, **never overwriting or deleting** anything, so media uploaded
   in the production admin is safe;
2. restarts the app, whose entrypoint runs `prisma migrate deploy`, then imports
   the snapshot. The import is skipped when that snapshot was already applied,
   so production admin edits survive restarts — until you deploy a *new*
   snapshot, which then wins for posts, projects, pages, experience, skills,
   education, certifications and testimonials. Users and contact messages are
   never touched.

The admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` is created on first start
if missing. Set `CONTENT_SYNC=false` in `.env` to freeze production content.

### Media storage

| Where | Path |
| --- | --- |
| Repo | `storage/uploads/` (served at `/uploads/*`) |
| Container | `/app/storage` (`STORAGE_DIR`) |
| VPS | `/opt/pankajpramanik/storage` — bind mount, survives every redeploy |
| Backup | `/var/backups/pankajpramanik/storage` (+ `REMOTE`) via `backup.sh` |

Admin uploads land in `uploads/YYYY/MM/DD/<name>-<random>.<ext>`. To pull
production uploads back into the repo so git holds them too:

```sh
rsync -av <user>@<host>:/opt/pankajpramanik/storage/ storage/
```

---

## CI/CD

Two workflows, one of which deploys.

**`.github/workflows/ci.yml`** runs on every push and pull request to `main`:
lint, typecheck, migrate, seed, import the content snapshot, build. It never
touches the server.

**`.github/workflows/docker.yml`** runs on pushes to `main` and on version tags:

1. Starts a throwaway Postgres, migrates, seeds and imports the content
   snapshot into it, and fails if any `/uploads/…` file the content references
   is missing from `storage/`.
2. Builds the image against that database and pushes to
   `ghcr.io/pankaj2k9/pankajpramanik`, tagged `latest`, `sha-<short>`, and the
   git tag when there is one.
3. Rsyncs `storage/` and `docker-compose.prod.yml` to `/opt/pankajpramanik/.deploy`,
   then SSHes in, installs the compose file (keeping a `.bak-*` copy), merges
   media into persistent storage without overwriting, pulls, restarts this
   stack, and waits for the app to answer before reporting success.

The server needs `rsync` installed (`sudo apt-get install -y rsync`).

The build needs a live database because `next build` prerenders pages that read
Postgres. CI provides one as a service container, and Buildx reaches it over the
host network.

A concurrency group serializes deploys and never cancels one mid-flight, since a
killed run can leave the stack half-restarted.

### What the deploy job will not do

Written down because this VPS is shared:

- It names only `/opt/pankajpramanik/docker-compose.prod.yml`, so `up -d` starts
  this stack's services and nothing else.
- No `docker compose down`, no `docker system prune`, no `docker network rm`, no
  volume removal.
- Image cleanup is `docker image prune -f --filter "until=72h"`, which collects
  dangling layers older than three days. Images referenced by a running
  container are never eligible, so another app's image cannot be collected.
- It never edits `/opt/proxy`. Proxy configuration happens once, by hand, in
  step 4.
- It aborts if the stack directory, the `.env`, or the shared network is
  missing, rather than recreating any of them.
- It never deletes or overwrites a file in `/opt/pankajpramanik/storage`.

---

## Retiring JourneyMesh

Once pankajpramanik.com is live and serving over HTTPS, JourneyMesh can come off
this VPS. `deploy/decommission-journeymesh.sh` does it, gated behind a typed
confirmation:

```sh
scp deploy/decommission-journeymesh.sh <user>@<host>:~
ssh <user>@<host> 'CONFIRM=REMOVE-JOURNEYMESH bash decommission-journeymesh.sh'
```

Or from the Actions tab: **Decommission JourneyMesh** → Run workflow → type
`REMOVE-JOURNEYMESH`. Manual dispatch only. It is deliberately not part of the
deploy workflow, because a destructive step that runs on every push to `main` is
one bad merge away from an outage.

**Order matters, and the script enforces it.** JourneyMesh's block currently owns
the bare IP (`JOURNEYMESH_DOMAIN=http://<vps-ip>`), so it is what answers on
this VPS today. The script refuses to touch anything unless
`https://pankajpramanik.com` already returns 200.

What it does, in order:

1. Verifies the replacement is live, the shared network exists, and prints every
   running container.
2. Archives the Caddyfile, both `.env` files, a container and volume inventory,
   and a `tar.gz` of each JourneyMesh volume, into `/opt/decommissioned/…`.
3. **Comments out** the `{$JOURNEYMESH_DOMAIN}` block rather than deleting it,
   by counting braces from its opening line. Caddy placeholders like `{host}`
   and `{scheme}` are balanced, so they do not confuse the match. Verified
   against a copy of the real Caddyfile with `caddy validate`.
4. Comments out `JOURNEYMESH_DOMAIN` in `/opt/proxy/.env`.
5. Runs `caddy validate`. On failure it restores the backup and reloads nothing.
6. Reloads, then re-checks the live URL. If that check fails it rolls the proxy
   back and leaves the JourneyMesh containers running.
7. Only then runs `docker compose down` in JourneyMesh's own directory.

**Volumes are kept by default.** Containers are cheap to recreate, data is not.
Pass `PURGE_VOLUMES=yes` only when you are certain, and note the backup in the
archive directory is your last copy.

To undo the proxy half at any point, restore the timestamped backup and reload:

```sh
ls -t /opt/proxy/Caddyfile.bak.*
cp /opt/proxy/Caddyfile.bak.<timestamp> /opt/proxy/Caddyfile
docker compose -f /opt/proxy/docker-compose.yml exec caddy \
  caddy reload --config /etc/caddy/Caddyfile
```

### Tighten the proxy afterwards

Two things in the shared config were held back only because JourneyMesh served
plain HTTP on a bare IP. Once every site on the VPS is on a real domain with a
certificate, both should be turned on:

- Uncomment `Strict-Transport-Security` in the `(common)` snippet. It was left
  out because sending HSTS over `http://` is ignored at best, and on a hostname
  it would pin that name to HTTPS in every browser for two years before a
  certificate existed.
- Set `ACME_EMAIL` in `/opt/proxy/.env` and uncomment the `email` directive, for
  Let's Encrypt expiry warnings.

---

## Routine operations

```sh
cd /opt/pankajpramanik

docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml restart app
```

**Rollback.** Every build is tagged with its short commit SHA, so name one:

```sh
APP_IMAGE=ghcr.io/pankaj2k9/pankajpramanik:sha-abc1234 \
  docker compose -f docker-compose.prod.yml up -d app
```

Rolling back the image does **not** roll back a migration. If a deploy shipped a
destructive schema change, restore from a dump instead.

**Backups.** `deploy/backup.sh` dumps, compresses, verifies, copies off-box, and
rotates. Install it as a cron:

```sh
sudo install -m 755 deploy/backup.sh /usr/local/bin/pankajpramanik-backup
crontab -e
# 03:17 daily, an odd minute so it misses the top-of-hour pile-up
17 3 * * * /usr/local/bin/pankajpramanik-backup >> /var/log/pankajpramanik-backup.log 2>&1
```

Set `REMOTE` inside the script to an rsync destination. A dump that only ever
lands on the machine it came from is not a backup, and the script warns on every
run until that is set. It also writes to a `.part` file and renames only on
success, so a truncated dump is never mistaken for a good one, and it shouts if
a dump comes back at less than half the previous size.

---

## Troubleshooting

**Caddy returns a connection error.** The app is not on the shared network.
Check that the alias resolves from inside the proxy container:

```sh
docker compose -f /opt/proxy/docker-compose.yml exec caddy \
  wget -qO- http://pankajpramanik-app:3000 | head
```

**The certificate never issues.** Confirm DNS resolves to this VPS, that ports
80 and 443 are open in the OVHcloud firewall, and that `PANKAJPRAMANIK_DOMAIN`
carries no `http://` prefix. That prefix tells Caddy to serve plain HTTP and
skip ACME entirely.

**A proxy edit broke every site.** Every append is backed up with a timestamp.
Restore and reload:

```sh
ls -t /opt/proxy/Caddyfile.bak.*
cp /opt/proxy/Caddyfile.bak.<timestamp> /opt/proxy/Caddyfile
docker compose -f /opt/proxy/docker-compose.yml exec caddy \
  caddy reload --config /etc/caddy/Caddyfile
```

**The app restarts in a loop.** Almost always a failed `prisma migrate deploy`
against an unreachable or misconfigured database. Read the first twenty lines of
`docker compose logs app`.

**The deploy fails with a 401 from ghcr.io.** `GHCR_PULL_TOKEN` has expired or
lacks `read:packages`. Regenerate it.

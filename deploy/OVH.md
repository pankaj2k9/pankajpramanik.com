# Deploying pankajpramanik.com on the shared OVHcloud VPS

The image is built in GitHub Actions, published to
`ghcr.io/pankaj2k9/pankajpramanik`, and pulled onto an OVHcloud VPS
(`51.79.166.97`) that **already hosts another production application**,
travelcrewai.com (JourneyMesh), behind a shared Caddy.

Everything in this guide is additive. Setting up and deploying this site adds
one proxy site file, one stack directory and one set of containers. No step
stops, restarts or reconfigures travelcrewai.com, the shared proxy container,
or the `proxy` network.

## Architecture

```
Cloudflare (DNS; optionally proxied)
    │
51.79.166.97
    │
shared-caddy  :80 / :443          /opt/proxy — the ONLY thing publishing host ports
    │                             sites: /opt/proxy/sites/travelcrewai.caddy
    │                                    /opt/proxy/sites/pankajpramanik.caddy
    │  external Docker network: proxy
    ├──────────────► travelcrewai / JourneyMesh containers (untouched)
    │
pankajpramanik-app:3000           container_name + alias; `expose` only, no `ports`
    │
    │  private network: pankajpramanik_internal
    ├── db     postgres:16-alpine  volume pankajpramanik_pgdata     (no ports)
    └── redis  redis:7-alpine      volume pankajpramanik_redisdata  (no ports)

/opt/pankajpramanik/
    docker-compose.prod.yml   shipped by every deploy (previous copy kept as .bak-*)
    .env                      production secrets, mode 600, never in git
    storage/                  media bind mount → /app/storage (persistent)
    .deploy/                  deploy staging + deployed-images.log
    proxy-backups/            backups of pankajpramanik.caddy taken by the bootstrap
```

Rules that keep the sharing safe:

1. **Only shared-caddy publishes host ports.** This stack publishes none, so
   port 3000, PostgreSQL 5432 and Redis 6379 are unreachable from the internet
   and cannot collide with anything.
2. **db and redis are only on the private network.** Not even shared-caddy or
   the other application can reach them.
3. **The proxy is reloaded by hand, never restarted.** `caddy reload` swaps the
   config in place; travelcrewai.com keeps its connections.
4. **Compose is always scoped** to `-f docker-compose.prod.yml` with the pinned
   project name `pankajpramanik`. No `down`, no `system prune`, no network or
   volume removal anywhere in the deploy path.

## Which setup applies

| | Situation | Do |
|---|---|---|
| **A** | First VPS ever, no shared proxy | [Appendix A](#appendix-a-first-vps-ever-create-the-shared-proxy), then continue from step 1 |
| **B** | Shared proxy already exists: `/opt/proxy`, `shared-caddy`, `proxy` network | Steps 1–9 below |

**This server (51.79.166.97) is option B.** Do not create another Caddy, network
or proxy directory on it.

---

## 1. Registry pull token

The server pulls a private image, so it needs its own credential.

GitHub → Settings → Developer settings → Personal access tokens → Tokens
(classic) → Generate new token, scope **`read:packages`** only. This becomes
`GHCR_PULL_TOKEN`.

Do not use `GITHUB_TOKEN` for this; it dies with the workflow run.

## 2. Deploy SSH key and GitHub secrets

If the `deploy` user does not yet have a key for GitHub Actions, create a
dedicated one on your laptop and install its public half:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/pankajpramanik_deploy -C "gha-pankajpramanik" -N ""
ssh-copy-id -i ~/.ssh/pankajpramanik_deploy.pub deploy@51.79.166.97
```

Repo → Settings → Environments → **New environment → `production`** (exact name;
the workflow uses `environment: production`). Optionally add yourself as a
required reviewer so each deploy waits for approval. Add these **environment**
secrets:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | `51.79.166.97` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | full private key (`~/.ssh/pankajpramanik_deploy`, including the BEGIN/END lines) |
| `GHCR_PULL_TOKEN` | the `read:packages` token from step 1 |

No application secret (`POSTGRES_PASSWORD`, `AUTH_SECRET`, …) goes into GitHub.
Those live only in `/opt/pankajpramanik/.env`.

The `deploy` user must be in the `docker` group, have `bash` as its login shell,
and never be `root`. Docker group membership is root-equivalent on the host:
guard `DEPLOY_SSH_KEY` accordingly.

## 3. DNS (Cloudflare)

| Record | Type | Value |
| --- | --- | --- |
| `pankajpramanik.com` | A | `51.79.166.97` |
| `www` | CNAME | `pankajpramanik.com` |

Start with **DNS only (grey cloud)** until Caddy has issued both certificates.
Proxied records combined with Cloudflare's "Always Use HTTPS" can block the
Let's Encrypt HTTP challenge. After certificates exist you may switch to
proxied (orange); then set SSL/TLS mode to **Full (strict)**. "Flexible" causes
redirect loops with Caddy.

```sh
dig +short pankajpramanik.com          # 51.79.166.97 while grey-clouded
```

## 4. Bootstrap the stack directory and proxy site file

```sh
ssh deploy@51.79.166.97 'mkdir -p ~/pp-bootstrap'
scp deploy/ovh-bootstrap.sh deploy/pankajpramanik.caddy deploy@51.79.166.97:~/pp-bootstrap/
ssh deploy@51.79.166.97 'bash ~/pp-bootstrap/ovh-bootstrap.sh'
```

Read-only checks first; it stops without writing anything if any fail:

- `/opt/proxy`, `/opt/proxy/Caddyfile`, `/opt/proxy/sites` exist
- `shared-caddy` is running and attached to the external `proxy` network
- the Caddyfile and `sites/` are mounted into `shared-caddy`
- the Caddyfile has an `import …sites/…` line and a `(common)` snippet exists
- no other file (and no block from an older version of this script) already
  defines `pankajpramanik.com`

Then it:

- creates `/opt/pankajpramanik/storage/uploads`
- writes `/opt/proxy/sites/pankajpramanik.caddy` from
  [`pankajpramanik.caddy`](./pankajpramanik.caddy), backing up any previous
  copy to `/opt/pankajpramanik/proxy-backups/` (outside `sites/`, so an import
  glob can never load a backup)
- runs `caddy validate` inside `shared-caddy`; on failure it restores or
  removes its file, so a later reload cannot break travelcrewai.com
- **does not reload** the proxy

Re-running it with an unchanged site file writes nothing.

If `/opt/pankajpramanik` cannot be created as `deploy`, or `/opt/proxy/sites` is
not writable, the script tells you the one command to fix it. Never run the
script as root.

## 5. Production `.env`

```sh
scp .env.production.example deploy@51.79.166.97:/opt/pankajpramanik/.env
ssh deploy@51.79.166.97 'chmod 600 /opt/pankajpramanik/.env && nano /opt/pankajpramanik/.env'
```

Replace every `CHANGE_ME_*`:

```sh
openssl rand -hex 32       # POSTGRES_PASSWORD (URL-safe: it is embedded in DATABASE_URL)
openssl rand -base64 32    # AUTH_SECRET
```

`POSTGRES_USER/PASSWORD/DB` take effect only when the `pgdata` volume is first
created. Choose them before the first deploy.

## 6. First deploy

GitHub → Actions → **CI/CD** → Run workflow → `main`
(or push to `main`).

The deploy job ships `docker-compose.prod.yml`, merges media, pulls the image
tagged `sha-<full commit sha>`, runs `docker compose up -d`, and waits for
`pankajpramanik-app` to become **healthy**. See [CI/CD](#cicd).

On first start the container:

1. `prisma migrate deploy` — applies all migrations to the empty database
2. creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` if it does not exist
3. imports `prisma/content/snapshot.json`
4. starts Next.js

## 7. Content and media — nothing to seed by hand

Content and media flow from your laptop to production through git. Both must be
committed; neither is gitignored:

- `prisma/content/snapshot.json` — baked into the image, imported on start
- `storage/uploads/**` — not in the image; synced to the VPS by the deploy

```sh
# locally, after editing content in the local admin (http://localhost:3000/admin)
npm run content:export        # local DB → prisma/content/snapshot.json (+ media check)
git add prisma/content storage && git commit -m "content: update" && git push
```

On push the deploy workflow:

1. rsyncs `storage/` to `/opt/pankajpramanik/.deploy/storage` (no `--delete`)
   and merges it into `/opt/pankajpramanik/storage` file by file, **never
   overwriting or deleting**, so media uploaded in the production admin is safe;
2. restarts the app, whose entrypoint runs `prisma migrate deploy`, ensures the
   admin exists, then imports the snapshot. The import is skipped when that
   snapshot was already applied, so production admin edits survive restarts —
   until you deploy a *new* snapshot, which then wins for posts, projects,
   pages, experience, skills, education, certifications and testimonials.
   Users and contact messages are never touched.

Set `CONTENT_SYNC=false` in `.env` to freeze production content.

### Media storage

| Where | Path |
| --- | --- |
| Repo | `storage/uploads/` (served at `/uploads/*`) |
| Container | `/app/storage` (`STORAGE_DIR`) |
| VPS | `/opt/pankajpramanik/storage` — bind mount, survives every redeploy |
| Backup | `/var/backups/pankajpramanik/storage` (+ `REMOTE`) via `backup.sh` |

To pull production uploads back into the repo:

```sh
rsync -av deploy@51.79.166.97:/opt/pankajpramanik/storage/ storage/
```

## 8. Go live: check, then reload the proxy

```sh
ssh deploy@51.79.166.97
cd /opt/pankajpramanik
docker compose -f docker-compose.prod.yml ps               # app healthy, db healthy, redis up
docker exec shared-caddy wget -qO- http://pankajpramanik-app:3000/api/health   # {"status":"ok"}
docker exec shared-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec shared-caddy caddy reload   --config /etc/caddy/Caddyfile --adapter caddyfile
```

(Use the Caddyfile path the bootstrap printed if it is not `/etc/caddy/Caddyfile`.)

## 9. Verify

```sh
curl -sI https://pankajpramanik.com | head -1              # HTTP/2 200
curl -sI https://www.pankajpramanik.com | grep -i location # https://pankajpramanik.com/
curl -s  https://pankajpramanik.com/api/health             # {"status":"ok"}
curl -sI https://travelcrewai.com | head -1                # unchanged
```

Then log in at `https://pankajpramanik.com/admin` and change the admin password.
Install backups (see below) the same day.

---

## CI/CD

One workflow, **`.github/workflows/ci-cd.yml`**, with three chained jobs:

```
ci ──needs──► e2e ──needs──► publish ──needs──► deploy (environment: production)
```

| Event | ci | e2e | publish | deploy |
|---|---|---|---|---|
| Pull request → `main` | ✓ | if ci passed | skipped | skipped |
| Push to `main` | ✓ | if ci passed | if ci + e2e passed | if publish passed |
| Manual run (Actions → CI/CD → Run workflow) on `main` | ✓ | if ci passed | if ci + e2e passed | if publish passed |
| Manual run on any other branch | ✓ | if ci passed | skipped | skipped |

Each job `needs` the previous one, so a failing CI run on a commit means no
image is built for it and nothing reaches the server. There is no separate
deploy workflow that could race ahead of CI.

1. **ci** (throwaway Postgres): `npm ci` → `prisma validate` → lint →
   typecheck → `prisma migrate deploy` → seed + import content snapshot →
   fail if any `/uploads/…` referenced by content is missing from `storage/` →
   `npm run build`.
2. **e2e** (own throwaway Postgres): prepare the database, build, start the
   production server, run the Playwright suite (`npm run test:e2e`, including
   the database-backed dashboard tests with Chromium). Report, screenshots and
   server log are uploaded as an artifact on failure. **This is a required
   gate: a failing browser test blocks the deploy.**
3. **publish**: same database preparation, then builds the Docker image and
   pushes `ghcr.io/pankaj2k9/pankajpramanik` tagged `latest`, `sha-<short>` and
   `sha-<full>`.
4. **deploy** (environment `production`), as `deploy` over SSH:
   1. rsync `storage/` and `docker-compose.prod.yml` to `/opt/pankajpramanik/.deploy`
   2. refuse unless `/opt/pankajpramanik`, its `.env` and the `proxy` network exist
   3. install the compose file (keeping `docker-compose.prod.yml.bak-*`)
   4. `docker login ghcr.io` with the token over stdin; logout on any exit
   5. `APP_IMAGE=…:sha-<full sha>` → `docker compose pull app`
   6. merge media without overwriting; `chown` to uid 1001
   7. `docker compose up -d` (entrypoint runs `prisma migrate deploy` + content import)
   8. wait up to ~250s for container health `healthy`; fail immediately on
      `unhealthy`, a crash loop (3+ restarts) or a wrong image — printing the
      last 80 log lines and the exact rollback command
   9. retag the server's cached `:latest` to the deployed build, append to
      `.deploy/deployed-images.log`
   10. remove old builds of **this image only**, keeping the 5 newest

Runs on `main` are serialized and never cancelled mid-flight; a newer queued
run replaces an older queued one. Pull-request runs are cancelled by newer
pushes to the same PR.

To stop unreviewed code reaching `main` at all, protect the branch: Settings →
Branches → `main` → require a pull request and the **CI** and **E2E tests**
status checks.

### What the deploy job will not do

- touch `/opt/proxy` in any way (no edit, reload or restart)
- run `docker compose down`, `docker system prune`, `docker network rm`, or remove volumes
- remove images of any other repository, or an image a container is using
- delete or overwrite any file in `/opt/pankajpramanik/storage`
- create a missing stack directory, `.env` or network — it fails instead
- print the SSH key or GHCR token

---

## Routine operations

```sh
cd /opt/pankajpramanik
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml restart app
tail .deploy/deployed-images.log
```

**Rollback** to any earlier build:

```sh
APP_IMAGE=ghcr.io/pankaj2k9/pankajpramanik:sha-<full or short sha> \
  docker compose -f docker-compose.prod.yml up -d app
```

Rolling back the image does **not** roll back a migration or a content import.
If a deploy shipped a destructive schema change, restore from a dump.

**Backups.** `deploy/backup.sh` dumps, compresses, verifies, copies off-box and
rotates:

```sh
scp deploy/backup.sh deploy@51.79.166.97:~
# on the VPS — set REMOTE= inside the script first
sudo install -m 755 ~/backup.sh /usr/local/bin/pankajpramanik-backup
sudo crontab -e
17 3 * * * /usr/local/bin/pankajpramanik-backup >> /var/log/pankajpramanik-backup.log 2>&1
```

## Troubleshooting

**502 from Caddy.** App not on the `proxy` network, or not healthy yet:
`docker exec shared-caddy wget -qO- http://pankajpramanik-app:3000/api/health`.

**Certificate never issues.** DNS not pointing at `51.79.166.97`, Cloudflare
proxying during issuance, or ports 80/443 blocked in the OVHcloud firewall.

**A proxy change broke sites.** Restore and reload:

```sh
ls -t /opt/pankajpramanik/proxy-backups/
cp /opt/pankajpramanik/proxy-backups/pankajpramanik.caddy.bak.<stamp> /opt/proxy/sites/pankajpramanik.caddy
# or, if this site should not be served at all: rm /opt/proxy/sites/pankajpramanik.caddy
docker exec shared-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec shared-caddy caddy reload   --config /etc/caddy/Caddyfile --adapter caddyfile
```

**App restarts in a loop / deploy reports crash loop.** Almost always
`prisma migrate deploy` or the content import failing against the database
(wrong `POSTGRES_*`, special characters in `POSTGRES_PASSWORD`). Read the first
lines of `docker compose -f docker-compose.prod.yml logs app`.

**No admin user.** `ADMIN_PASSWORD` missing or under 12 characters. Fix `.env`,
then `docker compose -f docker-compose.prod.yml up -d app` (recreates with the
new env; the admin is created on start).

**401 from ghcr.io.** `GHCR_PULL_TOKEN` expired or lacks `read:packages`.

## Risks to keep in mind

- **Cloudflare and rate limiting.** The app rate-limits by the first
  `X-Forwarded-For` entry, which the site file sets to the TCP peer. With
  Cloudflare proxying, that peer is a Cloudflare edge IP, so visitors behind the
  same edge share contact/login/comment limits. Fixing it properly needs
  `trusted_proxies` in the shared Caddyfile's global options, which affects
  every site — decide deliberately, not during first deploy.
- **The `(common)` snippet is shared.** Whatever it contains (e.g. HSTS)
  applies to this site too. Check it before the first reload.
- **A new content snapshot is authoritative.** Deploying one replaces
  production edits to content tables; posts missing from it are deleted, and
  their comments cascade with them.
- **SSH host key is trusted on first use** (`ssh-keyscan` in the workflow).
- **Rollbacks don't undo migrations.** Take a backup before deploying schema
  changes.

## Retired: JourneyMesh decommissioning

An earlier version shipped a workflow and script to remove JourneyMesh from this
VPS. JourneyMesh is the live travelcrewai.com production application, so the
workflow was removed and `deploy/decommission-journeymesh.sh` now refuses to
run.

---

## Appendix A: first VPS ever — create the shared proxy

Only for a VPS with **no** proxy. **Not for 51.79.166.97.** As a sudo user:

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo apt-get install -y rsync
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo install -d -o deploy -g deploy /opt/proxy /opt/proxy/sites /opt/pankajpramanik
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp && sudo ufw enable
```

As `deploy`:

```sh
docker network create proxy
```

`/opt/proxy/Caddyfile`:

```caddy
{
	email you@example.com
}

(common) {
	encode zstd gzip
	header {
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}
}

import /etc/caddy/sites/*.caddy
```

`/opt/proxy/docker-compose.yml`:

```yaml
services:
  caddy:
    image: caddy:2-alpine
    container_name: shared-caddy
    restart: unless-stopped
    ports: ["80:80", "443:443", "443:443/udp"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./sites:/etc/caddy/sites:ro
      - caddy_data:/data
      - caddy_config:/config
    networks: [proxy]
networks:
  proxy:
    external: true
volumes:
  caddy_data:
  caddy_config:
```

```sh
cd /opt/proxy && docker compose up -d
```

Then continue with step 1. The bootstrap script works unchanged against this
layout.

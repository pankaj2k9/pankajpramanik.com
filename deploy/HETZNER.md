# Deploying on Hetzner Cloud (CX23 / CPX-series)

The stack is provider-agnostic: any Ubuntu VPS + SSH works. There are two
supported deployment styles — pick one:

- **Docker Compose (recommended)** — app + Postgres + Redis + Caddy (auto
  HTTPS) in containers. See **"Docker deployment"** below. This matches
  `docker-compose.prod.yml`.
- **Bare-metal (PM2 + Nginx)** — the original path using
  `deploy/server-setup.sh`, `deploy/nginx.conf`, and PM2. See the sections
  after that.

GitHub Actions deploys over plain SSH either way, so there is no provider
lock-in — Hetzner has the same CI/CD story as DigitalOcean.

---

## Docker deployment (recommended)

**On the server (one-time):**

```bash
# install Docker Engine + compose plugin
curl -fsSL https://get.docker.com | sh

mkdir -p /opt/pankajpramanik && cd /opt/pankajpramanik
# copy these three files from the repo to the server:
#   docker-compose.prod.yml, Caddyfile, and a filled-in .env
cp .env.production.example .env && nano .env   # set real secrets + DOMAIN

# point DNS (A records @ and www) at the server IP first, then:
docker login ghcr.io -u <github-user>          # to pull the private image
docker compose -f docker-compose.prod.yml up -d
```

The app container runs `prisma migrate deploy` automatically on start.
**Seed the database once** (the slim runtime image can't seed itself):

```bash
# from a repo checkout (server or laptop) pointed at the prod DB:
DATABASE_URL="postgresql://appuser:PASS@<server-ip>:5432/pankajpramanik" \
  npm ci && npm run db:seed
```

(Or temporarily expose the `db` port, seed, then remove the port mapping.)

**Image builds** happen in CI: `.github/workflows/docker.yml` spins up a
throwaway Postgres, migrates + seeds it, builds the image against it
(`next build` needs a DB), and pushes to
`ghcr.io/pankaj2k9/pankajpramanik`. On push to `main` it then SSHes to the
server and runs `docker compose pull && up -d`.

Required repo secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`
(the `GITHUB_TOKEN` for GHCR is automatic). Make the GHCR package readable
by the server, or `docker login` on the server as above.

**TLS**: Caddy obtains and renews Let's Encrypt certs automatically for
`DOMAIN` and `www.DOMAIN` from the `.env` — nothing else to configure.

---

## Bare-metal (PM2 + Nginx) alternative

## 1. Create the server

1. Hetzner Cloud Console → **Add Server**
2. Location: nearest to your audience (e.g. Nuremberg/Falkenstein for EU,
   Ashburn for US)
3. Image: **Ubuntu 24.04**
4. Type: **Shared vCPU** — CX23 (Intel) or the equivalent **CPX** plan if
   you pick AMD. Anything with **≥ 2 GB RAM** works; 4 GB builds Next.js
   comfortably without relying on swap.
5. Networking: enable **Public IPv4** (and IPv6).
6. SSH key: add your public key (avoid password auth).
7. Optional but recommended: create a **Cloud Firewall** allowing inbound
   TCP 22, 80, 443 and attach it to the server. (`server-setup.sh` also
   configures ufw on the host — both is fine.)

## 2. DNS

Point `pankajpramanik.com` (A record `@` and `www`) at the server IP —
directly or through Cloudflare (proxy on is fine; use SSL mode
"Full (strict)" after certbot runs).

## 3. Provision

Same script as DigitalOcean:

```bash
scp deploy/server-setup.sh root@<server-ip>:/root/
ssh root@<server-ip> bash server-setup.sh
```

Installs Node 22, PostgreSQL, Nginx, PM2, fail2ban, ufw, 2 GB swap,
creates the `pankajpramanik` database + `appuser`, prints the production
`DATABASE_URL`, and sets up nightly `pg_dump` backups.

Then follow README sections 13–16 exactly as written (clone to
`/var/www/pankajpramanik`, `.env`, migrate, seed, build, PM2, Nginx,
certbot).

## 4. CI/CD (GitHub Actions)

`.github/workflows/deploy.yml` already deploys over SSH. Add these
repository secrets (Settings → Secrets and variables → Actions):

| Secret           | Value                                          |
| ---------------- | ---------------------------------------------- |
| `DEPLOY_HOST`    | your Hetzner server IP (or hostname)           |
| `DEPLOY_USER`    | `root` (or a dedicated deploy user)            |
| `DEPLOY_SSH_KEY` | private key whose public half is on the server |

Push to `main` → CI (lint, migrate check, build) → SSH deploy → PM2 reload.
Identical flow to DigitalOcean; only the IP behind `DEPLOY_HOST` changes.

## 5. Hetzner extras worth enabling

- **Backups** (server settings): automatic snapshots, +20% of server price.
- **Metrics**: built-in CPU/network graphs in the console.
- If you later outgrow the shared plan, resize to a bigger CX/CPX type in
  place (Rescale → keep disk size to allow scaling back down).

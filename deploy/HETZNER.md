# Deploying on Hetzner Cloud (CX23 / CPX-series)

The stack is provider-agnostic: any Ubuntu VPS + SSH works. The same
`deploy/server-setup.sh`, Nginx config, PM2 setup, and GitHub Actions
workflow used for DigitalOcean run unchanged on Hetzner. GitHub Actions
deploys over plain SSH, so there is no provider lock-in — Hetzner has
exactly the same CI/CD integration story as DigitalOcean here.

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

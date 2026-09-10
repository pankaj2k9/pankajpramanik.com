# Deploying pankajpramanik.com on the shared OVHcloud VPS

This is the only supported deployment path. The image is built in GitHub
Actions, published to the GitHub Container Registry, and pulled onto an
OVHcloud VPS that already hosts other applications.

**The VPS is shared.** A single Caddy in `/opt/proxy` fronts every site on the
box. Everything in this document is additive: it adds one site block, one stack
directory, and one set of containers. No step stops, removes, or reconfigures an
application that is already there.

```
                    :80 / :443
                        │
              ┌─────────▼──────────┐
              │  /opt/proxy        │   shared Caddy — TLS, headers, routing
              └──┬──────────────┬──┘
                 │  proxy network
     ┌───────────▼──┐        ┌──▼──────────────────┐
     │ other apps   │        │ pankajpramanik-app  │  :3000, no host port
     │ (untouched)  │        └──┬──────────────────┘
     └──────────────┘           │  internal network
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

## 7. Seed once

The runtime image is slim and carries neither `tsx` nor the migrated content, so
seeding runs from a repo checkout pointed at the production database.

```sh
DATABASE_URL="postgresql://appuser:PASS@localhost:5432/pankajpramanik" npm run db:seed
```

The seed is idempotent. Change the seeded admin password at first login.

---

## CI/CD

Two workflows, one of which deploys.

**`.github/workflows/ci.yml`** runs on every push and pull request to `main`:
lint, typecheck, migrate, seed, build. It never touches the server.

**`.github/workflows/docker.yml`** runs on pushes to `main` and on version tags:

1. Starts a throwaway Postgres, migrates and seeds it.
2. Builds the image against that database and pushes to
   `ghcr.io/pankaj2k9/pankajpramanik`, tagged `latest`, `sha-<short>`, and the
   git tag when there is one.
3. SSHes to the VPS, pulls, restarts this stack, and waits for the app to answer
   before reporting success.

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
- It aborts if the stack directory, the compose file, the `.env`, or the shared
  network is missing, rather than recreating any of them.

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

**Backups.** Nothing backs up Postgres today. Add a cron writing somewhere that
is not this VPS:

```sh
docker compose -f /opt/pankajpramanik/docker-compose.prod.yml exec -T db \
  pg_dump -U appuser pankajpramanik | gzip > "pankajpramanik-$(date +%F).sql.gz"
```

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

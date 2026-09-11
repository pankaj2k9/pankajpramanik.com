# pankajpramanik.com — Next.js Portfolio & Blog

Full-stack rebuild of [pankajpramanik.com](https://pankajpramanik.com), migrated from WordPress + MySQL to a modern **Next.js 16 + PostgreSQL** application. Content — blog posts, portfolio projects, services, work experience, skills, certifications, testimonials, and media — was migrated from the live WordPress site via its REST API.

Runs on **Docker Compose** both locally (Postgres + Redis) and in production (app + Postgres + Redis + Caddy with automatic HTTPS).

## 1. Project Overview

- **Public site**: interactive Three.js homepage, blog, portfolio, services, work experience, skills, about, and contact pages — statically generated with incremental revalidation (ISR).
- **Admin panel** (`/admin`): password-protected dashboard with a TipTap WYSIWYG editor to manage blog posts, projects, services/pages, experience, certifications, and skills — plus per-page SEO fields and a contact-message inbox.
- **Contact form**: server-validated, spam-protected (honeypot + time-trap + Redis/in-memory rate limiting), delivered via [Resend](https://resend.com) and stored in PostgreSQL.
- **SEO**: per-page metadata (WordPress Yoast titles/descriptions preserved), Open Graph images, JSON-LD, sitemap.xml, robots.txt, and 301 redirects from all old WordPress URLs.

## 2. Tech Stack

| Layer      | Choice                                                       |
| ---------- | ------------------------------------------------------------ |
| Framework  | Next.js 16 (App Router, Server Components, standalone output) |
| Language   | TypeScript                                                    |
| Styling    | Tailwind CSS v4                                               |
| 3D / anim  | Three.js + React Three Fiber (homepage), GSAP + Lenis (inner pages) |
| Editor     | TipTap (admin WYSIWYG)                                        |
| Database   | PostgreSQL 16                                                 |
| Cache      | Redis (contact-form rate limiting; optional)                 |
| ORM        | Prisma 6 (migrations + seed)                                  |
| Auth       | Auth.js (NextAuth v5) — credentials + bcrypt + JWT           |
| Email      | Resend                                                        |
| Runtime    | Node.js ≥ 20.19 (22 LTS recommended)                         |
| Containers | Docker Compose (local + prod)                                |
| Production | Caddy (auto TLS) · GHCR image · GitHub Actions               |

## 3. Features

- Blog with categories, tags, related posts, reading time, cover images
- Portfolio grouped by category with tabbed project detail pages (Overview / Case Study / Tech Stack)
- 23 service pages (agency-style banner, capability cards, process, CTA)
- Work experience timeline + education + certifications (with verification links) + testimonials
- Skills / tech-stack page linked to services
- Admin CRUD (WYSIWYG) for posts, projects, services/pages, experience, certifications, skills
- Dark/light theme, background music player, contact-message inbox
- WordPress URL preservation (old `/post-slug/` → `/blog/post-slug` 301s)
- SSG + ISR (5 min) for public pages; content HTML sanitized server-side

## 4. Folder Structure

```
├── docker-compose.yml              # DEV: Postgres (5433) + Redis (6380) [+ app via --profile full]
├── docker-compose.prod.yml         # PROD: app + Postgres + Redis, behind the shared proxy
├── Dockerfile                      # multi-stage build (Next.js standalone)
├── Dockerfile.dev                  # deps-only dev image (hot reload)
├── docker-entrypoint.sh            # runs `prisma migrate deploy` then starts app
├── Caddyfile                       # standalone fallback only (single-app VPS)
├── .env.example / .env.production.example
├── .github/workflows/
│   ├── ci.yml                      # lint · typecheck · migrate · seed · build
│   ├── docker.yml                  # build image → GHCR → SSH deploy to OVHcloud
│   └── decommission-journeymesh.yml # manual dispatch, retires the previous app
├── deploy/
│   ├── OVH.md                      # the deployment guide
│   ├── ovh-bootstrap.sh            # idempotent, additive server bootstrap
│   ├── decommission-journeymesh.sh # one-time retirement of the previous app
│   └── proxy-caddyfile.snippet     # site block for the shared /opt/proxy/Caddyfile
├── migration/                      # WordPress migration tooling
│   ├── wp-export/  extracted/      # raw REST export → cleaned seed JSON
│   ├── extract*.mjs                # WP export/portfolio → clean JSON
│   ├── download-media.mjs          # mirror WP media into public/uploads
│   ├── generate-service-art.mjs    # generated SVG service thumbnails
│   └── optimize-service-art.mjs    # optimize raster thumbnails → webp
├── prisma/  (schema.prisma · migrations · seed.ts)
├── public/  (uploads/ · services-art/ · audio/)
└── src/
    ├── app/ (site)/  admin/  api/  sitemap.ts  robots.ts  opengraph-image.tsx
    ├── actions/                    # server actions (posts, projects, pages…)
    ├── components/  (site/, home/ [R3F hero], admin/ [TipTap])
    ├── lib/  (prisma, auth, queries, content, redis, rate-limit, service-art)
    └── proxy.ts                    # /admin route guard (Next 16 proxy)
```

## 5. Prerequisites

- **Docker Desktop / Docker Engine** with Compose v2
- **Node.js ≥ 20.19** (22 LTS recommended) — the app runs on the host in dev; only the database + cache run in Docker locally

## 6. Local Setup (Docker Compose)

```bash
git clone <your-repo-url> pankajpramanik && cd pankajpramanik
npm install

# 1. start Postgres + Redis (host ports 5433 / 6380 to avoid clashing with
#    any native Postgres:5432 / Redis:6379)
docker compose up -d

# 2. configure env
cp .env.example .env
#    the defaults already point at the compose services:
#    DATABASE_URL="postgresql://pankajpramanik:pankajpramanik_dev@localhost:5433/pankajpramanik?schema=public"
#    REDIS_URL="redis://localhost:6380"
#    → set AUTH_SECRET (openssl rand -base64 32) and ADMIN_PASSWORD

# 3. migrate + seed + run
npm run db:migrate      # apply migrations
npm run db:seed         # admin user + all migrated content
npm run dev             # http://localhost:3000  (admin at /admin)
```

Stop the services with `docker compose down` (add `-v` to wipe the database volume).

## 7. Environment Variables

Copy `.env.example` → `.env`. Key values:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection (compose: port **5433**) |
| `REDIS_URL` | Redis (compose: port **6380**); optional — falls back to in-memory rate limiting |
| `AUTH_SECRET` | Auth.js JWT secret — `openssl rand -base64 32` |
| `AUTH_URL` | Canonical app URL (`http://localhost:3000` locally) |
| `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` | Initial admin created by the seed (change after first login) |
| `RESEND_API_KEY` | From resend.com (free tier OK) |
| `CONTACT_EMAIL` / `CONTACT_FROM_EMAIL` | Delivery inbox + verified sender |
| `NEXT_PUBLIC_SITE_URL` | Public URL used in metadata/sitemap |

## 8. NPM Scripts

```bash
npm run dev            # dev server
npm run build          # prisma generate + next build (standalone)
npm run db:migrate     # prisma migrate dev
npm run db:seed        # seed admin + migrated content (idempotent)
npm run db:studio      # Prisma Studio
npm run wp:extract     # re-run WordPress extraction
npm run wp:media       # re-mirror WordPress media → public/uploads
npm run services:svg   # regenerate SVG service thumbnails
npm run services:art   # optimize raster service thumbnails → webp
```

## 9. Production Deployment (OVHcloud VPS)

The app runs as **app + Postgres + Redis** in containers on an OVHcloud VPS that
already hosts other applications. A single shared Caddy in `/opt/proxy` fronts every
site on the box and terminates TLS. This stack publishes **no host ports** — it joins
the shared `proxy` Docker network as `pankajpramanik-app`, and Caddy is the only thing
that can reach it.

Full walkthrough: **[deploy/OVH.md](deploy/OVH.md)**.

```bash
# 1. DNS: A record @ → VPS IP, CNAME www → pankajpramanik.com (do this FIRST)

# 2. bootstrap — idempotent and additive; touches no other app on the VPS
scp deploy/ovh-bootstrap.sh <user>@<host>:~
ssh <user>@<host> 'bash ovh-bootstrap.sh'

# 3. stack files
scp docker-compose.prod.yml <user>@<host>:/opt/pankajpramanik/
scp .env.production.example  <user>@<host>:/opt/pankajpramanik/.env   # then fill it in

# 4. first start
ssh <user>@<host>
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin
cd /opt/pankajpramanik && docker compose -f docker-compose.prod.yml up -d

# 5. reload the shared proxy (reload, not restart — other sites keep serving)
docker compose -f /opt/proxy/docker-compose.yml exec caddy \
  caddy reload --config /etc/caddy/Caddyfile
```

- The app container runs **`prisma migrate deploy` automatically on start** (`docker-entrypoint.sh`).
- **Seed once** (the slim runtime image can't seed itself) from a repo checkout pointed at the prod DB:
  ```bash
  DATABASE_URL="postgresql://appuser:PASS@localhost:5432/pankajpramanik" npm run db:seed
  ```
- **TLS** is issued and renewed by the shared Caddy from `PANKAJPRAMANIK_DOMAIN` in `/opt/proxy/.env`.
- `public/uploads` (migrated media) is baked into the image; no volume is mounted over it.
- `Caddyfile` in the repo root is a **standalone fallback** for a VPS where this app is
  the only thing running. It is not used by `docker-compose.prod.yml`.

## 10. CI/CD (GitHub Actions → GHCR → OVHcloud)

**`.github/workflows/ci.yml`** — every push and PR to `main`: lint, typecheck, migrate,
seed, build. Never touches the server.

**`.github/workflows/docker.yml`** — pushes to `main` and version tags:

1. Spins up a throwaway Postgres, migrates + seeds it, and **builds the image against it**
   (`next build` prerenders DB-backed pages).
2. Pushes to `ghcr.io/<owner>/pankajpramanik`, tagged `latest`, `sha-<short>`, and the git tag.
3. SSHes to the VPS, pulls, restarts this stack, and **waits for the app to answer**
   before reporting success.

Required repo secrets (in the `production` environment): `DEPLOY_HOST`, `DEPLOY_USER`,
`DEPLOY_SSH_KEY`, `GHCR_PULL_TOKEN`.

`GHCR_PULL_TOKEN` is a PAT with `read:packages`. `GITHUB_TOKEN` is deliberately not used
for the server-side `docker login` — it expires with the workflow run, leaving a dead
credential on the box.

**Because the VPS is shared**, the deploy job is deliberately narrow: it names only this
stack's compose file, runs no `down`, no `system prune`, no network or volume removal,
never edits `/opt/proxy`, and aborts if the stack directory or shared network is missing
rather than recreating either. Image cleanup is limited to dangling layers older than 72h.

**Retiring JourneyMesh.** The VPS previously served JourneyMesh on the bare IP. Once
pankajpramanik.com is live over HTTPS, retire it with the **Decommission JourneyMesh**
workflow (manual dispatch, typed confirmation) or `deploy/decommission-journeymesh.sh`.
It refuses to run until the new site returns 200, archives everything first, comments the
old site block out rather than deleting it, and rolls the proxy back automatically if the
post-reload check fails. Volumes are kept unless you opt in. See
[deploy/OVH.md](deploy/OVH.md#retiring-journeymesh).

**Rollback** to any build by tag:

```bash
APP_IMAGE=ghcr.io/pankaj2k9/pankajpramanik:sha-abc1234 \
  docker compose -f docker-compose.prod.yml up -d app
```

## 11. Resend (contact email)

1. resend.com → API key → `RESEND_API_KEY`.
2. Verify your domain to send from `contact@pankajpramanik.com`; until then use `onboarding@resend.dev` as `CONTACT_FROM_EMAIL`.
3. Submissions are **always stored in PostgreSQL** (admin → Messages), so a Resend outage never loses a lead.

## 12. SEO

- Metadata API with per-page titles/descriptions; migrated posts keep their Yoast SEO fields; editable per post/project/page in admin.
- `sitemap.xml` + `robots.txt` generated from the database.
- Open Graph / Twitter cards + dynamic OG image (`opengraph-image.tsx`).
- JSON-LD: `Person` (home), `BlogPosting` (posts), `SoftwareSourceCode` (projects), `Service` (services).
- 301 redirects for every old WordPress URL (`next.config.ts`). After launch: submit the sitemap in Google Search Console.

## 13. Backups

- **Docker Postgres** — nightly dump from the db container:
  ```bash
  docker compose -f docker-compose.prod.yml exec -T db \
    pg_dump -U "$POSTGRES_USER" pankajpramanik | gzip > backup-$(date +%F).sql.gz
  ```
  Restore: `gunzip -c backup.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U "$POSTGRES_USER" pankajpramanik`
- **Media** — `public/uploads/` is in git and baked into the image.
- **Off-site** — enable provider snapshots, or sync dumps to S3 / DO Spaces with `rclone` on cron.

## 14. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Port 5433 / 6380 already in use | Another Postgres/Redis is bound; stop it or change the host port in `docker-compose.yml` |
| `Prisma only supports Node.js 20.19+` | Upgrade Node (`nvm install 22`) |
| Login always fails | Re-check `AUTH_SECRET` / `AUTH_URL`; reseed admin with `npm run db:seed` |
| Contact email not arriving | Check admin → Messages (stored regardless); verify Resend domain + `CONTACT_FROM_EMAIL` |
| Prod image build fails on `next build` | It needs a DB — the workflow provides one; for local `docker build` pass `--network=host --build-arg DATABASE_URL=…` |
| 502 behind Caddy | `docker compose -f docker-compose.prod.yml logs app` — app crashed or not on port 3000 |
| Images 404 under `/uploads` | Run `npm run wp:media`; rebuild the image so `public/uploads` is baked in |

---

### WordPress → Postgres migration (how it was done)

1. `migration/extract.mjs` + `extract-portfolio.mjs` pulled posts/pages/portfolio/taxonomy/media from the WP REST API, cleaned Elementor markup, preserved Yoast SEO, and rewrote `wp-content/uploads` + internal links to local paths.
2. `migration/download-media.mjs` mirrored referenced media into `public/uploads/`.
3. `prisma/seed.ts` loads the extracted JSON (+ hand-authored custom services) into PostgreSQL — idempotent, safe to re-run.
4. Old URLs 301-redirect via `next.config.ts`.

### Performance notes

- Three.js loaded **only** on the homepage via `next/dynamic` (`ssr: false`), skipped for `prefers-reduced-motion`.
- `next/image` everywhere (AVIF/WebP), `next/font` with `display: swap`.
- Server Components by default; SSG + ISR for public pages; standalone output for a small production image.
- Immutable caching for `/_next/static`, long cache for `/uploads` and `/services-art` (Caddy).
- HTML sanitized server-side — no client-side markdown/HTML parsing.

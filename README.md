# pankajpramanik.com — Next.js Portfolio & Blog

Full-stack rebuild of [pankajpramanik.com](https://pankajpramanik.com), migrated from WordPress + MySQL to a modern **Next.js 16 + PostgreSQL** application. All content — 27 blog posts, 17 categories, 149 tags, projects, work experience, skills, education, certifications, testimonials, and 326 media files — was migrated from the live WordPress site via its REST API.

## 1. Project Overview

- **Public site**: interactive Three.js homepage, blog, portfolio, work experience, skills, about, and contact pages — statically generated with incremental revalidation (ISR).
- **Admin panel** (`/admin`): password-protected dashboard to create/edit/delete blog posts, projects, and work experience, and to read contact messages.
- **Contact form**: server-validated, spam-protected (honeypot + time-trap + rate limiting), delivered via [Resend](https://resend.com) and stored in PostgreSQL.
- **SEO**: per-page metadata (WordPress Yoast titles/descriptions preserved), Open Graph images, JSON-LD structured data, sitemap.xml, robots.txt, and 301 redirects from all old WordPress URLs.

## 2. Tech Stack

| Layer      | Choice                                                     |
| ---------- | ---------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Server Components, Turbopack)      |
| Language   | TypeScript                                                  |
| Styling    | Tailwind CSS v4                                             |
| 3D         | Three.js + React Three Fiber (homepage only, lazy-loaded)  |
| Database   | PostgreSQL 15+                                              |
| ORM        | Prisma 6 (migrations + seed)                                |
| Auth       | Auth.js (NextAuth v5) — credentials + bcrypt + JWT          |
| Email      | Resend                                                      |
| Runtime    | Node.js ≥ 20.19 (22 LTS recommended)                        |
| Production | Ubuntu · Nginx · PM2 · Let's Encrypt · GitHub Actions       |

## 3. Features

- Blog with categories, tags, related posts, reading time, cover images
- Portfolio grouped by category with project detail pages
- Work experience timeline + education + certifications + testimonials
- Skills/tech-stack page
- Admin CRUD for posts (Markdown or HTML), projects, experience
- Contact messages inbox in admin
- WordPress URL preservation (old `/post-slug/` → `/blog/post-slug` 301s)
- Static generation + ISR (5 min) for public pages; content HTML sanitized server-side

## 4. Folder Structure

```
├── .github/workflows/deploy.yml   # CI + deploy pipeline
├── deploy/                        # nginx.conf, ecosystem.config.js, server-setup.sh
├── migration/                     # WordPress migration tooling
│   ├── wp-export/                 # raw WP REST API export (posts, pages, media…)
│   ├── extracted/                 # cleaned JSON consumed by the seed
│   ├── extract.mjs                # WP export → clean JSON
│   └── download-media.mjs         # mirrors WP media into public/uploads
├── prisma/
│   ├── schema.prisma              # database schema
│   ├── migrations/                # SQL migrations
│   └── seed.ts                    # admin user + migrated content
├── public/uploads/                # migrated WordPress media (326 files)
└── src/
    ├── app/
    │   ├── (site)/                # public pages (home, blog, portfolio, …)
    │   ├── admin/                 # login + protected dashboard (CRUD)
    │   ├── api/                   # auth + contact endpoints
    │   └── sitemap.ts  robots.ts  opengraph-image.tsx
    ├── actions/                   # server actions (posts, projects, experience…)
    ├── components/                # site/, home/ (Three.js hero), admin/
    ├── lib/                       # prisma, auth, queries, content, rate-limit
    └── proxy.ts                   # route guard for /admin (Next 16 proxy)
```

## 5. Local Setup

```bash
git clone <your-repo-url> pankajpramanik && cd pankajpramanik
npm install                # Node ≥ 20.19 required
cp .env.example .env       # then edit values (see section 7)
```

## 6. PostgreSQL Setup

**Option A — Docker (easiest):**

```bash
docker compose up -d       # starts postgres:16 with DB "pankajpramanik"
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pankajpramanik"
```

**Option B — native (macOS/Homebrew):**

```bash
brew install postgresql@16 && brew services start postgresql@16
createdb pankajpramanik
# DATABASE_URL="postgresql://<your-user>@localhost:5432/pankajpramanik"
```

## 7. Environment Variables

Copy `.env.example` → `.env`. Key values:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Auth.js JWT secret — `openssl rand -base64 32` |
| `AUTH_URL` | Canonical app URL (`http://localhost:3000` locally) |
| `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` | Initial admin created by the seed (min 12 chars; change after first login) |
| `RESEND_API_KEY` | From resend.com (free tier OK) |
| `CONTACT_EMAIL` | Where contact form messages are delivered |
| `CONTACT_FROM_EMAIL` | Verified Resend sender |
| `NEXT_PUBLIC_SITE_URL` | Public URL used in metadata/sitemap |

## 8–11. Migrate, Seed, Develop, Build

```bash
npm run db:migrate         # 8. apply migrations (dev: creates them too)
npm run db:seed            # 9. admin user + all migrated WordPress content
npm run dev                # 10. http://localhost:3000 (admin at /admin)
npm run build && npm start # 11. production build + serve
```

Other scripts: `db:studio` (Prisma Studio), `db:reset`, `wp:extract`, `wp:media` (re-run migration steps against the live WP site).

## 12–13. Production Deployment — DigitalOcean Droplet or Hetzner Cloud

Works on any Ubuntu VPS: DigitalOcean Droplet ($12/mo, 2 GB) or Hetzner Cloud CX23/CPX (often cheaper with 4 GB RAM — see [deploy/HETZNER.md](deploy/HETZNER.md) for the Hetzner-specific walkthrough; everything below applies to both).

1. Create an Ubuntu 24.04 droplet, point DNS (`A` records for `@` and `www`) at it. Cloudflare proxy optional but recommended.
2. SSH in as root and run the guided setup (review it first):

```bash
scp deploy/server-setup.sh root@<droplet-ip>:/root/ && ssh root@<droplet-ip> bash server-setup.sh
```

It installs Node 22, PostgreSQL, Nginx, PM2, fail2ban, a 2 GB swapfile (needed to build Next.js on 2 GB RAM), creates the database + `appuser`, prints your production `DATABASE_URL`, and installs a nightly `pg_dump` cron.

3. Clone + configure + first deploy:

```bash
git clone <your-repo-url> /var/www/pankajpramanik && cd /var/www/pankajpramanik
cp .env.example .env && nano .env    # production values; AUTH_URL=https://pankajpramanik.com
npm ci
npx prisma migrate deploy && npm run db:seed
npm run build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
pm2 start deploy/ecosystem.config.js && pm2 save && pm2 startup
```

## 14. Nginx

```bash
cp deploy/nginx.conf /etc/nginx/sites-available/pankajpramanik.com
ln -s /etc/nginx/sites-available/pankajpramanik.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

## 15. SSL — Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d pankajpramanik.com -d www.pankajpramanik.com
```

Auto-renewal is installed by certbot (`systemctl list-timers | grep certbot` to verify).

## 16. PM2

The app runs as Next.js **standalone** output under PM2 (`deploy/ecosystem.config.js`): single fork instance bound to `127.0.0.1:3000`, 700 MB restart threshold, logs in `/var/log/pm2/`. Useful commands: `pm2 status`, `pm2 logs pankajpramanik`, `pm2 reload pankajpramanik`.

## 17. GitHub Actions CI/CD

`.github/workflows/deploy.yml`:

- **PRs & pushes** → lint + `prisma migrate deploy` against a throwaway Postgres + full build.
- **Push to `main`** → after CI passes, SSH to the droplet: `git reset --hard origin/main`, `npm ci`, `prisma migrate deploy`, `npm run build`, copy standalone assets, `pm2 reload`.

Repository secrets required: `DEPLOY_HOST`, `DEPLOY_USER` (e.g. `root` or a deploy user), `DEPLOY_SSH_KEY` (private key whose public half is in `~/.ssh/authorized_keys` on the server). The deploy step is plain SSH, so it works identically for DigitalOcean, Hetzner Cloud, or any Ubuntu VPS.

## 18. Resend

1. Create a free account at resend.com → API key → `RESEND_API_KEY`.
2. Verify your domain (DNS records) so you can send from `contact@pankajpramanik.com`; until then use `onboarding@resend.dev` as `CONTACT_FROM_EMAIL`.
3. Contact submissions are **always stored in PostgreSQL** (admin → Messages), so a Resend outage never loses a lead.

## 19. SEO

- Metadata API with per-page titles/descriptions; migrated posts keep their Yoast SEO title + meta description.
- `sitemap.xml` and `robots.txt` generated from the database (`src/app/sitemap.ts`, `robots.ts`).
- Open Graph / Twitter cards sitewide + dynamic OG image (`opengraph-image.tsx`).
- JSON-LD: `Person` (home), `BlogPosting` (posts), `SoftwareSourceCode` (projects).
- 301 redirects for every old WordPress URL (`next.config.ts`), so existing backlinks and rankings carry over. After launch: submit the sitemap in Google Search Console.

## 20. Backup Strategy

- **Database**: nightly `pg_dump | gzip` to `/var/backups/postgres/` (14-day retention) — installed by `server-setup.sh`. Restore: `gunzip -c file.sql.gz | sudo -u postgres psql pankajpramanik`.
- **Media**: `public/uploads/` is in git (16 MB) — every clone is a backup.
- **Off-droplet**: enable DigitalOcean droplet backups (+20% of droplet cost) or sync `/var/backups/postgres` to DO Spaces/S3 with `rclone` on a cron.

## 21. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Prisma only supports Node.js 20.19+` | Upgrade Node (`nvm install 22`) |
| Build killed / OOM on droplet | Ensure the 2 GB swapfile from `server-setup.sh` is active (`swapon --show`) |
| `next start` warns about standalone | Expected — production runs `node .next/standalone/server.js` via PM2 |
| Login always fails | Re-check `AUTH_SECRET`/`AUTH_URL` in `.env`; reseed admin with `npm run db:seed` |
| Contact email not arriving | Check admin → Messages (stored regardless); verify Resend domain + `CONTACT_FROM_EMAIL` |
| Images 404 under `/uploads` | Run `npm run wp:media` to re-mirror; confirm `cp -r public .next/standalone/` ran after build |
| 502 from Nginx | `pm2 status` / `pm2 logs` — app probably crashed or isn't on port 3000 |

---

### WordPress → Postgres migration (how it was done)

1. `migration/extract.mjs` pulled all posts/pages/categories/tags/media from the WP REST API (`wp-export/`), cleaned markup, preserved Yoast SEO fields, and rewrote all `wp-content/uploads` URLs to local `/uploads/...` paths (`extracted/`).
2. `migration/download-media.mjs` mirrored all 326 referenced media files into `public/uploads/` (three images that were already broken on the live site are dropped from content).
3. `prisma/seed.ts` loads the extracted JSON into PostgreSQL — idempotent, safe to re-run.
4. Old URLs 301-redirect via `next.config.ts` (post slugs moved from `/` to `/blog/`).

### Performance checklist (already applied)

- Three.js loaded **only** on the homepage via `next/dynamic` (`ssr: false`), skipped for `prefers-reduced-motion`
- `next/image` everywhere (AVIF/WebP), `next/font` with `display: swap`
- Server Components by default; client components only where interactive
- SSG + ISR for all public pages; standalone output for a small production footprint
- Immutable caching for `/_next/static`, 7-day cache for `/uploads` (Nginx)
- Sanitized HTML rendered server-side — no client-side markdown/HTML parsing

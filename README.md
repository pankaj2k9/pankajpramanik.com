# Pankaj Pramanik — AI, Data & Automation

A Next.js 16 portfolio, services site, blog, and private content dashboard. Existing WordPress content and redirects are preserved in PostgreSQL. The homepage uses a procedural React Three Fiber / Three.js scene inspired by the supplied cool-blue visual references.

## Quick start

Prerequisites: **Node.js 22 LTS** (minimum 20.19), npm, and **Docker with Compose v2**. PostgreSQL 16 is required; Redis is optional. Run all commands from this repository.

```bash
npm ci
cp .env.example .env
# Edit .env: generate AUTH_SECRET and choose ADMIN_EMAIL / ADMIN_PASSWORD.
# Generate a secret with: openssl rand -base64 32

docker compose up -d db redis
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Do not overwrite an existing `.env`. The seed creates an administrator using your chosen credentials and imports content from `migration/extracted/`. The password must have at least 12 characters. It is hashed before storage. Existing admin passwords are **not changed** by re-running the seed. Some content upserts update existing records; back up an edited database before seeding it again. No database reset is needed for this redesign.

Local database: `localhost:5433`. Optional Redis: `localhost:6380`. Docker credentials in the example Compose configuration are for local development only. Database/cache ports bind to loopback.

## Actual local URLs

| URL | Purpose |
| --- | --- |
| http://localhost:3000/ | Homepage with interactive service nodes |
| http://localhost:3000/about | About and working process |
| http://localhost:3000/services | Services and “Find the right service” selector |
| http://localhost:3000/portfolio | Projects with service/technology filters, search, and expandable case studies |
| http://localhost:3000/contact | Contact form, email, and WhatsApp |
| http://localhost:3000/contact?service=automation | Prefills the inquiry subject for automation; also accepts `data` and `intelligence` |
| http://localhost:3000/admin | **Private dashboard**, redirects to login when signed out |
| http://localhost:3000/admin/login | Administrator sign-in |
| http://localhost:3000/admin/projects | Manage projects, covers, case studies, and SEO |
| http://localhost:3000/admin/messages | Contact inbox |
| http://localhost:3000/blog | Existing articles and category filters |
| http://localhost:3000/experience | Existing experience, education, and certifications |
| http://localhost:3000/skills | Existing technology groups |
| http://localhost:3000/sitemap.xml | Published public URLs |
| http://localhost:3000/robots.txt | Crawl rules excluding admin/API |
| http://localhost:3000/opengraph-image | Generated sharing image |

`/projects` redirects to `/portfolio`; `/projects/<slug>` redirects to `/portfolio/<slug>`; `/dashboard` redirects to `/admin`. WordPress-era post URLs, `/about-me`, `/resume`, and `/latest-from-the-blog` retain permanent redirects. Deep links into the dashboard return to the requested path after sign-in, and work on refresh.

If port 3000 is occupied, `npm run dev -- --port 3001` uses http://localhost:3001 instead. Update `AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, and browser-test `TEST_BASE_URL` to match.

## Environment variables

Copy `.env.example`, then set your own values. Do not commit `.env`, database URLs containing real passwords, session secrets, or API keys.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string; host development uses `localhost:5433`, Docker app uses `db:5432` |
| `REDIS_URL` | Optional shared rate limiter; leave blank for in-memory limiting on a single app instance |
| `AUTH_SECRET` | Random secret, generated with `openssl rand -base64 32` |
| `AUTH_URL` | `http://localhost:3000` locally; deployed HTTPS origin in production |
| `AUTH_TRUST_HOST` | `true` when the host/proxy is trusted; configure proxy forwarding correctly |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | Initial admin seed inputs; no public registration or shared demo account |
| `NEXT_PUBLIC_SITE_URL` | Origin for canonical URLs, sitemap, and social images; production: `https://pankajpramanik.com` |
| `RESEND_API_KEY` | Optional email provider key; leave blank for local database-only contact testing |
| `CONTACT_EMAIL` | Destination inbox for contact notifications |
| `CONTACT_FROM_EMAIL` | Sender address on a domain verified with Resend |
| `PORT`, `HOSTNAME` | Production start overrides; default port 3000, loopback unless a hostname is provided |

The WhatsApp number **+8801716121009**, its link **https://wa.me/8801716121009**, email, social profiles, portrait, and CV path are centralized in `src/lib/site.ts`.

## Database and content

```bash
npm run db:migrate:deploy  # Apply checked-in migrations to an existing database
npm run db:migrate        # Create/apply migrations during schema development
npm run db:seed           # Import migrated content and create the initial admin
npm run content:export    # Local DB → prisma/content/snapshot.json (commit to deploy)
npm run content:import    # Snapshot → DATABASE_URL (runs automatically in production)
npm run db:studio         # Inspect data using Prisma Studio
```

### Media storage

All media lives in `storage/uploads/` (served at `/uploads/*` by `src/app/uploads/[...path]/route.ts`) — not in `public/`. Admin cover-image and editor **Upload** buttons save to `storage/uploads/YYYY/MM/DD/`. Commit `storage/` so git holds every file; in production it is the bind-mounted `/opt/pankajpramanik/storage`, which deploys merge into without overwriting or deleting. See `deploy/OVH.md` § 7.

The additive `20260915090000_project_case_studies` migration adds `problem`, `approach`, `outcome`, and `evidenceUrl` to projects. It keeps existing records. Apply migrations before running the new production version. `npm run build` regenerates the Prisma client.

Dashboard project forms now persist cover images. They also validate URL slugs, image hosts, and case-study evidence. Outcome claims require a supporting URL; leave them blank when no evidence is available. The public page explicitly says when measured outcomes have not been published. A URL is supporting material supplied by the author, not an automatic verification of a claim. Review the linked evidence before publishing.

Core Home, About, Services introduction, Projects introduction, and Contact copy lives in their React page/components. Individual services, project content, blog posts, privacy policy, experience, skills, and certifications are database-backed. The migrated `about-me` database record is retained as an archive; current About copy lives in `src/app/(site)/about/page.tsx`.

Static content and public detail routes use static rendering with revalidation where possible. Contact query-prefill and category-filtered blog pages render on the server. Admin pages render per request. Authentication is enforced in the proxy, dashboard layout, server page reads, and every mutation. Deleted admin accounts lose access even with an existing session token.

## Demo, example, and dummy URLs

There is **no public demo login, authentication bypass, or shared default password**. Sign in with the admin credentials you configured for your local database.

- `localhost` URLs above refer to your local app, not a hosted demo.
- `/portfolio/uber-data-engineering-etl-project` and `/portfolio/medical-rag-chatbot-langchain-pinecone-flask` are real detail routes after the supplied portfolio seed. They describe projects; they are not deployed copies of those applications.
- Project `repoUrl` and `liveUrl` fields are edited at `/admin/projects/<id>/edit`. Existing seeded repository URLs point to the author's GitHub projects. Live URLs are currently blank where no deployment is provided; no dummy live-demo button is displayed.
- `you@example.com` in the contact form is input guidance. `example.invalid` addresses in browser tests are reserved test data and are never used for external mail.
- Placeholder secrets and mail settings in `.env.example` / `.env.production.example` must be replaced in your local environment or deployment secret store. `onboarding@resend.dev`, if used, is a Resend test sender; replace it with your verified sender for production.
- Deployment examples under `deploy/` use placeholders such as `<user>`, `<host>`, and `<owner>`. Replace them with your actual deployment account, server, and registry namespace.
- The production origin and social profile links in `src/lib/site.ts` are existing site configuration, not invented demo destinations. Set `NEXT_PUBLIC_SITE_URL` to change the deployed origin.

## Production build and start

A running, migrated PostgreSQL database is needed at build time to prerender content.

```bash
npm run lint
npm run typecheck
npm run db:migrate:deploy
npm run build
npm run start
```

`npm run start` uses the **standalone server** and copies `public` and `.next/static` into its output folder. It reads local `.env` if present without overriding injected environment variables. It does not use `next start`, which is not the correct entry point for standalone output. To use another port: `PORT=3001 npm run start`.

For Docker production, retain the existing `Dockerfile`, `docker-entrypoint.sh`, and `docker-compose.prod.yml`. The entrypoint applies migrations and the image already includes assets. See [the deployment guide](deploy/OVH.md) for the existing shared Caddy/OVH setup and backups. This change does not deploy or publish the website.

## Contact behavior

The API validates inputs, uses a honeypot and time check, rate-limits requests, and stores valid messages in PostgreSQL before attempting email delivery. Email delivery failure does not discard a saved message. A database failure returns a recoverable error so the visitor can retry or use WhatsApp/email. Keep `RESEND_API_KEY` blank for local testing to avoid sending real notifications. Actual Resend delivery requires configured and verified provider credentials.

## Design, accessibility, and performance

- Main headings, content, links, and service controls render as accessible HTML outside the canvas.
- Three.js loads after the initial paint only on fine-pointer screens at least 800px wide, with reduced motion disabled and data-saver mode off.
- Mobile, reduced-motion, unavailable WebGL2, context-loss, and scene-error cases retain the lightweight CSS visual and HTML service controls.
- The procedural scene downloads no 3D models, textures, HDRs, or postprocessing libraries. Pixel ratio is capped at 1.5. Rendering pauses outside the viewport, when the tab is hidden, and through the visible pause control.
- Native scroll and IntersectionObserver reveals replace GSAP/Lenis and the custom pointer runtime. Reduced-motion preferences disable animation. Music stays available as explicit opt-in with `preload="none"`.
- Images use `next/image` where appropriate; decorative service SVGs have explicit dimensions. Fonts are self-hosted by `next/font` after build-time download. Layout space is reserved for the hero and media.
- Page metadata includes canonical URLs, page-specific social cards, titles, and descriptions. Existing Person, Service, BlogPosting, and SoftwareSourceCode structured data is retained. Admin and login pages emit noindex metadata and an `X-Robots-Tag`; admin URLs are excluded from the sitemap.

## Browser and performance checks

With a production server running on port 3000:

```bash
npm run test:e2e
# Includes temporary local admin/project create-edit tests; email must be disabled:
TEST_ENABLE_DB=true npm run test:e2e
```

Tests use installed Google Chrome by default. To use Playwright Chromium instead, install it with `npx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium`. `TEST_BASE_URL` selects another local app origin. Database mutation tests refuse non-local database hosts, create an isolated temporary admin and draft project, and remove only those records afterward. Do not point them at production. Traces/screenshots may contain local dashboard content; `test-results/`, `playwright-report/`, and `reports/` are ignored by Git.

The suite covers primary public routes, metadata, WCAG automated checks, mobile layouts, reduced motion, service selection, contact error recovery, project filters/case studies, protected deep links, draft create/edit persistence, refresh, and sign-out. Automated accessibility checks complement manual keyboard and visual inspection; they do not establish full accessibility conformance.

```bash
npx lighthouse http://localhost:3000 --output=html --output=json \
  --output-path=reports/lighthouse-mobile --chrome-flags="--headless"
```

Lighthouse measures a local lab run. LCP, CLS, and interaction checks here are diagnostic; real-user Core Web Vitals, especially INP, need field data after deployment. See [verification results](docs/verification.md) for the checks performed and their limits.

## Troubleshooting

| Problem | Resolution |
| --- | --- |
| Database connection or prerender failure | Start Docker and `docker compose up -d db redis`; check `docker compose ps`, `DATABASE_URL`, port 5433, and applied migrations |
| Port conflict | Use `DB_PORT=5434 REDIS_PORT=6381 docker compose up -d` and update connection URLs; choose another app port as described above |
| Missing case-study columns / Prisma type errors | Run `npm run db:migrate:deploy`, `npx prisma generate`, then restart/rebuild the app |
| Login fails | Confirm database availability, chosen admin email/password, `AUTH_SECRET`, and `AUTH_URL`. Seed once if the user is missing; reseeding does not reset an existing password |
| Redirects lose the session after deployment | Check the HTTPS origin, secure cookie behavior, and forwarded host/protocol headers at the trusted proxy |
| Production assets 404 | Use `npm run start` or the Docker image, which include standalone static/public assets |
| Google font download fails at build time | Allow the build machine to reach Google's font endpoints, or replace the font imports with local licensed WOFF2 files |
| No 3D on mobile or reduced motion | This is intentional; the static visual and all service interactions remain available |
| Image URL rejected | Use `/uploads/...`, `/services-art/...`, or an allowed HTTPS host. Update both `next.config.ts` and `src/lib/validation.ts` when adding a trusted host |
| Email does not arrive | Check `/admin/messages`, the Resend key, destination, verified sender, and server logs |
| Dashboard save fails | Values remain in the form. Check database connectivity; duplicate slugs/names and deleted records have explicit feedback |
| Browser tests cannot launch | Install Chrome or Playwright Chromium; choose the matching `PLAYWRIGHT_CHANNEL` |

Do not use `db:reset` or `docker compose down -v` on data you intend to keep: both can remove database content. Existing production backup/restore instructions are in `deploy/OVH.md`.

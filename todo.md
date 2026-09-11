# TODO — interaction polish + deploy

**Direction:** keep the site's own identity. The indigo → violet → pink accent, both
themes, the Three.js neural scene, and the background audio player all stay. What gets
borrowed from the reference sites is **how they feel to use**, not how they look.

Two references, two different lessons:

- [rubenmarcus.dev](https://www.rubenmarcus.dev) — micro-interactions. Cursor-tracked
  card glow, sheen sweeps, mono micro-labels, numbered sections, staggered reveals.
- [aaabadcode.com](https://www.aaabadcode.com) — the pointer *is* the experience. A
  full-screen WebGL fluid canvas (`<canvas id="fluid">`, fixed, `z-0`) running Pavel
  Dobryakov's splat simulation. Every mouse move injects dye and velocity.

Their fluid config, read off the live bundle, if we go that route:

| Param | Value |
| --- | --- |
| `SIM_RESOLUTION` | 128 |
| `DYE_RESOLUTION` | 1440 |
| `DENSITY_DISSIPATION` | 0.5 |
| `VELOCITY_DISSIPATION` | 3 |
| `PRESSURE` / iterations | 0.1 / 20 |
| `CURL` | 3 |
| `SPLAT_RADIUS` / `FORCE` | 0.2 / 6000 |

---

## Track A — Custom cursor

One `src/components/site/CustomCursor.tsx`, mounted once in the root layout, reading
`data-theme` off `<html>` the same way `ThemeToggle` already does.

### A1. Base behaviour

- [ ] Render only when `(pointer: fine)` matches. Touch devices keep the native cursor
      and the component renders nothing at all, not a hidden div.
- [ ] Two layers: an inner dot that tracks the pointer exactly, and an outer ring that
      lags behind it.
- [ ] Drive the lag with `gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" })`.
      A `quickTo` setter reuses one tween instead of allocating a new one per
      `mousemove`, which matters at 120Hz.
- [ ] Position with `transform: translate3d(...)` only. Animating `left`/`top` forces
      layout on every frame.
- [ ] `pointer-events: none` and a high `z-index` on both layers, above the header but
      below the mobile menu overlay.
- [ ] `cursor: none` on `body` only once the component has mounted, so a JS failure
      never leaves a visitor with no cursor at all.
- [ ] Hide both layers on `mouseleave` of the document, show on `mouseenter`.

### A2. Two distinct designs

The interesting half of the ask. The cursor should read as a different object per theme,
not the same shape recolored.

- [ ] **Dark theme — "phosphor probe".** Hollow ring in `--accent`, 1px stroke, soft
      outer glow, tiny solid core dot. `mix-blend-mode: screen` so it brightens whatever
      it crosses. Optional short trail of 4-6 decaying dots, matching the neural scene's
      particle language.
- [ ] **Light theme — "ink blot".** Filled blob in a dark ink tone, `mix-blend-mode:
      multiply`, `filter: blur(2px)`, and a slight squash-and-stretch along the direction
      of travel driven by pointer velocity. This is the aaabadcode feel without the cost
      of a fluid sim.
- [ ] Cross-fade the two on theme switch rather than swapping instantly.
- [ ] Both variants defined as CSS custom properties in `globals.css` so the component
      stays theme-agnostic and only toggles a class.

### A3. Hover states

- [ ] Links and buttons: ring scales to ~2.2x, core dot fades out, border brightens.
- [ ] Cards and portfolio items: ring grows into a filled disc carrying a mono label
      (`VIEW`, `READ`, `OPEN`). Driven by a `data-cursor="view"` attribute so any element
      can opt in without the component knowing about it.
- [ ] Text inputs and textareas: collapse to a thin vertical I-beam.
- [ ] The music toggle: label reads `PLAY` / `PAUSE` to match its state.
- [ ] Magnetic pull on primary buttons — the button translates up to ~6px toward the
      pointer within a radius, and springs back on leave.
- [ ] Click feedback: quick scale-down then overshoot on `mousedown` / `mouseup`.

### A4. Guard rails

- [ ] Disable entirely under `prefers-reduced-motion: reduce` and restore the native cursor.
- [ ] Never hide the cursor over `/admin` — it is a working tool, not a showcase.
- [ ] Verify focus-visible outlines still show for keyboard users. A custom cursor must
      not become the only focus affordance.
- [ ] Confirm the cursor sits above the Three.js canvas on the homepage and does not
      swallow its `pointermove` handlers.

### A5. Optional — fluid trail

- [ ] Decide whether to add a WebGL fluid canvas at all. The homepage already runs a
      Three.js scene; a second WebGL context with a 1440px dye texture is a real cost on
      integrated GPUs and mobile.
      Recommendation: skip it, and if the ink feel is wanted, do a 2D canvas trail with
      ~30 decaying segments instead. Roughly 1% of the GPU cost, most of the impression.
- [ ] If it ships anyway: homepage only, dynamically imported, `ssr: false`, dropped when
      the tab is hidden and when the device reports fewer than 4 cores.

---

## Track B — Smooth scrolling

`src/components/site/ScrollFX.tsx` works, but three specific things are fighting each
other. This is the "not sure what's wrong" part, and here is what is actually wrong.

### B1. Two animation loops running at once

- [ ] `autoRaf: true` gives Lenis its own `requestAnimationFrame` loop while GSAP runs a
      separate ticker. Two loops means Lenis and ScrollTrigger read positions at different
      moments in the same frame, which is exactly the jitter that is felt but hard to name.
- [ ] Fix: set `autoRaf: false` and drive Lenis from the GSAP ticker.

```ts
const lenis = new Lenis({ autoRaf: false, /* … */ });
lenis.on("scroll", ScrollTrigger.update);
const raf = (time: number) => lenis.raf(time * 1000); // gsap ticker is in seconds
gsap.ticker.add(raf);
gsap.ticker.lagSmoothing(0);
// cleanup: gsap.ticker.remove(raf)
```

- [ ] `lagSmoothing(0)` matters. By default GSAP fabricates a catch-up frame after a
      long task, which makes Lenis jump.

### B2. Reveal animations that undo themselves

- [ ] `toggleActions: "play reverse play reverse"` fades every block back **out** as it
      leaves the viewport. Scrolling back up replays everything. It reads as flicker,
      not polish.
- [ ] Fix: reveal once with `once: true`, or `toggleActions: "play none none none"`.
- [ ] Batch the reveals with `ScrollTrigger.batch()` and a `stagger: 0.09`. That is the
      staggered-grid feel from the reference, and it replaces up to N individual
      ScrollTriggers with one.
- [ ] Reveal transform is `y: 34` with `opacity`. Add a small `scale: 0.98` and lengthen
      to ~0.64s on `power2.out` for the slower, more deliberate feel.

### B3. Tuning

- [ ] `lerp: 0.16` with `wheelMultiplier: 1.25` is snappy to the point of feeling loose.
      Try `lerp: 0.09` and `wheelMultiplier: 1`, then compare side by side.
- [ ] Set `syncTouch: false` and let touch devices scroll natively. Smoothed touch
      scrolling on iOS fights the platform's own momentum.
- [ ] Handle in-page anchors through `lenis.scrollTo()`, otherwise `#hash` links jump
      while everything else glides.
- [ ] Call `ScrollTrigger.refresh()` after fonts load and after images decode. Reveal
      triggers currently measure against a pre-font layout and fire at the wrong points.
- [ ] Add `ScrollTrigger.config({ ignoreMobileResize: true })` so the mobile URL bar
      collapsing does not re-trigger everything.

### B4. The homepage is a special case

- [ ] `HomeExperience.tsx` scrolls a nested `overflow` element with CSS scroll-snap.
      Lenis is attached to the window, so it never touches that scroller — smooth scroll
      silently does nothing on the landing page.
- [ ] Fix: either give Lenis that element via `wrapper` / `content`, or drop scroll-snap
      and let the page scroll normally. Scroll-snap and momentum smoothing pull in
      opposite directions; picking one is better than half of each.
- [ ] Whichever way it goes, `/` and interior pages should feel like one site.

---

## Track C — Audio section, both themes

- [ ] `MusicPlayer.tsx` styling is currently one look for both themes. Give it a light
      variant: on light backgrounds the floating control needs a real surface and border,
      not the translucent dark treatment.
- [ ] The `eq` keyframe bars should use `--accent`, not a hardcoded color, so they follow
      the theme.
- [ ] The control sits bottom-right, which is where a custom cursor label will also want
      to live. Check they do not collide.
- [ ] Add a visible track title and a mute-vs-pause distinction. Right now the only state
      is playing or not.
- [ ] Consider a small waveform or level meter driven by `AnalyserNode` instead of the
      fixed CSS equalizer. Real motion tied to real audio, and it costs one analyser node.
- [ ] Respect `prefers-reduced-motion` for the bars, and keep autoplay behaviour as is —
      it already handles the browser gesture requirement correctly.
- [ ] Verify contrast of the control against the light theme's `#f8fafc` background.

---

## Track D — Micro-interactions worth borrowing

Palette stays; these are all behaviour, not color.

- [ ] Cursor-tracked radial glow inside cards. Set `--mx` / `--my` from `mousemove` and
      paint a `radial-gradient(220px circle at var(--mx) var(--my), …)` in a `::before`.
- [ ] Diagonal sheen sweep across a card on hover, animating `background-position` over
      ~0.72s.
- [ ] A 2px accent line that sweeps across the top edge of a card on hover.
- [ ] Mono uppercase micro-labels: section eyebrows as `01 / Services`, card indices,
      chip rows. Uses the existing `--font-mono` token, no new font needed.
- [ ] Nav links: a terminal-style `>_` prefix that types in on hover using
      `transition: width .26s steps(2, end)`, plus an underline that scales from the left.
- [ ] Marquee ticker of availability statements. The `marquee` keyframes already exist in
      `globals.css` and are used for the tech strip; reuse them.
- [ ] Number counters that animate up when the stats section first enters view.
- [ ] Staggered mobile menu entrance, one link at a time.

---

## Track E — Docker and OVHcloud deploy ✅ done

- [x] `docker-compose.yml` — dev stack. Postgres and Redis on host ports 5433 / 6380,
      plus an `app` service under `--profile full` running `next dev` with hot reload.
- [x] `Dockerfile.dev` — deps-only dev image, no build step.
- [x] `docker-compose.prod.yml` — bundled Caddy removed. No published host ports. Joins
      the external `proxy` network as `pankajpramanik-app`; database and cache stay on a
      private network.
- [x] Removed the Hetzner / bare-metal path entirely: `deploy/HETZNER.md`,
      `deploy/nginx.conf`, `deploy/ecosystem.config.js`, `deploy/server-setup.sh`.
      PM2, Nginx, and certbot are no longer part of this project.
- [x] `deploy/ovh-bootstrap.sh` — idempotent, additive server bootstrap. Creates the
      shared network only if absent, appends to `/opt/proxy/.env` and `Caddyfile` behind
      markers, backs both up first, and runs `caddy validate` before telling you to
      reload, so a bad edit cannot take the other applications offline.
- [x] `deploy/proxy-caddyfile.snippet` — the same site block, for manual installation.
- [x] `deploy/OVH.md` — the deployment guide: GHCR token, secrets, DNS, bootstrap,
      first start, rollback by SHA tag, backups, troubleshooting.
- [x] `Caddyfile` — kept, relabelled as the standalone single-app fallback.
- [x] Split the racing workflows. `ci.yml` lints, typechecks, and builds. `docker.yml`
      is the only thing that deploys, with a concurrency guard that never cancels
      mid-flight.
- [x] Swapped `GITHUB_TOKEN` for a `GHCR_PULL_TOKEN` PAT in the server-side registry
      login. `GITHUB_TOKEN` expires with the run, so later manual pulls returned 401.
- [x] Deploy job hardened for a shared VPS: aborts if the stack directory, compose file,
      `.env`, or shared network is missing; no `down`, no `system prune`, no network or
      volume removal; never edits `/opt/proxy`; prunes only dangling images older than
      72h; polls the app until it answers before reporting success.
- [x] Build job now exports the image tag, so a rollback has a concrete SHA to name.

### Retiring JourneyMesh

- [x] `deploy/decommission-journeymesh.sh` — gated behind `CONFIRM=REMOVE-JOURNEYMESH`.
      Refuses to run unless `https://pankajpramanik.com` already returns 200, since the
      JourneyMesh block currently owns the bare IP and is what answers on this VPS today.
- [x] Archives the Caddyfile, both `.env` files, a container and volume inventory, and a
      `tar.gz` of every JourneyMesh volume, before touching anything.
- [x] Comments the site block out rather than deleting it, by counting braces from the
      opening line. Caddy placeholders like `{host}` and `{scheme}` are balanced, so they
      do not break the match. Tested against a copy of the real Caddyfile, and the result
      passes `caddy validate` on a real Caddy 2 image.
- [x] Validates before reloading, re-checks the live URL after, and rolls the proxy back
      automatically if either step fails — leaving the JourneyMesh containers running.
- [x] Volumes kept by default. `PURGE_VOLUMES=yes` is opt-in.
- [x] `.github/workflows/decommission-journeymesh.yml` — `workflow_dispatch` only, with a
      typed confirmation input. Never wired into the deploy workflow.

### Still to do on the server

- [ ] Create the `GHCR_PULL_TOKEN` PAT with `read:packages` (or make the package public).
- [ ] Add the four GitHub secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`,
      `GHCR_PULL_TOKEN`.
- [ ] Point the `pankajpramanik.com` A record and `www` CNAME at the VPS **before**
      reloading Caddy, or certificate issuance fails and burns rate limit.
- [ ] Run `deploy/ovh-bootstrap.sh` on the VPS.
- [ ] Copy `docker-compose.prod.yml` and a filled `.env` into `/opt/pankajpramanik`.
- [ ] Start the stack, then reload the shared proxy.
- [ ] Seed once from a checkout, then change the seeded admin password.
- [ ] Add a `pg_dump` cron writing off this VPS. Nothing backs up Postgres today.
- [ ] Once pankajpramanik.com is verified live, retire JourneyMesh — either the Actions
      workflow or `CONFIRM=REMOVE-JOURNEYMESH bash deploy/decommission-journeymesh.sh`.
- [ ] After that, with every site on a real domain and certificate: uncomment
      `Strict-Transport-Security` in the shared `(common)` snippet, and set `ACME_EMAIL`
      in `/opt/proxy/.env` for expiry warnings. Both were held back only because
      JourneyMesh served plain HTTP on a bare IP.

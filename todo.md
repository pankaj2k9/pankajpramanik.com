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

## Track A — Custom cursor ✅ done

`src/components/site/CustomCursor.tsx`, mounted once in the root layout. The two
theme variants are defined entirely in CSS, so the component never reads
`data-theme` and a theme switch cross-fades for free.

### A1. Base behaviour

- [x] Renders only when `(pointer: fine)` matches. Touch devices get nothing at all.
- [x] Two layers: a dot that tracks exactly, a ring that lags.
- [x] Lag driven by `gsap.quickTo`, which reuses one tween instead of allocating
      per `mousemove`.
- [x] Transform-only positioning. No layout on any frame.
- [x] `pointer-events: none`, `z-index: 9999`, above the fixed header and the scene.
- [x] `cursor: none` applied from the component, never from the stylesheet, so a
      JS failure cannot leave a visitor with no pointer.
- [x] Hides on document leave, returns on enter.
- [x] A third layer carries the label. Inside the ring it would be smeared by the
      squash.

### A2. Two distinct designs

- [x] **Dark — phosphor probe.** Hollow accent ring, 1.5px stroke, glow, solid
      core, `mix-blend-mode: screen`.
- [x] **Light — ink blot.** Filled `#1e1b4b` body, no border, `multiply`,
      `blur(2px)`, plus velocity-driven squash-and-stretch along the direction of
      travel.
- [x] Cross-fades on theme switch through transitions on the token-driven rules.
- [x] Both variants are custom properties in `globals.css`; the component only
      toggles state classes.

### A3. Hover states

- [x] Links and buttons: ring opens to 64px, core fades out.
- [x] Cards: ring fills to 76px and carries a mono word, via `data-cursor="Read"`
      / `data-cursor="View"`. Any element can opt in without the component
      knowing about it.
- [x] Text inputs and textareas: collapse to a 2px I-beam.
- [x] Music toggle reads `PLAY` / `PAUSE`, and the mute button `MUTE` / `UNMUTE`.
- [x] Magnetic pull on `[data-magnetic]` CTAs, elastic return on leave.
- [x] Click feedback: the core swells and the ring brightens on `pointerdown`.

### A4. Guard rails

- [x] Disabled under `prefers-reduced-motion: reduce`; native cursor returns.
- [x] Never active on `/admin`.
- [x] Explicit `:focus-visible` outline added for every interactive element, so
      the cursor is never the only affordance a keyboard user has.
- [x] Sits above the Three.js canvas and swallows no pointer events.

### A5. Fluid trail — skipped, deliberately

- [x] Decided against the WebGL fluid canvas. The homepage already runs a
      Three.js context; a second one with a 1440px dye texture is a real cost on
      integrated GPUs for an effect the velocity squash already suggests.
      Revisit only if the ink feel is judged insufficient in a browser.

---

## Track B — Smooth scrolling ✅ done

All three defects were real, not matters of taste.

- [x] **Two rAF loops.** `autoRaf: true` ran a Lenis loop alongside GSAP's ticker,
      so Lenis and ScrollTrigger sampled scroll position at different moments in
      the same frame. Now `autoRaf: false`, with `gsap.ticker` driving
      `lenis.raf(time * 1000)`.
- [x] `gsap.ticker.lagSmoothing(0)`, so GSAP stops fabricating a catch-up frame
      after a long task and lurching the page.
- [x] **Reveals undid themselves.** `play reverse play reverse` faded every block
      back out on the way past. Now `once: true`.
- [x] Reveals batched with `ScrollTrigger.batch` and `stagger: 0.09` — one trigger
      for the set instead of one per element.
- [x] Reveal retuned: `y: 34` plus `scale: 0.98`, 0.64s on `power2.out`.
- [x] `lerp: 0.09`, `wheelMultiplier: 1`. The old 0.16 with 1.25 overshot.
- [x] `syncTouch: false` — touch scrolls natively rather than fighting iOS momentum.
- [x] In-page anchors routed through `lenis.scrollTo()` with an `-80` offset.
      Native `scrollIntoView` is inert while Lenis runs.
- [x] `ScrollTrigger.refresh()` after `document.fonts.ready` and after every
      pending image settles.
- [x] `ScrollTrigger.config({ ignoreMobileResize: true })`.
- [x] **The homepage had no smooth scrolling at all.** Its sections lived in a
      nested scroll-snap `overflow-y-auto` element that window-attached Lenis
      never touched. Snap is gone, the scene is `fixed` behind a normally
      scrolling page, and `/` now shares one Lenis with every other route.
- [x] `ScrollFX` hoisted from the site layout to the root layout, so exactly one
      instance exists across both route groups.
- [x] `src/lib/lenis.ts` exposes the instance, so components scroll through Lenis
      instead of calling `scrollIntoView` and getting a jump.
- [x] The homepage header was `absolute` inside a non-scrolling wrapper, which
      only looked fixed. Now genuinely `fixed`, or it would have scrolled away.

---

## Track C — Audio, both themes ✅ done

- [x] The control is now a pill on `bg-surface` with a `border-border-strong`
      edge, so it reads correctly on the light theme's near-white background
      rather than assuming a dark ground.
- [x] Correction to an earlier note: the equalizer bars were already using the
      `bg-accent` token and did follow the theme. The surface was the real gap.
- [x] Pause and mute are now separate controls. Pausing stops and remembers the
      position; muting silences a track that keeps running.
- [x] Visible track title and subtitle, `aria-hidden` since the buttons are
      already labelled, and hidden below `sm`.
- [x] Real level meter from an `AnalyserNode` (`fftSize: 64`), written straight to
      the bars' inline height. Falls back permanently to the CSS equalizer if the
      Web Audio graph cannot be built.
- [x] `createMediaElementSource` guarded — it can only be called once per element
      and re-routes audio, so it connects on to the destination or playback would
      go silent.
- [x] The suspended `AudioContext` is resumed after the first gesture.
- [x] Meter disabled under `prefers-reduced-motion`; the autoplay-after-gesture
      behaviour is unchanged.
- [x] No collision with the cursor label, which follows the pointer rather than
      sitting bottom-right.

---

## Track D — Micro-interactions ✅ done

Behaviour only. The indigo → violet → pink palette is untouched.

- [x] Cursor-tracked radial glow inside every `.card`, painted from `--mx` /
      `--my`. Set by one delegated listener in `CardFX.tsx` rather than a handler
      per card, so the cards stay server components.
- [x] Diagonal sheen sweeping across a card on hover over 0.72s.
- [x] A 2px accent line running along a card's top edge on hover.
- [x] Mono uppercase micro-labels. The `micro-label` class replaced the repeated
      inline eyebrow across all seven interior pages.
- [x] Nav links get the terminal `>_` prefix that types in with
      `steps(2, end)`, plus an underline that scales from the left and stays lit
      on the current page.
- [x] Availability ticker on the homepage, reusing the existing `marquee`
      keyframes, with `✦` separators.
- [x] Counters that animate up on first view, in `Counter.tsx`. The final value is
      server-rendered, so the real number is in the HTML without JavaScript.
- [x] Staggered mobile menu entrance, 45ms per item.
- [x] Glow and sheen also trigger on `:focus-within`, so keyboard users get them.

### Known remaining

- [ ] `SectionHeading` in `cards.tsx` gained an optional numbered `index` prop but
      is not imported anywhere. Either adopt it on the interior pages or delete it.
- [ ] Visual pass in a real browser, both themes: the light-theme ink blot over
      images, and contrast of `micro-label` at 0.72rem against `--background`.
- [ ] `docker-compose.yml` dev ports are now `${DB_PORT:-5433}` and
      `${REDIS_PORT:-6380}`. 5433 collides with `journeymesh-dev-db` on this
      machine, so local work needs `DB_PORT=5434` until that is retired.

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

# Remote Data & AI Outreach Agent — Architecture Plan

Status: **design only, nothing implemented**. This document is the decision record to build from.

Target repo: `pankajpramanik` (Next.js 16.3.5, React 19, Prisma 6, PostgreSQL 16, Redis 7, Resend, next-auth v5).

---

## 1. What this system is

An operator-controlled agent that finds up to **5** remote Data/AI opportunities per run, identifies a decision-maker, verifies a business email, drafts a personalized email plus a tailored cover letter and CV, and then **stops and waits for a human**. Sending is a separate, explicitly approved action.

The success condition is *5 well-researched drafts awaiting approval*, not 5 emails sent.

---

## 2. Constraints discovered during research

These shape the design more than anything in the spec. Read this section first.

### 2.1 The free email-discovery tier is the binding limit

Hunter.io's free plan is **25 search credits and 50 verification credits per month**. At 5 contacts per run that is roughly **5 runs per month**, and only if every lookup succeeds on the first try. Realistically it is 3–4 runs.

This is the single biggest cost driver in the system. Options:

| Provider | Free tier | Paid entry |
|---|---|---|
| Hunter.io | 25 finds + 50 verifies / mo | $49/mo (500 finds, 1,000 verifies) |
| Snov.io | 50 credits / mo | $39/mo |
| Apollo.io | Free tier, email credits under fair-use | $49/user/mo |

**Recommendation:** build against a `EmailProvider` interface with Hunter as the first adapter, so swapping or stacking providers is a config change. Track credit consumption in the database and surface remaining credits on the dashboard — otherwise a run will fail halfway through for a reason that is invisible.

### 2.2 Cold outreach is legal here, but conditionally

B2B cold email to a business address is lawful in the US (CAN-SPAM), UK/EU (GDPR Article 6(1)(f) legitimate interest), Canada (CASL) and Australia, **provided** the message identifies the sender honestly, is relevant to the recipient's professional role, and honors opt-out.

Material exceptions:
- **Germany** expects double opt-in even for B2B. Treat German-domiciled companies as out of scope, or accept the risk knowingly.
- Penalties are not nominal: CAN-SPAM is up to ~$53,000 **per email**; GDPR up to €20M or 4% of turnover.

Design consequences, all mandatory:
- Every sent email carries a genuine identity (real name, real site, real reply-to) and a one-line opt-out.
- `do_not_contact` is enforced **server-side at send time**, not just in the UI.
- Store the lawful-basis rationale per contact (role relevance) — that is the legitimate-interest paper trail.
- Applying to an *advertised* position is the safest category. Prefer it. Unsolicited pitches to companies with no open role carry more risk and should be a separate, clearly-labelled mode.

### 2.3 LinkedIn scraping is off the table

The spec mentions "public professional profiles". Automated LinkedIn scraping violates their terms and will get the account banned. Use provider APIs (Hunter/Apollo return LinkedIn URLs as *data*) and company career pages. Store `linkedin_url` when a provider hands it over; never crawl for it.

### 2.4 LangGraph's Postgres checkpointer and Prisma will collide

`@langchain/langgraph-checkpoint-postgres` (`PostgresSaver`) creates and migrates **its own tables** via `.setup()`. Prisma does not know about them, so `prisma migrate dev` will see them as drift and offer to drop them.

**Fix:** give the checkpointer its own Postgres schema and exclude it from Prisma.

```
DATABASE_URL="postgresql://...?schema=public"
LANGGRAPH_CHECKPOINT_URL="postgresql://...?schema=langgraph"
```

Prisma owns `public`. LangGraph owns `langgraph`. Neither migrates the other. Verify with `prisma migrate diff` before the first deploy.

### 2.5 LLM model id is unconfirmed

You said "OpenAI 5.6, cheapest model". I could not confirm that model id, so the plan does not hardcode one. Model comes from `OPENAI_MODEL` env var, and the LLM sits behind an `LlmProvider` interface. **Set that variable to the exact model string before the first run.**

---

## 3. Runtime topology

The agent cannot live inside a Next.js request. A run takes minutes, survives restarts, and must be resumable. A request handler is the wrong lifetime.

```
┌──────────────────────┐        ┌────────────────────────┐
│  Next.js app         │        │  agent-worker          │
│  (existing container)│        │  (new container)       │
│                      │        │                        │
│  /admin/outreach     │        │  LangGraph run loop    │
│   dashboard          │        │  Tavily / job boards   │
│  /api/outreach/*     │        │  Hunter / OpenAI       │
│   control + approve  │        │  CV + letter builders  │
│  Resend send action  │        │                        │
└──────────┬───────────┘        └───────────┬────────────┘
           │                                │
           │      ┌──────────────────┐      │
           └─────▶│  PostgreSQL      │◀─────┘
                  │  public schema   │  Prisma models
                  │  langgraph schema│  checkpoints
                  └──────────────────┘
                  ┌──────────────────┐
                  │  Redis           │  control signals, rate limits
                  └──────────────────┘
```

**Why a separate container:** the app container is fronted by a healthcheck and restarted on deploy. A long agent run inside it dies on every redeploy. The worker restarts independently and resumes from its last checkpoint.

It joins the existing `internal` network in `docker-compose.prod.yml` and needs **no** `proxy` network membership — it is never reached from outside.

**Control channel:** the dashboard writes the desired state to Postgres (`OutreachRun.status`). The worker reads it. Redis carries an optional pub/sub nudge so a STOP is felt within a second instead of at the next node boundary. Postgres is the source of truth; Redis is only a latency optimization.

---

## 4. Data model

New Prisma models in `public`. Conventions follow the existing schema: `cuid()` ids, `createdAt`/`updatedAt`, uppercase enums, comments on anything non-obvious.

```prisma
enum AgentStatus {
  STOPPED
  RUNNING
  PAUSED
  COMPLETED
  ERROR
}

enum ApprovalStatus {
  DRAFT
  AWAITING_APPROVAL
  APPROVED
  REJECTED
}

enum SendStatus {
  NOT_SENT
  QUEUED
  SENT
  FAILED
}

enum EmailVerification {
  VALID
  RISKY
  UNKNOWN
  INVALID
}

enum ReplyClass {
  POSITIVE
  INTERVIEW_REQUEST
  NEUTRAL
  NOT_NOW
  WRONG_PERSON
  NEGATIVE
  OUT_OF_OFFICE
  UNSUBSCRIBE
  OTHER
}

model OutreachRun {
  id             String        @id @default(cuid())
  status         AgentStatus   @default(STOPPED)
  targetCount    Int           @default(5)
  qualifiedCount Int           @default(0)
  // LangGraph thread id. Resume replays from this thread's latest checkpoint.
  threadId       String        @unique
  // Last error surfaced to the dashboard when status is ERROR.
  lastError      String?
  startedAt      DateTime?
  pausedAt       DateTime?
  resumedAt      DateTime?
  stoppedAt      DateTime?
  completedAt    DateTime?
  opportunities  Opportunity[]
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@index([status, createdAt])
}

model Opportunity {
  id       String      @id @default(cuid())
  run      OutreachRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  runId    String

  companyName String
  companyUrl  String?
  jobTitle    String
  jobUrl      String
  jobSource   String
  // Raw description kept verbatim — it is the grounding corpus for the draft.
  jobDescription String
  remoteStatus   String

  matchScore  Int
  // Per-dimension breakdown, so a score is auditable rather than a bare number.
  matchBreakdown Json
  matchReason    String

  contactName    String?
  contactTitle   String?
  contactEmail   String?
  emailSource    String?
  emailVerification EmailVerification?
  linkedinUrl    String?

  emailSubject String?
  emailBody    String?
  coverLetter  String?
  // Storage path under STORAGE_DIR, same convention as uploads.
  cvFilePath   String?
  cvVersion    String?

  attachCv          Boolean @default(true)
  attachCoverLetter Boolean @default(false)

  approvalStatus ApprovalStatus @default(DRAFT)
  approvedAt     DateTime?
  sendStatus     SendStatus     @default(NOT_SENT)
  sentAt         DateTime?
  messageId      String?
  // Exact bytes sent, frozen at send time for the audit trail.
  sentSubject String?
  sentBody    String?

  replyStatus ReplyClass?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  // Dedupe keys. Partial-unique behavior is enforced in application code
  // because the same company may legitimately appear across different runs.
  @@unique([runId, jobUrl])
  @@index([contactEmail])
  @@index([approvalStatus, sendStatus])
  @@index([companyName])
}

// Global suppression list. Checked before drafting AND again before sending.
model DoNotContact {
  id        String   @id @default(cuid())
  email     String   @unique
  domain    String?
  reason    String
  createdAt DateTime @default(now())

  @@index([domain])
}

// Append-only audit of every state transition and external call.
model OutreachEvent {
  id            String   @id @default(cuid())
  runId         String?
  opportunityId String?
  kind          String
  payload       Json
  createdAt     DateTime @default(now())

  @@index([runId, createdAt])
  @@index([opportunityId, createdAt])
}
```

**Note on dedupe:** the spec wants "has this person/company/job been contacted before" across *all* runs. `@@unique([runId, jobUrl])` only guards within a run. Cross-run dedupe is a query against `contactEmail` and `companyName` plus `DoNotContact`, run as an explicit node. Do not try to express it as a database constraint.

---

## 5. The graph

`@langchain/langgraph` + `@langchain/langgraph-checkpoint-postgres`. `thread_id = OutreachRun.threadId`.

```
                    ┌──────────────────────────┐
  START ──▶ loadProfile ──▶ loadMasterCv ──▶ searchOpportunities
                                                      │
                                                      ▼
                                             ┌──▶ pickNext ──┐
                                             │               │ none left
                              (loop back)    │               ▼
                                             │            finish
                                             ▼
                                        dedupeCheck
                                             │ fresh
                                             ▼
                                        scoreOpportunity
                                             │ >= 80
                                             ▼
                                        researchCompany
                                             ▼
                                        findDecisionMaker
                                             ▼
                                        findBusinessEmail
                                             ▼
                                        verifyEmail ──── INVALID ──▶ reject
                                             │ VALID
                                             ▼
                                        buildTailoredCv
                                             ▼
                                        buildCoverLetter
                                             ▼
                                        buildEmailDraft
                                             ▼
                                        groundingCheck ── fail ──▶ reject
                                             │ pass
                                             ▼
                                        persistDraft
                                             ▼
                                      qualifiedCount += 1
                                             │
                                   count < 5 ┴ count == 5 ──▶ COMPLETED
```

**State check placement.** The spec says "check agent status before every major step". Implement this as a wrapper, not as separate nodes:

```ts
const guarded = (name: string, fn: NodeFn): NodeFn => async (state) => {
  const status = await currentStatus(state.runId);
  if (status === "STOPPED") throw new AgentStopped();
  if (status === "PAUSED") throw new AgentPaused();   // checkpoint persists; resume continues
  return fn(state);
};
```

`AgentPaused` is caught by the run loop, which exits cleanly leaving the checkpoint intact. RESUME re-invokes the graph on the same `thread_id` and LangGraph replays from the last completed node. STOP additionally marks the run `STOPPED` and does not resume without an explicit action.

**Rejection is not an error.** A sub-80 score, an INVALID email or a failed grounding check routes to a `reject` node that records an `OutreachEvent` and returns to `pickNext`. Only infrastructure failures raise.

---

## 6. Anti-fabrication design — the part that matters most

The spec says "never invent" eleven times. Prompt instructions alone will not achieve that. The architecture has to make fabrication structurally difficult.

### 6.1 Convert the master CV to structured JSON, once

`public/Pankaj_Kumar_Pramanik_AI_Data_Engineer_CV.pdf` is the master, but PDF text is a bad grounding source — extraction is lossy and an LLM handed loose text will smooth over gaps.

Instead, build `prisma/content/master-cv.json` once, by hand, reviewed by you:

```json
{
  "roles": [{ "company": "...", "title": "...", "start": "2023-01", "end": "2024-06",
              "bullets": ["..."], "tech": ["Python", "LangGraph"] }],
  "projects": [{ "slug": "...", "title": "...", "summary": "...", "tech": [...] }],
  "skills": { "languages": [...], "data": [...], "ai": [...], "cloud": [...] },
  "education": [...],
  "certifications": [...]
}
```

Much of this already exists in the database — `Experience`, `Project`, `SkillGroup`, `Education`, `Certification` models are populated. **Derive the JSON from those tables** and treat the PDF as a cross-check. That makes the site and the CV share one source of truth.

### 6.2 Tailoring is selection, not generation

This is the key rule. The tailored CV is built by **filtering and reordering** structured records. No LLM writes a bullet point, a date, an employer or a metric.

The LLM is allowed to generate exactly two pieces of prose:
1. the professional summary paragraph, and
2. the email and cover letter body,

and both are constrained to facts present in the structured CV plus the job description.

### 6.3 The grounding check is mechanical

`groundingCheck` is not "ask the model if it made anything up". It is:

- **Entity allow-list:** extract every company name, job title, date, technology and number from the generated prose. Every one must appear in the structured CV or the job description. Anything else fails the check.
- **Numeric guard:** reject any figure — "8 years", "40% faster", "10M rows" — not literally present in the source. This catches the most damaging class of hallucination.
- **Recipient guard:** the recipient's name, title and company must match the provider-returned record character for character.

Failures route to `reject` with the offending span recorded. Do not retry more than once; a second failure means the opportunity is dropped.

### 6.4 CV rendering

No PDF library in the repo today. Recommend **`@react-pdf/renderer`** — pure JavaScript, no headless browser, renders from the structured JSON, deterministic output.

Rejected alternative: Playwright HTML→PDF. It is already a devDependency, but shipping Chromium into the production image for this is disproportionate.

Write to `STORAGE_DIR` (`/app/storage`, the existing bind mount) under `outreach/<runId>/<opportunityId>.pdf`, so generated CVs survive redeploys exactly like uploads do. Store `cvVersion` as a content hash so approval can assert the file did not change after review.

---

## 7. Providers

| Concern | Choice | Auth | Notes |
|---|---|---|---|
| Web research | **Tavily** | API key | Confirmed with you. Company research, decision-maker discovery. |
| Job listings | **Himalayas** public JSON API | none | Free, no key, supports keyword/country/seniority/timezone filters. |
| Job listings | **Remotive**, **Arbeitnow** | none | Free JSON feeds. Use as breadth. |
| Job listings | Apify aggregators | key | ~$0.50–2.00 per 1,000 jobs. Only if the free feeds prove thin. |
| Email find + verify | **Hunter.io** | API key | Free tier is the bottleneck — see §2.1. |
| LLM | **OpenAI** | API key | Model from `OPENAI_MODEL`. **Unconfirmed — you must set it.** |
| Sending | **Resend** | API key | Already a dependency and already wired for booking mail. |
| PDF | `@react-pdf/renderer` | — | New dependency. |

All behind interfaces in `src/lib/outreach/providers/`, so each is swappable and mockable in tests.

New environment variables, server-side only, never exposed to the client:

```
TAVILY_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=
HUNTER_API_KEY=
LANGGRAPH_CHECKPOINT_URL=
OUTREACH_SENDER="me@pankajpramanik.com"
OUTREACH_ENABLED=false     # global kill switch, defaults off
```

Add to `.env.example` and `.env.production.example` with empty values. `.env` is already in `.dockerignore`.

---

## 8. Approval and send pipeline

```
DRAFT ──▶ AWAITING_APPROVAL ──▶ APPROVED ──▶ SENT
```

`DRAFT → SENT` must be unreachable. Enforce in a single `transitionApproval()` function that is the only writer of `approvalStatus`; reject any transition not in the allowed set.

The send endpoint re-validates everything server-side. The dashboard's opinion is not trusted:

```ts
// POST /api/outreach/[id]/send — all seven must hold
approvalStatus === "APPROVED"
emailVerification === "VALID"
(await doNotContact(email)) === false
sendStatus === "NOT_SENT"           // idempotency: never double-send
process.env.OUTREACH_ENABLED === "true"
recipient === approvedSnapshot.recipient
subject === approvedSnapshot.subject && body === approvedSnapshot.body
```

The last check is why `sentSubject`/`sentBody` exist: freeze the approved text at approval time, compare at send time, persist the exact bytes after. If any check fails, do not send — record an `OutreachEvent` and surface the reason.

Route protection is already solved: `src/proxy.ts` matches `/admin/:path*` and `next.config.ts` sets `X-Robots-Tag: noindex, nofollow` on the same prefix. Put the dashboard at `/admin/outreach` and it inherits both. The API routes need their own `auth()` check — the proxy matcher does not cover `/api`.

Rate limiting: reuse `src/lib/rate-limit.ts`. Cap sends per hour and per day regardless of approvals, as a blast-radius limit against a UI mistake.

---

## 9. Dashboard

`/admin/outreach`, inside the existing admin layout.

- **Run header** — status pill, `Qualified: 3 / 5`, credits remaining, elapsed time, and the contextual control: START / STOP / RESUME / START NEW RUN.
- **Opportunity cards** — every field from the spec's card list, with the match breakdown rendered per dimension rather than as a bare score.
- **Actions** — view job/company/research/contact source, edit subject and body, view and edit cover letter, view and download CV, toggle the two attachment switches, approve, reject, approve & send, mark do-not-contact.
- **Live updates** — poll `/api/outreach/runs/active` every few seconds. Server-Sent Events are nicer, but polling is simpler and a run emits an event every 20–60 seconds. Do not reach for websockets.

Editing an approved draft must reset it to `AWAITING_APPROVAL` and invalidate the frozen snapshot. Otherwise the send-time equality check would compare against stale text.

---

## 10. Build phases

Each phase ends somewhere you could stop and still have something coherent.

1. **Schema + control plane.** Prisma models, migration, `/api/outreach` control routes, dashboard shell with a status pill and START/STOP that move a row between states. No agent yet. Proves the state machine.
2. **Structured CV.** Derive `master-cv.json` from the existing `Experience` / `Project` / `SkillGroup` / `Education` / `Certification` tables, cross-check against the PDF, review by hand. Everything downstream grounds on this.
3. **Provider adapters + tests.** Tavily, Himalayas, Hunter, OpenAI, each behind an interface with recorded fixtures. No graph yet.
4. **Graph, read-only.** Nodes through `scoreOpportunity`. Run it and inspect what it finds and how it scores. **Calibrate the 80 threshold here, against real listings.** The threshold is a guess until it has seen data.
5. **Contact + drafting.** `findDecisionMaker` through `buildEmailDraft`, plus `groundingCheck`. Still nothing sendable.
6. **CV rendering.** `@react-pdf/renderer`, storage paths, versioning.
7. **Approval + send.** The seven gates, Resend integration, audit persistence. `OUTREACH_ENABLED` stays `false` until you have manually inspected a full run.
8. **Worker container.** Add `agent-worker` to both compose files, checkpoint resume across restarts, deploy.
9. **Replies.** Optional and last. Inbound webhook, classification, `REPLY_DRAFT` records. The spec correctly says never auto-reply.

Phases 1–5 are usable from a local `tsx` script before the worker container exists. Build the container when the graph is stable, not before.

---

## 11. Decisions I need from you

1. **`OPENAI_MODEL`** — the exact model id. "5.6" is not one I can verify.
2. **Email provider budget** — accept ~3–4 runs/month on Hunter's free tier, or budget $39–49/month? This determines whether the system is usable weekly or monthly.
3. **Advertised roles only, or also unsolicited pitches?** Advertised is lower legal risk and higher reply rates. Recommend starting there.
4. **Germany** — exclude German-domiciled companies, or accept the double-opt-in risk?
5. **Scoring weights** — the spec's eight dimensions sum to exactly 100 and the bar is 80. That is strict: an opportunity has to be near-perfect. Confirm you want it that tight, or plan to calibrate in phase 4.
6. **Reply handling** — in scope now, or defer?

---

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Hallucinated employer/metric in a sent email | Reputational, hard to undo | §6 grounding check; selection-not-generation; human approval |
| Wrong recipient — email belongs to someone else | Wasted credit, bad impression | Verify VALID only; recipient guard; role-relevance check |
| Provider credits exhausted mid-run | Run dies opaquely | Track credits in DB, pre-flight check, surface on dashboard |
| Prisma drops LangGraph tables | Total checkpoint loss | Separate `langgraph` schema (§2.4); verify with `migrate diff` |
| Double-send on retry | Duplicate email to a real person | `sendStatus` idempotency gate; unique `messageId` |
| Redeploy kills a run | Lost work | Checkpointer + separate worker container |
| Cold email complaint | Legal exposure | §2.2 — honest identity, opt-out, suppression list, prefer advertised roles |

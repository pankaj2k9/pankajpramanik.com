import type { AgentStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { configGaps } from "@/lib/outreach/env";
import { HEARTBEAT_STALE_SECONDS, latestRun, liveness } from "@/lib/outreach/state";
import { dailyLimit, qualifiedToday, timezone } from "@/lib/outreach/quota";
import { formatDate } from "@/lib/utils";
import OutreachControls from "@/components/admin/OutreachControls";

export const metadata = { title: "Outreach agent" };

// Control-plane state changes from the worker, so never serve a cached page.
export const dynamic = "force-dynamic";

const TONE: Record<AgentStatus, string> = {
  RUNNING: "border-accent text-accent",
  PAUSED: "border-border text-muted",
  STOPPED: "border-border text-muted",
  COMPLETED: "border-accent text-accent",
  ERROR: "border-red-500 text-red-500",
};

export default async function AdminOutreachPage() {
  await requireAdmin();

  const run = await latestRun();
  const events = run
    ? await prisma.outreachEvent.findMany({
        where: { runId: run.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  const live = run ? liveness(run) : "IDLE";
  const gaps = configGaps();
  const today = await qualifiedToday();
  const limit = dailyLimit();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Outreach agent</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Finds remote Data &amp; AI opportunities and prepares drafts. Nothing is
        ever sent without your explicit approval.
      </p>

      <section className="card mt-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1 text-sm ${run ? TONE[run.status] : "border-border text-muted"}`}
            >
              {run?.status ?? "NO RUNS YET"}
            </span>
            {run && (
              <span className="text-sm text-muted">
                Qualified: {run.qualifiedCount} / {run.targetCount}
              </span>
            )}
            <span className="text-sm text-muted">
              Today: {today} / {limit}
            </span>
            {live === "WORKING" && (
              <span className="text-sm text-accent">Worker active</span>
            )}
          </div>
          <OutreachControls
            runId={run?.id ?? null}
            status={run?.status ?? null}
            targetCount={run?.targetCount ?? 5}
            qualifiedCount={run?.qualifiedCount ?? 0}
          />
        </div>

        {/*
          The status above is what was ASKED for. This says whether anything is
          actually happening — otherwise a down or undeployed worker reads as
          progress forever.
        */}
        {live === "NO_WORKER" && (
          <p role="status" className="mt-4 rounded-md border border-border p-3 text-sm">
            <strong>Marked RUNNING, but no worker is attached.</strong>{" "}
            {run?.workerSeenAt
              ? `Last seen ${formatDate(run.workerSeenAt)}; nothing for over ${HEARTBEAT_STALE_SECONDS}s.`
              : "No worker has ever checked in on this run."}{" "}
            The agent worker is not built yet, so this is expected — the run
            will sit here until it is.
          </p>
        )}

        {run?.lastError && (
          <p role="alert" className="mt-4 text-sm text-red-500">
            {run.lastError}
          </p>
        )}

        {today >= limit && (
          <p role="status" className="mt-4 rounded-md border border-border p-3 text-sm">
            <strong>Daily limit reached.</strong> {today} of {limit} collected
            today ({timezone()}). New runs are refused until tomorrow.
          </p>
        )}

        {gaps.length > 0 && (
          <p className="mt-4 rounded-md border border-border p-3 text-sm">
            <strong>Not ready to run.</strong> Missing configuration:{" "}
            <span className="font-mono text-xs">{gaps.join(", ")}</span>. See{" "}
            <span className="font-mono text-xs">.env.example</span>.
          </p>
        )}

        {run && (
          <dl className="mt-5 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-faint">Started</dt>
              <dd>{run.startedAt ? formatDate(run.startedAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-faint">Last change</dt>
              <dd>{formatDate(run.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-faint">Worker last seen</dt>
              <dd>{run.workerSeenAt ? formatDate(run.workerSeenAt) : "never"}</dd>
            </div>
            <div>
              <dt className="text-faint">Run id</dt>
              <dd className="truncate font-mono text-xs">{run.id}</dd>
            </div>
          </dl>
        )}
      </section>

      <h2 className="mt-10 font-display text-lg font-semibold">Opportunities</h2>
      <p className="mt-2 text-muted">
        No opportunities yet — the agent worker is not built.
      </p>

      {events.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-lg font-semibold">Activity</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 border-b border-border pb-2">
                <span className="text-faint">{formatDate(e.createdAt)}</span>
                <span className="font-mono text-xs">{e.kind}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

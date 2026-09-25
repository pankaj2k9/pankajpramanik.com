import type { AgentStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { latestRun } from "@/lib/outreach/state";
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

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Outreach agent</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Finds remote Data &amp; AI opportunities and prepares drafts. Nothing is
        ever sent without your explicit approval.
      </p>

      <section className="card mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
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
          </div>
          <OutreachControls runId={run?.id ?? null} status={run?.status ?? null} />
        </div>

        {run?.lastError && (
          <p role="alert" className="mt-4 text-sm text-red-500">
            {run.lastError}
          </p>
        )}

        {run && (
          <dl className="mt-5 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-faint">Started</dt>
              <dd>{run.startedAt ? formatDate(run.startedAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-faint">Last change</dt>
              <dd>{formatDate(run.updatedAt)}</dd>
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

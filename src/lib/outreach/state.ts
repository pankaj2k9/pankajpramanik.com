import { randomUUID } from "node:crypto";
import { AgentStatus, type OutreachRun, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Run lifecycle for the outreach agent.
 *
 * This module is the ONLY writer of OutreachRun.status. The dashboard and the
 * worker both go through `transition()`, so an illegal move fails in one place
 * instead of being re-checked (and eventually mis-checked) at each call site.
 *
 * Design record: docs/outreach-agent-architecture.md
 */

/** A run the worker may act on. Anything else is dormant. */
export const ACTIVE: AgentStatus[] = [AgentStatus.RUNNING, AgentStatus.PAUSED];

/** Terminal states. A new run is the only way forward from here. */
const TERMINAL: AgentStatus[] = [AgentStatus.COMPLETED];

/**
 * Legal moves. STOPPED and ERROR are resumable on purpose: the checkpoint
 * survives, so RESUME continues the graph rather than restarting the search.
 * COMPLETED is deliberately absent — it has no outgoing edge.
 */
const ALLOWED: Record<AgentStatus, AgentStatus[]> = {
  [AgentStatus.RUNNING]: [
    AgentStatus.PAUSED,
    AgentStatus.STOPPED,
    AgentStatus.COMPLETED,
    AgentStatus.ERROR,
  ],
  [AgentStatus.PAUSED]: [AgentStatus.RUNNING, AgentStatus.STOPPED],
  [AgentStatus.STOPPED]: [AgentStatus.RUNNING],
  [AgentStatus.ERROR]: [AgentStatus.RUNNING, AgentStatus.STOPPED],
  [AgentStatus.COMPLETED]: [],
};

/** Timestamp column to stamp when entering each state. */
const STAMP: Partial<Record<AgentStatus, keyof OutreachRun>> = {
  [AgentStatus.PAUSED]: "pausedAt",
  [AgentStatus.STOPPED]: "stoppedAt",
  [AgentStatus.COMPLETED]: "completedAt",
};

export class IllegalTransition extends Error {
  constructor(from: AgentStatus, to: AgentStatus) {
    super(`Cannot move an outreach run from ${from} to ${to}.`);
    this.name = "IllegalTransition";
  }
}

export class RunAlreadyActive extends Error {
  constructor(id: string) {
    super(`Run ${id} is still active. Stop it before starting another.`);
    this.name = "RunAlreadyActive";
  }
}

export function isActive(status: AgentStatus): boolean {
  return ACTIVE.includes(status);
}

export function isTerminal(status: AgentStatus): boolean {
  return TERMINAL.includes(status);
}

/** Moves the dashboard offers for a run in this state. */
export function availableMoves(status: AgentStatus): AgentStatus[] {
  return ALLOWED[status];
}

/** The single run the worker should be looking at, if any. */
export function activeRun() {
  return prisma.outreachRun.findFirst({
    where: { status: { in: ACTIVE } },
    orderBy: { createdAt: "desc" },
  });
}

/** Most recent run whatever its state — what the dashboard renders by default. */
export function latestRun() {
  return prisma.outreachRun.findFirst({ orderBy: { createdAt: "desc" } });
}

/**
 * Opens a new run. Refuses while another is RUNNING or PAUSED: two concurrent
 * runs would race on the qualified count and could double-contact a company.
 */
export async function startRun(targetCount = 5) {
  const existing = await activeRun();
  if (existing) throw new RunAlreadyActive(existing.id);

  const run = await prisma.outreachRun.create({
    data: {
      status: AgentStatus.RUNNING,
      targetCount,
      threadId: randomUUID(),
      startedAt: new Date(),
    },
  });
  await record(run.id, "run.started", { targetCount });
  return run;
}

/**
 * Moves a run to `next`, or throws.
 *
 * The update is conditional on the status we validated, so two dashboards
 * clicking at once cannot both win — the loser matches no row and retries
 * against fresh state.
 */
export async function transition(
  runId: string,
  next: AgentStatus,
  options: { error?: string } = {},
): Promise<OutreachRun> {
  const current = await prisma.outreachRun.findUniqueOrThrow({
    where: { id: runId },
  });
  if (current.status === next) return current;
  if (!ALLOWED[current.status].includes(next)) {
    throw new IllegalTransition(current.status, next);
  }

  const data: Prisma.OutreachRunUpdateInput = {
    status: next,
    lastError: next === AgentStatus.ERROR ? (options.error ?? null) : null,
  };
  const stamp = STAMP[next];
  if (stamp) Object.assign(data, { [stamp]: new Date() });
  // Resuming from any dormant state is a resume, not a fresh start.
  if (next === AgentStatus.RUNNING && current.status !== AgentStatus.RUNNING) {
    data.resumedAt = new Date();
  }

  const updated = await prisma.outreachRun.updateManyAndReturn({
    where: { id: runId, status: current.status },
    data,
  });
  if (updated.length === 0) {
    // Someone moved it underneath us. Re-read and let the caller decide.
    throw new IllegalTransition(current.status, next);
  }

  await record(runId, "run.transition", { from: current.status, to: next, ...options });
  return updated[0];
}

/**
 * Records one qualified opportunity and closes the run when the target is met.
 * The spec is explicit: stop at the target, do not look for one more.
 */
export async function countQualified(runId: string): Promise<OutreachRun> {
  const run = await prisma.outreachRun.update({
    where: { id: runId },
    data: { qualifiedCount: { increment: 1 } },
  });
  if (run.qualifiedCount >= run.targetCount) {
    return transition(runId, AgentStatus.COMPLETED);
  }
  return run;
}

/**
 * What the worker calls between nodes. Returns the live status so the caller
 * can stop or park itself; it never decides on the worker's behalf.
 */
export async function currentStatus(runId: string): Promise<AgentStatus> {
  const run = await prisma.outreachRun.findUniqueOrThrow({
    where: { id: runId },
    select: { status: true },
  });
  return run.status;
}

/** Append-only audit row. Never throws into the caller's path. */
export async function record(
  runId: string | null,
  kind: string,
  payload: Prisma.InputJsonValue,
  opportunityId?: string,
): Promise<void> {
  try {
    await prisma.outreachEvent.create({
      data: { runId, opportunityId, kind, payload },
    });
  } catch (error) {
    console.error("[outreach] failed to record event", kind, error);
  }
}

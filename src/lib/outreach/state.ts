import { randomUUID } from "node:crypto";
import { AgentStatus, type OutreachRun, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DailyLimitReached, QUALIFIED_EVENT, dailyLimit, remainingToday } from "./quota";

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

/** Sane bounds for a run target. One is useful for a smoke test. */
export const MIN_TARGET = 1;
export const MAX_TARGET = 25;

/**
 * A worker beats between graph nodes. Longer than the slowest single node,
 * short enough that a dead worker is obvious within a page refresh or two.
 */
export const HEARTBEAT_STALE_SECONDS = 90;

export class InvalidTarget extends Error {
  constructor(value: number) {
    super(`Target must be a whole number between ${MIN_TARGET} and ${MAX_TARGET}; got ${value}.`);
    this.name = "InvalidTarget";
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
/**
 * Opens a new run, clamped to what the daily cap still allows.
 *
 * Refuses while another is RUNNING or PAUSED: two concurrent runs would race
 * on the qualified count and could double-contact a company.
 */
export async function startRun(targetCount = 5) {
  assertValidTarget(targetCount);
  const existing = await activeRun();
  if (existing) throw new RunAlreadyActive(existing.id);

  // The per-run target cannot exceed what is left in the day's budget.
  const remaining = await remainingToday();
  if (remaining === 0) throw new DailyLimitReached(dailyLimit());
  const effective = Math.min(targetCount, remaining);

  const run = await prisma.outreachRun.create({
    data: {
      status: AgentStatus.RUNNING,
      targetCount: effective,
      threadId: randomUUID(),
      startedAt: new Date(),
    },
  });
  await record(run.id, "run.started", {
    requested: targetCount,
    targetCount: effective,
    remainingToday: remaining,
  });
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

export class TargetAlreadyMet extends Error {
  constructor(runId: string) {
    super(`Run ${runId} has already reached its target; refusing to qualify another.`);
    this.name = "TargetAlreadyMet";
  }
}

/**
 * Records one qualified opportunity and closes the run when the target is met.
 *
 * The count is NOT a blind increment. The spec forbids exceeding the target,
 * so this refuses once the goal is reached rather than overshooting, and the
 * update is conditional on the count it just read, so two workers finishing
 * at the same moment cannot both take the last slot.
 */
export async function countQualified(runId: string): Promise<OutreachRun> {
  const run = await prisma.outreachRun.findUniqueOrThrow({ where: { id: runId } });

  if (run.qualifiedCount >= run.targetCount) {
    // Already done. Make the state say so rather than silently going over.
    if (run.status === AgentStatus.RUNNING) {
      return transition(runId, AgentStatus.COMPLETED);
    }
    throw new TargetAlreadyMet(runId);
  }

  const updated = await prisma.outreachRun.updateManyAndReturn({
    where: { id: runId, qualifiedCount: run.qualifiedCount },
    data: { qualifiedCount: run.qualifiedCount + 1 },
  });
  if (updated.length === 0) {
    // Another worker claimed the slot between our read and write.
    throw new TargetAlreadyMet(runId);
  }

  const next = updated[0];
  // The daily cap counts these, so it must be written for every qualification.
  await record(runId, QUALIFIED_EVENT, { qualifiedCount: next.qualifiedCount });

  if (next.qualifiedCount >= next.targetCount) {
    return transition(runId, AgentStatus.COMPLETED);
  }
  return next;
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

export function assertValidTarget(value: number): void {
  if (!Number.isInteger(value) || value < MIN_TARGET || value > MAX_TARGET) {
    throw new InvalidTarget(value);
  }
}

/**
 * Changes how many opportunities a run is aiming for.
 *
 * Refused below the number already qualified: lowering the target under the
 * work already done would strand finished drafts outside the run's own goal.
 * Raising the target on a COMPLETED run reopens it, which is the whole point
 * of being able to edit it.
 */
export async function setTargetCount(
  runId: string,
  targetCount: number,
): Promise<OutreachRun> {
  assertValidTarget(targetCount);
  const run = await prisma.outreachRun.findUniqueOrThrow({ where: { id: runId } });
  if (targetCount < run.qualifiedCount) {
    throw new InvalidTarget(targetCount);
  }

  const reopen =
    run.status === AgentStatus.COMPLETED && targetCount > run.qualifiedCount;
  // Lowering the goal onto work already done means the run is finished now;
  // leaving it RUNNING would let it qualify one more and overshoot.
  const nowComplete = isActive(run.status) && targetCount <= run.qualifiedCount;

  const updated = await prisma.outreachRun.update({
    where: { id: runId },
    data: {
      targetCount,
      ...(reopen ? { status: AgentStatus.PAUSED, completedAt: null } : {}),
      ...(nowComplete
        ? { status: AgentStatus.COMPLETED, completedAt: new Date() }
        : {}),
    },
  });
  await record(runId, "run.target_changed", {
    from: run.targetCount,
    to: targetCount,
    reopened: reopen,
  });
  return updated;
}

/** Called by the worker between nodes to prove it is alive. */
export async function heartbeat(runId: string): Promise<void> {
  try {
    await prisma.outreachRun.update({
      where: { id: runId },
      data: { workerSeenAt: new Date() },
    });
  } catch (error) {
    console.error("[outreach] heartbeat failed", error);
  }
}

export type Liveness =
  /** State says RUNNING and a worker beat recently. */
  | "WORKING"
  /** State says RUNNING but no worker has beaten recently. Nothing is happening. */
  | "NO_WORKER"
  /** The run is not meant to be progressing. */
  | "IDLE";

/**
 * Distinguishes "we asked for a run" from "a run is actually happening".
 *
 * Without this the dashboard shows RUNNING forever whenever the worker is
 * down, stopped or not yet deployed, which reads as progress when there is
 * none.
 */
export function liveness(
  run: Pick<OutreachRun, "status" | "workerSeenAt">,
  now = new Date(),
): Liveness {
  if (run.status !== AgentStatus.RUNNING) return "IDLE";
  if (!run.workerSeenAt) return "NO_WORKER";
  const ageSeconds = (now.getTime() - run.workerSeenAt.getTime()) / 1000;
  return ageSeconds <= HEARTBEAT_STALE_SECONDS ? "WORKING" : "NO_WORKER";
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

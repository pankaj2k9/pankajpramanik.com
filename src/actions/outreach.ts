"use server";

import { revalidatePath } from "next/cache";
import { AgentStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import {
  IllegalTransition,
  InvalidTarget,
  RunAlreadyActive,
  setTargetCount,
  startRun,
  transition,
} from "@/lib/outreach/state";

/**
 * Dashboard controls for the outreach agent.
 *
 * These only move the run's state. The worker watches that state and does the
 * actual work, so STOP is felt at the next node boundary rather than killing
 * anything mid-flight.
 */

export type ControlResult = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/admin/outreach");
  revalidatePath("/admin");
}

/** Turns the state machine's exceptions into something the page can render. */
async function guard(run: () => Promise<unknown>): Promise<ControlResult> {
  try {
    await run();
    refresh();
    return { ok: true };
  } catch (error) {
    if (
      error instanceof RunAlreadyActive ||
      error instanceof IllegalTransition ||
      error instanceof InvalidTarget
    ) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function startOutreachRun(targetCount = 5): Promise<ControlResult> {
  await requireAdmin();
  return guard(() => startRun(targetCount));
}

/** Changes the goal of an existing run; may reopen a COMPLETED one. */
export async function setOutreachTarget(
  runId: string,
  targetCount: number,
): Promise<ControlResult> {
  await requireAdmin();
  return guard(() => setTargetCount(runId, targetCount));
}

export async function stopOutreachRun(runId: string): Promise<ControlResult> {
  await requireAdmin();
  return guard(() => transition(runId, AgentStatus.STOPPED));
}

export async function pauseOutreachRun(runId: string): Promise<ControlResult> {
  await requireAdmin();
  return guard(() => transition(runId, AgentStatus.PAUSED));
}

/** Continues from the saved checkpoint — it does not restart the search. */
export async function resumeOutreachRun(runId: string): Promise<ControlResult> {
  await requireAdmin();
  return guard(() => transition(runId, AgentStatus.RUNNING));
}

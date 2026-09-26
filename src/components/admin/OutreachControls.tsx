"use client";

import { useState, useTransition } from "react";
import type { AgentStatus } from "@prisma/client";
import {
  pauseOutreachRun,
  resumeOutreachRun,
  setOutreachTarget,
  startOutreachRun,
  stopOutreachRun,
  type ControlResult,
} from "@/actions/outreach";

const MIN_TARGET = 1;
const MAX_TARGET = 25;

type Props = {
  runId: string | null;
  status: AgentStatus | null;
  targetCount: number;
  qualifiedCount: number;
};

/**
 * START / STOP / PAUSE / RESUME plus the run target.
 *
 * Which buttons appear is derived from the run's state, so the UI cannot
 * offer a move the state machine would reject.
 */
export default function OutreachControls({
  runId,
  status,
  targetCount,
  qualifiedCount,
}: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState(targetCount);

  const run = (action: () => Promise<ControlResult>) => () => {
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  };

  const idle = !runId || status === "COMPLETED";
  const buttons: { label: string; onClick: () => void; primary?: boolean }[] = [];

  if (idle) {
    buttons.push({
      label: status === "COMPLETED" ? "Start new run" : "Start agent",
      onClick: run(() => startOutreachRun(target)),
      primary: true,
    });
  } else if (status === "RUNNING") {
    buttons.push({ label: "Pause", onClick: run(() => pauseOutreachRun(runId)) });
    buttons.push({ label: "Stop", onClick: run(() => stopOutreachRun(runId)) });
  } else if (status === "PAUSED") {
    buttons.push({ label: "Resume", onClick: run(() => resumeOutreachRun(runId)), primary: true });
    buttons.push({ label: "Stop", onClick: run(() => stopOutreachRun(runId)) });
  } else {
    // STOPPED or ERROR — both continue from the saved checkpoint.
    buttons.push({ label: "Resume", onClick: run(() => resumeOutreachRun(runId)), primary: true });
    buttons.push({ label: "Start new run", onClick: run(() => startOutreachRun(target)) });
  }

  // Lowering the goal below work already done would strand finished drafts.
  const floor = runId && !idle ? Math.max(MIN_TARGET, qualifiedCount) : MIN_TARGET;
  const changed = target !== targetCount;

  return (
    <div className="flex flex-col items-start gap-3 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="outreach-target" className="text-sm text-muted">
          Target
        </label>
        <input
          id="outreach-target"
          type="number"
          min={floor}
          max={MAX_TARGET}
          value={target}
          disabled={pending}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="w-16 rounded-md border border-border bg-transparent px-2 py-1 text-sm"
        />
        {runId && changed && (
          <button
            type="button"
            onClick={run(() => setOutreachTarget(runId, target))}
            disabled={pending}
            className="rounded-full border border-accent px-3 py-1 text-sm text-accent disabled:opacity-50"
          >
            Save target
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={b.onClick}
            disabled={pending}
            className={`rounded-full border px-4 py-1.5 text-sm disabled:opacity-50 ${
              b.primary ? "border-accent text-accent" : "border-border text-muted"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

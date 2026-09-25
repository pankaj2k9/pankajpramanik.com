"use client";

import { useState, useTransition } from "react";
import type { AgentStatus } from "@prisma/client";
import {
  pauseOutreachRun,
  resumeOutreachRun,
  startOutreachRun,
  stopOutreachRun,
  type ControlResult,
} from "@/actions/outreach";

type Props = { runId: string | null; status: AgentStatus | null };

/**
 * START / STOP / PAUSE / RESUME. Which buttons appear is derived from the
 * run's state, so the UI cannot offer a move the state machine would reject.
 */
export default function OutreachControls({ runId, status }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<ControlResult>) => () => {
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  };

  const buttons: { label: string; onClick: () => void; primary?: boolean }[] = [];

  if (!runId || status === "COMPLETED") {
    buttons.push({
      label: status === "COMPLETED" ? "Start new run" : "Start agent",
      onClick: run(startOutreachRun),
      primary: true,
    });
  } else if (status === "RUNNING") {
    buttons.push({ label: "Pause", onClick: run(() => pauseOutreachRun(runId)) });
    buttons.push({ label: "Stop", onClick: run(() => stopOutreachRun(runId)) });
  } else if (status === "PAUSED") {
    buttons.push({
      label: "Resume",
      onClick: run(() => resumeOutreachRun(runId)),
      primary: true,
    });
    buttons.push({ label: "Stop", onClick: run(() => stopOutreachRun(runId)) });
  } else {
    // STOPPED or ERROR — both continue from the saved checkpoint.
    buttons.push({
      label: "Resume",
      onClick: run(() => resumeOutreachRun(runId)),
      primary: true,
    });
    buttons.push({ label: "Start new run", onClick: run(startOutreachRun) });
  }

  return (
    <div>
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
        <p role="alert" className="mt-3 text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

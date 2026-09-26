/**
 * Agent worker.
 *
 *   npm run outreach:worker         # process the active run, then exit
 *   npm run outreach:worker -- --watch   # keep polling for work
 *
 * Picks up whatever run the dashboard has marked RUNNING and drives it. STOP
 * and PAUSE are honoured between steps, so the dashboard stays in control.
 *
 * In production this is the `agent-worker` container; locally it is this
 * script. Either way it is a plain Node process, which is why nothing it
 * imports may be server-only.
 */
import { AgentStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { activeRun, transition } from "../src/lib/outreach/state";
import { runAgent } from "../src/lib/outreach/worker";

const WATCH = process.argv.includes("--watch");
const POLL_SECONDS = 15;

async function once(): Promise<boolean> {
  const run = await activeRun();
  if (!run) return false;
  if (run.status !== AgentStatus.RUNNING) return false;

  console.log(`[worker] picking up run ${run.id} (${run.qualifiedCount}/${run.targetCount})`);
  const started = Date.now();
  try {
    const outcome = await runAgent(run.id);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      `[worker] ${outcome.status} in ${seconds}s — qualified ${outcome.qualified}, ` +
      `scanned ${outcome.scanned}, rejected ${outcome.rejected}`,
    );
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[worker] run ${run.id} failed:`, message);
    // Surface the failure on the dashboard instead of dying silently.
    await transition(run.id, AgentStatus.ERROR, { error: message }).catch(() => {});
    return true;
  }
}

async function main() {
  if (!WATCH) {
    const worked = await once();
    if (!worked) console.log("[worker] no run is marked RUNNING — nothing to do");
    await prisma.$disconnect();
    return;
  }

  console.log(`[worker] watching for work every ${POLL_SECONDS}s`);
  for (;;) {
    try {
      await once();
    } catch (error) {
      console.error("[worker] poll failed:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_SECONDS * 1000));
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

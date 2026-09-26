import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { activeRun, startRun } from "@/lib/outreach/state";
import { DailyLimitReached, dailyLimit, remainingToday } from "@/lib/outreach/quota";

/**
 * Opens the day's outreach run.
 *
 * Call once a day with `Authorization: Bearer $CRON_SECRET`, e.g.
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://pankajpramanik.com/api/cron/outreach
 *
 * Safe to call repeatedly: it does nothing while a run is active and nothing
 * once the day's budget is spent, so a retry or an overlapping schedule
 * cannot collect more than the daily cap.
 *
 * This only OPENS a run. The worker does the work, and nothing is ever sent
 * without explicit approval.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok =
    Boolean(secret) &&
    given.length === secret!.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(secret!));
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await activeRun();
  if (existing) {
    return NextResponse.json({
      started: false,
      reason: "a run is already active",
      runId: existing.id,
      qualified: existing.qualifiedCount,
      target: existing.targetCount,
    });
  }

  const remaining = await remainingToday();
  if (remaining === 0) {
    return NextResponse.json({
      started: false,
      reason: "daily limit reached",
      limit: dailyLimit(),
    });
  }

  try {
    const run = await startRun(remaining);
    return NextResponse.json({
      started: true,
      runId: run.id,
      target: run.targetCount,
      limit: dailyLimit(),
    });
  } catch (error) {
    if (error instanceof DailyLimitReached) {
      return NextResponse.json({ started: false, reason: error.message });
    }
    throw error;
  }
}

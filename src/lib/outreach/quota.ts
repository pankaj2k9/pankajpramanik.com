import { prisma } from "@/lib/prisma";

/**
 * Daily collection cap.
 *
 * A run stops at its own target, but without a daily ceiling nothing stops
 * someone starting run after run. The cap is what makes "collect at most five
 * a day" true regardless of how many runs are started.
 *
 * Counted from OutreachEvent rather than Opportunity rows so the ceiling holds
 * even if a draft is later deleted — the credits and the outreach were still
 * spent.
 */

export const QUALIFIED_EVENT = "opportunity.qualified";

/** Pankaj is in Bangladesh; "today" should mean his day, not UTC. */
export function timezone(): string {
  return process.env.OUTREACH_TIMEZONE?.trim() || "Asia/Dhaka";
}

export function dailyLimit(): number {
  const raw = Number(process.env.OUTREACH_DAILY_LIMIT?.trim());
  return Number.isInteger(raw) && raw > 0 ? raw : 5;
}

/** Milliseconds `tz` is ahead of UTC at `at`. */
function offsetMs(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"), get("month") - 1, get("day"),
    get("hour") % 24, get("minute"), get("second"),
  );
  return asUtc - at.getTime();
}

/** The UTC instant at which the current local day began. */
export function startOfDay(now = new Date(), tz = timezone()): Date {
  const offset = offsetMs(tz, now);
  const local = new Date(now.getTime() + offset);
  const midnight = Date.UTC(
    local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(),
  );
  return new Date(midnight - offset);
}

export async function qualifiedToday(now = new Date()): Promise<number> {
  return prisma.outreachEvent.count({
    where: { kind: QUALIFIED_EVENT, createdAt: { gte: startOfDay(now) } },
  });
}

export async function remainingToday(now = new Date()): Promise<number> {
  return Math.max(0, dailyLimit() - (await qualifiedToday(now)));
}

export class DailyLimitReached extends Error {
  constructor(limit: number) {
    super(`Daily limit of ${limit} qualified opportunities is already reached. Try again tomorrow.`);
    this.name = "DailyLimitReached";
  }
}

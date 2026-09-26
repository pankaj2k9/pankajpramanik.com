import { outreachEnv } from "../env";
import { cached } from "./cache";
import { prisma } from "@/lib/prisma";

/**
 * Hunter.io email discovery and verification.
 *
 * This is the scarcest resource in the system: the free tier is 25 finds and
 * 50 verifications a MONTH, so at five contacts a run it allows roughly three
 * or four runs. Every call is therefore cached, counted and guarded, and a
 * lookup is only attempted once a real company domain is known.
 *
 * Design record: docs/outreach-agent-architecture.md §2.1
 */

export type Verification = "VALID" | "RISKY" | "UNKNOWN" | "INVALID";

export type FoundEmail = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  linkedin: string | null;
  confidence: number;
  verification: Verification;
  source: string;
};

export class HunterError extends Error {}
export class CreditsExhausted extends Error {
  constructor(used: number, limit: number) {
    super(`Hunter budget spent: ${used} of ${limit} lookups used this month.`);
    this.name = "CreditsExhausted";
  }
}

const FIND_EVENT = "hunter.find";

export function monthlyFindLimit(): number {
  const raw = Number(process.env.HUNTER_MONTHLY_FINDS?.trim());
  return Number.isInteger(raw) && raw > 0 ? raw : 25;
}

function startOfMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Lookups spent this month, counted from our own ledger, not Hunter's. */
export async function findsUsedThisMonth(now = new Date()): Promise<number> {
  return prisma.outreachEvent.count({
    where: { kind: FIND_EVENT, createdAt: { gte: startOfMonth(now) } },
  });
}

export async function findsRemaining(now = new Date()): Promise<number> {
  return Math.max(0, monthlyFindLimit() - (await findsUsedThisMonth(now)));
}

async function api<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://api.hunter.io/v2/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("api_key", outreachEnv.hunterKey());

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const payload = (await response.json()) as { data?: T; errors?: { details?: string }[] };
  if (!response.ok) {
    throw new HunterError(payload.errors?.[0]?.details ?? `Hunter responded ${response.status}`);
  }
  return payload.data as T;
}

type HunterVerifyData = { status?: string; result?: string; score?: number };

/** Hunter's own words mapped onto the four states the spec defines. */
function mapVerification(data: HunterVerifyData): Verification {
  const state = (data.status ?? data.result ?? "").toLowerCase();
  if (state === "valid" || state === "deliverable") return "VALID";
  if (state === "invalid" || state === "undeliverable") return "INVALID";
  if (state === "accept_all" || state === "webmail" || state === "risky") return "RISKY";
  return "UNKNOWN";
}

type HunterFinderData = {
  email?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  linkedin_url?: string;
  score?: number;
  verification?: HunterVerifyData;
};

/**
 * Finds one person's address at a domain.
 *
 * Refuses when the month's budget is spent rather than letting Hunter reject
 * the call, so the run fails with a reason the dashboard can show. Results
 * are cached for a week: the same person at the same company does not change,
 * and a cache hit costs nothing.
 */
export async function findEmail(
  domain: string,
  firstName: string,
  lastName: string,
): Promise<FoundEmail | null> {
  const key = `hunter:find:${domain}:${firstName}:${lastName}`.toLowerCase();

  let spent = false;
  const data = await cached<HunterFinderData | null>(key, 7 * 24 * 60 * 60, async () => {
    const remaining = await findsRemaining();
    if (remaining === 0) throw new CreditsExhausted(await findsUsedThisMonth(), monthlyFindLimit());
    spent = true;
    return api<HunterFinderData>("email-finder", {
      domain,
      first_name: firstName,
      last_name: lastName,
    });
  });

  // Only a real network call counts against the budget; a cache hit does not.
  if (spent) {
    await prisma.outreachEvent.create({
      data: { kind: FIND_EVENT, payload: { domain, firstName, lastName } },
    });
  }

  if (!data?.email) return null;
  return {
    email: data.email,
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    position: data.position ?? null,
    linkedin: data.linkedin_url ?? null,
    confidence: data.score ?? 0,
    verification: data.verification ? mapVerification(data.verification) : "UNKNOWN",
    source: "hunter.io",
  };
}

/** Verification is a separate, larger budget (50/month) than finding. */
export async function verifyEmail(email: string): Promise<Verification> {
  const data = await cached<HunterVerifyData>(
    `hunter:verify:${email.toLowerCase()}`,
    7 * 24 * 60 * 60,
    () => api<HunterVerifyData>("email-verifier", { email }),
  );
  return mapVerification(data);
}

/**
 * Whether a found address may be used without a human looking at it first.
 * The spec allows only VALID through normal approval; RISKY and UNKNOWN need
 * deliberate review, and INVALID is rejected outright.
 */
export function isSendable(verification: Verification): boolean {
  return verification === "VALID";
}

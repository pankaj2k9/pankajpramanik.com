import { AgentStatus, type Opportunity } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { masterCvSchema, type MasterCv } from "./master-cv";
import { searchAllBoards } from "./providers/job-boards";
import type { JobListing } from "./providers/types";
import { qualifies, scoreOpportunity, type Score } from "./scoring";
import { contactDiscoveryEnabled, enrichOpportunity, type EnrichOutcome } from "./enrich";
import {
  countQualified, currentStatus, heartbeat, record,
} from "./state";

/**
 * The run loop.
 *
 * Turns an OutreachRun row into actual opportunities. The dashboard only ever
 * records what was ASKED for; this is what does the work, and its heartbeat
 * is what makes "RUNNING" mean something.
 *
 * Sourcing and scoring cost nothing. Contact discovery, drafting and CV
 * rendering spend OpenAI tokens and one of the 25 monthly Hunter credits per
 * contact, so they can be switched off with OUTREACH_CONTACT_DISCOVERY=false.
 *
 * A qualified opportunity is stored BEFORE it is enriched, so a failure in
 * research or drafting never loses the find.
 *
 * Design record: docs/outreach-agent-architecture.md
 */

export class AgentStopped extends Error {
  constructor() { super("Run stopped"); this.name = "AgentStopped"; }
}
export class AgentPaused extends Error {
  constructor() { super("Run paused"); this.name = "AgentPaused"; }
}

/** The keywords a Data/AI search is built from. */
export const SEARCH_KEYWORDS = [
  "ai", "machine learning", "ml engineer", "data engineer", "data scientist",
  "llm", "mlops", "llmops", "rag", "python", "genai", "ai engineer",
  "data platform", "analytics engineer", "backend",
];

export function loadMasterCv(): MasterCv {
  const file = path.join(process.cwd(), "prisma/content/master-cv.json");
  return masterCvSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

/**
 * Checked between every step. STOP is felt at the next boundary rather than
 * killing work mid-flight, and PAUSE leaves the run resumable.
 */
async function checkpoint(runId: string): Promise<void> {
  const status = await currentStatus(runId);
  if (status === AgentStatus.STOPPED) throw new AgentStopped();
  if (status === AgentStatus.PAUSED) throw new AgentPaused();
  if (status !== AgentStatus.RUNNING) throw new AgentStopped();
  await heartbeat(runId);
}

/**
 * Has this company or posting already been handled?
 *
 * Checked across ALL runs, not just this one: contacting the same company
 * twice is the failure the spec is most explicit about.
 */
async function alreadySeen(listing: JobListing): Promise<string | null> {
  const [sameJob, sameCompany] = await Promise.all([
    prisma.opportunity.findFirst({ where: { jobUrl: listing.url }, select: { id: true } }),
    prisma.opportunity.findFirst({
      where: { companyName: { equals: listing.company, mode: "insensitive" } },
      select: { id: true },
    }),
  ]);
  if (sameJob) return "this posting was already processed";
  if (sameCompany) return "this company was already contacted";
  return null;
}

export type RunOutcome = {
  status: "COMPLETED" | "STOPPED" | "PAUSED" | "EXHAUSTED";
  qualified: number;
  scanned: number;
  rejected: number;
};

/**
 * Processes one run to its target, or until the sources are exhausted.
 *
 * Returns rather than throwing on STOP/PAUSE, since neither is an error: the
 * checkpoint survives and RESUME continues from here.
 */
export async function runAgent(runId: string): Promise<RunOutcome> {
  const cv = loadMasterCv();
  let scanned = 0;
  let rejected = 0;

  try {
    await checkpoint(runId);
    await record(runId, "search.started", { keywords: SEARCH_KEYWORDS.length });

    const listings = await searchAllBoards({ keywords: SEARCH_KEYWORDS, limit: 400 });
    await record(runId, "search.completed", { found: listings.length });
    await checkpoint(runId);

    for (const listing of listings) {
      await checkpoint(runId);
      scanned++;

      const run = await prisma.outreachRun.findUniqueOrThrow({ where: { id: runId } });
      if (run.qualifiedCount >= run.targetCount) break;

      const score = scoreOpportunity(listing, cv);
      if (!qualifies(score)) {
        rejected++;
        continue;
      }

      const duplicate = await alreadySeen(listing);
      if (duplicate) {
        rejected++;
        await record(runId, "opportunity.skipped", { company: listing.company, reason: duplicate });
        continue;
      }

      const opportunity = await persistOpportunity(runId, listing, score);

      // Enrichment runs BEFORE the count. Counting first reaches the target,
      // which auto-completes the run, which makes the next checkpoint abort —
      // so the last opportunity of every run would never get a contact or a
      // draft. It is best-effort either way: the opportunity is already
      // stored, so a research failure never loses the find.
      if (contactDiscoveryEnabled()) {
        try {
          const outcome: EnrichOutcome = await enrichOpportunity(opportunity, listing, score, cv);
          console.log(`[worker] ${listing.company}: ${outcome}`);
        } catch (error) {
          // Enrichment is best-effort. The opportunity stays for review.
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[worker] enrichment failed for ${listing.company}:`, message);
          await record(runId, "opportunity.enrich_failed", { company: listing.company, error: message }, opportunity.id);
        }
      }

      await countQualified(runId);
    }

    const finalRun = await prisma.outreachRun.findUniqueOrThrow({ where: { id: runId } });
    if (finalRun.status === AgentStatus.COMPLETED) {
      return { status: "COMPLETED", qualified: finalRun.qualifiedCount, scanned, rejected };
    }
    // Sources ran dry before the target was met. Leave the run RUNNING so the
    // next sweep can continue rather than declaring a false completion.
    await record(runId, "search.exhausted", {
      scanned, rejected, qualified: finalRun.qualifiedCount, target: finalRun.targetCount,
    });
    return { status: "EXHAUSTED", qualified: finalRun.qualifiedCount, scanned, rejected };
  } catch (error) {
    if (error instanceof AgentStopped) {
      const run = await prisma.outreachRun.findUniqueOrThrow({ where: { id: runId } });
      // Reaching the target auto-completes the run, and the next checkpoint
      // then reads as "not RUNNING". That is success, not a stop.
      const status = run.status === AgentStatus.COMPLETED ? "COMPLETED" : "STOPPED";
      return { status, qualified: run.qualifiedCount, scanned, rejected };
    }
    if (error instanceof AgentPaused) {
      const run = await prisma.outreachRun.findUniqueOrThrow({ where: { id: runId } });
      return { status: "PAUSED", qualified: run.qualifiedCount, scanned, rejected };
    }
    throw error;
  }
}

/** Stores a qualified opportunity as a DRAFT. Nothing here is sendable yet. */
async function persistOpportunity(
  runId: string,
  listing: JobListing,
  score: Score,
): Promise<Opportunity> {
  const opportunity = await prisma.opportunity.create({
    data: {
      runId,
      companyName: listing.company,
      companyUrl: null,
      jobTitle: listing.title,
      jobUrl: listing.url,
      jobSource: listing.source,
      jobDescription: listing.description.slice(0, 20_000),
      remoteStatus: listing.remoteFit,
      matchScore: score.total,
      matchBreakdown: {
        ...score.breakdown,
        matchedSkills: score.matchedSkills.slice(0, 25),
        matchedProjects: score.matchedProjects,
        attribution: listing.attribution,
      },
      matchReason: score.reasons.join("; "),
    },
  });
  await record(runId, "opportunity.qualified.detail", {
    company: listing.company, title: listing.title, score: score.total,
  }, opportunity.id);
  return opportunity;
}

import { ApprovalStatus, type Opportunity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildDraft, DraftRejected, type Recipient } from "./drafting";
import { renderTailoredCv } from "./cv-pdf";
import type { MasterCv } from "./master-cv";
import { completeJson } from "./providers/llm";
import { findEmail, findsRemaining, isSendable, verifyEmail, CreditsExhausted } from "./providers/hunter";
import { findCompanyDomain, findDecisionMakerHints, researchCompany } from "./providers/tavily";
import type { JobListing } from "./providers/types";
import type { Score } from "./scoring";
import { record } from "./state";

/**
 * Turns a scored opportunity into something a human can approve: a real
 * decision-maker, a verified business email, a personalised draft, a cover
 * letter and a tailored CV.
 *
 * Every step can fail without losing the opportunity. A listing with no
 * findable contact is still worth showing — Pankaj can apply through the
 * posting — so failures downgrade the record rather than discarding it.
 *
 * Design record: docs/outreach-agent-architecture.md
 */

export type EnrichOutcome =
  | "READY"           // contact found, verified, drafted
  | "NO_DOMAIN"       // company website could not be resolved
  | "NO_CONTACT"      // no decision-maker or no address
  | "UNVERIFIED"      // address found but not VALID
  | "DRAFT_FAILED"    // grounding check rejected it
  | "NO_CREDITS";     // Hunter budget spent

/** Contact discovery spends money and scarce credits, so it is switchable. */
export function contactDiscoveryEnabled(): boolean {
  return process.env.OUTREACH_CONTACT_DISCOVERY?.trim() !== "false";
}

type ExtractedPerson = { name?: string; title?: string; confidence?: number };

/**
 * Pulls a person out of search snippets.
 *
 * The snippets are untrusted web text, so the model only EXTRACTS from them —
 * it is told to return nothing rather than guess, because an invented name
 * wastes a Hunter credit and can address a stranger.
 */
async function extractDecisionMaker(
  company: string,
  role: string,
  evidence: string,
): Promise<ExtractedPerson | null> {
  const person = await completeJson<ExtractedPerson>(
    `You extract a named person from search results. Return ONLY someone explicitly named in the text as working at the given company in an engineering, data, AI or hiring leadership role.

Return JSON: {"name": "Full Name", "title": "Their Title", "confidence": 0-100}
If no such person is clearly named, return {"confidence": 0}. Never guess a name. Never invent one.`,
    `COMPANY: ${company}\nROLE BEING HIRED: ${role}\n\nSEARCH RESULTS:\n${evidence.slice(0, 6000)}`,
    { tier: "fast", maxTokens: 200 },
  );

  if (!person?.name || (person.confidence ?? 0) < 50) return null;
  // A full name is required: Hunter's finder needs first and last.
  if (person.name.trim().split(/\s+/).length < 2) return null;
  return person;
}

/**
 * Enriches one stored opportunity in place.
 *
 * Returns what happened so the run loop can record it; it never throws for an
 * ordinary failure.
 */
export async function enrichOpportunity(
  opportunity: Opportunity,
  listing: JobListing,
  score: Score,
  cv: MasterCv,
): Promise<EnrichOutcome> {
  const runId = opportunity.runId;
  const note = (outcome: EnrichOutcome, detail: Record<string, unknown> = {}) =>
    record(runId, "opportunity.enriched", { outcome, company: listing.company, ...detail }, opportunity.id);

  // 1. The company's own domain. Everything downstream needs it, and a wrong
  //    one both wastes a credit and can address an unrelated company.
  const domain = await findCompanyDomain(listing.company);
  if (!domain) {
    await note("NO_DOMAIN");
    return "NO_DOMAIN";
  }
  await prisma.opportunity.update({
    where: { id: opportunity.id },
    data: { companyUrl: `https://${domain}` },
  });

  // 2. Background, so the email can be specific rather than generic.
  const research = await researchCompany(listing.company, domain);

  // 3. Who owns this hire.
  const hints = await findDecisionMakerHints(listing.company, listing.title);
  const person = hints.length
    ? await extractDecisionMaker(listing.company, listing.title, hints.map((h) => h.evidence).join("\n\n"))
    : null;

  if (!person?.name) {
    await note("NO_CONTACT", { reason: "no decision-maker named in public sources" });
    return "NO_CONTACT";
  }

  // 4. Their address. Guarded: the monthly budget is 25 lookups.
  if ((await findsRemaining()) === 0) {
    await note("NO_CREDITS");
    return "NO_CREDITS";
  }

  const [first, ...rest] = person.name.trim().split(/\s+/);
  let found;
  try {
    found = await findEmail(domain, first, rest.join(" "));
  } catch (error) {
    if (error instanceof CreditsExhausted) {
      await note("NO_CREDITS");
      return "NO_CREDITS";
    }
    throw error;
  }

  if (!found?.email) {
    await note("NO_CONTACT", { reason: "no address found for that person" });
    return "NO_CONTACT";
  }

  const verification =
    found.verification === "UNKNOWN" ? await verifyEmail(found.email) : found.verification;

  await prisma.opportunity.update({
    where: { id: opportunity.id },
    data: {
      contactName: person.name,
      contactTitle: person.title ?? found.position ?? null,
      contactEmail: found.email,
      emailSource: found.source,
      emailVerification: verification,
      linkedinUrl: found.linkedin,
    },
  });

  // Only a VALID address goes through normal approval. RISKY and UNKNOWN stay
  // as drafts for deliberate review; drafting for them would be wasted work.
  if (!isSendable(verification)) {
    await note("UNVERIFIED", { verification });
    return "UNVERIFIED";
  }

  // 5. The draft itself, grounded against the CV.
  const recipient: Recipient = {
    name: person.name,
    title: person.title ?? null,
    company: listing.company,
  };
  const enrichedListing: JobListing = {
    ...listing,
    description: `${listing.description}\n\nABOUT ${listing.company}:\n${research.summary}`.slice(0, 20_000),
  };

  let draft;
  try {
    draft = await buildDraft(cv, enrichedListing, score, recipient);
  } catch (error) {
    if (error instanceof DraftRejected) {
      await note("DRAFT_FAILED", { failures: error.failures.map((f) => `${f.kind}:${f.value}`) });
      return "DRAFT_FAILED";
    }
    throw error;
  }

  // 6. The CV that will be attached.
  const rendered = await renderTailoredCv(cv, draft.tailored, runId, opportunity.id);

  await prisma.opportunity.update({
    where: { id: opportunity.id },
    data: {
      emailSubject: draft.subject,
      emailBody: draft.body,
      coverLetter: draft.coverLetter,
      cvFilePath: rendered.filePath,
      cvVersion: rendered.version,
      // Ready for a human. Sending still requires explicit approval.
      approvalStatus: ApprovalStatus.AWAITING_APPROVAL,
    },
  });

  await note("READY", { contact: person.name, verification });
  return "READY";
}

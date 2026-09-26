import { checkGrounding, describeFailures, type GroundingFailure } from "./grounding";
import type { CvProject, CvRole, MasterCv } from "./master-cv";
import { complete, completeJson } from "./providers/llm";
import type { JobListing } from "./providers/types";
import type { Score } from "./scoring";

/**
 * Email, cover letter and the tailored CV selection.
 *
 * The tailoring is SELECTION: roles, projects and skills are filtered and
 * reordered from the structured CV. The model writes only the prose that has
 * to be written — a summary, an email, a letter — and everything it produces
 * is checked against the CV before it can be stored.
 *
 * Design record: docs/outreach-agent-architecture.md §6
 */

export type Recipient = {
  name: string | null;
  title: string | null;
  company: string;
};

export type TailoredCv = {
  summary: string;
  roles: CvRole[];
  projects: CvProject[];
  skills: { category: string; items: string[] }[];
};

export type Draft = {
  subject: string;
  body: string;
  coverLetter: string;
  tailored: TailoredCv;
};

export class DraftRejected extends Error {
  constructor(readonly failures: GroundingFailure[]) {
    super(`Draft failed the grounding check: ${describeFailures(failures)}`);
    this.name = "DraftRejected";
  }
}

const relevanceOf = (terms: string[], haystack: string): number =>
  terms.filter((t) => haystack.toLowerCase().includes(t.toLowerCase())).length;

/**
 * Picks the most relevant records. No text is written here — reordering and
 * filtering only, so career history cannot be altered by tailoring.
 */
export function selectForListing(cv: MasterCv, listing: JobListing, score: Score): Omit<TailoredCv, "summary"> {
  const haystack = `${listing.title} ${listing.tags.join(" ")} ${listing.description}`;

  const roles = [...cv.roles]
    .map((r) => ({ r, hits: relevanceOf(r.tech, haystack) }))
    .sort((a, b) => b.hits - a.hits || b.r.start.localeCompare(a.r.start))
    // Keep enough history that the CV reads as a career, not a highlight reel.
    .slice(0, 6)
    .sort((a, b) => b.r.start.localeCompare(a.r.start))
    .map(({ r }) => r);

  const projects = [...cv.projects]
    .map((p) => ({ p, hits: relevanceOf(p.tech, haystack) }))
    .filter(({ hits }) => hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 4)
    .map(({ p }) => p);

  // Skill groups whose items the listing actually mentions come first.
  const skills = [...cv.skills]
    .map((g) => ({ g, hits: relevanceOf(g.items, haystack) }))
    .sort((a, b) => b.hits - a.hits)
    .map(({ g, hits }) => ({
      category: g.category,
      items: hits > 0
        ? [...g.items].sort((a, b) =>
            Number(haystack.toLowerCase().includes(b.toLowerCase())) -
            Number(haystack.toLowerCase().includes(a.toLowerCase())))
        : g.items,
    }));

  void score;
  return { roles, projects, skills };
}

/** Only the facts the model is permitted to use, rendered as plain text. */
function factSheet(cv: MasterCv, selection: Omit<TailoredCv, "summary">): string {
  const roles = selection.roles
    .map((r) => `- ${r.title}, ${r.company} (${r.start} to ${r.end}): ${r.bullets.slice(0, 3).join(" ")}`)
    .join("\n");
  const projects = selection.projects
    .map((p) => `- ${p.title}: ${p.summary} [${p.tech.slice(0, 8).join(", ")}]`)
    .join("\n");
  const achievements = cv.achievements.map((a) => `- ${a.label}: ${a.detail}`).join("\n");
  const skills = selection.skills.map((g) => `- ${g.category}: ${g.items.slice(0, 12).join(", ")}`).join("\n");

  return [
    `NAME: ${cv.name}`,
    `HEADLINE: ${cv.headline}`,
    `LOCATION: ${cv.location} (remote, international contractor)`,
    `YEARS OF EXPERIENCE: ${cv.yearsExperience}`,
    `WEBSITE: ${cv.website}`,
    ``, `ROLES:`, roles,
    ``, `PROJECTS:`, projects,
    ``, `ACHIEVEMENTS:`, achievements,
    ``, `SKILLS:`, skills,
  ].join("\n");
}

const RULES = `You write on behalf of a named engineer, to a named person at a named company.

ABSOLUTE RULES:
- Use ONLY facts from the FACTS block. Never add an employer, project, date, metric, technology or qualification that is not there.
- Never state a number that is not in the FACTS block or the job posting.
- Do not exaggerate. Do not claim to have worked at the recipient's company.
- No "I hope this email finds you well" or similar filler.
- Plain text. No markdown, no placeholders, no square brackets.`;

/** Rewrites only the summary paragraph; every fact comes from the sheet. */
async function writeSummary(facts: string, listing: JobListing): Promise<string> {
  return complete(
    `${RULES}\n\nWrite a 2-sentence professional summary for a CV, tailored to the role. Return only the summary.`,
    `FACTS:\n${facts}\n\nROLE: ${listing.title} at ${listing.company}\n\nPOSTING:\n${listing.description.slice(0, 2500)}`,
    { tier: "reasoning", maxTokens: 300 },
  );
}

async function writeEmail(
  facts: string,
  listing: JobListing,
  to: Recipient,
): Promise<{ subject: string; body: string }> {
  const result = await completeJson<{ subject: string; body: string }>(
    `${RULES}

Write a cold outreach email of 60-120 words with this shape:
1. the specific reason for writing to THIS person at THIS company
2. the link between their need and the sender's real experience
3. ONE concrete proof project from the FACTS
4. a low-friction question as the close

Return JSON: {"subject": "...", "body": "..."}
The body must open by addressing the recipient by first name and end with the sender's name.`,
    `FACTS:\n${facts}

RECIPIENT: ${to.name ?? "the hiring manager"}${to.title ? `, ${to.title}` : ""} at ${to.company}
ROLE: ${listing.title}
POSTING:\n${listing.description.slice(0, 2500)}`,
    { tier: "reasoning", maxTokens: 700 },
  );
  if (!result?.subject || !result?.body) {
    throw new Error("The model did not return a usable subject and body.");
  }
  return result;
}

async function writeCoverLetter(facts: string, listing: JobListing, to: Recipient): Promise<string> {
  return complete(
    `${RULES}\n\nWrite a concise cover letter (200-280 words) for this specific role. Mention 2-3 matching capabilities with real project evidence. Return only the letter.`,
    `FACTS:\n${facts}\n\nCOMPANY: ${to.company}\nROLE: ${listing.title}\n\nPOSTING:\n${listing.description.slice(0, 3000)}`,
    { tier: "reasoning", maxTokens: 900 },
  );
}

/**
 * Produces a complete draft, or throws.
 *
 * Every generated passage is grounded against the CV and the posting. One
 * retry is allowed — models often recover when told what they invented — and
 * a second failure drops the opportunity rather than storing something that
 * cannot be substantiated.
 */
export async function buildDraft(
  cv: MasterCv,
  listing: JobListing,
  score: Score,
  to: Recipient,
): Promise<Draft> {
  const selection = selectForListing(cv, listing, score);
  const facts = factSheet(cv, selection);

  for (let attempt = 0; attempt < 2; attempt++) {
    const [summary, email, coverLetter] = await Promise.all([
      writeSummary(facts, listing),
      writeEmail(facts, listing, to),
      writeCoverLetter(facts, listing, to),
    ]);

    const prose = `${summary}\n${email.subject}\n${email.body}\n${coverLetter}`;
    const grounded = checkGrounding(prose, cv, listing.description, {
      name: to.name,
      title: to.title,
      company: to.company,
    });

    if (grounded.ok) {
      return { subject: email.subject, body: email.body, coverLetter, tailored: { summary, ...selection } };
    }
    if (attempt === 1) throw new DraftRejected(grounded.failures);
    console.warn(`[outreach] draft attempt ${attempt + 1} rejected: ${describeFailures(grounded.failures)}`);
  }
  throw new DraftRejected([]);
}

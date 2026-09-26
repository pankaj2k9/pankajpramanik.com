import type { MasterCv } from "./master-cv";
import type { JobListing } from "./providers/types";

/**
 * Opportunity scoring, 0-100 against the spec's eight dimensions.
 *
 * Deliberately DETERMINISTIC. An LLM score would cost a call per listing,
 * vary between runs and be unauditable; these weights are computed from the
 * structured CV and the listing text, so every number on the dashboard can be
 * explained and reproduced. The LLM is used later for drafting, where
 * judgement is actually needed.
 *
 * Design record: docs/outreach-agent-architecture.md
 */

export const DIMENSIONS = {
  technicalMatch: 25,
  dataAiRelevance: 20,
  experienceMatch: 15,
  remoteCompatibility: 15,
  portfolioEvidence: 10,
  companyQuality: 5,
  contactFindable: 5,
  personalization: 5,
} as const;

export type Dimension = keyof typeof DIMENSIONS;
export type Breakdown = Record<Dimension, number>;

export type Score = {
  total: number;
  breakdown: Breakdown;
  /** Human-readable justification, stored so a score can be challenged. */
  reasons: string[];
  matchedSkills: string[];
  matchedProjects: string[];
  /** True for marketplaces and staffing firms, which have no addressee. */
  isIntermediary: boolean;
};

/** Terms that mark a listing as Data/AI work rather than generic software. */
const AI_SIGNALS = [
  "ai", "artificial intelligence", "machine learning", "ml", "mlops", "llm",
  "llmops", "genai", "generative ai", "rag", "agentic", "ai agent", "langchain",
  "langgraph", "nlp", "deep learning", "data engineer", "data engineering",
  "data scientist", "data science", "etl", "elt", "data pipeline",
  "analytics engineer", "vector database", "embeddings", "prompt engineering",
];

/**
 * Talent marketplaces and staffing intermediaries. Listing here is not a
 * judgement on them — it is that cold outreach has no addressee at a
 * marketplace, so these cannot become qualified opportunities.
 */
const MARKETPLACE =
  /^(lemon\.io|toptal|proxify|andela|turing|crossover|gun\.io|arc\.dev|x-?team|upwork|fiverr|workana|braintrust|deel|oyster|remote\.com|micro1|mercier|revelo|howdy|near(short)?|strider)/i;

const AGENCY_WORDS =
  /(staffing|recruit|consultancy|outsourc|talent (solutions|network|pool)|headhunt|manpower|resourcing|body ?shop)/i;

const SENIOR_TERMS = ["senior", "staff", "principal", "lead", "architect", "sr."];
const JUNIOR_TERMS = ["junior", "intern", "graduate", "entry level", "entry-level", "trainee", "apprentice"];

/** Boundary-aware match; "ai" must not hit inside "available". */
function mentions(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9+#.])${escaped}($|[^a-z0-9+#.])`, "i").test(haystack);
}

/** Every technology the CV can legitimately claim. */
function cvVocabulary(cv: MasterCv): string[] {
  const terms = new Set<string>();
  for (const group of cv.skills) for (const item of group.items) terms.add(item.toLowerCase());
  for (const role of cv.roles) for (const t of role.tech) terms.add(t.toLowerCase());
  for (const project of cv.projects) for (const t of project.tech) terms.add(t.toLowerCase());
  // Single characters and noise would match everything.
  return [...terms].filter((t) => t.length >= 2);
}

function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function scoreOpportunity(listing: JobListing, cv: MasterCv): Score {
  const title = listing.title;
  const tags = listing.tags.join(" ");
  const body = `${title} ${tags} ${listing.description}`;
  const reasons: string[] = [];

  // 1. Technical match — how much of the stack Pankaj has actually used.
  const vocabulary = cvVocabulary(cv);
  const matchedSkills = vocabulary.filter((term) => mentions(body, term));
  const technicalMatch = clamp((matchedSkills.length / 8) * DIMENSIONS.technicalMatch, DIMENSIONS.technicalMatch);
  reasons.push(`${matchedSkills.length} technologies overlap with the CV`);

  // 2. Data/AI relevance — a title signal counts for far more than a body one,
  //    because descriptions mention AI for roles that are not AI work.
  const titleSignals = AI_SIGNALS.filter((s) => mentions(title, s));
  const tagSignals = AI_SIGNALS.filter((s) => mentions(tags, s));
  const bodySignals = AI_SIGNALS.filter((s) => mentions(listing.description, s));
  const dataAiRelevance = clamp(
    titleSignals.length * 9 + tagSignals.length * 3 + Math.min(bodySignals.length, 4) * 1.5,
    DIMENSIONS.dataAiRelevance,
  );
  reasons.push(
    titleSignals.length
      ? `Data/AI named in the title (${titleSignals.slice(0, 3).join(", ")})`
      : "no Data/AI signal in the title",
  );

  // 3. Experience match — 8+ years, so senior postings fit and junior ones do not.
  const isSenior = SENIOR_TERMS.some((t) => mentions(title, t));
  const isJunior = JUNIOR_TERMS.some((t) => mentions(title, t));
  const experienceMatch = isJunior ? 0 : isSenior ? DIMENSIONS.experienceMatch : 10;
  if (isJunior) reasons.push("junior posting — below Pankaj's level");
  else if (isSenior) reasons.push("senior posting matches 8+ years");

  // 4. Remote compatibility — the hard eligibility gate.
  const remoteCompatibility =
    listing.remoteFit === "WORLDWIDE" ? 15
    : listing.remoteFit === "COMPATIBLE" ? 10
    : listing.remoteFit === "UNKNOWN" ? 6
    : 0;
  reasons.push(`remote fit: ${listing.remoteFit}`);

  // 5. Portfolio evidence — a project whose stack overlaps is proof, not a claim.
  const matchedProjects = cv.projects
    .filter((p) => p.tech.some((t) => mentions(body, t.toLowerCase())))
    .map((p) => p.title);
  const portfolioEvidence = clamp((matchedProjects.length / 3) * DIMENSIONS.portfolioEvidence, DIMENSIONS.portfolioEvidence);
  if (matchedProjects.length) reasons.push(`${matchedProjects.length} portfolio projects share this stack`);

  // 6. Company quality — a named employer, not an intermediary.
  //
  // Talent marketplaces post constantly and score well on every technical
  // axis, so they dominate results. But there is no hiring decision-maker to
  // write to: the "role" is a pool, and the contact would be their sales
  // team. They are not outreach targets.
  const agency = MARKETPLACE.test(listing.company) || AGENCY_WORDS.test(listing.company);
  const companyQuality = agency
    ? 0
    : clamp((listing.company ? 2 : 0) + (listing.description.length > 600 ? 2 : 1) + 1, DIMENSIONS.companyQuality);
  if (agency) reasons.push("intermediary, not the hiring company — no decision-maker to contact");

  // 7. Contact findable — email discovery needs a real company domain. A
  //    board-hosted apply link gives us nothing to look up.
  const boardHosted = /remoteok|weworkremotely|himalayas|jobicy|remotive|arbeitnow|workingnomads/i.test(listing.url);
  const contactFindable = clamp((listing.company ? 3 : 0) + (boardHosted ? 0 : 2), DIMENSIONS.contactFindable);
  if (boardHosted) reasons.push("apply link is board-hosted; company domain needs research");

  // 8. Personalization — enough specifics to write something that is not generic.
  const personalization = clamp(
    (listing.description.length > 1200 ? 3 : listing.description.length > 400 ? 2 : 0) +
      (matchedProjects.length > 0 ? 2 : 0),
    DIMENSIONS.personalization,
  );

  const breakdown: Breakdown = {
    technicalMatch, dataAiRelevance, experienceMatch, remoteCompatibility,
    portfolioEvidence, companyQuality, contactFindable, personalization,
  };
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

  return { total, breakdown, reasons, matchedSkills, matchedProjects, isIntermediary: agency };
}

/**
 * The bar an opportunity must clear.
 *
 * The spec says 80. Kept configurable because 80 against these weights is
 * extremely strict — see the calibration note in the design record.
 */
export function threshold(): number {
  const raw = Number(process.env.OUTREACH_SCORE_THRESHOLD?.trim());
  return Number.isFinite(raw) && raw > 0 && raw <= 100 ? raw : 80;
}

/**
 * Minimum Data/AI relevance, out of 20.
 *
 * The spec allows a general software role only when Data/AI work is a
 * significant part of it. Without this floor a strong generic role — a .NET
 * or QA posting — clears 80 on technical overlap alone, because relevance is
 * only a fifth of the total.
 */
export function minRelevance(): number {
  const raw = Number(process.env.OUTREACH_MIN_RELEVANCE?.trim());
  return Number.isFinite(raw) && raw >= 0 ? raw : 8;
}

export function qualifies(score: Score): boolean {
  // Gates, not weights. Each of these disqualifies however well the rest scores.
  if (score.breakdown.remoteCompatibility === 0) return false; // cannot take it
  if (score.isIntermediary) return false;                      // nobody to write to
  if (score.breakdown.dataAiRelevance < minRelevance()) return false; // not the work
  return score.total >= threshold();
}

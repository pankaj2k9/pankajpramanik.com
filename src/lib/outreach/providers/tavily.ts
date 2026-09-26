import { outreachEnv } from "../env";
import { cached } from "./cache";

/**
 * Tavily web research.
 *
 * The free job boards alone cannot sustain five qualified opportunities a day
 * (see the calibration note in the design record), so this is the primary
 * discovery channel rather than a supplement: it reaches company career pages
 * and postings the boards never carry.
 *
 * It is also how a company's real domain and a plausible decision-maker are
 * found, which email discovery depends on.
 */

export type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score: number;
};

type TavilyResponse = { results?: TavilyResult[]; answer?: string };

async function search(
  query: string,
  options: { maxResults?: number; answer?: boolean; days?: number; domains?: string[] } = {},
): Promise<TavilyResponse> {
  const body = {
    api_key: outreachEnv.tavilyKey(),
    query,
    max_results: options.maxResults ?? 8,
    include_answer: options.answer ?? false,
    search_depth: "basic",
    ...(options.days ? { days: options.days, topic: "news" } : {}),
    ...(options.domains ? { include_domains: options.domains } : {}),
  };

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Tavily responded ${response.status}`);
  }
  return (await response.json()) as TavilyResponse;
}

/** Cached so repeated research inside one run costs a single call. */
function researchCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  return cached(`tavily:${key}`, 12 * 60 * 60, fetcher);
}

/**
 * The company's own domain.
 *
 * Email discovery needs this and a board-hosted apply link does not provide
 * it. Returns null rather than guessing — a wrong domain wastes a Hunter
 * credit and can address a stranger at an unrelated company.
 */
export async function findCompanyDomain(company: string): Promise<string | null> {
  const data = await researchCached(`domain:${company.toLowerCase()}`, () =>
    search(`${company} official company website`, { maxResults: 5 }),
  );

  const skip = /linkedin|indeed|glassdoor|crunchbase|wikipedia|facebook|twitter|x\.com|youtube|github|remoteok|weworkremotely|himalayas|jobicy|remotive|arbeitnow|workingnomads|bloomberg|reuters/i;
  const slug = company.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const result of data.results ?? []) {
    let host: string;
    try {
      host = new URL(result.url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (skip.test(host)) continue;
    // Only accept a host that plainly belongs to this company.
    const hostSlug = host.split(".")[0].replace(/[^a-z0-9]/g, "");
    if (slug.includes(hostSlug) || hostSlug.includes(slug)) return host;
  }
  return null;
}

/** Background on the company, used to make an email specific rather than generic. */
export async function researchCompany(
  company: string,
  domain: string | null,
): Promise<{ summary: string; sources: string[] }> {
  const data = await researchCached(`company:${company.toLowerCase()}`, () =>
    search(`What does ${company} do? products, engineering, AI or data work`, {
      maxResults: 6,
      answer: true,
      ...(domain ? { domains: [domain] } : {}),
    }),
  );
  return {
    summary: data.answer ?? (data.results ?? []).map((r) => r.content).join("\n").slice(0, 2000),
    sources: (data.results ?? []).map((r) => r.url),
  };
}

export type DecisionMakerHint = {
  name: string | null;
  title: string | null;
  source: string | null;
  evidence: string;
};

/**
 * Looks for who would own this hire.
 *
 * Returns HINTS, never a conclusion. The name is unverified text scraped from
 * search snippets, so it is passed to the LLM for extraction and must survive
 * the grounding check before it can be addressed. Nothing here crawls
 * LinkedIn; a LinkedIn URL is only ever recorded when a search result hands
 * one over.
 */
export async function findDecisionMakerHints(
  company: string,
  role: string,
): Promise<DecisionMakerHint[]> {
  const queries = [
    `${company} CTO OR "VP Engineering" OR "Head of Engineering" name`,
    `${company} "Head of AI" OR "Head of Data" OR "Engineering Manager" hiring ${role}`,
  ];

  const hints: DecisionMakerHint[] = [];
  for (const query of queries) {
    const data = await researchCached(`dm:${query.toLowerCase()}`, () =>
      search(query, { maxResults: 5 }),
    );
    for (const result of data.results ?? []) {
      hints.push({
        name: null,
        title: null,
        source: result.url,
        evidence: `${result.title}\n${result.content}`.slice(0, 1200),
      });
    }
  }
  return hints;
}

/** Broadens sourcing past the boards, straight to company career pages. */
export async function findCareerPagePostings(keywords: string[]): Promise<TavilyResult[]> {
  const query = `remote ${keywords.slice(0, 3).join(" OR ")} job worldwide "apply" careers`;
  const data = await researchCached(`postings:${query.toLowerCase()}`, () =>
    search(query, { maxResults: 12 }),
  );
  return data.results ?? [];
}

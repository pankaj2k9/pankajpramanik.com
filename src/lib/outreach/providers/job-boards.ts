import { classifyRemoteFit } from "./remote-fit";
import { cached } from "./cache";
import type { JobBoard, JobListing, JobQuery } from "./types";

/**
 * Free remote job boards. All three are keyless.
 *
 * Their capabilities differ enough that the agent needs all of them:
 *  - Remotive  — real keyword search, but ~4 calls/day allowed by its terms
 *  - Himalayas — a recency firehose, 20 per page, no server-side filtering
 *  - Arbeitnow — 250 per page, Germany-heavy, carries an explicit remote flag
 *
 * Design record: docs/outreach-agent-architecture.md §7
 */

const UA = "pankajpramanik.com outreach agent (+https://pankajpramanik.com)";

async function getJson<T>(url: string, timeoutMs = 20_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`${url} responded ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Case-insensitive, word-boundary match.
 *
 * Substring matching is wrong here: short keywords like "ai", "ml" and "rag"
 * occur inside ordinary words — available, maintain, training, email — and
 * pull in sales and support roles that have nothing to do with Data/AI.
 * Boundaries are letter-class rather than \b so that "node.js" or "c++"
 * still match at a punctuation edge.
 */
const EDGE = "[^a-z0-9+#.]";

function keywordPattern(keyword: string): RegExp {
  const escaped = keyword
    .toLowerCase()
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    // Treat any run of whitespace in a phrase as flexible.
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(^|${EDGE})${escaped}($|${EDGE})`, "i");
}

/**
 * Titles that are never the work, whatever the description says. A sales or
 * transcription listing routinely mentions AI in its body copy.
 */
const NOT_THE_JOB =
  /(account (executive|manager)|sales|business development|recruit|talent acquisition|customer success|support (agent|representative)|transcription|translator|copywriter|content writer|contract writer|trainer|teacher|tutor|marketing|community manager|designer|accountant|paralegal|bookkeep|virtual assistant)/i;

/**
 * Whether a listing is plausibly the work Pankaj does.
 *
 * The keyword must appear in the TITLE or TAGS. Matching the description was
 * too loose: sales and transcription roles mention AI in their body copy and
 * flooded the results. A genuine Data/AI role says so in its title, and the
 * scoring step still reads the full description later, so precision here
 * costs little and keeps the expensive steps focused.
 */
function matches(
  listing: Pick<JobListing, "title" | "tags" | "description">,
  keywords: string[],
): boolean {
  if (NOT_THE_JOB.test(listing.title)) return false;
  if (keywords.length === 0) return true;
  const signal = `${listing.title} ${listing.tags.join(" ")}`;
  return keywords.some((k) => keywordPattern(k).test(signal));
}

// --------------------------------------------------------------------------
// Remotive — the only one with working server-side search.
//
// Its terms require linking back to the Remotive URL and naming Remotive as
// the source, and advise at most four calls a day. Both are enforced here:
// `attribution` is carried on every listing and the cache TTL is six hours.
// --------------------------------------------------------------------------
type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  tags: string[];
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
};

export const remotive: JobBoard = {
  name: "remotive",
  // Their terms: "you only need to GET Remotive job data a couple of times a
  // day (we advise max. 4 times a day)". Six hours keeps us inside that.
  minIntervalSeconds: 6 * 60 * 60,

  async search(query: JobQuery): Promise<JobListing[]> {
    const term = query.keywords[0] ?? "";
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(term)}`;
    const data = await cached(`remotive:${term}`, remotive.minIntervalSeconds, () =>
      getJson<{ jobs: RemotiveJob[] }>(url),
    );

    return (data.jobs ?? [])
      .map((j): JobListing => {
        const locations = j.candidate_required_location
          ? j.candidate_required_location.split(",").map((s) => s.trim())
          : [];
        return {
          externalId: `remotive:${j.id}`,
          source: "remotive",
          title: j.title,
          company: j.company_name,
          url: j.url,
          description: j.description ?? "",
          locations,
          remoteFit: classifyRemoteFit(locations, j.description ?? ""),
          tags: [...(j.tags ?? []), j.category].filter(Boolean),
          postedAt: j.publication_date ? new Date(j.publication_date) : null,
          salary: j.salary || null,
          attribution: "Sourced via Remotive (remotive.com)",
        };
      })
      .filter((l) => matches(l, query.keywords))
      .slice(0, query.limit);
  },
};

// --------------------------------------------------------------------------
// Himalayas — ignores `search`, caps every page at 20 regardless of `limit`,
// and returns newest first. So it is a feed: page through recent listings and
// filter locally.
// --------------------------------------------------------------------------
type HimalayasJob = {
  guid: string;
  title: string;
  companyName: string;
  applicationLink: string;
  description: string;
  excerpt: string;
  locationRestrictions: string[];
  timezoneRestrictions: string[];
  categories: string[];
  seniority: string[];
  pubDate: number;
  minSalary: number | null;
  maxSalary: number | null;
  currency: string | null;
};

/** The API caps a page at 20 whatever `limit` says. */
const HIMALAYAS_PAGE = 20;

export const himalayas: JobBoard = {
  name: "himalayas",
  minIntervalSeconds: 60 * 60,

  async search(query: JobQuery): Promise<JobListing[]> {
    // No server-side filtering, so read a bounded window of the newest
    // listings and match locally. Ten pages is ~200 jobs, roughly a day.
    const pages = 10;
    const found: JobListing[] = [];

    for (let page = 0; page < pages && found.length < query.limit; page++) {
      const offset = page * HIMALAYAS_PAGE;
      const data = await cached(`himalayas:${offset}`, himalayas.minIntervalSeconds, () =>
        getJson<{ jobs: HimalayasJob[] }>(
          `https://himalayas.app/jobs/api?limit=${HIMALAYAS_PAGE}&offset=${offset}`,
        ),
      );
      if (!data.jobs?.length) break;

      for (const j of data.jobs) {
        const description = j.description || j.excerpt || "";
        const listing: JobListing = {
          externalId: `himalayas:${j.guid}`,
          source: "himalayas",
          title: j.title,
          company: j.companyName,
          url: j.applicationLink,
          description,
          locations: [...(j.locationRestrictions ?? []), ...(j.timezoneRestrictions ?? [])],
          remoteFit: classifyRemoteFit(j.locationRestrictions ?? [], description),
          tags: [...(j.categories ?? []), ...(j.seniority ?? [])].filter(Boolean),
          postedAt: j.pubDate ? new Date(j.pubDate * 1000) : null,
          salary:
            j.minSalary && j.maxSalary
              ? `${j.currency ?? ""}${j.minSalary}-${j.maxSalary}`.trim()
              : null,
          attribution: "Sourced via Himalayas (himalayas.app)",
        };
        if (matches(listing, query.keywords)) found.push(listing);
      }
    }
    return found.slice(0, query.limit);
  },
};

// --------------------------------------------------------------------------
// Arbeitnow — one large page, explicit remote flag. Skewed to Germany, which
// is the jurisdiction with the strictest cold-outreach rules, so the graph
// treats these as lower priority rather than dropping them here.
// --------------------------------------------------------------------------
type ArbeitnowJob = {
  slug: string;
  title: string;
  company_name: string;
  url: string;
  description: string;
  location: string;
  remote: boolean;
  tags: string[];
  job_types: string[];
  created_at: number;
};

export const arbeitnow: JobBoard = {
  name: "arbeitnow",
  minIntervalSeconds: 60 * 60,

  async search(query: JobQuery): Promise<JobListing[]> {
    const data = await cached("arbeitnow:board", arbeitnow.minIntervalSeconds, () =>
      getJson<{ data: ArbeitnowJob[] }>("https://www.arbeitnow.com/api/job-board-api"),
    );

    return (data.data ?? [])
      .filter((j) => j.remote)
      .map((j): JobListing => ({
        externalId: `arbeitnow:${j.slug}`,
        source: "arbeitnow",
        title: j.title,
        company: j.company_name,
        url: j.url,
        description: j.description ?? "",
        locations: j.location ? [j.location] : [],
        remoteFit: classifyRemoteFit(j.location ? [j.location] : [], j.description ?? ""),
        tags: [...(j.tags ?? []), ...(j.job_types ?? [])].filter(Boolean),
        postedAt: j.created_at ? new Date(j.created_at * 1000) : null,
        salary: null,
        attribution: "Sourced via Arbeitnow (arbeitnow.com)",
      }))
      .filter((l) => matches(l, query.keywords))
      .slice(0, query.limit);
  },
};


// --------------------------------------------------------------------------
// RemoteOK — one large feed. Its terms require a followed link back and
// naming Remote OK as the source, so `attribution` is carried and the apply
// URL is theirs, never rewritten.
// --------------------------------------------------------------------------
type RemoteOkJob = {
  id?: string;
  slug?: string;
  position?: string;
  company?: string;
  url?: string;
  apply_url?: string;
  description?: string;
  location?: string;
  tags?: string[];
  epoch?: number;
  salary_min?: number;
  salary_max?: number;
};

export const remoteOk: JobBoard = {
  name: "remoteok",
  minIntervalSeconds: 60 * 60,

  async search(query: JobQuery): Promise<JobListing[]> {
    const rows = await cached("remoteok:all", remoteOk.minIntervalSeconds, () =>
      getJson<RemoteOkJob[]>("https://remoteok.com/api"),
    );

    // The first element is a legal/terms notice, not a job.
    return (rows ?? [])
      .filter((j) => j.position && j.company)
      .map((j): JobListing => {
        const locations = j.location ? [j.location] : [];
        const description = j.description ?? "";
        return {
          externalId: `remoteok:${j.id ?? j.slug}`,
          source: "remoteok",
          title: j.position!,
          company: j.company!,
          url: j.url ?? j.apply_url ?? "",
          description,
          locations,
          remoteFit: classifyRemoteFit(locations, description),
          tags: j.tags ?? [],
          postedAt: j.epoch ? new Date(j.epoch * 1000) : null,
          salary:
            j.salary_min && j.salary_max ? `${j.salary_min}-${j.salary_max}` : null,
          attribution: "Sourced via Remote OK (remoteok.com)",
        };
      })
      .filter((l) => l.url && matches(l, query.keywords))
      .slice(0, query.limit);
  },
};

// --------------------------------------------------------------------------
// Jobicy — the only source with a server-side "anywhere" filter, which is
// exactly the worldwide-remote case, so it is queried that way directly.
// --------------------------------------------------------------------------
type JobicyJob = {
  id: number;
  jobTitle: string;
  companyName: string;
  jobGeo: string;
  jobLevel: string;
  jobType: string[] | string;
  jobIndustry: string[] | string;
  jobExcerpt: string;
  jobDescription: string;
  pubDate: string;
  url: string;
};

export const jobicy: JobBoard = {
  name: "jobicy",
  minIntervalSeconds: 60 * 60,

  async search(query: JobQuery): Promise<JobListing[]> {
    // geo=anywhere returns only globally-open roles — no local filtering needed.
    const data = await cached("jobicy:anywhere", jobicy.minIntervalSeconds, () =>
      getJson<{ jobs: JobicyJob[] }>(
        "https://jobicy.com/api/v2/remote-jobs?count=50&geo=anywhere",
      ),
    );

    const asArray = (v: string[] | string | undefined): string[] =>
      Array.isArray(v) ? v : v ? [v] : [];

    return (data.jobs ?? [])
      .map((j): JobListing => {
        const locations = j.jobGeo ? j.jobGeo.split(",").map((x) => x.trim()) : [];
        const description = j.jobDescription || j.jobExcerpt || "";
        return {
          externalId: `jobicy:${j.id}`,
          source: "jobicy",
          title: j.jobTitle,
          company: j.companyName,
          url: j.url,
          description,
          locations,
          remoteFit: classifyRemoteFit(locations, description),
          tags: [...asArray(j.jobIndustry), ...asArray(j.jobType), j.jobLevel].filter(Boolean),
          postedAt: j.pubDate ? new Date(j.pubDate) : null,
          salary: null,
          attribution: "Sourced via Jobicy (jobicy.com)",
        };
      })
      .filter((l) => matches(l, query.keywords))
      .slice(0, query.limit);
  },
};

// --------------------------------------------------------------------------
// We Work Remotely — RSS only. Its <region> field states "Anywhere in the
// World" explicitly, which is the strongest worldwide signal of any source.
// --------------------------------------------------------------------------
const WWR_FEEDS = [
  "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
];

/** RSS carries titles HTML-escaped; "Java &amp; React" must not reach a draft. */
const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/** Minimal RSS reader. The feed is flat and regular; a parser dependency would be overkill. */
function rssItems(xml: string): Record<string, string>[] {
  const unwrap = (v: string) =>
    decodeEntities(v.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim());

  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const body = m[1];
    const fields: Record<string, string> = {};
    for (const f of body.matchAll(/<([a-zA-Z:]+)>([\s\S]*?)<\/\1>/g)) {
      fields[f[1]] = unwrap(f[2]);
    }
    return fields;
  });
}

export const weWorkRemotely: JobBoard = {
  name: "weworkremotely",
  minIntervalSeconds: 60 * 60,

  async search(query: JobQuery): Promise<JobListing[]> {
    const found: JobListing[] = [];

    for (const feed of WWR_FEEDS) {
      const xml = await cached(`wwr:${feed}`, weWorkRemotely.minIntervalSeconds, async () => {
        const response = await fetch(feed, { headers: { "user-agent": UA } });
        if (!response.ok) throw new Error(`${feed} responded ${response.status}`);
        return response.text();
      });

      for (const item of rssItems(xml)) {
        // Titles read "Company: Role".
        const raw = item.title ?? "";
        const split = raw.indexOf(":");
        const company = split > 0 ? raw.slice(0, split).trim() : (item.company ?? "");
        const title = split > 0 ? raw.slice(split + 1).trim() : raw;
        const region = item.region ?? "";
        const description = (item.description ?? "").replace(/<[^>]+>/g, " ");
        if (!title || !company || !item.link) continue;

        const listing: JobListing = {
          externalId: `weworkremotely:${item.link}`,
          source: "weworkremotely",
          title,
          company,
          url: item.link,
          description,
          locations: region ? [region] : [],
          remoteFit: classifyRemoteFit(region ? [region] : [], description),
          tags: item.category ? [item.category] : [],
          postedAt: item.pubDate ? new Date(item.pubDate) : null,
          salary: null,
          attribution: "Sourced via We Work Remotely (weworkremotely.com)",
        };
        if (matches(listing, query.keywords)) found.push(listing);
      }
    }
    return found.slice(0, query.limit);
  },
};

// --------------------------------------------------------------------------
// Working Nomads. Useful breadth, but its feed often omits the company name,
// and a listing without one cannot be researched or addressed, so those are
// dropped here rather than failing later in the graph.
// --------------------------------------------------------------------------
type WorkingNomadsJob = {
  title?: string;
  company_name?: string;
  url?: string;
  description?: string;
  location?: string;
  tags?: string;
  category_name?: string;
  pub_date?: string;
};

export const workingNomads: JobBoard = {
  name: "workingnomads",
  minIntervalSeconds: 60 * 60,

  async search(query: JobQuery): Promise<JobListing[]> {
    const rows = await cached("workingnomads:all", workingNomads.minIntervalSeconds, () =>
      getJson<WorkingNomadsJob[]>("https://www.workingnomads.com/api/exposed_jobs/"),
    );

    return (rows ?? [])
      .filter((j) => j.title && j.company_name && j.url)
      .map((j): JobListing => {
        const locations = j.location ? [j.location] : [];
        const description = j.description ?? "";
        return {
          externalId: `workingnomads:${j.url}`,
          source: "workingnomads",
          title: j.title!,
          company: j.company_name!,
          url: j.url!,
          description,
          locations,
          remoteFit: classifyRemoteFit(locations, description),
          tags: [
            ...(j.tags ? j.tags.split(",").map((t) => t.trim()) : []),
            ...(j.category_name ? [j.category_name] : []),
          ].filter(Boolean),
          postedAt: j.pub_date ? new Date(j.pub_date) : null,
          salary: null,
          attribution: "Sourced via Working Nomads (workingnomads.com)",
        };
      })
      .filter((l) => matches(l, query.keywords))
      .slice(0, query.limit);
  },
};

export const jobBoards: JobBoard[] = [
  remotive,
  himalayas,
  arbeitnow,
  remoteOk,
  jobicy,
  weWorkRemotely,
  workingNomads,
];

/**
 * Queries every board and merges the results, newest first.
 *
 * One board failing must not sink a run — a board that throws is logged and
 * skipped, because three sources exist precisely so none is load-bearing.
 */
export async function searchAllBoards(query: JobQuery): Promise<JobListing[]> {
  const results = await Promise.allSettled(
    jobBoards.map((board) => board.search(query)),
  );

  const listings: JobListing[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") listings.push(...result.value);
    else console.error(`[outreach] ${jobBoards[index].name} failed:`, result.reason);
  });

  // Same role cross-posted to two boards is one opportunity.
  const byUrl = new Map<string, JobListing>();
  for (const listing of listings) {
    if (!byUrl.has(listing.url)) byUrl.set(listing.url, listing);
  }

  /**
   * Worldwide first, then regionally compatible, then unstated.
   *
   * A globally-open role is worth more than a newer regional one: it is the
   * only category with no eligibility doubt for someone contracting from
   * Bangladesh, so it should reach the expensive scoring step first.
   * Recency breaks ties within a band.
   */
  const RANK: Record<string, number> = { WORLDWIDE: 0, COMPATIBLE: 1, UNKNOWN: 2, INELIGIBLE: 3 };

  return [...byUrl.values()].sort((a, b) => {
    const byFit = RANK[a.remoteFit] - RANK[b.remoteFit];
    if (byFit !== 0) return byFit;
    return (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0);
  });
}

/** Only roles open worldwide — no eligibility doubt at all. */
export async function searchWorldwide(query: JobQuery): Promise<JobListing[]> {
  const all = await searchAllBoards({ ...query, limit: query.limit * 4 });
  return all.filter((l) => l.remoteFit === "WORLDWIDE").slice(0, query.limit);
}

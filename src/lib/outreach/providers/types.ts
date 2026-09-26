/**
 * Provider-agnostic shapes for the outreach agent.
 *
 * Every external source normalizes into these, so swapping or adding a board
 * never touches the graph. Design record: docs/outreach-agent-architecture.md §7
 */

/** How reachable a listing is for someone contracting from Bangladesh. */
export type RemoteFit =
  /** Explicitly worldwide / no location restriction. */
  | "WORLDWIDE"
  /** Restricted, but to a region that does not exclude Bangladesh outright. */
  | "COMPATIBLE"
  /** Restricted to a country or work authorization Pankaj does not have. */
  | "INELIGIBLE"
  /** The listing says nothing useful; the scoring step must read the text. */
  | "UNKNOWN";

export type JobListing = {
  /** Stable per source, used for cross-run dedupe. */
  externalId: string;
  source: string;
  title: string;
  company: string;
  /** Canonical URL. Some sources require this exact link be used. */
  url: string;
  description: string;
  /** Raw location strings as the board stated them, never reinterpreted. */
  locations: string[];
  remoteFit: RemoteFit;
  tags: string[];
  postedAt: Date | null;
  salary: string | null;
  /**
   * Attribution the source's terms require us to carry. Rendered in the
   * dashboard; Remotive terminates API access without it.
   */
  attribution: string | null;
};

export type JobQuery = {
  /** Matched case-insensitively against title, tags and description. */
  keywords: string[];
  /** Upper bound on listings returned, across all pages. */
  limit: number;
};

export interface JobBoard {
  readonly name: string;
  /**
   * Minimum seconds between live calls, from the source's own terms.
   * The cache honors this; exceeding it can get API access revoked.
   */
  readonly minIntervalSeconds: number;
  search(query: JobQuery): Promise<JobListing[]>;
}

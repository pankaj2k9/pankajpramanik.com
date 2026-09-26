import type { RemoteFit } from "./types";

/**
 * Classifies a listing's location restrictions for someone contracting from
 * Bangladesh.
 *
 * Deliberately conservative: it only returns INELIGIBLE on an explicit,
 * unambiguous restriction, and UNKNOWN whenever the text is unclear, so the
 * scoring step reads the description rather than silently discarding a role.
 * Losing a good opportunity is worse than spending one scoring call.
 */

const HOME = "bangladesh";

/** Phrases that rule Pankaj out regardless of anything else in the listing. */
const HARD_BLOCKS = [
  "must be located in the united states",
  "must reside in the united states",
  "us citizens only",
  "u.s. citizens only",
  "must be a us citizen",
  "requires us work authorization",
  "must have the right to work in the us",
  "must be authorized to work in the united states",
  "eu residents only",
  "must reside in the eu",
  "must be based in the uk",
  "uk work authorization required",
  "right to work in the uk",
  "no visa sponsorship",
  "we do not sponsor",
  "onsite only",
  "on-site only",
  "hybrid role",
];

/** Location strings that mean "anywhere". */
const WORLDWIDE = ["worldwide", "anywhere", "global", "remote - global", "international"];

/**
 * Regions that include or plausibly include Bangladesh. APAC and EMEA
 * contractor roles are routinely open to South Asia.
 */
const COMPATIBLE_REGIONS = [
  "asia", "apac", "emea", "south asia", "india", "global remote",
  "any timezone", "all timezones", "remote",
];

function normalize(values: string[]): string[] {
  return values.map((v) => v.toLowerCase().trim()).filter(Boolean);
}

export function classifyRemoteFit(locations: string[], description = ""): RemoteFit {
  const body = description.toLowerCase();
  if (HARD_BLOCKS.some((phrase) => body.includes(phrase))) return "INELIGIBLE";

  const locs = normalize(locations);
  // No stated restriction on a remote board usually means unrestricted, but
  // the description can still contradict it, which the block check above ran.
  if (locs.length === 0) return "UNKNOWN";

  if (locs.some((l) => WORLDWIDE.some((w) => l.includes(w)))) return "WORLDWIDE";
  if (locs.some((l) => l.includes(HOME))) return "WORLDWIDE";
  if (locs.some((l) => COMPATIBLE_REGIONS.some((r) => l.includes(r)))) return "COMPATIBLE";

  // Named countries that are not Bangladesh and not a region we match.
  return "INELIGIBLE";
}

/** Fits worth spending a scoring call on. */
export function isWorthScoring(fit: RemoteFit): boolean {
  return fit !== "INELIGIBLE";
}

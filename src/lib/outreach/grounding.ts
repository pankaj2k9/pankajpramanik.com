import { groundingCorpus, type MasterCv } from "./master-cv";

/**
 * Mechanical fabrication check.
 *
 * NOT "ask the model whether it made anything up" — a model that invents a
 * metric will also confirm it. Every figure and every capitalised entity in
 * generated prose must appear literally in the CV or the job description.
 * Anything else fails the draft.
 *
 * Design record: docs/outreach-agent-architecture.md §6.3
 */

export type GroundingFailure = {
  kind: "number" | "entity" | "forbidden" | "recipient";
  value: string;
  context: string;
};

export type GroundingResult = {
  ok: boolean;
  failures: GroundingFailure[];
};

/** Figures that carry no claim and appear in ordinary prose. */
const HARMLESS_NUMBERS = new Set([
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "one", "two", "three", "first", "second", "24", "7",
]);

/**
 * Words that are capitalised for grammar rather than because they name
 * something. Sentence-initial words are handled separately.
 */
const STOPWORDS = new Set([
  "I", "I'm", "I've", "The", "A", "An", "And", "But", "Or", "If", "When", "While",
  "This", "That", "These", "Those", "It", "Its", "You", "Your", "We", "Our", "My",
  "Hi", "Hello", "Dear", "Thanks", "Best", "Regards", "Kind", "Happy", "Would",
  "Could", "Should", "Is", "Are", "Was", "Were", "Have", "Has", "Had", "Do", "Does",
  "For", "From", "With", "At", "On", "In", "To", "Of", "As", "By", "Not", "No",
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  "January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December",
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ");
}

/** Digit runs with optional unit: 87%, 100,000+, 8, 3.5x. */
function extractNumbers(text: string): string[] {
  return (text.match(/\d[\d,.]*\+?%?x?/g) ?? [])
    // "2." from a numbered list is the number 2, not a claim of "2.".
    .map((n) => n.replace(/\.+$/, ""))
    .filter(Boolean);
}

/**
 * Capitalised words and runs, which is where invented employers and products
 * show up. Sentence-initial words are dropped, since capitalisation there
 * says nothing.
 */
function extractEntities(text: string): string[] {
  const found: string[] = [];
  for (const sentence of text.split(/(?<=[.!?\n])\s+/)) {
    const words = sentence.trim().split(/\s+/);
    words.forEach((word, index) => {
      const clean = word
        .replace(/^[^A-Za-z0-9]+/, "")
        .replace(/[^A-Za-z0-9+#.]+$/, "")
        // A sentence-ending period must not make "Python." look invented,
        // while an internal dot in "node.js" has to survive.
        .replace(/\.+$/, "")
        // Possessives: "Faire's" is the same entity as "Faire".
        .replace(/['\u2019]s$/i, "");
      if (!clean || clean.length < 3) return;
      if (index === 0) return;                       // sentence-initial
      if (!/^[A-Z]/.test(clean)) return;             // not capitalised
      if (STOPWORDS.has(clean)) return;
      found.push(clean);
    });
  }
  return [...new Set(found)];
}

/**
 * Checks generated prose against everything the agent is allowed to state.
 *
 * `jobDescription` is part of the permitted corpus: naming the company's own
 * technologies back to them is grounded, not invented.
 */
export function checkGrounding(
  prose: string,
  cv: MasterCv,
  jobDescription: string,
  recipient?: { name?: string | null; title?: string | null; company?: string | null },
): GroundingResult {
  const { text: cvText, numbers: cvNumbers } = groundingCorpus(cv);
  // The recipient's own name, title and company are facts we were given, and
  // a greeting legitimately repeats them ("Hiring Manager", "Head of Data").
  const permitted = normalize(
    [cvText, jobDescription, recipient?.name, recipient?.title, recipient?.company]
      .filter(Boolean)
      .join("\n"),
  );
  const failures: GroundingFailure[] = [];

  // A resolved conflict names wording that must never reappear.
  for (const conflict of cv.conflicts) {
    for (const phrase of conflict.forbidden) {
      if (normalize(prose).includes(normalize(phrase))) {
        failures.push({ kind: "forbidden", value: phrase, context: conflict.field });
      }
    }
  }

  // Figures are the most damaging fabrication, so they are checked strictly.
  const jobNumbers = new Set(extractNumbers(jobDescription));
  for (const number of extractNumbers(prose)) {
    if (HARMLESS_NUMBERS.has(number)) continue;
    if (cvNumbers.has(number) || jobNumbers.has(number)) continue;
    if (permitted.includes(normalize(number))) continue;
    failures.push({ kind: "number", value: number, context: "not stated in the CV or the listing" });
  }

  for (const entity of extractEntities(prose)) {
    const term = normalize(entity);
    // "LLMs" is the same claim as "LLM"; a plural must not read as invented.
    const singular = term.replace(/(?:'s|s)$/, "");
    if (permitted.includes(term)) continue;
    if (singular.length >= 3 && permitted.includes(singular)) continue;
    failures.push({ kind: "entity", value: entity, context: "named but not in the CV or the listing" });
  }

  // The recipient must be addressed exactly as the provider returned them.
  if (recipient?.name) {
    const first = recipient.name.trim().split(/\s+/)[0];
    if (first && !normalize(prose).includes(normalize(first))) {
      failures.push({ kind: "recipient", value: first, context: "recipient is never addressed" });
    }
  }

  return { ok: failures.length === 0, failures };
}

/** One-line summary for the dashboard and the audit trail. */
export function describeFailures(failures: GroundingFailure[]): string {
  return failures
    .map((f) => `${f.kind}: "${f.value}" (${f.context})`)
    .join("; ");
}

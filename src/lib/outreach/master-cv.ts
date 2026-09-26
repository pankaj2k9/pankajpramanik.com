import { z } from "zod";

/**
 * The structured master CV.
 *
 * Everything the agent writes about Pankaj must come from this file. The
 * tailoring step SELECTS and REORDERS these records; it never generates a
 * bullet, an employer, a date or a metric. That is what makes "never invent"
 * an architectural property instead of a prompt instruction.
 *
 * Built by scripts/build-master-cv.ts from two sources:
 *  - the site database (Experience, Project, SkillGroup, Education, Certification)
 *  - prisma/content/cv-overlay.json, the hand-reviewed records that exist only
 *    in the published PDF
 *
 * Design record: docs/outreach-agent-architecture.md §6
 */

/** Where a record came from, so any claim can be traced back. */
export const provenance = z.enum(["db", "pdf", "both"]);
export type Provenance = z.infer<typeof provenance>;

/** YYYY-MM, or "present" for an ongoing role. */
const month = z.string().regex(/^(\d{4}-\d{2}|present)$/);

export const roleSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().default("Remote"),
  start: month,
  end: month,
  summary: z.string().default(""),
  bullets: z.array(z.string()).default([]),
  tech: z.array(z.string()).default([]),
  source: provenance,
});

export const projectSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().default(""),
  problem: z.string().default(""),
  approach: z.string().default(""),
  outcome: z.string().default(""),
  tech: z.array(z.string()).default([]),
  category: z.string().default("General"),
  url: z.string().nullable().default(null),
  source: provenance,
});

export const educationSchema = z.object({
  degree: z.string().min(1),
  institution: z.string().min(1),
  startYear: z.number().int(),
  endYear: z.number().int().nullable(),
  note: z.string().default(""),
  source: provenance,
});

export const certificationSchema = z.object({
  title: z.string().min(1),
  issuer: z.string().min(1),
  url: z.string().nullable().default(null),
  source: provenance,
});

/**
 * Achievements carry the CV's numeric claims ("87% accuracy"). They are listed
 * separately because the grounding check treats every figure as a hard
 * allow-list: a number absent from here cannot appear in generated prose.
 */
export const achievementSchema = z.object({
  label: z.string().min(1),
  detail: z.string().min(1),
  source: provenance,
});

export const masterCvSchema = z.object({
  generatedAt: z.string(),
  name: z.string(),
  headline: z.string(),
  location: z.string(),
  email: z.string(),
  website: z.string(),
  summary: z.string(),
  yearsExperience: z.number().int(),
  roles: z.array(roleSchema),
  projects: z.array(projectSchema),
  skills: z.array(z.object({ category: z.string(), items: z.array(z.string()) })),
  education: z.array(educationSchema),
  certifications: z.array(certificationSchema),
  achievements: z.array(achievementSchema),
  /** Conflicts the build found between the database and the PDF. */
  conflicts: z.array(
    z.object({ field: z.string(), db: z.string(), pdf: z.string(), note: z.string() }),
  ),
});

export type MasterCv = z.infer<typeof masterCvSchema>;
export type CvRole = z.infer<typeof roleSchema>;
export type CvProject = z.infer<typeof projectSchema>;

/**
 * Every literal string and number the agent is permitted to state.
 *
 * `groundingCheck` (phase 5) extracts the entities and figures from generated
 * prose and requires each one to appear here or in the job description.
 * Anything else is a fabrication and fails the draft.
 */
export function groundingCorpus(cv: MasterCv): { text: string; numbers: Set<string> } {
  const parts = [
    cv.name, cv.headline, cv.location, cv.summary,
    ...cv.roles.flatMap((r) => [r.company, r.title, r.location, r.summary, ...r.bullets, ...r.tech]),
    ...cv.projects.flatMap((p) => [p.title, p.summary, p.problem, p.approach, p.outcome, ...p.tech]),
    ...cv.skills.flatMap((s) => [s.category, ...s.items]),
    ...cv.education.flatMap((e) => [e.degree, e.institution, e.note]),
    ...cv.certifications.flatMap((c) => [c.title, c.issuer]),
    ...cv.achievements.flatMap((a) => [a.label, a.detail]),
  ];
  const text = parts.join("\n");
  // Any digit run, with or without a unit, that the CV actually states.
  const numbers = new Set(text.match(/\d[\d,.]*\+?%?/g) ?? []);
  numbers.add(String(cv.yearsExperience));
  return { text, numbers };
}

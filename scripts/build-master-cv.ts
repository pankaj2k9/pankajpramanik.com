/**
 * Builds prisma/content/master-cv.json — the agent's only source of truth
 * about Pankaj.
 *
 *   npx tsx scripts/build-master-cv.ts [--check]
 *
 * Sources, in order of precedence:
 *   1. the site database (Experience, Project, SkillGroup, Education, Certification)
 *   2. prisma/content/cv-overlay.json, for records only the published PDF has
 *
 * The database wins on anything both contain, so updating the site keeps the
 * agent current. --check exits non-zero if the committed file is stale.
 *
 * Design record: docs/outreach-agent-architecture.md §6
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { groundingCorpus, masterCvSchema, type MasterCv } from "../src/lib/outreach/master-cv";
import { site } from "../src/lib/site";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const OVERLAY = path.join(ROOT, "prisma/content/cv-overlay.json");
const OUTPUT = path.join(ROOT, "prisma/content/master-cv.json");

const ym = (d: Date) => d.toISOString().slice(0, 7);
const key = (company: string, title: string) =>
  `${company}::${title}`.toLowerCase().replace(/[^a-z0-9:]/g, "");

type Overlay = {
  roles: Array<Omit<MasterCv["roles"][number], "source">>;
  achievements: Array<Omit<MasterCv["achievements"][number], "source">>;
  summary: string;
  conflicts: MasterCv["conflicts"];
};

async function build(): Promise<MasterCv> {
  const overlay = JSON.parse(readFileSync(OVERLAY, "utf8")) as Overlay;

  const [experience, projects, skills, education, certifications] = await Promise.all([
    prisma.experience.findMany({ orderBy: [{ order: "asc" }] }),
    prisma.project.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ featured: "desc" }, { order: "asc" }],
    }),
    prisma.skillGroup.findMany({ orderBy: { order: "asc" } }),
    prisma.education.findMany({ orderBy: { order: "asc" } }),
    prisma.certification.findMany({ orderBy: { order: "asc" } }),
  ]);

  const dbRoles: MasterCv["roles"] = experience.map((e) => ({
    company: e.company,
    title: e.role,
    location: e.location,
    start: ym(e.startDate),
    end: e.current ? "present" : e.endDate ? ym(e.endDate) : "present",
    summary: e.summary,
    bullets: e.highlights,
    tech: e.techStack,
    source: "db" as const,
  }));

  // Overlay roles the database already knows about are marked "both" rather
  // than duplicated; the rest are PDF-only.
  const seen = new Set(dbRoles.map((r) => key(r.company, r.title)));
  const overlayRoles: MasterCv["roles"] = overlay.roles.map((r) => ({
    ...r,
    source: seen.has(key(r.company, r.title)) ? ("both" as const) : ("pdf" as const),
  }));

  const roles = [...dbRoles, ...overlayRoles].sort((a, b) =>
    a.end === "present" && b.end !== "present" ? -1
      : b.end === "present" && a.end !== "present" ? 1
      : b.start.localeCompare(a.start),
  );

  return masterCvSchema.parse({
    generatedAt: new Date().toISOString(),
    name: site.name,
    headline: "Senior Data & AI Engineer",
    location: "Bangladesh",
    email: site.businessEmail,
    website: site.url,
    summary: overlay.summary,
    yearsExperience: site.yearsExperience,
    roles,
    // "Work Experience" portfolio entries restate employment; keeping them
    // would let the CV count the same job twice.
    projects: projects
      .filter((p) => p.category !== "Work Experience")
      .map((p) => ({
        slug: p.slug,
        title: p.title,
        summary: p.tagline || p.description,
        problem: p.problem,
        approach: p.approach,
        outcome: p.outcome,
        tech: p.techStack,
        category: p.category,
        url: p.liveUrl ?? p.repoUrl ?? `${site.url}/portfolio/${p.slug}`,
        source: "db" as const,
      })),
    skills: skills.map((s) => ({ category: s.category, items: s.items })),
    education: education.map((e) => ({
      degree: e.degree,
      institution: e.institution,
      startYear: e.startYear,
      endYear: e.endYear,
      note: e.description,
      source: "db" as const,
    })),
    certifications: certifications.map((c) => ({
      title: c.title,
      issuer: c.issuer,
      url: c.url,
      source: "db" as const,
    })),
    achievements: overlay.achievements.map((a) => ({ ...a, source: "pdf" as const })),
    conflicts: overlay.conflicts,
  });
}

/**
 * A resolved conflict names wording the agent must never emit. If any of it
 * reaches the grounding corpus, the agent could state it as fact, so the build
 * refuses rather than shipping a CV that can repeat a rejected claim.
 */
function assertNoForbiddenWording(cv: MasterCv): void {
  const { text } = groundingCorpus(cv);
  const found = cv.conflicts.flatMap((c) =>
    c.forbidden.filter((phrase) => text.includes(phrase)).map((phrase) => ({ c, phrase })),
  );
  if (found.length === 0) return;
  for (const { c, phrase } of found) {
    console.error(`Forbidden wording reached the CV corpus: "${phrase}" (${c.field})`);
    console.error(`  ${c.decision || c.note}`);
  }
  process.exit(1);
}

async function main() {
  const cv = await build();
  assertNoForbiddenWording(cv);
  // Trailing newline included, so --check compares like for like with the file.
  const json = JSON.stringify(cv, null, 2) + "\n";

  if (process.argv.includes("--check")) {
    let current = "";
    try { current = readFileSync(OUTPUT, "utf8"); } catch { /* not built yet */ }
    // generatedAt always differs; compare everything else.
    const strip = (s: string) => s.replace(/"generatedAt": "[^"]*",?\n/, "");
    if (strip(current) !== strip(json)) {
      console.error("master-cv.json is stale. Run: npx tsx scripts/build-master-cv.ts");
      process.exit(1);
    }
    console.log("master-cv.json is current.");
    return;
  }

  writeFileSync(OUTPUT, json);

  const bySource = (s: string) => cv.roles.filter((r) => r.source === s).length;
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
  console.log(
    `  roles ${cv.roles.length} (db ${bySource("db")}, pdf ${bySource("pdf")}, both ${bySource("both")})`,
  );
  console.log(`  projects ${cv.projects.length}`);
  console.log(`  skills ${cv.skills.length} groups`);
  console.log(`  education ${cv.education.length}`);
  console.log(`  certifications ${cv.certifications.length}`);
  console.log(`  achievements ${cv.achievements.length}`);

  const unresolved = cv.conflicts.filter((c) => !c.decision);
  const resolved = cv.conflicts.filter((c) => c.decision);

  if (resolved.length) {
    console.log(`\n  ${resolved.length} resolved conflict(s):`);
    for (const c of resolved) console.log(`    ${c.field} — ${c.decision}`);
  }

  if (unresolved.length) {
    console.log(`\n  ${unresolved.length} unresolved conflict(s) — review before any run:`);
    for (const c of unresolved) {
      console.log(`\n  ${c.field}`);
      console.log(`    db:  ${c.db}`);
      console.log(`    pdf: ${c.pdf}`);
      console.log(`    ${c.note}`);
    }
  }
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(() => prisma.$disconnect());

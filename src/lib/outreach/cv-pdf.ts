import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createElement as h, type ReactElement } from "react";
import { STORAGE_DIR } from "@/lib/storage";
import type { MasterCv } from "./master-cv";
import type { TailoredCv } from "./drafting";

/**
 * Renders the tailored CV to PDF.
 *
 * Every value comes from the structured CV, so the document is a VIEW over
 * selected records and cannot introduce a claim the grounding check never saw.
 *
 * Two deliberate choices:
 *  - @react-pdf/renderer rather than headless Chrome, so the production image
 *    does not have to carry a browser.
 *  - The package is loaded with a dynamic import and the tree is built with
 *    createElement rather than JSX. @react-pdf/hyphenate is ESM-only (its
 *    exports map has no `require`), so a static import fails under CommonJS —
 *    which is how a plain Node worker resolves this file. The dynamic import
 *    works in both the Next runtime and the worker.
 *
 * Design record: docs/outreach-agent-architecture.md §6.4
 */

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** "2025-03" to "Mar 2025"; "present" is left alone. */
function period(value: string): string {
  if (value === "present") return "Present";
  const [year, month] = value.split("-").map(Number);
  return month ? `${MONTHS[month - 1]} ${year}` : String(year);
}

type Pdf = typeof import("@react-pdf/renderer");

function buildStyles(pdf: Pdf) {
  return pdf.StyleSheet.create({
    page: { paddingTop: 34, paddingBottom: 34, paddingHorizontal: 40, fontSize: 9.5, lineHeight: 1.45, color: "#1a1a1a" },
    // Two rules here exist for text EXTRACTION, not appearance, because an
    // applicant tracking system reads this document the way pdftotext does:
    //   - no letterSpacing: it inserts gaps inside words
    //   - an explicit lineHeight on any text much larger than the page's
    //     base size: inheriting the page's 1.45 makes the line box tall
    //     enough that "PANKAJ KUMAR PRAMANIK" extracts as "PANKAJ" alone.
    name: { fontSize: 19, fontWeight: "bold", lineHeight: 1.2 },
    headline: { fontSize: 10.5, marginTop: 3, color: "#333", lineHeight: 1.2 },
    contact: { fontSize: 8.5, marginTop: 5, color: "#555" },
    sectionTitle: {
      fontSize: 9.5, fontWeight: "bold", marginTop: 13, marginBottom: 5,
      borderBottomWidth: 0.7, borderBottomColor: "#bbb", paddingBottom: 2.5,
    },
    summary: { marginTop: 9, textAlign: "justify" },
    row: { flexDirection: "row", justifyContent: "space-between" },
    roleTitle: { fontWeight: "bold", fontSize: 10 },
    roleMeta: { fontSize: 8.5, color: "#555" },
    dates: { fontSize: 8.5, color: "#555" },
    bullet: { flexDirection: "row", marginTop: 2.5, paddingRight: 4 },
    dot: { width: 8, fontSize: 9 },
    entry: { marginBottom: 8 },
    skillRow: { flexDirection: "row", marginBottom: 2.5 },
    skillLabel: { width: 118, fontWeight: "bold", fontSize: 8.8 },
    skillItems: { flex: 1, fontSize: 8.8 },
    tech: { fontSize: 8.3, color: "#555", marginTop: 1.5 },
    grow: { flex: 1 },
  });
}

function buildDocument(pdf: Pdf, cv: MasterCv, tailored: TailoredCv): ReactElement {
  const s = buildStyles(pdf);
  const { Document, Page, Text, View } = pdf;

  const text = (style: unknown, content: string, key?: string) =>
    h(Text, { style, key } as never, content);

  const heading = (label: string) => text(s.sectionTitle, label, `h-${label}`);

  const bullet = (line: string, key: string) =>
    h(View, { style: s.bullet, key } as never,
      h(Text, { style: s.dot } as never, "•"),
      h(Text, { style: s.grow } as never, line));

  const children: ReactElement[] = [
    text(s.name, cv.name.toUpperCase(), "name"),
    text(s.headline, cv.headline, "headline"),
    text(s.contact, [cv.location, cv.email, cv.website].filter(Boolean).join("  |  "), "contact"),
    text(s.summary, tailored.summary, "summary"),

    heading("CORE SKILLS"),
    ...tailored.skills.map((group) =>
      h(View, { style: s.skillRow, key: `sk-${group.category}` } as never,
        h(Text, { style: s.skillLabel } as never, group.category),
        h(Text, { style: s.skillItems } as never, group.items.join(", ")))),

    heading("PROFESSIONAL EXPERIENCE"),
    ...tailored.roles.map((role) =>
      h(View, { style: s.entry, wrap: false, key: `r-${role.company}-${role.title}` } as never,
        h(View, { style: s.row } as never,
          h(Text, { style: s.roleTitle } as never, role.title),
          h(Text, { style: s.dates } as never, `${period(role.start)} - ${period(role.end)}`)),
        h(Text, { style: s.roleMeta } as never,
          role.location ? `${role.company} | ${role.location}` : role.company),
        ...role.bullets.slice(0, 4).map((line, i) => bullet(line, `b-${role.company}-${i}`)))),
  ];

  if (tailored.projects.length > 0) {
    children.push(heading("SELECTED PROJECTS"));
    for (const project of tailored.projects) {
      children.push(
        h(View, { style: s.entry, wrap: false, key: `p-${project.slug}` } as never,
          h(Text, { style: s.roleTitle } as never, project.title),
          h(Text, {} as never, project.summary),
          ...(project.tech.length
            ? [h(Text, { style: s.tech } as never, `Stack: ${project.tech.slice(0, 10).join(", ")}`)]
            : [])),
      );
    }
  }

  children.push(heading("EDUCATION"));
  for (const entry of cv.education) {
    children.push(
      h(View, { style: s.row, key: `e-${entry.institution}-${entry.startYear}` } as never,
        h(Text, {} as never, `${entry.degree} - ${entry.institution}`),
        h(Text, { style: s.dates } as never,
          entry.endYear ? `${entry.startYear} - ${entry.endYear}` : String(entry.startYear))),
    );
  }

  if (cv.certifications.length > 0) {
    children.push(heading("CERTIFICATIONS"));
    children.push(
      text({}, cv.certifications.slice(0, 8).map((c) => `${c.title} (${c.issuer})`).join("  •  "), "certs"),
    );
  }

  return h(Document, { title: `${cv.name} - ${cv.headline}`, author: cv.name, subject: cv.headline } as never,
    h(Page, { size: "A4", style: s.page } as never, ...children));
}

export type RenderedCv = {
  /** Path relative to STORAGE_DIR, as stored on the opportunity. */
  filePath: string;
  absolutePath: string;
  /** Content hash, so approval can assert the file did not change after review. */
  version: string;
  bytes: number;
};

/** Renders the document without storing it — used by tests and previews. */
/**
 * Stable identity for a rendered CV.
 *
 * Hashing the PDF bytes does not work: the format embeds a creation timestamp
 * and a document id, so identical content produces a different hash every
 * render. The version therefore hashes the CONTENT that was selected, which
 * is what the approval gate actually needs to assert — that the reviewed CV
 * is the CV that gets attached.
 */
export function cvVersion(cv: MasterCv, tailored: TailoredCv): string {
  const content = JSON.stringify({
    name: cv.name, headline: cv.headline, contact: [cv.location, cv.email, cv.website],
    summary: tailored.summary,
    roles: tailored.roles.map((r) => [r.company, r.title, r.start, r.end, r.bullets]),
    projects: tailored.projects.map((p) => [p.slug, p.title, p.summary, p.tech]),
    skills: tailored.skills,
    education: cv.education.map((e) => [e.degree, e.institution, e.startYear, e.endYear]),
    certifications: cv.certifications.slice(0, 8).map((c) => [c.title, c.issuer]),
  });
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

let hyphenationDisabled = false;

export async function renderCvBuffer(cv: MasterCv, tailored: TailoredCv): Promise<Buffer> {
  const pdf = (await import("@react-pdf/renderer")) as Pdf;

  // react-pdf hyphenates by default. A CV should never show a hyphen-broken
  // word, and hyphenated words extract badly for an applicant tracking
  // system, so words are kept whole.
  if (!hyphenationDisabled) {
    pdf.Font.registerHyphenationCallback((word) => [word]);
    hyphenationDisabled = true;
  }
  // buildDocument returns the Document element; createElement cannot carry the
  // library's DocumentProps generic through, so the cast is at this one seam.
  const document = buildDocument(pdf, cv, tailored) as Parameters<Pdf["renderToBuffer"]>[0];
  return pdf.renderToBuffer(document);
}

/**
 * Renders and stores the CV under STORAGE_DIR, which is a bind mount in
 * production, so generated files survive a redeploy exactly like uploads.
 */
export async function renderTailoredCv(
  cv: MasterCv,
  tailored: TailoredCv,
  runId: string,
  opportunityId: string,
): Promise<RenderedCv> {
  const buffer = await renderCvBuffer(cv, tailored);

  const relative = path.join("outreach", runId, `${opportunityId}.pdf`);
  const absolute = path.join(STORAGE_DIR, relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, buffer);

  return {
    filePath: relative,
    absolutePath: absolute,
    version: cvVersion(cv, tailored),
    bytes: buffer.length,
  };
}

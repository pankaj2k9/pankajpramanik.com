import { breadcrumbJsonLd, jsonLdGraph, metaDescription, pageMetadata, PERSON_ID } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPageBySlug, getPublishedProjects, getServices } from "@/lib/queries";
import { renderContent, upgradeCtaLinks } from "@/lib/content";
import { absoluteUrl, site } from "@/lib/site";
import { jsonLdScript } from "@/lib/utils";
import { groupForService, serviceGroups } from "@/lib/service-catalog";
import { projectTags } from "@/lib/project-tags";
import PageHero from "@/components/inner/PageHero";
import SectionHead from "@/components/inner/SectionHead";
import PageCTA from "@/components/inner/PageCTA";
import ArchitectureFlow from "@/components/inner/ArchitectureFlow";
import ProjectCard from "@/components/inner/ProjectCard";
import PageMotion from "@/components/motion/PageMotion";
import SystemVisual from "@/components/home/SystemVisual";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const services = await prisma.page.findMany({
      where: { kind: "SERVICE" },
      select: { slug: true },
    });
    return services.map((s) => ({ slug: s.slug }));
  } catch {
    // DB unreachable at build time — pages render on demand (ISR)
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page || page.kind !== "SERVICE") return {};
  const title = page.seoTitle || page.label || page.title;
  return pageMetadata(title, metaDescription(page.seoDescription || page.summary), `/services/${page.slug}`, {
    absoluteTitle: title.length > 40,
  });
}

type Feature = { icon: string; title: string; desc: string };

type Showcase = {
  img: string | null;
  title: string;
  desc: string;
  href: string | null;
};
type Section = { title: string; body: string };

const stripTags = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;|&#038;/g, "&")
    .replace(/&#8217;|&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Remove decorative inline images from the article body. Feature-card
 * icons and case-study screenshots are extracted separately and rendered
 * on their own; the images left in the prose are reused stock art that
 * looks out of place, so strip them (and any now-empty figure wrappers).
 */
function stripInlineImages(html: string): string {
  return html
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/g, "")
    .replace(/<img\b[^>]*\/?>/g, "")
    .replace(/<p>\s*<\/p>/g, "");
}

/**
 * The tail of each migrated service page is a flat run of <h2> sections:
 * some are project showcases (screenshot + "Explore Project" link), some
 * are real copy, and some are empty Elementor tab stubs ("AI Industry" /
 * "Hire Me"). Split and classify them so each kind gets a proper layout.
 */
function organizeArticle(html: string): {
  intro: string;
  showcases: Showcase[];
  sections: Section[];
} {
  const parts = html.split(/<h2>([\s\S]*?)<\/h2>/);
  const intro = parts[0]?.trim() ?? "";
  const showcases: Showcase[] = [];
  const sections: Section[] = [];

  for (let i = 1; i < parts.length; i += 2) {
    const title = stripTags(parts[i] ?? "");
    const body = (parts[i + 1] ?? "").trim();
    const text = stripTags(body);
    const isShowcase = /explore\s+project/i.test(text);

    if (isShowcase) {
      const img = body.match(/<img[^>]*\bsrc="([^"]+)"[^>]*>/)?.[1] ?? null;
      const href =
        body.match(/<a[^>]*\bhref="([^"]+)"[^>]*>\s*Explore/i)?.[1] ??
        body.match(/<a[^>]*\bhref="([^"]+)"/)?.[1] ??
        null;
      const desc =
        stripTags(body.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? "").replace(
          /Explore Project.*$/i,
          "",
        ) || text.replace(/Explore Project.*$/i, "");
      showcases.push({ img, title, desc, href });
      continue;
    }

    // Elementor tab/label stubs carry almost no text — drop them
    if (text.length < 90) continue;

    sections.push({ title, body });
  }

  return { intro, showcases, sections };
}

/**
 * Migrated service content follows a consistent Elementor pattern:
 * `<img class="svc-icon" src="…"><h2>Feature</h2><p>Description</p>`.
 * Pull those triplets out into a proper card grid and keep the rest
 * of the article as flowing prose.
 */
function extractFeatures(html: string): { features: Feature[]; rest: string } {
  const features: Feature[] = [];
  const rest = html.replace(
    // attribute order varies after sanitizing — assert svc-icon via lookahead
    /<img\b(?=[^>]*\bsvc-icon\b)[^>]*\bsrc="([^"]+)"[^>]*\/?>\s*<h2>([\s\S]*?)<\/h2>\s*<p>([\s\S]*?)<\/p>/g,
    (_m, icon: string, title: string, desc: string) => {
      features.push({ icon, title, desc });
      return "";
    },
  );
  return { features, rest };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page || page.kind !== "SERVICE") notFound();

  const [services, projects] = await Promise.all([
    getServices(),
    getPublishedProjects(),
  ]);
  const group = groupForService(slug) ?? serviceGroups[serviceGroups.length - 1];
  const title = page.label || page.title;
  const siblings = services.filter(
    (s) => group.serviceSlugs.includes(s.slug) && s.slug !== slug,
  );
  const related = projects
    .map((p) => ({ p, tags: projectTags(p) }))
    .filter(({ tags }) => group.projectTags.includes(tags[0]?.id))
    .slice(0, 3);
  const fullHtml = renderContent(page.content, page.contentFormat);
  const { features, rest } = extractFeatures(fullHtml);
  const { intro, showcases, sections } = organizeArticle(rest);

  const jsonLd = jsonLdGraph(
    {
      "@type": "Service",
      name: page.label || page.title,
      description: page.summary,
      serviceType: group.label,
      provider: { "@type": "Person", "@id": PERSON_ID, name: site.name, url: absoluteUrl("/") },
      areaServed: "Worldwide",
      url: absoluteUrl(`/services/${page.slug}`),
    },
    breadcrumbJsonLd([
      ["Services", "/services"],
      [page.label || page.title, `/services/${page.slug}`],
    ]),
  );

  const steps = [
    { id: "intro", label: "Intro" },
    { id: "problem", label: "Problem" },
    { id: "build", label: "What I build" },
    { id: "how", label: "How it works" },
    ...(stripTags(intro).length || sections.length ? [{ id: "details", label: "In depth" }] : []),
    { id: "stack", label: "Stack" },
    ...(related.length || showcases.length ? [{ id: "work", label: "Related work" }] : []),
    { id: "contact", label: "Contact" },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <PageHero
        index="03"
        label={`Services / ${group.label}`}
        tone={group.tone}
        lines={[title, group.title]}
        lead={page.summary ? <p>{page.summary}</p> : <p>{group.description}</p>}
        visual={
          <div className="sd-visual ip-card" data-hm-pointer>
            <div className="sd-visual-art">
              <SystemVisual kind={group.visual} />
            </div>
            <dl className="sd-meta">
              <div>
                <dt>Area</dt>
                <dd>{group.label}</dd>
              </div>
              <div>
                <dt>Stages</dt>
                <dd>{group.stages.length}</dd>
              </div>
              <div>
                <dt>Related projects</dt>
                <dd>{related.length}</dd>
              </div>
            </dl>
          </div>
        }
      >
        <div className="ip-actions">
          <Link className="hm-button" href={`/contact?service=${group.id}`} data-hm-magnetic>
            Discuss this service <span aria-hidden>↗</span>
          </Link>
          <Link className="ip-back" href={`/services?area=${group.id}#explorer`}>
            <span aria-hidden>←</span> All services
          </Link>
        </div>
      </PageHero>

      <section id="problem" className="ip-section">
        <div className="hm-container">
          <SectionHead
            index="01"
            label="The problem"
            title={["What usually", "gets in the way."]}
            intro={group.description}
          />
          <div className="sd-problems" data-hm-stagger>
            {group.problems.map((problem, i) => (
              <article key={problem} className={`ip-card sd-problem tone-${group.tone}`} data-hm="up" data-hm-focus>
                <span className="sd-problem-num">{String(i + 1).padStart(2, "0")}</span>
                <p>{problem}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="build" className="ip-section is-tint">
        <div className="hm-container">
          <SectionHead
            index="02"
            label="What I build"
            title={features.length ? ["Capabilities", "in this service."] : ["What you get."]}
          />
          {features.length > 0 ? (
            <div className="sd-features" data-hm-stagger>
              {features.map((f, i) => (
                <article key={f.title} className={`ip-card sd-feature tone-${group.tone}`} data-hm="up">
                  <div className="sd-feature-top">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.icon} alt="" width={40} height={40} loading="lazy" />
                    <span>{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 dangerouslySetInnerHTML={{ __html: f.title }} />
                  <p dangerouslySetInnerHTML={{ __html: f.desc }} />
                </article>
              ))}
            </div>
          ) : null}
          <ul className="sd-deliverables" data-hm-stagger>
            {group.deliverables.map((d) => (
              <li key={d} data-hm="up">
                {d}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="how" className={`ip-section tone-${group.tone}`}>
        <div className="hm-container sd-how">
          <div className="sd-how-aside">
            <SectionHead
              index="03"
              label="How it works"
              title={[group.architectureTitle]}
            />
            <p className="hm-intro" data-hm="up">
              A typical architecture for this kind of work. Scroll to follow the
              flow, or hover a stage for detail.
            </p>
          </div>
          <ArchitectureFlow items={group.stages} label={`${group.label} architecture`} />
        </div>
      </section>

      {(stripTags(intro).length > 0 || sections.length > 0) && (
        <section id="details" className="ip-section is-tint">
          <div className="hm-container">
            <SectionHead index="04" label="In depth" title={["The details."]} />
            {stripTags(intro).length > 0 && (
              <div
                className="prose-content sd-intro"
                data-hm="up"
                dangerouslySetInnerHTML={{ __html: stripInlineImages(upgradeCtaLinks(intro)) }}
              />
            )}
            {sections.length > 0 && (
              <div className="sd-sections">
                {sections.map((sec) => (
                  <div key={sec.title} className="sd-section" data-hm="up">
                    <h3>{sec.title}</h3>
                    <div
                      className="prose-content"
                      dangerouslySetInnerHTML={{ __html: stripInlineImages(upgradeCtaLinks(sec.body)) }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section id="stack" className="ip-section">
        <div className="hm-container sd-stack">
          <SectionHead index="05" label="Tech stack" title={["Tools I use", "for this work."]} />
          <div className="sd-stack-body" data-hm-stagger>
            <ul className="sd-tools">
              {group.tools.map((t) => (
                <li key={t} className={`tone-${group.tone}`} data-hm="up">
                  {t}
                </li>
              ))}
            </ul>
            {siblings.length > 0 && (
              <div className="sd-siblings" data-hm="up">
                <p className="hm-label">More in {group.label}</p>
                <ul className="sx-links">
                  {siblings.map((s) => (
                    <li key={s.id}>
                      <Link href={`/services/${s.slug}`}>
                        {s.label} <span aria-hidden>→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {(related.length > 0 || showcases.length > 0) && (
        <section id="work" className="ip-section is-tint">
          <div className="hm-container">
            <SectionHead
              index="06"
              label="Related work"
              title={["Proof,", "not promises."]}
              action={
                <Link className="hm-link" href="/portfolio">
                  All projects <span aria-hidden>→</span>
                </Link>
              }
            />
            <div className="pj-grid" data-hm-stagger>
              {related.map(({ p, tags }) => (
                <ProjectCard key={p.id} project={p} tags={tags} />
              ))}
              {showcases.map((sc) => (
                <a
                  key={sc.title}
                  href={sc.href ?? "#"}
                  target={sc.href?.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className={`hm-project tone-${group.tone}`}
                  data-hm="up"
                  data-hm-pointer
                  data-hm-tilt
                >
                  <div className="hm-project-visual" data-cursor-label="Explore project ↗">
                    <SystemVisual kind={group.visual} />
                  </div>
                  <div className="hm-project-body">
                    <div className="hm-card-meta">
                      <span>Showcase</span>
                      <span className="hm-arrow" aria-hidden>
                        ↗
                      </span>
                    </div>
                    <h3>{sc.title}</h3>
                    <p>{sc.desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <PageCTA
        label={group.label}
        lines={[`Need ${title}?`, "Let’s scope it together."]}
        copy="Tell me about the goal, the data and the constraints. I’ll reply with questions and a practical first step."
        href={`/contact?service=${group.id}`}
        cta="Start a project"
      />
      <PageMotion steps={steps} />
    </>
  );
}

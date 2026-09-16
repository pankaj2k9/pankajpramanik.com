import Link from "next/link";
import Image from "next/image";
import { pageMetadata } from "@/lib/seo";
import { getCategoriesWithCounts, getPublishedPosts } from "@/lib/queries";
import { readingTimeMinutes } from "@/lib/content";
import { formatDate } from "@/lib/utils";
import PageHero from "@/components/inner/PageHero";
import SectionHead from "@/components/inner/SectionHead";
import PageCTA from "@/components/inner/PageCTA";
import PageMotion from "@/components/motion/PageMotion";
import BlogExplorer, { type BlogPost } from "@/components/inner/BlogExplorer";
import SystemVisual, { type SystemVisualKind } from "@/components/home/SystemVisual";
import Counter from "@/components/site/Counter";

export const revalidate = 300;

export const metadata = pageMetadata(
  "Journal - Writing on AI, data & engineering",
  "Articles on AI engineering, LLM/RAG systems, MLOps, data engineering, and full-stack development.",
  "/blog",
);

const STEPS = [
  { id: "intro", label: "Intro" },
  { id: "featured", label: "Featured" },
  { id: "articles", label: "Articles" },
  { id: "contact", label: "Contact" },
];

const TONES = ["blue", "peach", "mint", "orange", "violet"];
const VISUALS: SystemVisualKind[] = ["knowledge", "pipeline", "workflow", "analytics", "production"];

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const [{ category }, posts, categories] = await Promise.all([
    searchParams,
    getPublishedPosts(),
    getCategoriesWithCounts(),
  ]);

  const mapped: BlogPost[] = posts.map((p, i) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    coverImage: p.coverImage,
    date: p.publishedAt?.toISOString() ?? "",
    dateLabel: formatDate(p.publishedAt),
    minutes: readingTimeMinutes(p.content, p.contentFormat),
    categories: p.categories.map((c) => ({ name: c.name, slug: c.slug })),
    tone: TONES[i % TONES.length],
    visual: VISUALS[i % VISUALS.length],
  }));
  const [featured, ...rest] = mapped;
  const categoryList = categories
    .filter((c) => c._count.posts > 0)
    .map((c) => ({ slug: c.slug, name: c.name, count: c._count.posts }));

  return (
    <>
      <PageHero
        index="07"
        label="Journal"
        tone="peach"
        lines={["Thoughts from building", "real AI systems."]}
        lead={
          <p>
            Notes on LLM and RAG systems, MLOps, data engineering and the craft
            of shipping software that has to keep working.
          </p>
        }
      >
        <dl className="ip-stats bl-stats">
          <div>
            <dd>
              <Counter value={mapped.length} />
            </dd>
            <dt>Articles published</dt>
          </div>
          <div>
            <dd>
              <Counter value={categoryList.length} />
            </dd>
            <dt>Topics covered</dt>
          </div>
        </dl>
      </PageHero>

      {featured && (
        <section id="featured" className="ip-section">
          <div className="hm-container">
            <SectionHead index="01" label="Latest" title={["Fresh from the desk."]} />
            <Link href={`/blog/${featured.slug}`} className={`bl-featured tone-${featured.tone}`} data-hm="up" data-hm-pointer>
              <div className="bl-featured-visual" data-cursor-label="Read article ↗">
                {featured.coverImage ? (
                  <Image src={featured.coverImage} alt="" fill sizes="(max-width: 900px) 100vw, 55vw" priority />
                ) : (
                  <SystemVisual kind={featured.visual} />
                )}
              </div>
              <div className="bl-featured-body">
                <div className="bl-meta">
                  {featured.categories[0] && <span className="bl-cat">{featured.categories[0].name}</span>}
                  <time dateTime={featured.date}>{featured.dateLabel}</time>
                  <span aria-hidden>·</span>
                  <span>{featured.minutes} min read</span>
                </div>
                <h3>{featured.title}</h3>
                <p>{featured.excerpt}</p>
                <span className="hm-link">
                  Read article <span aria-hidden>→</span>
                </span>
              </div>
            </Link>
          </div>
        </section>
      )}

      <section id="articles" className="ip-section is-tint">
        <div className="hm-container">
          <SectionHead
            index="02"
            label="All articles"
            title={["Everything I’ve", "written down."]}
            intro="Filter by topic or search for a specific problem."
          />
          {rest.length ? (
            <BlogExplorer posts={rest} categories={categoryList} initial={category} />
          ) : (
            <p className="hm-intro">More articles are on the way.</p>
          )}
        </div>
      </section>

      <PageCTA
        label="Discuss an idea"
        lines={["Working on something", "you want to talk through?"]}
        copy="If one of these posts is close to a problem you have, tell me about it - I’m happy to compare notes."
        cta="Start a conversation"
      />
      <PageMotion steps={STEPS} />
    </>
  );
}

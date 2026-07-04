import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import SocialLinks from "@/components/site/SocialLinks";
import { getExperiences, getSkillGroups } from "@/lib/queries";
import { site } from "@/lib/site";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "About Me",
  description:
    "AI and Data Engineer with 8+ years of experience — 5 years in full-stack development and 3+ focused on Generative AI, LLM/RAG systems, MLOps, and data engineering.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const [experiences, skillGroups] = await Promise.all([
    getExperiences(),
    getSkillGroups(),
  ]);
  const companies = experiences.map((e) => e.company);
  const yearsExperience = new Date().getFullYear() - 2017;

  return (
    <div className="container-site py-16">
      <div className="grid gap-12 lg:grid-cols-[2fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">
            About
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Hi, I&apos;m {site.name.split(" ")[0]}{" "}
            <span className="text-gradient">👋</span>
          </h1>

          <div className="mt-8 space-y-5 text-lg leading-relaxed text-muted">
            <p>
              I&apos;m an <strong className="text-foreground">AI and Data Engineer</strong>{" "}
              specializing in Generative AI, AI agents, LLM/RAG systems, data
              engineering, MLOps, and workflow automation. Over{" "}
              {yearsExperience}+ years of experience — 5 years in full-stack
              development and the last 3+ focused on AI and data — building
              scalable, end-to-end solutions across intelligent automation,
              cloud systems, and modern data platforms.
            </p>
            <p>
              I build AI-powered applications, agentic workflows, ETL/data
              pipelines, and production-ready cloud solutions using{" "}
              <strong className="text-foreground">
                LangChain, LangGraph, n8n, OpenAI, Claude, FastAPI, AWS, GCP,
                and Azure
              </strong>
              . My approach combines data, AI, and automation with a practical,
              impact-driven mindset to ship reliable systems that solve
              real-world problems.
            </p>
            <p>
              Before moving into AI, I spent years shipping web and mobile
              products with React, Next.js, Node.js, and React Native — and a
              stretch deep in 3D graphics with Three.js and WebGL. That
              full-stack foundation means the AI systems I design don&apos;t
              stop at the notebook: they become deployed, monitored,
              maintainable products.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/contact"
              className="rounded-xl bg-accent-strong px-6 py-3 font-semibold text-white transition hover:opacity-90"
            >
              Get in Touch
            </Link>
            <Link
              href="/experience"
              className="rounded-xl border border-border-strong px-6 py-3 font-semibold transition hover:border-accent hover:text-accent"
            >
              Full Resume
            </Link>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="card overflow-hidden">
            <div className="relative aspect-square">
              <Image
                src={site.photo}
                alt={site.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 384px"
                className="object-cover"
              />
            </div>
            <div className="p-5">
              <p className="font-display font-semibold">{site.name}</p>
              <p className="mt-1 text-sm text-muted">{site.headline}</p>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-faint">
              Quick facts
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              <li>🚀 {yearsExperience}+ years shipping software</li>
              <li>🤖 3+ years focused on AI &amp; data</li>
              <li>🌍 Remote-first, global clients</li>
              <li>🏢 {companies.length} companies &amp; long-term clients</li>
              <li>🛠 {skillGroups.reduce((n, g) => n + g.items.length, 0)}+ tools &amp; technologies</li>
            </ul>
          </div>

          <div className="card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-faint">
              Find me online
            </h2>
            <SocialLinks className="mt-4" size="lg" />
            <a
              href={`mailto:${site.email}`}
              className="mt-4 block text-sm text-muted hover:text-accent"
            >
              {site.email}
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

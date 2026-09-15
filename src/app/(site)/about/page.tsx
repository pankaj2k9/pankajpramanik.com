import Link from "next/link";
import Image from "next/image";
import SocialLinks from "@/components/site/SocialLinks";
import { site } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata(
  "About — Practical AI & Data Engineering",
  "Meet Pankaj Kumar Pramanik, an AI and data engineer connecting software development, data pipelines, intelligent applications, and workflow automation.",
  "/about",
);
export default function AboutPage() {
  return (
    <div className="container-site py-16">
      <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <p className="eyebrow">The person behind the systems</p>
          <h1 className="mt-5 font-display text-4xl font-medium tracking-tight sm:text-6xl">
            Hi, I’m Pankaj.
            <br />
            <span className="text-muted">
              I build things
              <br />
              that connect.
            </span>
          </h1>
          <div className="mt-8 space-y-5 text-lg leading-relaxed text-muted">
            <p>
              I’m Pankaj Kumar Pramanik, an AI and data engineer with a
              background in full-stack web and mobile development. I work where
              data, intelligent applications, and everyday business processes
              meet.
            </p>
            <p>
              I build document-aware AI applications, data pipelines, and
              connected workflows. My software development background helps me
              take a project beyond a model or notebook and into an application
              people can use and maintain.
            </p>
            <p>
              My approach starts with your problem: who needs the system, which
              data it can use, and what a useful result looks like. From there,
              I help choose an architecture, test assumptions, and develop the
              solution in reviewable steps.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-5">
            <Link className="button-primary" href="/contact">
              Let’s work together ↗
            </Link>
            <Link className="text-link" href="/experience">
              Explore my experience →
            </Link>
          </div>
        </div>
        <aside>
          <div className="card overflow-hidden">
            <div className="relative aspect-[4/5]">
              <Image
                src={site.photo}
                alt="Portrait of Pankaj Kumar Pramanik, AI and data engineer"
                fill
                sizes="(max-width: 1024px) 90vw, 420px"
                preload
                className="object-cover"
              />
            </div>
            <div className="p-6">
              <p className="font-semibold">{site.name}</p>
              <p className="mt-2 text-sm text-muted">
                AI · Data · Software · Automation
              </p>
              <SocialLinks className="mt-5" />
            </div>
          </div>
          <a href={site.cv} download className="text-link mt-3">
            Download my CV ↓
          </a>
        </aside>
      </div>
      <section className="mt-24" data-reveal>
        <p className="eyebrow">How we work together</p>
        <h2 className="mt-4 text-3xl font-medium tracking-tight">
          Clarity at every step.
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Understand",
              text: "Define the users, constraints, available data, and acceptance criteria before choosing a tool.",
            },
            {
              title: "Make it tangible",
              text: "Build a focused prototype so we can test the difficult assumptions early.",
            },
            {
              title: "Build & evaluate",
              text: "Develop in iterations, review behavior on real inputs, and document the trade-offs.",
            },
            {
              title: "Launch & hand over",
              text: "Prepare deployment, monitoring, and operating notes so the system can be supported.",
            },
          ].map((step, i) => (
            <div className="card p-6" key={step.title}>
              <p className="eyebrow text-muted">0{i + 1}</p>
              <h3 className="mt-4 text-xl">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {step.text}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-muted">
          Explore my{" "}
          <Link className="underline" href="/services">
            services
          </Link>
          , browse{" "}
          <Link className="underline" href="/portfolio">
            project implementations
          </Link>
          , or see the{" "}
          <Link className="underline" href="/skills">
            tools I work with
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

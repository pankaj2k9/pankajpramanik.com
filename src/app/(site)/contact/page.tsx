import type { Metadata } from "next";
import ContactForm from "@/components/site/ContactForm";
import SocialLinks from "@/components/site/SocialLinks";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch for AI engineering, agentic systems, RAG applications, MLOps, and full-stack development engagements.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="container-site py-16">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">
            Contact
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Let&apos;s work <span className="text-gradient">together</span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Have a project in mind? Whether it&apos;s an AI agent, a RAG
            system, a data pipeline, or a full-stack product — tell me about it
            and I&apos;ll reply within 24 hours.
          </p>

          <dl className="mt-10 space-y-6 text-sm">
            <div>
              <dt className="font-semibold uppercase tracking-wider text-faint">
                GitHub
              </dt>
              <dd className="mt-1">
                <a
                  href={site.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {site.githubUsername}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wider text-faint">
                Availability
              </dt>
              <dd className="mt-1 inline-flex items-center gap-2 text-emerald">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald" />
                Open to new projects
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wider text-faint">
                Social
              </dt>
              <dd className="mt-2">
                <SocialLinks size="lg" />
              </dd>
            </div>
          </dl>
        </div>

        <div className="card relative p-8">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}

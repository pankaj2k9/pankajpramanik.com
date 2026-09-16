import Link from "next/link";
import SocialLinks from "@/components/site/SocialLinks";
import { site } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";
import { homeServices } from "@/lib/services";
import { serviceGroups } from "@/lib/service-catalog";
import PageHero from "@/components/inner/PageHero";
import ProjectInquiry from "@/components/inner/ProjectInquiry";
import PageMotion from "@/components/motion/PageMotion";

export const metadata = pageMetadata(
  "Contact - Let's Build Something Useful",
  "Discuss your AI application, data pipeline, or automation project with Pankaj Kumar Pramanik. Send a project brief, email, or connect on WhatsApp.",
  "/contact",
);

const STEPS = [
  { id: "intro", label: "Intro" },
  { id: "brief", label: "Project brief" },
];

/** Maps ?service= ids from the homepage and services pages onto form options. */
const NEED_BY_SERVICE: Record<string, string> = {
  data: "data-platform",
  "data-engineering": "data-platform",
  intelligence: "rag",
  "genai-rag": "rag",
  "agentic-ai": "ai-product",
  automation: "automation",
  analytics: "analytics",
  "data-analytics": "analytics",
  production: "mlops",
  "llmops-mlops": "mlops",
  "ai-ml": "ai-product",
  "cloud-production": "ai-product",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service: id } = await searchParams;
  const service =
    homeServices.find((s) => s.id === id) ?? serviceGroups.find((g) => g.id === id);

  return (
    <>
      <PageHero
        index="08"
        label="Contact"
        tone="mint"
        lines={["Let’s build", "something useful."]}
        lead={
          <>
            <p>
              Tell me about your idea, the problem you’re solving and where you
              need help. A short brief about your goals, timeline and existing
              tools is a good place to start.
            </p>
            {service && (
              <p className="ct-preselect">
                Starting from <strong>{service.label}</strong>.
              </p>
            )}
          </>
        }
      >
        <div className="ct-details">
          <dl>
            <div>
              <dt className="hm-label">WhatsApp</dt>
              <dd>
                <a href={site.whatsapp} target="_blank" rel="noopener noreferrer">
                  {site.phone} <span aria-hidden>↗</span>
                </a>
              </dd>
            </div>
            <div>
              <dt className="hm-label">Email</dt>
              <dd>
                <a href={`mailto:${site.businessEmail}`}>{site.businessEmail}</a>
                <a href={`mailto:${site.email}`}>{site.email}</a>
              </dd>
            </div>
            <div>
              <dt className="hm-label">What happens next</dt>
              <dd className="ct-next">
                I read the brief, reply by email with questions and a suggested
                first step, and say plainly if I’m not the right fit.
              </dd>
            </div>
          </dl>
          <SocialLinks className="ct-socials" />
          <Link className="hm-link" href="/services#explorer">
            Not sure where to start? Find a service <span aria-hidden>→</span>
          </Link>
        </div>
      </PageHero>

      <section id="brief" className="ip-section ct-section">
        <div className="hm-container ct-layout">
          <div className="ct-intro" data-hm-stagger>
            <p className="hm-label" data-hm="up">
              <span>01</span> / Project brief
            </p>
            <h2 className="hm-title ip-section-title" data-hm="up">
              Five short steps.
            </h2>
            <p className="hm-intro" data-hm="up">
              Enough for me to understand the problem and reply with something
              useful rather than a generic quote.
            </p>
            <ul className="ct-list" data-hm="up">
              <li>No account, no sales sequence.</li>
              <li>Your details are only used to reply.</li>
              <li>Prefer email or WhatsApp? Both work too.</li>
            </ul>
          </div>
          <div className="ct-card ip-card" data-hm="scale">
            <ProjectInquiry initialNeed={id ? NEED_BY_SERVICE[id] : undefined} />
          </div>
        </div>
      </section>
      <PageMotion steps={STEPS} />
    </>
  );
}

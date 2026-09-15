import Link from "next/link";
import ContactForm from "@/components/site/ContactForm";
import SocialLinks from "@/components/site/SocialLinks";
import { site } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";
import { servicePaths } from "@/lib/services";
export const metadata = pageMetadata(
  "Contact — Let's Build Something Useful",
  "Discuss your AI application, data pipeline, or automation project with Pankaj Kumar Pramanik. Send a project brief, email, or connect on WhatsApp.",
  "/contact",
);
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service: id } = await searchParams;
  const service = servicePaths.find((s) => s.id === id);
  return (
    <div className="container-site py-16">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <p className="eyebrow">Every useful thing starts somewhere</p>
          <h1 className="mt-5 font-display text-4xl font-medium tracking-tight sm:text-6xl">
            What are you
            <br />
            <span className="text-muted">working on?</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            Tell me about your idea, the problem you’re solving, and where you
            need help. A short description of your goals, timeline, and existing
            tools is a good place to start.
          </p>
          <dl className="mt-9 space-y-6">
            <div>
              <dt className="eyebrow text-muted">WhatsApp</dt>
              <dd className="mt-2">
                <a className="text-xl hover:underline" href={site.whatsapp}>
                  {site.phone} ↗
                </a>
              </dd>
            </div>
            <div>
              <dt className="eyebrow text-muted">Email</dt>
              <dd className="mt-2 break-all">
                <a className="block hover:underline" href={`mailto:${site.businessEmail}`}>
                  {site.businessEmail}
                </a>
                <a className="mt-1 block hover:underline" href={`mailto:${site.email}`}>
                  {site.email}
                </a>
              </dd>
            </div>
          </dl>
          <SocialLinks className="mt-7" />
          <div className="mt-10 border-t border-border pt-6">
            <h2 className="font-semibold">What happens next?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              I’ll review your brief and follow up to clarify the scope, suggest
              an approach, and discuss whether we’re a good fit.
            </p>
            <Link href="/services#service-finder" className="text-link">
              Not sure where to start? Find a service →
            </Link>
          </div>
        </div>
        <div className="card h-fit p-6 sm:p-8">
          <h2 className="mb-6 text-xl font-medium">
            A little about your project
          </h2>
          <ContactForm
            initialSubject={service ? `${service.label} project inquiry` : ""}
          />
        </div>
      </div>
    </div>
  );
}

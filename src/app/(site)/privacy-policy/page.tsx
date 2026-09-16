import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageBySlug } from "@/lib/queries";
import { renderContent } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import PageHero from "@/components/inner/PageHero";
import PageMotion from "@/components/motion/PageMotion";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("privacy-policy");
  return {
    ...pageMetadata(
      page?.seoTitle ?? "Privacy Policy",
      page?.seoDescription ?? "Privacy policy for pankajpramanik.com.",
      "/privacy-policy",
    ),
    // Useful to visitors, not to searchers: keep it out of the index but let crawlers follow links.
    robots: { index: false, follow: true },
  };
}

export default async function PrivacyPolicyPage() {
  const page = await getPageBySlug("privacy-policy");
  if (!page) notFound();

  return (
    <>
      <PageHero
        index="09"
        label="Legal"
        tone="blue"
        compact
        lines={[page.title]}
        lead={
          <p>
            How this site handles the information you share through the contact
            form, comments and analytics.
          </p>
        }
      />
      <section className="ip-section">
        <div className="hm-container ar-layout">
          <article className="ar-body">
            <div
              className="prose-content"
              dangerouslySetInnerHTML={{
                __html: renderContent(page.content, page.contentFormat),
              }}
            />
          </article>
        </div>
      </section>
      <PageMotion />
    </>
  );
}

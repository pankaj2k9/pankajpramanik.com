import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageBySlug } from "@/lib/queries";
import { renderContent } from "@/lib/content";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("privacy-policy");
  return {
    title: page?.seoTitle ?? "Privacy Policy",
    description:
      page?.seoDescription ?? "Privacy policy for pankajpramanik.com.",
    alternates: { canonical: "/privacy-policy" },
    robots: { index: false },
  };
}

export default async function PrivacyPolicyPage() {
  const page = await getPageBySlug("privacy-policy");
  if (!page) notFound();

  return (
    <div className="container-site py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl font-bold tracking-tight">
          {page.title}
        </h1>
        <div
          className="prose-content mt-8"
          dangerouslySetInnerHTML={{
            __html: renderContent(page.content, page.contentFormat),
          }}
        />
      </div>
    </div>
  );
}

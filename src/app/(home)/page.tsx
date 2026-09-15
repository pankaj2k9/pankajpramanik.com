import { getFeaturedProjects } from "@/lib/queries";
import { pageMetadata } from "@/lib/seo";
import HomeExperience from "@/components/home/HomeExperience";
import { site, absoluteUrl } from "@/lib/site";
import { jsonLdScript } from "@/lib/utils";

export const metadata = pageMetadata(
  "AI, Data & Automation Engineering",
  site.description,
  "/",
);
export const revalidate = 300;

export default async function HomePage() {
  const projects = await getFeaturedProjects(3);
  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.name,
    url: site.url,
    email: `mailto:${site.email}`,
    image: absoluteUrl(site.photo),
    telephone: site.phone,
    jobTitle: "Data Scientist & AI Engineer",
    sameAs: [
      site.github,
      site.linkedin,
      site.facebook,
      site.leetcode,
      site.kaggle,
      site.huggingface,
    ],
    knowsAbout: [...site.keywords],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(personJsonLd) }}
      />
      <HomeExperience projects={projects} />
    </>
  );
}

import { getEducation, getFeaturedProjects } from "@/lib/queries";
import { jsonLdGraph, pageMetadata, personJsonLd, websiteJsonLd } from "@/lib/seo";
import HomeExperience from "@/components/home/HomeExperience";
import { site } from "@/lib/site";
import { jsonLdScript } from "@/lib/utils";

export const metadata = pageMetadata(site.title, site.description, "/", {
  absoluteTitle: true,
});
export const revalidate = 300;

export default async function HomePage() {
  const [projects, education] = await Promise.all([
    getFeaturedProjects(3),
    getEducation(),
  ]);
  const jsonLd = jsonLdGraph(websiteJsonLd(), personJsonLd(education));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <HomeExperience projects={projects} />
    </>
  );
}

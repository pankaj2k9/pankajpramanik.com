import type { Metadata } from "next";
import type { Education } from "@prisma/client";
import { absoluteUrl, site } from "./site";

type PageImage = { url: string; alt: string; width?: number; height?: number };

const DEFAULT_IMAGE: PageImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: site.title,
};

/**
 * Metadata for an indexable page: title, description, canonical URL, Open
 * Graph and X card, all pointing at the production domain. `title` goes
 * through the root title template unless `absoluteTitle` is set; social
 * titles always carry the site name.
 */
export function pageMetadata(
  title: string,
  description: string,
  path: string,
  options: {
    absoluteTitle?: boolean;
    type?: "website" | "article" | "profile";
    image?: PageImage | null;
    publishedTime?: string;
    modifiedTime?: string;
  } = {},
): Metadata {
  const { absoluteTitle = false, type = "website", publishedTime, modifiedTime } = options;
  const socialTitle = absoluteTitle ? title : `${title} | ${site.name}`;
  const image = options.image
    ? { ...options.image, url: absoluteUrl(options.image.url) }
    : { ...DEFAULT_IMAGE, url: absoluteUrl(DEFAULT_IMAGE.url) };
  const url = absoluteUrl(path);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    // Set per indexable page rather than in the root layout, so 404 and error
    // responses only carry the noindex tag Next.js adds for them.
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
    openGraph: {
      type,
      locale: "en_US",
      title: socialTitle,
      description,
      url,
      siteName: site.name,
      images: [image],
      ...(type === "article" ? { publishedTime, modifiedTime, authors: [site.url] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}

/** Shortens text for a meta description without cutting a word in half. */
export function metaDescription(text: string, max = 160): string {
  const clean = text
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8230;|&hellip;/g, "…")
    .replace(/\s*…?\s*Read More\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const end = cut.lastIndexOf(" ");
  return `${(end > max * 0.6 ? cut.slice(0, end) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

export const PERSON_ID = `${absoluteUrl("/")}#person`;
export const WEBSITE_ID = `${absoluteUrl("/")}#website`;

/** Person entity built only from facts stored in site.ts and the education records. */
export function personJsonLd(education: Pick<Education, "institution">[] = []) {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: site.name,
    url: absoluteUrl("/"),
    image: absoluteUrl(site.photo),
    jobTitle: "AI & Data Engineer",
    email: `mailto:${site.email}`,
    telephone: site.phone,
    sameAs: [
      site.github,
      site.linkedin,
      site.youtube,
      site.facebook,
      site.leetcode,
      site.kaggle,
      site.huggingface,
    ],
    knowsAbout: [...site.keywords],
    ...(education.length
      ? {
          alumniOf: education.map((e) => ({
            "@type": "EducationalOrganization",
            name: e.institution,
          })),
        }
      : {}),
  };
}

export function websiteJsonLd() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: absoluteUrl("/"),
    name: site.name,
    description: site.description,
    inLanguage: "en",
    publisher: { "@id": PERSON_ID },
  };
}

/** Breadcrumb trail from the homepage; each item is [name, path]. */
export function breadcrumbJsonLd(items: [string, string][]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [["Home", "/"] as [string, string], ...items].map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: absoluteUrl(path),
    })),
  };
}

/** Wraps several entities in one JSON-LD document. */
export function jsonLdGraph(...nodes: object[]) {
  return { "@context": "https://schema.org", "@graph": nodes };
}

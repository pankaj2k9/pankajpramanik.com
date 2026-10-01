import type { Metadata } from "next";
import type { Education } from "@prisma/client";
import { absoluteUrl, site } from "./site";

/**
 * Link-preview image for a page: a 1200x630 branded card with the page's own
 * title (src/app/og/route.tsx), optionally beside its JPEG/PNG cover.
 */
function previewImage(title: string, section?: string, cover?: string | null) {
  const query = new URLSearchParams({ title });
  if (section) query.set("section", section);
  if (cover) query.set("cover", cover);
  return {
    url: absoluteUrl(`/og?${query}`),
    width: 1200,
    height: 630,
    type: "image/png",
    alt: section ? `${section}: ${title}` : title,
  };
}

/** Longest title shown in full by Google (about 600px) and WhatsApp/LinkedIn previews. */
export const TITLE_MAX = 63;

/** Page title with the brand appended when it fits, e.g. "LLMOps | Pankaj Pramanik". */
export function brandedTitle(title: string): string {
  if (title.includes("Pankaj")) return title;
  const branded = `${title} | ${site.brand}`;
  return branded.length <= TITLE_MAX ? branded : title;
}

/**
 * Metadata for an indexable page: title, description, canonical URL, Open
 * Graph and X card, all pointing at the production domain. The title gets
 * " | Pankaj Pramanik" when the result still fits a search result or chat
 * preview (TITLE_MAX); longer titles, and titles that already name Pankaj,
 * stay as they are.
 */
export function pageMetadata(
  title: string,
  description: string,
  path: string,
  options: {
    type?: "website" | "article" | "profile";
    /** Small label above the title on the preview card, e.g. "Service". */
    section?: string;
    /** Page cover from /uploads, shown beside the title when JPEG or PNG. */
    cover?: string | null;
    /** Headline for the preview card when it should differ from the page title. */
    previewTitle?: string;
    publishedTime?: string;
    modifiedTime?: string;
  } = {},
): Metadata {
  const { type = "website", publishedTime, modifiedTime } = options;
  const fullTitle = brandedTitle(title);
  // The card already carries the site name, so it shows the bare page title.
  const image = previewImage(options.previewTitle ?? title, options.section, options.cover);
  const url = absoluteUrl(path);

  return {
    title: { absolute: fullTitle },
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
      title: fullTitle,
      description,
      url,
      siteName: site.name,
      images: [image],
      ...(type === "article" ? { publishedTime, modifiedTime, authors: [site.url] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
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

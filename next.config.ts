import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

/**
 * 301 redirects preserving WordPress-era URLs.
 * Old blog posts lived at the site root (/my-post-slug/);
 * they now live under /blog/. The list is derived from the
 * migrated content so old backlinks and search results keep working.
 */
function wordpressRedirects() {
  const file = path.join(process.cwd(), "migration", "extracted", "posts.json");
  let postSlugs: string[] = [];
  try {
    postSlugs = (
      JSON.parse(fs.readFileSync(file, "utf8")) as { slug: string }[]
    ).map((p) => p.slug);
  } catch {
    // migration data not present (e.g. fresh clone without content) — skip
  }

  const postRedirects = postSlugs.map((slug) => ({
    source: `/${slug}`,
    destination: `/blog/${slug}`,
    permanent: true,
  }));

  const pageRedirects = [
    { source: "/about-me", destination: "/about", permanent: true },
    { source: "/resume", destination: "/experience", permanent: true },
    { source: "/latest-from-the-blog", destination: "/blog", permanent: true },
    { source: "/services", destination: "/skills", permanent: true },
  ];

  return [...postRedirects, ...pageRedirects];
}

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // during transition some content may still reference the old host
      { protocol: "https", hostname: "pankajpramanik.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  async redirects() {
    return wordpressRedirects();
  },
};

export default nextConfig;

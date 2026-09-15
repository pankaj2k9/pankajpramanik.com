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
    { source: "/projects", destination: "/portfolio", permanent: true },
    {
      source: "/projects/:slug",
      destination: "/portfolio/:slug",
      permanent: true,
    },
    { source: "/dashboard", destination: "/admin", permanent: true },
    { source: "/about-me", destination: "/about", permanent: true },
    { source: "/resume", destination: "/experience", permanent: true },
    { source: "/latest-from-the-blog", destination: "/blog", permanent: true },
  ];

  // Retired WordPress services still occur in migrated article links.
  const retiredServices: Record<string, string> = {
    "full-stack-android-ios-developer":
      "/services/ai-based-software-development",
    "system-design": "/services/forward-deployed-engineer",
    "freelance-python-developer": "/services/ai-based-software-development",
    "nodejs-development": "/services/ai-based-software-development",
    "nodejs-developer": "/services/ai-based-software-development",
    "angular-app-development": "/portfolio/angular-app-development",
    "remote-angular-app-developer": "/portfolio/angular-app-development",
    "restful-applications-development":
      "/services/ai-based-software-development",
    "single-page-applications-development": "/portfolio/react-app-development",
    "blockchain-developer": "/portfolio/blockchain-developer-at-xr-foundation",
    "freelancing-with-full-stack-software-development":
      "/services/ai-based-software-development",
    "nextjs-rsc-applications-developer":
      "/services/ai-based-software-development",
  };
  const retiredRedirects = Object.entries(retiredServices).map(
    ([slug, destination]) => ({
      source: `/services/${slug}`,
      destination,
      permanent: true,
    }),
  );
  return [
    ...postRedirects,
    ...pageRedirects,
    ...retiredRedirects,
    {
      source: "/freelance-python-developer",
      destination: "/services/ai-based-software-development",
      permanent: true,
    },
    {
      source: "/svc-team/spotter-labs",
      destination: "/portfolio/full-stack-developer-at-spotter-labs",
      permanent: true,
    },
  ];
}

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // during transition some content may still reference the old host
      { protocol: "https", hostname: "pankajpramanik.com" },
      { protocol: "https", hostname: "github.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "opengraph.githubassets.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  async redirects() {
    return wordpressRedirects();
  },
};

export default nextConfig;

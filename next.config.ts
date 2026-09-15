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

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy. 'unsafe-inline' scripts are required by the inline
 * theme bootstrap, JSON-LD and Next's streamed RSC payload without per-request
 * nonces (which would force every page to render dynamically). The rest is
 * locked down: no third-party scripts, no plugins, no framing, no foreign form
 * targets. 'wasm-unsafe-eval' lets the hero's meshopt decoder instantiate its
 * WebAssembly; dev additionally needs eval and the HMR websocket.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Ignored by browsers over plain http (IP smoke tests), enforced once on HTTPS.
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  // The dev-tools badge defaults to bottom-left, directly over the music
  // player's play button, and swallows its clicks during development.
  devIndicators: { position: "top-right" },
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
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/models/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
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

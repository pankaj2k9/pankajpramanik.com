import type { MetadataRoute } from "next";
import { absoluteUrl, site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          // /booking/ (with slash) holds private manage links; /booking itself stays public.
          "/booking/",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    // Canonical host: www.pankajpramanik.com 301s here (deploy/pankajpramanik.caddy).
    host: site.url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
  };
}

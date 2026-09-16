import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /booking/ (with slash) holds private manage links; /booking itself stays public.
        disallow: ["/admin", "/api", "/booking/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

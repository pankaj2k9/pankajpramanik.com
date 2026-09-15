import { writeFile, mkdir } from "node:fs/promises";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const xml = await (await fetch(`${base}/sitemap.xml`)).text();
const paths = [
  ...new Set(
    [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (m) => new URL(m[1]).pathname,
    ),
  ),
];
const links = new Map(),
  failures = [];
for (let i = 0; i < paths.length; i += 4) {
  await Promise.all(
    paths.slice(i, i + 4).map(async (path) => {
      const response = await fetch(`${base}${path}`);
      if (!response.ok) failures.push({ path, status: response.status });
      const html = await response.text();
      for (const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
        let url;
        try {
          url = new URL(m[1].replaceAll("&amp;", "&"), base);
        } catch {
          continue;
        }
        if (
          url.origin !== new URL(base).origin ||
          url.pathname.startsWith("/_next/") ||
          url.pathname.startsWith("/api/") ||
          url.pathname.startsWith("/admin")
        )
          continue;
        links.set(url.pathname + url.search, path);
      }
    }),
  );
}
for (const [path, source] of links) {
  const response = await fetch(`${base}${path}`, { method: "HEAD" });
  if (!response.ok) failures.push({ path, source, status: response.status });
}
await mkdir("reports", { recursive: true });
await writeFile(
  "reports/links.json",
  JSON.stringify(
    { publicPages: paths.length, internalTargets: links.size, failures },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    publicPages: paths.length,
    internalTargets: links.size,
    failures,
  }),
);
process.exitCode = failures.length ? 1 : 0;

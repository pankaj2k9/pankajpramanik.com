/**
 * Extract structured content from the raw WordPress REST API export
 * (migration/wp-export/*.json) into clean JSON seed files
 * (migration/extracted/*.json) consumed by prisma/seed.ts.
 *
 * Also builds a media manifest of every image referenced by post
 * content or featured images, so download-media.mjs can mirror them
 * into public/uploads/ and content URLs can be rewritten to local paths.
 *
 * Usage: node migration/extract.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(__dirname, "wp-export");
const OUT_DIR = path.join(__dirname, "extracted");
fs.mkdirSync(OUT_DIR, { recursive: true });

const read = (f) =>
  JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, f), "utf8"));

const posts = read("posts.json");
const categories = read("categories.json");
const tags = read("tags.json");
const pages = read("pages.json");

const UPLOADS_RE =
  /https?:\/\/(?:www\.)?pankajpramanik\.com\/wp-content\/uploads\/([^\s"'()<>]+)/g;

const mediaManifest = new Map(); // remote URL -> local public path

function registerMedia(url) {
  if (!url) return null;
  const clean = url.split("?")[0];
  const m = clean.match(
    /wp-content\/uploads\/(.+)$/
  );
  if (!m) return null;
  const local = `/uploads/${m[1]}`;
  mediaManifest.set(clean, local);
  return local;
}

// Images that 404 on the live WordPress site itself (verified during
// migration) — drop the whole <img> tag rather than ship a broken image.
const DEAD_IMAGES = [
  "2024/03/How-to-use-DALL-E-2-300x169.jpg",
  "2023/11/d193b40195-300x107.jpeg",
  "2020/09/image-10-224x169.png",
];

function rewriteContent(html) {
  for (const dead of DEAD_IMAGES) {
    html = html.replace(
      new RegExp(`<img[^>]*${dead.replace(/[./]/g, "\\$&")}[^>]*/?>`, "g"),
      ""
    );
  }
  return html
    // mirror upload URLs locally
    .replace(UPLOADS_RE, (full) => registerMedia(full) ?? full)
    // internal links: absolute -> relative, and posts live under /blog/
    .replace(
      /href="https?:\/\/(?:www\.)?pankajpramanik\.com\/([^"]*)"/g,
      (_, p) => `href="/${p}"`
    );
}

function decode(s = "") {
  return s
    .replace(/&#8217;|&#039;|&#39;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&amp;|&#038;/g, "&")
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html = "") {
  return decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// ---- categories & tags (only those actually used by posts) ----
const usedCatIds = new Set(posts.flatMap((p) => p.categories));
const usedTagIds = new Set(posts.flatMap((p) => p.tags));

const catOut = categories
  .filter((c) => usedCatIds.has(c.id))
  .map((c) => ({
    wpId: c.id,
    name: decode(c.name),
    slug: c.slug,
    description: stripTags(c.description),
  }));

const tagOut = tags
  .filter((t) => usedTagIds.has(t.id))
  .map((t) => ({ wpId: t.id, name: decode(t.name), slug: t.slug }));

const catById = new Map(catOut.map((c) => [c.wpId, c]));
const tagById = new Map(tagOut.map((t) => [t.wpId, t]));

// ---- posts ----
const postOut = posts.map((p) => {
  const featured =
    p._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null;
  const coverImage = featured ? registerMedia(featured) : null;
  const yoast = p.yoast_head_json ?? {};
  return {
    wpId: p.id,
    slug: p.slug,
    title: decode(p.title.rendered),
    excerpt: stripTags(p.excerpt.rendered).replace(/\s*\[?…\]?$/, ""),
    contentHtml: rewriteContent(p.content.rendered),
    coverImage,
    publishedAt: p.date_gmt + "Z",
    updatedAt: p.modified_gmt + "Z",
    categories: p.categories.map((id) => catById.get(id)?.slug).filter(Boolean),
    tags: p.tags.map((id) => tagById.get(id)?.slug).filter(Boolean),
    seoTitle: yoast.title ?? null,
    seoDescription: yoast.description ?? null,
  };
});

// ---- static pages worth keeping as DB pages ----
const KEEP_PAGES = ["privacy-policy", "about-me"];

// Short display names for the /services grid (WP titles are long SEO
// headlines). Keyed by the WordPress page slug; parent page id 2511.
const SERVICE_LABELS = {
  "llm-rag-developer-hire": "LLM & RAG Systems",
  "hire-ai-langchain-expert": "LangChain Development",
  "ai-chatbot-agent-designer": "AI Chatbots & Agents",
  "ai-voice-assistant-developer": "AI Voice Assistants",
  "prompt-engineer-hire": "Prompt Engineering",
  "vector-database-integration-expert": "Vector Database Integration",
  "hire-n8n-workflow-developer": "n8n Workflow Automation",
  "hire-ai-data-pipeline-engineer": "AI-Powered Data Pipelines",
  "data-engineering-excellence": "Data Engineering",
  "hire-the-perfect-mlops-developer": "MLOps",
  "data-science-and-machine-learning": "Data Science & Machine Learning",
  "deep-learning-solutions": "Deep Learning Solutions",
  "natural-language-processing-excellence": "Natural Language Processing",
  "hire-data-analytics-visualization-expert": "Data Analytics & Visualization",
  "hire-cloud-devops-engineer-ai": "Cloud & DevOps for AI",
  "aws-serverless-app-development": "AWS Serverless Apps",
  "full-stack-javascript-app-developer": "Full-Stack JavaScript Apps",
  "chatting-app-development": "Chat App Development",
  "remote-angular-app-developer": "Angular App Development",
  "data-structure-and-algorithm-problem-solving": "DSA Problem Solving",
};

const SERVICES_PARENT_ID = 2511;

const pageOut = pages
  .filter(
    (p) => KEEP_PAGES.includes(p.slug) || p.parent === SERVICES_PARENT_ID
  )
  .map((p) => {
    const isService = p.parent === SERVICES_PARENT_ID;
    return {
      wpId: p.id,
      slug: p.slug,
      kind: isService ? "SERVICE" : "GENERIC",
      label: isService ? (SERVICE_LABELS[p.slug] ?? decode(p.title.rendered)) : "",
      summary: isService ? (p.yoast_head_json?.description ?? "") : "",
      title: decode(p.title.rendered),
      contentHtml: rewriteContent(p.content.rendered),
      seoTitle: p.yoast_head_json?.title ?? null,
      seoDescription: p.yoast_head_json?.description ?? null,
    };
  });

fs.writeFileSync(path.join(OUT_DIR, "posts.json"), JSON.stringify(postOut, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "categories.json"), JSON.stringify(catOut, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "tags.json"), JSON.stringify(tagOut, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "pages.json"), JSON.stringify(pageOut, null, 2));
fs.writeFileSync(
  path.join(OUT_DIR, "media-manifest.json"),
  JSON.stringify(Object.fromEntries(mediaManifest), null, 2)
);

console.log(
  `posts: ${postOut.length}, categories: ${catOut.length}, tags: ${tagOut.length}, pages: ${pageOut.length}, media referenced: ${mediaManifest.size}`
);

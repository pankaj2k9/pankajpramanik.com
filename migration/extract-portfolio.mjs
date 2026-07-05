/**
 * Extract the WordPress `portfolio` custom-post-type export
 * (wp-export/portfolio.json) into clean project seed data with a rich
 * "Project Overview"/"Role Overview" paragraph for the Overview tab and
 * the full cleaned article for the Case Study tab.
 *
 * Output:
 *   extracted/portfolio-projects.json  (consumed by prisma/seed.ts)
 *   extracted/portfolio-media.json     (remote → local upload paths)
 *
 * Usage: node migration/extract-portfolio.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sanitizeHtml from "sanitize-html";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const items = JSON.parse(
  fs.readFileSync(path.join(__dirname, "wp-export", "portfolio.json"), "utf8")
);
const OUT = path.join(__dirname, "extracted");

const media = new Map(); // remote clean url -> /uploads/... local path

function registerMedia(url) {
  if (!url) return null;
  const clean = url.split("?")[0];
  const m = clean.match(/wp-content\/uploads\/(.+)$/);
  if (!m) return null;
  const local = `/uploads/${m[1]}`;
  media.set(clean, local);
  return local;
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
    .replace(/&nbsp;/g, " ")
    // strip emoji + variation selectors used as decorative bullets
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, "");
}

function stripTags(html = "") {
  return decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// upload URLs → local; internal links → relative (drop the WP host so they
// stay on the new site instead of bouncing to the old WordPress domain)
function rewrite(html) {
  return html
    .replace(
      /https?:\/\/(?:www\.)?pankajpramanik\.com\/wp-content\/uploads\/([^\s"'()<>]+)/g,
      (full) => registerMedia(full) ?? full
    )
    .replace(/src="\/wp-content\/uploads\/([^"]+)"/g, (_m, p) => {
      registerMedia(`https://pankajpramanik.com/wp-content/uploads/${p}`);
      return `src="/uploads/${p.split("?")[0]}"`;
    })
    // internal navigation links → site-relative (also handles "/#/path")
    .replace(/href="https?:\/\/(?:www\.)?pankajpramanik\.com\/#?\/?([^"]*)"/g,
      (_m, p) => `href="/${p.replace(/^\/+/, "")}"`)
    .replace(/href="\/#\//g, 'href="/');
}

// Clean the Elementor export into a linear article for the Case Study tab.
function cleanContent(html) {
  const cleaned = sanitizeHtml(rewrite(html), {
    allowedTags: [
      "h2", "h3", "h4", "p", "ul", "ol", "li",
      "strong", "em", "b", "i", "a", "img",
      "figure", "figcaption", "blockquote", "code", "pre", "hr",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height"],
    },
    transformTags: { h1: "h2" },
  });
  return cleaned
    .replace(/<p>(\s|&nbsp;)*<\/p>/g, "")
    .replace(/<(h[234])>\s*<\/\1>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The subtitle line directly after the H1 is a "Tech | Tech | Tech" tagline.
function subtitleAfterH1(html) {
  const end = html.indexOf("</h1>");
  if (end === -1) return "";
  const chunk = html.slice(end + 5, end + 600);
  // stop at the next heading
  const cut = chunk.search(/<h[1-4][\s>]/i);
  return stripTags(cut === -1 ? chunk : chunk.slice(0, cut));
}

// Text under the "Project Overview" / "Role Overview" / "About" heading.
function overviewText(html) {
  const re =
    /<h[234][^>]*>\s*(?:[^<]*?)(?:Project|Role|About)[^<]*?(?:Overview|the Project)?\s*<\/h[234]>([\s\S]*?)(?:<h[234][\s>]|$)/i;
  const m = html.match(re);
  let text = m ? stripTags(m[1]) : "";
  const isCta = (s) => /let'?s (discuss|talk|work|build)|get in touch|contact me|hire me|book (a )?free/i.test(s);
  if (text.length < 120 || isCta(text)) {
    // fallback: first substantial, non-CTA paragraph
    for (const pm of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
      const t = stripTags(pm[1]);
      if (t.length >= 140 && !isCta(t)) { text = t; break; }
    }
  }
  return text;
}

const TECH_KEYWORDS = [
  "Python","TensorFlow","PyTorch","scikit-learn","Pandas","NumPy","Streamlit",
  "LangChain","LangGraph","Pinecone","FAISS","OpenAI","GPT-4","Claude","RAG",
  "Flask","FastAPI","Django","n8n","GoHighLevel","Retell AI","Twilio",
  "MLflow","DVC","Docker","Kubernetes","CI/CD","GitHub Actions","AWS","GCP",
  "Azure","BigQuery","Mage.ai","Airflow","EC2","S3","RDS","Lambda","CloudFront",
  "Serverless","Node.js","Express","Next.js","React","React Native","Redux",
  "Redux Saga","TypeScript","JavaScript","GraphQL","Relay","Angular","Gatsby.js",
  "Vue","Supabase","PostgreSQL","MongoDB","MySQL","Redis","Kafka","Spring",
  "Solidity","Ethereum","Web3.js","Three.js","Babylon.js","WebGL","Storybook",
  "Ant Design","Tailwind","TMDB API","Microservices","REST","TF-IDF",
  "Cosine Similarity","Computer Vision","NLP","Deep Learning","Machine Learning",
  "Data Engineering","ETL","Looker Studio",
];

// slug hints for pages whose body never names the headline tech
const SLUG_TECH = {
  "angular-app-development": ["Angular", "TypeScript"],
  "react-app-development": ["React"],
};

function detectTech(text, slug = "") {
  const found = [...(SLUG_TECH[slug] ?? [])];
  for (const k of TECH_KEYWORDS) {
    const re = new RegExp(`(?:^|[^\\w])${k.replace(/[.+]/g, "\\$&")}(?:$|[^\\w])`, "i");
    if (re.test(text)) found.push(k);
  }
  return [...new Set(found)].slice(0, 10);
}

function inferCategory(slug, title, text) {
  const t = `${slug} ${title} ${text}`.toLowerCase();
  if (/\bat\s|developer at|engineer at/i.test(title)) return "Work Experience";
  if (/etl|data engineering|bigquery|warehouse|mage\.ai|airflow/.test(t))
    return "Data Engineering";
  if (/mlops|ci\/cd|deployment pipeline|model (serving|registry|monitoring)/.test(t) &&
      /model|deep learning|classification|prediction/.test(t))
    return "MLOps";
  if (/\brag\b|chatbot|\bllm\b|langchain|n8n|gohighlevel|voice agent|agent(ic)?/.test(t))
    return "AI / LLM";
  if (/recommend|tf-idf|cosine|scikit|pandas|prediction|sentiment/.test(t))
    return "Machine Learning";
  if (/angular|react|next\.js|frontend|full.?stack|web app/.test(t)) return "Web Development";
  return "Projects";
}

// GitHub repos for the items that have public source
const REPOS = {
  "moviemate-tf-idf-cosine-similarity-movie-recommender":
    "https://github.com/pankaj2k9/moviemate-personalized-movie-recommender",
  "bird-disease-prediction-end-to-end-mlops-deep-learning":
    "https://github.com/pankaj2k9/MLOpsE2EBirdDiseaseClassificationDeepLearningProject",
  "end-to-end-mlops-classification-aws-fastapi-ci-cd":
    "https://github.com/pankaj2k9/MLOpsE2EClassificationTermProject",
  "medical-rag-chatbot-langchain-pinecone-flask":
    "https://github.com/pankaj2k9/caresage-rag-langchain-pinecone",
  "uber-data-engineering-etl-project":
    "https://github.com/pankaj2k9/uber-data-engineering-etl-project",
  "ai-automation-engineer-n8n-gohighlevel-ai-automation-engineer":
    "https://github.com/pankaj2k9/n8n-Integration-Manager",
};

// Featured on the homepage (the strongest AI/Data work)
const FEATURED = new Set([
  "bird-disease-prediction-end-to-end-mlops-deep-learning",
  "medical-rag-chatbot-langchain-pinecone-flask",
  "uber-data-engineering-etl-project",
  "end-to-end-mlops-classification-aws-fastapi-ci-cd",
  "moviemate-tf-idf-cosine-similarity-movie-recommender",
  "ai-automation-engineer-n8n-gohighlevel-ai-automation-engineer",
]);

// keep project/portfolio work first, employment history after
const CATEGORY_RANK = {
  "AI / LLM": 0, "MLOps": 1, "Machine Learning": 2, "Data Engineering": 3,
  "Web Development": 4, "Blockchain / Web3": 5, Projects: 6, "Work Experience": 7,
};

// pages whose overview lives only in lists/counters get a hand-written
// summary drawn from their own on-page content
const OVERVIEW_OVERRIDE = {
  "ai-automation-engineer-n8n-gohighlevel-ai-automation-engineer":
    "AI automation engineer building end-to-end workflow systems with n8n, integrating Retell AI voice agents, OpenAI GPT-4, and Claude with GoHighLevel CRM, Twilio, and Make.com. Delivered voice-agent platforms that automated 1,000+ monthly sales calls with real-time transcription, sentiment analysis, and follow-up automation — saving clients hundreds of hours every month.",
};

const projects = items
  .filter((p) => p.status === "publish" && p.slug !== "my-portfolio-website")
  .map((p, idx) => {
    const html = p.content.rendered;
    const title = decode(p.title.rendered);
    const tagline = subtitleAfterH1(html).slice(0, 120);
    const bodyText = stripTags(html);
    let description = OVERVIEW_OVERRIDE[p.slug] ?? overviewText(html);
    if (description.length < 120)
      description = p.yoast_head_json?.description ?? description;
    const content = cleanContent(html);
    const featured =
      p._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null;
    const coverImage = featured ? registerMedia(featured) : null;
    const category = inferCategory(p.slug, title, `${description} ${bodyText.slice(0, 600)}`);
    const techStack = detectTech(`${tagline} ${bodyText.slice(0, 3500)}`, p.slug);
    return {
      wpOrder: idx,
      slug: p.slug,
      title,
      tagline,
      description,
      content,
      contentFormat: "HTML",
      coverImage,
      techStack,
      category,
      repoUrl: REPOS[p.slug] ?? null,
      liveUrl: null,
      featured: FEATURED.has(p.slug),
      seoTitle: p.yoast_head_json?.title ?? null,
      seoDescription: p.yoast_head_json?.description ?? null,
    };
  });

projects.sort(
  (a, b) =>
    (CATEGORY_RANK[a.category] ?? 9) - (CATEGORY_RANK[b.category] ?? 9) ||
    a.wpOrder - b.wpOrder
);
projects.forEach((p, i) => { p.order = i; delete p.wpOrder; });

fs.writeFileSync(
  path.join(OUT, "portfolio-projects.json"),
  JSON.stringify(projects, null, 2)
);
fs.writeFileSync(
  path.join(OUT, "portfolio-media.json"),
  JSON.stringify(Object.fromEntries(media), null, 2)
);

console.log(`portfolio projects: ${projects.length}, media: ${media.size}`);
for (const p of projects) {
  console.log(
    `  ${p.featured ? "★" : " "} [${p.category}] ${p.slug} — overview ${p.description.length}c, tech ${p.techStack.length}`
  );
}

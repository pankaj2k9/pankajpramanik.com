/**
 * Enrich the curated portfolio projects with real content from GitHub:
 *  - README.md (markdown) as the project case study, with relative
 *    image/link URLs rewritten to absolute raw.githubusercontent.com URLs
 *  - the repository OpenGraph image as the project cover image
 *
 * Writes migration/extracted/project-content.json, which prisma/seed.ts
 * merges into the Project rows.
 *
 * Usage: node migration/github-projects.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "extracted");

const projects = JSON.parse(
  fs.readFileSync(path.join(OUT_DIR, "projects.json"), "utf8")
);

const headers = { "User-Agent": "pankajpramanik.com-migration" };
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

function repoFromUrl(repoUrl) {
  const m = repoUrl?.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

/** Rewrite README-relative image/link paths to absolute raw URLs. */
function absolutizeReadme(md, owner, repo, branch) {
  const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`;
  const blob = `https://github.com/${owner}/${repo}/blob/${branch}/`;
  return (
    md
      // markdown images: ![alt](relative/path.png)
      .replace(
        /!\[([^\]]*)\]\((?!https?:\/\/|data:)([^)\s]+)\)/g,
        (_m, alt, p) => `![${alt}](${raw}${p.replace(/^\.?\//, "")})`
      )
      // html <img src="relative">
      .replace(
        /(<img[^>]+src=")(?!https?:\/\/|data:)([^"]+)(")/g,
        (_m, a, p, b) => `${a}${raw}${p.replace(/^\.?\//, "")}${b}`
      )
      // markdown links to repo files
      .replace(
        /(?<!!)\[([^\]]+)\]\((?!https?:\/\/|#|mailto:)([^)\s]+)\)/g,
        (_m, text, p) => `[${text}](${blob}${p.replace(/^\.?\//, "")})`
      )
  );
}

const out = {};
for (const project of projects) {
  const ref = repoFromUrl(project.repoUrl);
  if (!ref) continue;
  const { owner, repo } = ref;

  try {
    const repoRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers }
    );
    if (!repoRes.ok) throw new Error(`repo HTTP ${repoRes.status}`);
    const repoInfo = await repoRes.json();
    const branch = repoInfo.default_branch ?? "main";

    let content = "";
    const readmeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/readme`,
      { headers: { ...headers, Accept: "application/vnd.github.raw+json" } }
    );
    if (readmeRes.ok) {
      const md = await readmeRes.text();
      // drop a leading H1 (the page already renders the project title)
      content = absolutizeReadme(md, owner, repo, branch)
        .replace(/^\s*# [^\n]+\n/, "")
        .trim();
    }

    out[project.slug] = {
      content,
      coverImage: `https://opengraph.githubassets.com/1/${owner}/${repo}`,
      stars: repoInfo.stargazers_count ?? 0,
      language: repoInfo.language ?? null,
    };
    console.log(
      `✓ ${project.slug} — readme ${content.length} chars, branch ${branch}`
    );
    await new Promise((r) => setTimeout(r, 300));
  } catch (e) {
    console.log(`✗ ${project.slug}: ${e.message}`);
  }
}

fs.writeFileSync(
  path.join(OUT_DIR, "project-content.json"),
  JSON.stringify(out, null, 2)
);
console.log(`saved project-content.json (${Object.keys(out).length} projects)`);

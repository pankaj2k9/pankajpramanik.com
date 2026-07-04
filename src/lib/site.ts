export const site = {
  name: "Pankaj Kumar Pramanik",
  title: "Pankaj Kumar Pramanik — AI & Data Engineer",
  description:
    "AI & Data Engineer specializing in Generative AI, AI agents, LLM/RAG systems, MLOps, and workflow automation. 8+ years building production systems.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://pankajpramanik.com",
  email: "pkp2.me2k9@gmail.com",
  github: "https://github.com/pankaj2k9",
  githubUsername: "pankaj2k9",
  headline: "AI & Data Engineer — Agentic AI · MLOps · GenAI",
  keywords: [
    "AI Engineer",
    "Data Engineer",
    "LLM",
    "RAG",
    "LangChain",
    "MLOps",
    "Full Stack Developer",
    "Next.js",
    "Python",
  ],
} as const;

export function absoluteUrl(path = ""): string {
  return `${site.url.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

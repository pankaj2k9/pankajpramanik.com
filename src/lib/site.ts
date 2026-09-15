export const site = {
  name: "Pankaj Kumar Pramanik",
  title: "Pankaj Kumar Pramanik — AI & Data Engineer",
  description:
    "AI and data engineering by Pankaj Kumar Pramanik. Build useful AI applications, reliable data pipelines, and connected automation for your business.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://pankajpramanik.com",
  phone: "+8801716121009",
  whatsapp: "https://wa.me/8801716121009",
  email: "pkp2.me2k9@gmail.com",
  businessEmail: "me@pankajpramanik.com",
  github: "https://github.com/pankaj2k9",
  githubUsername: "pankaj2k9",
  linkedin: "https://www.linkedin.com/in/pankaj-pramanik/",
  facebook: "https://www.facebook.com/pankaj.pramanikk",
  leetcode: "https://leetcode.com/pankajpramanik/",
  kaggle: "https://www.kaggle.com/pankajpramanik",
  huggingface: "https://huggingface.co/pankajpramanik",
  headline: "AI & Data Engineer — Agentic AI · MLOps · GenAI",
  photo: "/uploads/2026/09/16/pankaj-kumar-pramanik-portrait.jpg",
  cv: "/Pankaj_Kumar_Pramanik_AI_Data_Engineer_CV.pdf",
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

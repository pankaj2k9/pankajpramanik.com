import type { Tone, Visual } from "./service-catalog";

/**
 * Derives display categories, visuals and a layered architecture from a
 * project's stored title, text and tech stack. Only what the project record
 * says is used — nothing here invents results.
 */
type ProjectLike = {
  title: string;
  tagline?: string;
  description?: string;
  techStack: string[];
  category: string;
  repoUrl?: string | null;
  liveUrl?: string | null;
};

export type ProjectTag = { id: string; label: string; tone: Tone; visual: Visual };

const TAGS: (ProjectTag & { words: string[] })[] = [
  { id: "agents", label: "Agentic AI", tone: "blue", visual: "agents", words: ["langgraph", "multi-agent", "agentic", "mcp", "crewai", "autogen", "ai agent"] },
  { id: "rag", label: "RAG", tone: "peach", visual: "rag", words: ["rag", "retrieval", "pinecone", "faiss", "vector", "chroma", "qdrant", "weaviate"] },
  { id: "automation", label: "Automation", tone: "mint", visual: "workflow", words: ["n8n", "automation", "zapier", "make.com", "gohighlevel", "retell"] },
  { id: "data", label: "Data Engineering", tone: "blue", visual: "pipeline", words: ["etl", "airflow", "spark", "dbt", "kafka", "data pipeline", "data engineering", "snowflake", "bigquery", "data ingestion"] },
  { id: "analytics", label: "Data Analytics", tone: "orange", visual: "analytics", words: ["analytics", "dashboard", "power bi", "tableau", "visualization", "visualisation", "looker"] },
  { id: "mlops", label: "MLOps", tone: "violet", visual: "production", words: ["mlops", "mlflow", "dvc", "model monitoring"] },
  { id: "llmops", label: "LLMOps", tone: "violet", visual: "production", words: ["llmops", "langsmith", "guardrail", "evaluation"] },
  { id: "cv", label: "Computer Vision", tone: "orange", visual: "knowledge", words: ["computer vision", "cnn", "yolo", "opencv", "image classification"] },
  { id: "ml", label: "Machine Learning", tone: "orange", visual: "analytics", words: ["machine learning", "scikit", "tf-idf", "cosine similarity", "xgboost", "deep learning", "classification", "recommend"] },
  { id: "web", label: "Full-Stack", tone: "blue", visual: "workflow", words: ["react", "next.js", "node", "angular", "full stack", "full-stack", "three.js", "vue", "web app"] },
];

const haystack = (p: ProjectLike) =>
  `${p.title} ${p.tagline ?? ""} ${p.description ?? ""} ${p.techStack.join(" ")} ${p.category}`.toLowerCase();

const matches = (text: string, word: string) =>
  word.length <= 4 ? new RegExp(`\\b${word.replace(/[.]/g, "\\.")}\\b`).test(text) : text.includes(word);

export function projectTags(p: ProjectLike): ProjectTag[] {
  const text = haystack(p);
  const found = TAGS.filter((t) => t.words.some((w) => matches(text, w)));
  return (found.length ? found : [TAGS[TAGS.length - 1]]).map((t) => ({
    id: t.id,
    label: t.label,
    tone: t.tone,
    visual: /voice|retell/.test(text) && t.id === "automation" ? "voice" : t.visual,
  }));
}

export const ALL_PROJECT_TAGS: Pick<ProjectTag, "id" | "label">[] = TAGS.map(({ id, label }) => ({ id, label }));

export function projectType(p: ProjectLike): string {
  if (p.category === "Work Experience") return "Client work";
  if (p.liveUrl) return "Live product";
  if (p.repoUrl) return "Open source";
  return "Case study";
}

/** Splits "Name — Subtitle (Stack)" style titles for display. */
export function splitTitle(title: string): { name: string; subtitle?: string } {
  const [name, ...rest] = title.split(/\s+[—|–]\s+|\s+\|\s+|\s*\(/);
  const subtitle = rest.join(" ").replace(/\)\s*$/, "").trim();
  return { name: name.trim(), subtitle: subtitle || undefined };
}

export type Layer = { id: string; name: string; tools: string[] };

const LAYERS: { id: string; name: string; words: string[] }[] = [
  { id: "interface", name: "Interface", words: ["react", "next", "angular", "vue", "streamlit", "three.js", "html", "tailwind", "typescript", "javascript", "react native", "flutter", "gradio"] },
  { id: "api", name: "API & services", words: ["fastapi", "flask", "django", "node", "express", "rest", "graphql", "serverless", "lambda", "nest", "websocket"] },
  { id: "ai", name: "AI layer", words: ["langchain", "langgraph", "openai", "gpt", "claude", "groq", "llm", "hugging", "transformers", "tensorflow", "pytorch", "scikit", "deep learning", "machine learning", "tf-idf", "cosine", "cnn", "computer vision", "rag", "nlp", "keras"] },
  { id: "tools", name: "Tools & integrations", words: ["mcp", "twilio", "tmdb", "gohighlevel", "n8n", "zapier", "stripe", "retell", "hubspot", "api", "web3", "blockchain", "solidity", "ethers"] },
  { id: "data", name: "Data & vector stores", words: ["postgres", "mysql", "mongo", "pinecone", "faiss", "supabase", "redis", "s3", "firebase", "snowflake", "bigquery", "dynamodb", "sql", "pandas", "chroma"] },
  { id: "ops", name: "Cloud & monitoring", words: ["docker", "kubernetes", "aws", "gcp", "azure", "ec2", "github actions", "ci/cd", "langsmith", "mlflow", "vercel", "terraform", "dvc", "monitoring"] },
];

/** Groups the project's stack into ordered layers; empty layers are dropped. */
export function architectureLayers(techStack: string[]): Layer[] {
  const used = new Set<string>();
  const layers = LAYERS.map((layer) => {
    const tools = techStack.filter((tool) => {
      if (used.has(tool)) return false;
      const t = tool.toLowerCase();
      const hit = layer.words.some((w) => t.includes(w));
      if (hit) used.add(tool);
      return hit;
    });
    return { id: layer.id, name: layer.name, tools };
  }).filter((l) => l.tools.length);
  const rest = techStack.filter((t) => !used.has(t));
  if (rest.length) layers.push({ id: "other", name: "Other components", tools: rest });
  return layers;
}

export const servicePaths = [
  {
    id: "data",
    label: "Data",
    title: "Give your data direction.",
    description:
      "Connect scattered sources, build dependable pipelines, and make the information your team needs ready to use.",
    slug: "data-engineering-excellence",
    technologies: "Python · SQL · Cloud platforms",
    need: "Make sense of my data",
    deliverable: "A clear data model, tested pipelines, and usable reporting.",
  },
  {
    id: "intelligence",
    label: "Intelligence",
    title: "Turn knowledge into answers.",
    description:
      "Build AI applications that work with your documents and tools, with retrieval, evaluation, and human oversight built in.",
    slug: "llm-rag-developer-hire",
    technologies: "LangChain · RAG · Vector databases",
    need: "Build an AI-powered product",
    deliverable:
      "A working prototype, evaluation criteria, and a practical deployment plan.",
  },
  {
    id: "automation",
    label: "Automation",
    title: "Make room for better work.",
    description:
      "Connect your applications and automate repetitive tasks with observable workflows, clear boundaries, and useful failure recovery.",
    slug: "ai-automation",
    technologies: "n8n · APIs · Agent workflows",
    need: "Automate repetitive work",
    deliverable:
      "An integrated workflow with monitoring, handoff notes, and recovery steps.",
  },
] as const;

/** The six capability cards orbiting the homepage brain. `region` maps each
 * card onto one of the model's three glow masks (Data / Intelligence / Automation). */
export const heroServices = [
  {
    id: "data",
    label: "Data",
    tags: "Collect • Process • Transform",
    slug: "data-engineering-excellence",
    region: 0,
    tone: "blue",
    title: "Give your data direction.",
  },
  {
    id: "ml",
    label: "AI / ML",
    tags: "Models • Insights • Prediction",
    slug: "data-science-and-machine-learning",
    region: 1,
    tone: "violet",
    title: "Models that earn their place.",
  },
  {
    id: "intelligence",
    label: "Intelligence",
    tags: "Understand • Reason • Plan",
    slug: "llm-rag-developer-hire",
    region: 1,
    tone: "coral",
    title: "Turn knowledge into answers.",
  },
  {
    id: "automation",
    label: "Automation",
    tags: "Agents • Workflows • Scale",
    slug: "ai-automation",
    region: 2,
    tone: "teal",
    title: "Make room for better work.",
  },
  {
    id: "analytics",
    label: "Data Analytics",
    tags: "Dashboards • BI • Insights",
    slug: "hire-data-analytics-visualization-expert",
    region: 0,
    tone: "orange",
    title: "Numbers your team can act on.",
  },
  {
    id: "llmops",
    label: "LLMOps / MLOps",
    tags: "Evaluation • Deployment • Monitoring",
    slug: "llmops",
    region: 2,
    tone: "indigo",
    title: "AI that keeps working in production.",
  },
] as const;

export const heroNiches = [
  { label: "Healthcare", icon: "heart", href: "/portfolio" },
  { label: "Legal", icon: "scale", href: "/portfolio" },
  { label: "Finance", icon: "bank", href: "/portfolio" },
  { label: "Education", icon: "cap", href: "/portfolio" },
  { label: "Travel", icon: "plane", href: "/portfolio" },
  { label: "Cybersecurity", icon: "shield", href: "/portfolio" },
  { label: "Biotech", icon: "dna", href: "/portfolio" },
] as const;

/**
 * Homepage "What I do" cards and service selector, in story order:
 * data → intelligence → automation → analytics → production.
 * `tone` picks the card's accent; `visual` picks its abstract system drawing.
 */
export const homeServices = [
  {
    id: "data",
    label: "Data",
    title: "Give your data direction.",
    description:
      "Connect scattered sources, build dependable pipelines, and make the information your team needs ready to use.",
    technologies: "Python · SQL · Cloud platforms",
    slug: "data-engineering-excellence",
    tone: "blue",
    visual: "pipeline",
    need: "Make sense of my data",
    deliverable:
      "A clear data model, tested pipelines, usable reporting, and production-ready infrastructure.",
  },
  {
    id: "intelligence",
    label: "Intelligence",
    title: "Turn knowledge into answers.",
    description:
      "Build AI applications that work with your documents and tools, with retrieval, evaluation, agents, and human oversight built in.",
    technologies: "LangChain · RAG · Vector databases",
    slug: "llm-rag-developer-hire",
    tone: "peach",
    visual: "knowledge",
    need: "Build an AI-powered product",
    deliverable:
      "A working prototype, evaluation criteria, and a practical deployment plan.",
  },
  {
    id: "automation",
    label: "Automation",
    title: "Make room for better work.",
    description:
      "Connect applications and automate repetitive tasks with observable workflows, clear boundaries, and useful failure recovery.",
    technologies: "n8n · APIs · Agent workflows",
    slug: "ai-automation",
    tone: "mint",
    visual: "workflow",
    need: "Automate repetitive work",
    deliverable:
      "An integrated workflow with monitoring, handoff notes, and recovery steps.",
  },
  {
    id: "analytics",
    label: "Data Analytics",
    title: "Turn data into decisions.",
    description:
      "Define the metrics that matter, then build dashboards and analysis your team can trust and act on.",
    technologies: "SQL · BI dashboards · Python",
    slug: "hire-data-analytics-visualization-expert",
    tone: "orange",
    visual: "analytics",
    need: "Understand my business data",
    deliverable:
      "Agreed metrics, trustworthy dashboards, and analysis that points to the next decision.",
  },
  {
    id: "production",
    label: "LLMOps / MLOps",
    title: "Move AI safely into production.",
    description:
      "Evaluate, deploy, and monitor models and LLM applications with tracing, versioning, cost controls, and rollback plans.",
    technologies: "Evaluation · CI/CD · Monitoring",
    slug: "llmops",
    tone: "violet",
    visual: "production",
    need: "Deploy / monitor AI systems",
    deliverable:
      "A deployment pipeline, an evaluation suite, monitoring dashboards, and runbooks.",
  },
] as const;

export type HomeService = (typeof homeServices)[number];

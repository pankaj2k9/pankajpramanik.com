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

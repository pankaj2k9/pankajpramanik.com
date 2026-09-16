/**
 * The eight capability groups used by the Services explorer, service detail
 * pages and the skills map. Each group lists the service pages it covers
 * (Page.slug, kind SERVICE) and the stages of a typical architecture.
 */
export type Tone = "blue" | "peach" | "mint" | "orange" | "violet";
export type Visual =
  | "pipeline"
  | "knowledge"
  | "workflow"
  | "analytics"
  | "production"
  | "agents"
  | "rag"
  | "voice";

export type Stage = { name: string; detail: string };

export type ServiceGroup = {
  id: string;
  label: string;
  title: string;
  description: string;
  tone: Tone;
  visual: Visual;
  problems: string[];
  deliverables: string[];
  tools: string[];
  /** Project tag ids (see project-tags.ts) that count as related work. */
  projectTags: string[];
  serviceSlugs: string[];
  architectureTitle: string;
  stages: Stage[];
};

export const serviceGroups: ServiceGroup[] = [
  {
    id: "data-engineering",
    label: "Data Engineering",
    title: "Give your data direction.",
    description:
      "Connect scattered sources into dependable pipelines, so the data your team needs is modelled, tested and ready to use.",
    tone: "blue",
    visual: "pipeline",
    problems: [
      "Reports disagree because every team pulls data differently",
      "Manual exports and spreadsheets hold critical workflows together",
      "Pipelines break silently and nobody notices until a decision is wrong",
    ],
    deliverables: [
      "Source-to-warehouse pipelines with tests and alerts",
      "A clear data model and documentation",
      "Scheduled, observable jobs your team can maintain",
    ],
    tools: ["Python", "SQL", "dbt", "Airflow", "Snowflake", "BigQuery", "AWS"],
    projectTags: ["data"],
    serviceSlugs: ["data-engineering-excellence", "hire-ai-data-pipeline-engineer"],
    architectureTitle: "From sources to trusted tables",
    stages: [
      { name: "Sources", detail: "Apps, APIs, files and databases, inventoried with owners." },
      { name: "Ingestion", detail: "Incremental loads that can be replayed safely." },
      { name: "Validation", detail: "Schema and freshness checks before data moves on." },
      { name: "Transformation", detail: "Tested models that turn raw records into business entities." },
      { name: "Warehouse", detail: "One governed place for analytics and AI to read from." },
      { name: "Serving", detail: "Dashboards, reverse ETL and features for downstream systems." },
    ],
  },
  {
    id: "data-analytics",
    label: "Data Analytics",
    title: "Turn data into decisions.",
    description:
      "Define the metrics that matter, then build dashboards and analysis your team can trust and act on.",
    tone: "orange",
    visual: "analytics",
    problems: [
      "Dashboards exist, but nobody trusts the numbers",
      "Every question needs an analyst and a week",
      "Metrics are defined differently across teams",
    ],
    deliverables: [
      "Agreed metric definitions and a semantic layer",
      "Focused dashboards for the decisions people actually make",
      "Analysis that ends in a recommendation, not a chart",
    ],
    tools: ["SQL", "Python", "Pandas", "Power BI", "Looker", "Tableau"],
    projectTags: ["analytics", "ml"],
    serviceSlugs: ["hire-data-analytics-visualization-expert"],
    architectureTitle: "From raw events to a decision",
    stages: [
      { name: "Raw data", detail: "Events and records pulled from the warehouse." },
      { name: "Modelling", detail: "Clean tables shaped around questions, not sources." },
      { name: "Metrics layer", detail: "One definition per metric, reused everywhere." },
      { name: "Dashboards", detail: "Few, focused views with context and thresholds." },
      { name: "Decisions", detail: "Reviews and alerts that turn numbers into action." },
    ],
  },
  {
    id: "ai-ml",
    label: "AI / ML",
    title: "Models that earn their place.",
    description:
      "Frame the prediction problem properly, build a baseline, and ship a model only when it clearly beats simpler options.",
    tone: "orange",
    visual: "analytics",
    problems: [
      "A promising notebook never makes it to production",
      "It is unclear whether the model beats a simple rule",
      "Predictions drift and nobody measures it",
    ],
    deliverables: [
      "Problem framing, baseline and evaluation plan",
      "A trained, versioned model with honest metrics",
      "An API or batch job ready for deployment",
    ],
    tools: ["Python", "scikit-learn", "PyTorch", "TensorFlow", "XGBoost", "FastAPI"],
    projectTags: ["ml", "cv"],
    serviceSlugs: [
      "data-science-and-machine-learning",
      "deep-learning-solutions",
      "natural-language-processing-excellence",
    ],
    architectureTitle: "From data to a monitored model",
    stages: [
      { name: "Data", detail: "Labelled examples with known gaps and biases." },
      { name: "Features", detail: "Reproducible transformations shared by training and serving." },
      { name: "Training", detail: "Tracked experiments against a simple baseline." },
      { name: "Evaluation", detail: "Metrics that match the business cost of mistakes." },
      { name: "Serving", detail: "An API or batch job with versioned artefacts." },
      { name: "Monitoring", detail: "Drift and quality checks with retraining triggers." },
    ],
  },
  {
    id: "genai-rag",
    label: "GenAI / RAG",
    title: "Turn knowledge into answers.",
    description:
      "Build AI applications grounded in your documents, with retrieval you can inspect, citations people can check, and evaluation built in.",
    tone: "peach",
    visual: "rag",
    problems: [
      "Knowledge is spread across PDFs, wikis and inboxes",
      "Chatbot demos hallucinate on real questions",
      "No way to tell whether answers are getting better or worse",
    ],
    deliverables: [
      "Ingestion, chunking and retrieval tuned on your content",
      "Answers with citations and clear fallbacks",
      "An evaluation set and quality dashboard",
    ],
    tools: ["LangChain", "LlamaIndex", "OpenAI", "Claude", "Pinecone", "FAISS", "FastAPI"],
    projectTags: ["rag"],
    serviceSlugs: [
      "llm-rag-developer-hire",
      "vector-database-integration-expert",
      "hire-ai-langchain-expert",
      "prompt-engineer-hire",
    ],
    architectureTitle: "From documents to cited answers",
    stages: [
      { name: "Documents", detail: "PDFs, pages and tickets, with access rules preserved." },
      { name: "Parsing", detail: "Text, tables and structure extracted cleanly." },
      { name: "Chunking", detail: "Sections sized for meaning, not a fixed character count." },
      { name: "Embeddings", detail: "Vectors that capture what each chunk is about." },
      { name: "Vector database", detail: "Fast similarity search with metadata filters." },
      { name: "Retrieval", detail: "Hybrid search and re-ranking pick the best context." },
      { name: "LLM", detail: "A prompt that answers only from retrieved context." },
      { name: "Answer + citations", detail: "Sources shown, so people can verify." },
    ],
  },
  {
    id: "agentic-ai",
    label: "Agentic AI",
    title: "Agents with clear boundaries.",
    description:
      "Design multi-step AI agents that plan, use tools and hand off to people — with guardrails, tracing and review where it matters.",
    tone: "blue",
    visual: "agents",
    problems: [
      "Single prompts cannot handle multi-step work",
      "Agents take actions nobody can trace or undo",
      "Tool integrations are brittle and untested",
    ],
    deliverables: [
      "A supervisor-and-specialist agent design",
      "Tool integrations with guardrails and approvals",
      "Traces, evaluations and a human-review path",
    ],
    tools: ["LangGraph", "MCP", "OpenAI", "Claude", "Groq", "LangSmith"],
    projectTags: ["agents"],
    serviceSlugs: ["agentic-ai-development", "ai-chatbot-agent-designer", "ai-voice-assistant-developer"],
    architectureTitle: "From a request to a reviewed action",
    stages: [
      { name: "Request", detail: "A goal in plain language, with user context." },
      { name: "Planner", detail: "A supervisor splits the goal into steps." },
      { name: "Tools", detail: "Specialist agents call APIs, search and databases." },
      { name: "Memory", detail: "State carried across steps and sessions." },
      { name: "Guardrails", detail: "Policies check inputs, outputs and actions." },
      { name: "Human review", detail: "Approval for anything costly or irreversible." },
      { name: "Action", detail: "The result is delivered and fully traced." },
    ],
  },
  {
    id: "automation",
    label: "Automation",
    title: "Make room for better work.",
    description:
      "Connect applications and automate repetitive tasks with observable workflows, clear boundaries and useful failure recovery.",
    tone: "mint",
    visual: "workflow",
    problems: [
      "People copy data between tools all day",
      "Leads and requests fall through the cracks",
      "Existing automations fail without anyone knowing",
    ],
    deliverables: [
      "Mapped workflows with owners and edge cases",
      "Integrations with retries, logging and alerts",
      "Handoff notes and a recovery playbook",
    ],
    tools: ["n8n", "Make.com", "Zapier", "GoHighLevel", "Retell AI", "HubSpot", "APIs"],
    projectTags: ["automation"],
    serviceSlugs: ["ai-automation", "hire-n8n-workflow-developer"],
    architectureTitle: "From a trigger to a recovered failure",
    stages: [
      { name: "Trigger", detail: "A form, call, webhook or schedule starts the flow." },
      { name: "Enrich", detail: "Look up context from CRM and other systems." },
      { name: "Decide", detail: "Rules or an AI step choose the next action." },
      { name: "Act", detail: "Update records, send messages, create tasks." },
      { name: "Log & alert", detail: "Every run is recorded; failures notify a person." },
      { name: "Recover", detail: "Retries and a documented manual fallback." },
    ],
  },
  {
    id: "llmops-mlops",
    label: "LLMOps / MLOps",
    title: "Move AI safely into production.",
    description:
      "Evaluate, deploy and monitor models and LLM applications with tracing, versioning, cost controls and rollback plans.",
    tone: "violet",
    visual: "production",
    problems: [
      "Every model release is a manual, risky event",
      "Quality and cost are only noticed after complaints",
      "Nobody can reproduce last month's model",
    ],
    deliverables: [
      "CI/CD for models and prompts, with evaluation gates",
      "Tracing, quality and cost dashboards",
      "Versioned artefacts, runbooks and rollback",
    ],
    tools: ["MLflow", "DVC", "LangSmith", "Evidently", "Docker", "GitHub Actions", "AWS"],
    projectTags: ["mlops", "llmops"],
    serviceSlugs: ["llmops", "hire-the-perfect-mlops-developer"],
    architectureTitle: "A loop, not a launch",
    stages: [
      { name: "Model", detail: "A versioned model or prompt with its data lineage." },
      { name: "Evaluation", detail: "Automated checks against a fixed test set." },
      { name: "Deployment", detail: "Gated releases with canary and rollback." },
      { name: "Monitoring", detail: "Latency, cost, drift and quality in one view." },
      { name: "Feedback", detail: "Real usage flows back into the next evaluation." },
    ],
  },
  {
    id: "cloud-production",
    label: "Cloud / Production",
    title: "Software that stays up.",
    description:
      "Turn prototypes into maintainable applications on AWS, GCP or Azure, with infrastructure as code, CI/CD and observability.",
    tone: "violet",
    visual: "production",
    problems: [
      "The prototype works on one laptop only",
      "Deployments are manual and scary",
      "No visibility into errors, latency or spend",
    ],
    deliverables: [
      "Containerised services and infrastructure as code",
      "CI/CD pipelines with tests and preview environments",
      "Logging, metrics, alerts and cost guardrails",
    ],
    tools: ["AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "Next.js", "FastAPI"],
    projectTags: ["web", "mlops"],
    serviceSlugs: [
      "hire-cloud-devops-engineer-ai",
      "aws-serverless-app-development",
      "forward-deployed-engineer",
      "ai-based-software-development",
      "chatting-app-development",
      "data-structure-and-algorithm-problem-solving",
    ],
    architectureTitle: "From commit to observed production",
    stages: [
      { name: "Code", detail: "Reviewed changes with tests alongside." },
      { name: "CI/CD", detail: "Build, test and deploy on every merge." },
      { name: "Containers", detail: "The same image runs locally and in the cloud." },
      { name: "Cloud runtime", detail: "Managed services sized for real load." },
      { name: "Observability", detail: "Logs, traces and alerts on what users feel." },
      { name: "Cost controls", detail: "Budgets and scaling rules to avoid surprises." },
    ],
  },
];

export function groupForService(slug: string): ServiceGroup | undefined {
  return serviceGroups.find((g) => g.serviceSlugs.includes(slug));
}

/**
 * Outreach agent configuration.
 *
 * Read lazily, never at module load: a missing key must fail the run that
 * needs it, not the whole application build. Nothing here may ever reach the
 * client — every value is a credential or a spend control.
 *
 * Deliberately NOT marked "server-only": the agent worker is a plain Node
 * process outside Next, and that import would throw there. Keeping it out
 * means every caller must be server-side by construction, so never import
 * this from a "use client" module.
 *
 * Design record: docs/outreach-agent-architecture.md §7
 */

export class MissingConfig extends Error {
  constructor(name: string, purpose: string) {
    super(`${name} is not set. Needed for ${purpose}. See .env.example.`);
    this.name = "MissingConfig";
  }
}

function required(name: string, purpose: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new MissingConfig(name, purpose);
  return value;
}

export const outreachEnv = {
  openaiKey: () => required("OPENAI_API_KEY", "drafting and scoring"),
  /** No fallback model on purpose — a typo should fail, not silently bill. */
  model: () => required("OPENAI_MODEL", "drafting and scoring"),
  fastModel: () => process.env.OPENAI_FAST_MODEL?.trim() || required("OPENAI_MODEL", "cheap classification"),
  reasoningModel: () => process.env.OPENAI_REASONING_MODEL?.trim() || required("OPENAI_MODEL", "scoring"),
  tavilyKey: () => required("TAVILY_API_KEY", "company and contact research"),
  hunterKey: () => required("HUNTER_API_KEY", "email discovery and verification"),
  checkpointUrl: () => required("LANGGRAPH_CHECKPOINT_URL", "agent checkpointing"),
  sender: () => process.env.OUTREACH_SENDER?.trim() || "me@pankajpramanik.com",
  /**
   * Kill switch. Exact-match "true" so an empty, absent or malformed value
   * can never be read as permission to send.
   */
  sendingEnabled: () => process.env.OUTREACH_ENABLED?.trim() === "true",
} as const;

/** Names of anything missing, for the dashboard to show before a run starts. */
export function configGaps(): string[] {
  const checks: [string, () => unknown][] = [
    ["OPENAI_API_KEY", outreachEnv.openaiKey],
    ["OPENAI_MODEL", outreachEnv.model],
    ["TAVILY_API_KEY", outreachEnv.tavilyKey],
    ["HUNTER_API_KEY", outreachEnv.hunterKey],
    ["LANGGRAPH_CHECKPOINT_URL", outreachEnv.checkpointUrl],
  ];
  return checks.filter(([, read]) => {
    try { read(); return false; } catch { return true; }
  }).map(([name]) => name);
}

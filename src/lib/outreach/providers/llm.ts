import { outreachEnv } from "../env";

/**
 * OpenAI chat wrapper.
 *
 * Two tiers so cheap work does not pay reasoning prices: `fast` for
 * extraction and classification, `reasoning` for drafting. Model ids come
 * from the environment with no fallback, so a typo fails loudly instead of
 * silently billing a different model.
 */

export type Tier = "fast" | "reasoning";

export class LlmError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "LlmError";
  }
}

function modelFor(tier: Tier): string {
  return tier === "fast" ? outreachEnv.fastModel() : outreachEnv.reasoningModel();
}

export async function complete(
  system: string,
  user: string,
  options: { tier?: Tier; maxTokens?: number; json?: boolean } = {},
): Promise<string> {
  const model = modelFor(options.tier ?? "reasoning");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${outreachEnv.openaiKey()}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_completion_tokens: options.maxTokens ?? 1200,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const payload = (await response.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };
  if (!response.ok || payload.error) {
    throw new LlmError(payload.error?.message ?? `OpenAI responded ${response.status}`, response.status);
  }
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new LlmError("OpenAI returned an empty completion");
  return content;
}

/** Same call, parsed as JSON. Returns null rather than throwing on bad JSON. */
export async function completeJson<T>(
  system: string,
  user: string,
  options: { tier?: Tier; maxTokens?: number } = {},
): Promise<T | null> {
  const raw = await complete(system, user, { ...options, json: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.error("[outreach] model returned unparseable JSON");
    return null;
  }
}

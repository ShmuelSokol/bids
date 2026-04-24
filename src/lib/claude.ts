/**
 * Thin Claude API client — no SDK dependency, uses native fetch.
 *
 * Env required:
 *   ANTHROPIC_API_KEY — get at https://console.anthropic.com
 *
 * Costs tracked per call so budget enforcement is trivial.
 */

const API_BASE = "https://api.anthropic.com/v1/messages";

// Pricing as of 2026-04 (USD per 1M tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-7": { input: 15.0, output: 75.0 },
};

export type ClaudeCallResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  model: string;
};

export async function claudeCall(opts: {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string;
}): Promise<ClaudeCallResult> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set in .env");
  }

  const t0 = Date.now();
  const resp = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    }),
  });

  const body = await resp.text();
  if (!resp.ok) {
    throw new Error(`Claude API ${resp.status}: ${body.slice(0, 300)}`);
  }
  const json = JSON.parse(body);
  const text = json.content?.[0]?.text ?? "";
  const inputTokens = json.usage?.input_tokens ?? 0;
  const outputTokens = json.usage?.output_tokens ?? 0;

  const pricing = MODEL_PRICING[opts.model] ?? { input: 3.0, output: 15.0 };
  const costUsd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;

  return {
    text,
    inputTokens,
    outputTokens,
    costUsd,
    durationMs: Date.now() - t0,
    model: opts.model,
  };
}

/**
 * Safely parse JSON from Claude's output — Claude sometimes wraps JSON in
 * ```json fences or prose. Strip anything before/after the outermost {}.
 */
export function extractJson<T = any>(text: string): T {
  // Fast path: already clean JSON
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }
  // Find outermost {...}
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  }
  throw new Error(`No JSON object in response: ${text.slice(0, 200)}`);
}

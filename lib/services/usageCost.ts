// ── Groq pricing (per million tokens, as of 2025) ─────────────────
// Update these if Groq changes pricing.
const PRICING: Record<string, { input: number; output: number }> = {
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  "llama-3.1-8b-instant": { input: 0.05, output: 0.08 },
  "mixtral-8x7b-32768": { input: 0.24, output: 0.24 },
  "gemma2-9b-it": { input: 0.2, output: 0.2 },
  default: { input: 0.59, output: 0.79 },
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  if (model === "qwen") return 0
  const p = PRICING[model] ?? PRICING.default
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
}

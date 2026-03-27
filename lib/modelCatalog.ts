import { MODELS, type Provider } from "../types/chat.ts"

export interface ModelCatalogItem {
  id: Provider
  label: string
  sublabel: string
  color: string
  bgColor: string
  available: boolean
  availabilityLabel: string
  note?: string
}

type ModelEnv = Record<string, string | undefined>

export function buildModelCatalog(
  env: ModelEnv = process.env
): ModelCatalogItem[] {
  return (Object.entries(MODELS) as [Provider, (typeof MODELS)[Provider]][]).map(
    ([id, meta]) => {
      if (id === "groq") {
        const available = Boolean(env.GROQ_API_KEY)
        return {
          id,
          ...meta,
          available,
          availabilityLabel: available ? "Ready" : "Setup required",
          note: available
            ? "Cloud model. If Groq rate-limits, chat can fall back to Qwen automatically."
            : "Set GROQ_API_KEY to use Groq.",
        }
      }

      const available = Boolean(env.LM_STUDIO_URL)
      return {
        id,
        ...meta,
        available,
        availabilityLabel: available ? "Local" : "Setup required",
        note: "Requires an OpenAI-compatible local endpoint such as LM Studio.",
      }
    }
  )
}

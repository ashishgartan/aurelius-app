import { ALL_TOOLS, TOOL_META, type ToolId } from "../../types/auth.ts"

export interface ToolCatalogItem {
  id: ToolId
  label: string
  description: string
  icon: string
  available: boolean
  availabilityLabel: string
  note?: string
  envVar?: string
}

type ToolEnv = Record<string, string | undefined>

export function buildToolCatalog(
  env: ToolEnv = process.env
): ToolCatalogItem[] {
  return ALL_TOOLS.map((id) => {
    const meta = TOOL_META[id]

    switch (id) {
      case "research_agent": {
        const available = Boolean(env.TAVILY_API_KEY)
        return {
          id,
          ...meta,
          available,
          availabilityLabel: available ? "Ready" : "Setup required",
          note: available
            ? "Uses live web search."
            : "Tavily is not configured on this deployment.",
          envVar: "TAVILY_API_KEY",
        }
      }
      case "productivity_agent": {
        const available = Boolean(env.SMTP_HOST)
        return {
          id,
          ...meta,
          available,
          availabilityLabel: available ? "Ready" : "Setup required",
          note: available
            ? "Uses the app SMTP server with your own login credentials."
            : "Email sending requires SMTP_HOST to be configured on the server.",
          envVar: "SMTP_HOST",
        }
      }
      case "code_agent":
        return {
          id,
          ...meta,
          available: true,
          availabilityLabel: "Built-in",
          note: "Code help only. Execution and repo search are not enabled yet.",
        }
      case "knowledge_agent":
        return {
          id,
          ...meta,
          available: true,
          availabilityLabel: "Session-based",
          note: "Works when documents are uploaded to the current chat.",
        }
      default:
        return {
          id,
          ...meta,
          available: true,
          availabilityLabel: "Built-in",
        }
    }
  })
}

// types/auth.ts

export interface User {
  id:          string
  email:       string
  displayName: string
  avatarUrl?:  string
  createdAt:   string
}

export interface AuthTokenPayload {
  userId:      string
  email:       string
  displayName: string
  avatarUrl?:  string
  createdAt:   string
  iat?:        number
  exp?:        number
}

// ── User settings ──────────────────────────────────────────────────
export type ResponseLength = "concise" | "balanced" | "detailed"
export type ResponseTone   = "professional" | "casual" | "technical"

export interface UserSettings {
  instructions: string
  memory:       string
  language:     string
  length:       ResponseLength
  tone:         ResponseTone
  enabledTools: string[]   // agent names the user has activated
  smtpUser?:    string
  smtpPass?:    string
}

export const ALL_TOOLS = [
  "research_agent",
  "math_agent",
  "code_agent",
  "knowledge_agent",
  "productivity_agent",
] as const

export type ToolId = typeof ALL_TOOLS[number]

export const TOOL_META: Record<ToolId, { label: string; description: string; icon: string }> = {
  research_agent:     { label: "Web Search",     icon: "🔍", description: "Search the live web for current news, prices, and real-time info" },
  math_agent:         { label: "Calculator",     icon: "🧮", description: "Evaluate maths expressions, percentages, and unit conversions" },
  code_agent:         { label: "Code Assistant", icon: "💻", description: "Write, debug, explain, and review code across languages and frameworks" },
  knowledge_agent:    { label: "Document Reader",icon: "📄", description: "Search and analyse files you upload to the chat session" },
  productivity_agent: { label: "Email",          icon: "📧", description: "Send emails directly from Aurelius" },
}

export const DEFAULT_SETTINGS: UserSettings = {
  instructions: "",
  memory:       "",
  language:     "English",
  length:       "balanced",
  tone:         "professional",
  enabledTools: [],   // all tools off by default
  smtpUser:     "",
  smtpPass:     "",
}

// types/chat.ts

export type Provider = "groq" | "qwen"
export type Role     = "user" | "assistant"

export interface ToolCall {
  tool:   string
  input:  string
  output?: string
  outputCode?: string
  outputMeta?: Record<string, string>
}

// A reference to a code artifact saved in Cloudinary
export interface ArtifactRef {
  artifactId: string
  filename:   string
  lang:       string
  sizeBytes:  number
  favorite?:  boolean
}

export interface ChatMessage {
  _id:        string
  role:       Role
  content:    string
  model:      Provider
  createdAt:  string
  planSteps?: string[]
  toolCalls?: ToolCall[]
  thinking?:  string
  artifacts?: ArtifactRef[]   // code files saved to Cloudinary during this message
}

export interface ChatSession {
  _id:       string
  title:     string
  provider:  Provider
  pinned?:   boolean
  archived?: boolean
  messages:  ChatMessage[]
  updatedAt: string
  createdAt: string
}

export interface SessionSummary {
  _id:       string
  title:     string
  provider:  Provider
  pinned?:   boolean
  archived?: boolean
  updatedAt: string
  createdAt: string
}

export const MODELS: Record<Provider, { label: string; sublabel: string; color: string; bgColor: string }> = {
  groq: { label: "Groq", sublabel: "Llama 3.3 · Cloud", color: "text-orange-500", bgColor: "bg-orange-500" },
  qwen: { label: "Qwen", sublabel: "Local · LM Studio",  color: "text-green-500",  bgColor: "bg-green-500"  },
}

export interface UserSettings {
  instructions: string
  memory:       string
  language:     string
  length:       "concise" | "balanced" | "detailed"
  tone:         "professional" | "casual" | "technical"
  enabledTools: string[]
}

export function toolDisplayName(tool: string): string {
  if (tool.includes("tavily") || tool === "web_search") return "Web search"
  if (tool.includes("wikipedia"))   return "Wikipedia"
  if (tool.includes("calc"))        return "Calculator"
  if (tool.includes("email"))       return "Send email"
  if (tool === "list_documents")    return "List documents"
  if (tool === "document_search")   return "Document search"
  if (tool === "read_document")     return "Read document"
  if (tool === "code_runner")       return "Run code"
  if (tool === "repo_search")       return "Repo search"
  return tool.replace(/_/g, " ")
}

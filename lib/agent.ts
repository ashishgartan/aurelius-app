// lib/agent.ts

import { buildAgentRegistry } from "@/lib/agents/index"
import { routeQuery }         from "@/lib/agents/router"
import { executeAgent }       from "@/lib/agents/executor"
import { buildMemoryContext } from "@/lib/services/userMemory"
import type { Provider }      from "@/types/chat"
import type { RegistryOptions } from "@/lib/agents/index"
import {
  buildExecutionPlan,
  chooseExecutionProvider,
  classifyEmailIntent,
  isResearchEmailRequest,
  type RecoveryCode,
} from "@/lib/ai/workflow"

export type AgentChunk =
  | { type: "plan";           steps: string[] }
  | { type: "model";          provider: Provider }
  | { type: "tool_start";     tool: string; input: string }
  | { type: "tool_end";       tool: string; output: string; code?: RecoveryCode; meta?: Record<string, string> }
  | { type: "token";          content: string }
  | { type: "thinking_token"; content: string }
  | { type: "artifact";       artifactId: string; filename: string; lang: string; sizeBytes: number }
  | { type: "usage";          inputTokens: number; outputTokens: number; toolsUsed: string[] }
  | { type: "error";          message: string; code?: RecoveryCode }
  | { type: "title";          title: string }

interface AgentStreamOptions {
  message:       string
  history:       { role: string; content: string }[]
  provider:      Provider
  instructions?: string
  memory?:       string
  structuredMemory?: string
  language?:     string
  length?:       "concise" | "balanced" | "detailed"
  tone?:         "professional" | "casual" | "technical"
  ragContext?:   string
  sessionId?:    string
  userId?:       string
  enabledTools?: string[]   // ← new
}

const LENGTH_INSTRUCTIONS = {
  concise:  "Keep responses short and to the point. Avoid unnecessary explanation.",
  balanced: "Balance brevity with completeness. Use detail only where it adds value.",
  detailed: "Be thorough and comprehensive. Explain reasoning, show examples.",
}

const TONE_INSTRUCTIONS = {
  professional: "Use a clear, professional tone.",
  casual:       "Use a friendly, conversational tone.",
  technical:    "Use precise technical language. Assume expertise.",
}

const AGENT_CONTEXT: Record<string, string> = {
  math_agent:         "You are in math mode. Always use the calculator tool for numerical computations — never calculate in your head.",
  research_agent:     "You are in research mode. Always use the web search tool for current information. " +
    "When writing your response, cite sources inline using numbered superscripts like [1], [2] — " +
    "place the citation immediately after the sentence or fact it supports. " +
    "Then end your response with a '## Sources' section listing every cited source as a clickable link:\n" +
    "## Sources\n1. [Title](url)\n2. [Title](url)\n" +
    "Example of correct inline citation: 'Bitcoin rose 4% on Monday [1], driven by ETF inflows [2].'\n" +
    "Never omit the Sources section — it is mandatory whenever you used the search tool. " +
    "If search returns no results or fails, answer from memory and note it may not be current.",
  code_agent:
    "You are in code mode. Produce production-quality code and concrete fixes, not toy snippets. " +
    "Before answering, infer the likely runtime/framework context from the user's request and stay consistent with it. " +
    "Prefer complete, maintainable implementations over placeholders, pseudocode, or hand-wavy advice. " +
    "When debugging, identify the likely root cause first and then show the corrected code. " +
    "For refactors, preserve behavior unless the user asks for changes. " +
    "For CSS and frontend work, avoid weak generic styling: produce intentional, polished, responsive UI with sound spacing, hierarchy, and states. " +
    "If the request is for React/Next/Tailwind, use idiomatic modern patterns for that stack. " +
    "Do not pad the response with theory when the user clearly wants working code.",
  knowledge_agent:    "You are in document mode. Always search the user's uploaded documents before answering. Cite the source file for every claim.",
  productivity_agent: "You are in productivity mode. Use the send_email_tool when the user wants to send a message. Ensure you have a recipient, subject, and body before calling the tool. After the tool returns, stop and give a short final result. Do not call the email tool more than once for the same request unless the user explicitly asks to retry. Do not imply task or calendar integrations exist when they are not available.",
  research_productivity_agent:
    "You are in research-to-email mode. First use live web search to gather current information. Then draft a concise email subject and body from those sourced findings. Finally call send_email_tool exactly once. Do not send placeholders. After the tool returns, stop and give a short final result with recipient and subject.",
}

function buildSystemPrompt(opts: AgentStreamOptions, agentName: string): string {
  const parts: string[] = []

  parts.push(`You are Aurelius, a helpful AI assistant with real tool capabilities. You can actually perform actions — not just describe them.`)

  const agentContext = AGENT_CONTEXT[agentName]
  if (agentContext) parts.push(agentContext)

  const emailIntent = classifyEmailIntent(opts.message)
  if (agentName === "productivity_agent") {
    if (emailIntent.intent === "send") {
      parts.push(`## Email action policy
- The user approved sending an email.
- Validate the recipient before using the email tool.
- If subject or body is missing, draft the missing parts from the user's request instead of asking the user to rewrite the whole prompt.
- If the request depends on current information, gather that information before drafting or sending.
- Call send_email_tool at most once.
- After the tool returns, answer with a short final status including recipient and subject.`)
    } else {
      parts.push(`## Email action policy
- If the user is drafting or composing an email, write the draft only.
- Do not call the email tool unless the user explicitly asks to send.`)
    }
  }

  if (agentName === "research_productivity_agent" || isResearchEmailRequest(opts.message)) {
    parts.push(`## Research email workflow
- This request needs current information and a real email send.
- Use web search first and rely on those findings for the email content.
- Draft a concrete subject and body from the search results before using the email tool.
- Call send_email_tool at most once.
- After the tool returns, answer with a short final delivery status including recipient and subject.`)
  }

  parts.push(`## Formatting rules
- Always use Markdown. Your responses are rendered in a Markdown-aware UI.
- Use ## or ### headings to introduce major sections.
- Use **bold** for key terms and important concepts.
- Use bullet lists (- item) or numbered lists for enumerations — never write them inline as "1. ... 2. ...".
- Use backtick code blocks with a language tag for all code (e.g. \`\`\`javascript).
- Use tables for comparisons when there are 2+ attributes across 2+ items.
- Leave a blank line between sections for readability.
- Never write walls of text — break information into scannable sections.
- Keep the opening sentence short and direct. State what the thing is before going into detail.`)

  parts.push(`## Handling short or vague messages
- If the user sends a single word or short phrase (e.g. "mongodb", "python", "cars"), treat it as "tell me about [topic]" and give a well-structured overview.
- Never return an empty response. If the message is ambiguous, make a reasonable assumption and answer, then offer to go deeper.
- If a question is genuinely unclear, give a brief best-guess answer first, then ask for clarification.`)

  if (agentName !== "general_agent") {
    parts.push(`## Tool usage\nUse your available tools proactively when they will improve the answer. Report tool results concisely inline.`)
  }

  if (agentName === "code_agent") {
    parts.push(`## Coding quality bar
- Write code that is ready to run, not sketch-level pseudocode.
- Match the requested language, framework, and style conventions.
- Prefer clear naming, small cohesive functions, and predictable control flow.
- Avoid placeholder comments like TODO unless the user explicitly asked for scaffolding.
- When fixing bugs, explain the root cause briefly and return the corrected implementation.
- When returning frontend code, include the necessary CSS/Tailwind classes directly so the result looks finished.
- For CSS/UI work, ensure spacing, typography, hover/focus states, and responsive behavior are considered.
- Do not produce ugly fallback CSS or repetitive utility spam when a cleaner structure would do.`)
  }

  const length = opts.length ?? "balanced"
  const tone   = opts.tone   ?? "professional"
  parts.push(LENGTH_INSTRUCTIONS[length])
  parts.push(TONE_INSTRUCTIONS[tone])

  if (opts.language && opts.language !== "English") {
    parts.push(`Always respond in ${opts.language}, regardless of the language the user writes in.`)
  }

  if (opts.ragContext?.trim()) parts.push(opts.ragContext.trim())
  if (opts.memory?.trim()) {
    parts.push(
      "Stable user preferences and facts to remember across chats:\n" +
        opts.memory.trim()
    )
  }
  if (opts.structuredMemory?.trim()) {
    parts.push(opts.structuredMemory.trim())
  }
  if (opts.instructions?.trim()) parts.push("Additional instructions from the user:\n" + opts.instructions.trim())

  return parts.join("\n\n")
}

export async function createAgentStream(
  options: AgentStreamOptions
): Promise<AsyncGenerator<AgentChunk>> {
  const { message, history, provider, sessionId, userId, enabledTools } = options

  const AGENT_REGISTRY = buildAgentRegistry({ sessionId, userId, enabledTools } as RegistryOptions)

  if (AGENT_REGISTRY.length === 0) {
    throw new Error("No agents available. Check your environment variables (GROQ_API_KEY, TAVILY_API_KEY, etc.)")
  }

  const availableProviders: Provider[] = []
  if (process.env.GROQ_API_KEY) availableProviders.push("groq")
  if (process.env.LM_STUDIO_URL) availableProviders.push("qwen")

  const effectiveProvider = chooseExecutionProvider(message, {
    provider,
    availableProviders,
    enabledTools,
    hasDocuments: Boolean(sessionId),
  })

  const chosenName = await routeQuery(message, AGENT_REGISTRY, effectiveProvider)

  const agent =
    AGENT_REGISTRY.find((a) => a.name === chosenName) ??
    AGENT_REGISTRY.find((a) => a.name === "general_agent") ??
    AGENT_REGISTRY[0]

  console.log(`[router] "${message.slice(0, 60)}" → ${agent.name} via ${effectiveProvider} (Active tools: ${AGENT_REGISTRY.length - 1})`)

  const structuredMemory = userId
    ? await buildMemoryContext(userId, message).catch(() => "")
    : ""
  const systemText = buildSystemPrompt({ ...options, structuredMemory }, agent.name)
  const plan = buildExecutionPlan(message, agent.name, effectiveProvider)

  return (async function* () {
    if (effectiveProvider !== provider) {
      yield { type: "model", provider: effectiveProvider } as const
    }
    yield { type: "plan", steps: plan.steps } as const
    for await (const chunk of executeAgent(
      agent,
      message,
      history,
      systemText,
      effectiveProvider
    )) {
      yield chunk
    }
  })()
}

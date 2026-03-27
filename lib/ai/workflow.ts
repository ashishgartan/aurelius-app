import type { Provider } from "@/types/chat"

export type EmailActionIntent = "none" | "draft" | "send"
export type RecoveryCode =
  | "SMTP_SERVER_CONFIG_MISSING"
  | "SMTP_USER_CREDENTIALS_MISSING"
  | "SMTP_AUTH_FAILED"
  | "MODEL_RATE_LIMIT"
  | "CHAT_RATE_LIMIT"
  | "AGENT_START_FAILED"
  | "UNKNOWN"

export interface EmailDraftFields {
  to: string
  subject: string
  body: string
}

export interface EmailIntentResult {
  intent: EmailActionIntent
  fields?: EmailDraftFields
}

export interface ExecutionContext {
  provider: Provider
  availableProviders: Provider[]
  enabledTools?: string[]
  hasDocuments?: boolean
}

export interface ExecutionPlan {
  provider: Provider
  steps: string[]
}

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

export function classifyEmailIntent(input: string): EmailIntentResult {
  const normalized = input.trim()
  const lowered = normalized.toLowerCase()
  const hasEmailVerb =
    lowered.includes("email") || lowered.includes("mail")
  const hasSendVerb =
    lowered.includes("send") ||
    lowered.includes("deliver") ||
    lowered.includes("send out")
  const hasDraftVerb =
    lowered.includes("draft") ||
    lowered.includes("write") ||
    lowered.includes("compose")

  const toMatch = normalized.match(EMAIL_REGEX)
  const subjectMatch = normalized.match(
    /subject\s*[:=-]\s*([\s\S]+?)(?=\s+body\s*[:=-]|$)/i
  )
  const bodyMatch = normalized.match(/body\s*[:=-]\s*([\s\S]+)/i)
  const hasRecipient = Boolean(toMatch)

  const looksLikeStructuredEmail =
    hasSendVerb && Boolean(toMatch && (subjectMatch || bodyMatch))

  if (!hasEmailVerb && !(hasSendVerb && hasRecipient) && !looksLikeStructuredEmail) {
    return { intent: "none" }
  }

  const fields =
    toMatch || subjectMatch || bodyMatch
      ? {
          to: toMatch?.[0] ?? "",
          subject: subjectMatch?.[1]?.trim() ?? "",
          body: bodyMatch?.[1]?.trim() ?? "",
        }
      : undefined

  if (hasSendVerb && toMatch) return { intent: "send", fields }
  if (hasDraftVerb || toMatch || subjectMatch || bodyMatch) {
    return { intent: "draft", fields }
  }
  return { intent: "none" }
}

export function buildStructuredEmailPrompt(
  intent: Extract<EmailActionIntent, "draft" | "send">,
  fields: EmailDraftFields,
  originalPrompt: string
): string {
  const action =
    intent === "send"
      ? "The user approved sending this email now."
      : "The user wants a draft only. Do not send any email."

  return [
    action,
    "Use the structured details below as the source of truth.",
    `Recipient: ${fields.to || "(missing)"}`,
    `Subject: ${fields.subject || "(missing)"}`,
    `Body: ${fields.body || "(missing)"}`,
    "If subject or body is missing, draft the missing parts from the user's request before using the email tool.",
    "If the request depends on current information, gather that information first before drafting or sending.",
    "",
    "Original user request:",
    originalPrompt.trim(),
  ].join("\n")
}

export function buildSuggestedEmailSubject(input: string): string {
  const normalized = input.trim().replace(/\s+/g, " ")
  const withoutRecipient = normalized.replace(EMAIL_REGEX, "").trim()
  const withoutSendVerb = withoutRecipient
    .replace(/\b(send|mail|email|draft|write|compose)\b/gi, "")
    .replace(/\bto\b/gi, "")
    .trim()

  if (/latest news in india/i.test(input)) return "Latest news in India"
  if (withoutSendVerb.length === 0) return ""

  const candidate = withoutSendVerb
    .replace(/\s+/g, " ")
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "")

  return candidate ? candidate.slice(0, 80) : ""
}

export function requiresCurrentResearch(input: string): boolean {
  const lowered = input.toLowerCase()
  return (
    lowered.includes("latest") ||
    lowered.includes("current") ||
    lowered.includes("recent") ||
    lowered.includes("news") ||
    lowered.includes("headline") ||
    lowered.includes("market update") ||
    lowered.includes("stock price") ||
    lowered.includes("breaking")
  )
}

export function isResearchEmailRequest(input: string): boolean {
  const emailIntent = classifyEmailIntent(input)
  return emailIntent.intent === "send" && requiresCurrentResearch(input)
}

export function isCodeHeavyPrompt(message: string): boolean {
  const lowered = message.toLowerCase()
  return (
    lowered.includes("code") ||
    lowered.includes("debug") ||
    lowered.includes("bug") ||
    lowered.includes("fix") ||
    lowered.includes("refactor") ||
    lowered.includes("implement") ||
    lowered.includes("function") ||
    lowered.includes("component") ||
    lowered.includes("react") ||
    lowered.includes("next.js") ||
    lowered.includes("nextjs") ||
    lowered.includes("typescript") ||
    lowered.includes("javascript") ||
    lowered.includes("python") ||
    lowered.includes("java") ||
    lowered.includes("c++") ||
    lowered.includes("cpp") ||
    lowered.includes("css") ||
    lowered.includes("tailwind") ||
    lowered.includes("ui") ||
    lowered.includes("layout") ||
    lowered.includes("responsive")
  )
}

function isSimplePrompt(message: string): boolean {
  const lowered = message.toLowerCase()
  return (
    message.length < 140 &&
    !EMAIL_REGEX.test(message) &&
    !lowered.includes("latest") &&
    !lowered.includes("today") &&
    !lowered.includes("document") &&
    !lowered.includes("upload") &&
    !lowered.includes("search") &&
    !isCodeHeavyPrompt(message)
  )
}

export function chooseExecutionProvider(
  message: string,
  context: ExecutionContext
): Provider {
  const available = new Set(context.availableProviders)

  if (!available.has(context.provider)) {
    return available.has("groq") ? "groq" : "qwen"
  }

  if (context.provider === "groq" && available.has("qwen") && isSimplePrompt(message)) {
    return "qwen"
  }

  return context.provider
}

export function buildExecutionPlan(
  message: string,
  agentName: string,
  provider: Provider
): ExecutionPlan {
  const lowered = message.toLowerCase()
  const steps: string[] = [`Use ${provider === "groq" ? "Groq" : "Qwen"} for this request.`]

  if (agentName === "productivity_agent") {
    const emailIntent = classifyEmailIntent(message)
    if (emailIntent.intent === "send") {
      steps.push("Validate recipient, subject, and body before using the email tool.")
      steps.push("Send one email and report the final delivery result.")
      return { provider, steps }
    }
    steps.push("Draft the email clearly and wait for explicit send approval.")
    return { provider, steps }
  }

  if (agentName === "research_productivity_agent") {
    steps.push("Search the live web for current information.")
    steps.push("Draft the email subject and body from the sourced findings.")
    steps.push("Send one email and report the final delivery result.")
    return { provider, steps }
  }

  if (agentName === "research_agent") {
    steps.push("Search the live web for current information.")
    steps.push("Answer using sourced findings only.")
    return { provider, steps }
  }

  if (agentName === "knowledge_agent") {
    steps.push("Search uploaded documents first.")
    steps.push("Answer with file-grounded findings.")
    return { provider, steps }
  }

  if (agentName === "code_agent" || lowered.includes("code")) {
    steps.push("Understand the implementation task before writing code.")
    steps.push("Prefer maintainable, production-ready code over quick hacks.")
    steps.push("For UI/CSS requests, produce polished, responsive styling instead of generic layouts.")
    return { provider, steps }
  }

  steps.push("Answer directly without unnecessary tool use.")
  return { provider, steps }
}

export function buildRecoveryGuidance(
  errorMessage: string,
  code?: RecoveryCode
): string[] {
  if (code === "SMTP_SERVER_CONFIG_MISSING") {
    return [
      "Set SMTP_HOST, SMTP_PORT, and SMTP_SECURE on the server.",
      "Retry the email action after the server SMTP transport is configured.",
    ]
  }

  if (code === "SMTP_USER_CREDENTIALS_MISSING") {
    return [
      "Save your mailbox username and password in Tools.",
      "Run the SMTP test again after the credentials are saved.",
    ]
  }

  if (code === "SMTP_AUTH_FAILED") {
    return [
      "Recheck the saved mailbox username and password.",
      "If you use Gmail, generate and save a Google App Password instead of the normal account password.",
    ]
  }

  if (code === "MODEL_RATE_LIMIT" || code === "CHAT_RATE_LIMIT") {
    return [
      "Retry the request after a short wait.",
      "If Qwen is available, fall back to Qwen for this request.",
    ]
  }

  if (code === "AGENT_START_FAILED") {
    return [
      "Check that the selected model provider is configured on the server.",
      "Retry the request after the provider setup is fixed.",
    ]
  }

  const normalized = errorMessage.toLowerCase()

  if (
    normalized.includes("smtp_host is missing") ||
    normalized.includes("smtp is not configured on this server")
  ) {
    return [
      "Set SMTP_HOST, SMTP_PORT, and SMTP_SECURE on the server.",
      "Retry the email action after the server SMTP transport is configured.",
    ]
  }

  if (
    normalized.includes("could not connect to smtp server") ||
    normalized.includes("invalid login") ||
    normalized.includes("authentication")
  ) {
    return [
      "Recheck the saved mailbox username and password.",
      "If you use Gmail, generate and save a Google App Password instead of the normal account password.",
    ]
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("rate_limit_exceeded") ||
    normalized.includes("429")
  ) {
    return [
      "Retry the request after a short wait.",
      "If Qwen is available, fall back to Qwen for this request.",
    ]
  }

  return ["Retry the request with a shorter or more explicit prompt."]
}

export function formatRecoveryMessage(
  errorMessage: string,
  code?: RecoveryCode
): string {
  const steps = buildRecoveryGuidance(errorMessage, code)

  return [
    errorMessage,
    "",
    "Next steps:",
    ...steps.map((step) => `- ${step}`),
  ].join("\n")
}

// lib/agents/index.ts

import { z } from "zod"
import { evaluate, format } from "mathjs"
import { DynamicTool, DynamicStructuredTool } from "@langchain/core/tools"
import type { StructuredToolInterface }        from "@langchain/core/tools"
import { retrieveRelevantChunks, listDocuments } from "@/lib/services/ragService"
import { connectDB }     from "@/lib/mongodb"
import { DocumentModel } from "@/lib/models/Document"
import { Types }         from "mongoose"
import { sendSmtpEmail } from "@/lib/services/sendSmtpEmail"
import { extractCodeAttachments } from "@/lib/services/sendSmtpEmail"
import { getSettings } from "@/lib/services/userSettings"
import { logEmailDelivery } from "@/lib/services/emailDelivery"
import type { RecoveryCode } from "@/lib/ai/workflow"

export interface AgentDefinition {
  name:        string
  description: string
  tools:       StructuredToolInterface[]
}

function notImplemented(name: string, description: string): StructuredToolInterface {
  return new DynamicTool({
    name,
    description,
    func: async () => `${name} is not implemented yet.`,
  }) as unknown as StructuredToolInterface
}

function buildTavilyTool(): StructuredToolInterface {
  return new DynamicTool({
    name: "tavily_search",
    description:
      "Searches the live web for current information. Use for recent news, " +
      "today's prices, live scores, or anything the LLM cannot know from memory. " +
      "Always mention the sources you used. Input: a plain search query string.",
    func: async (query: string) => {
      const apiKey = process.env.TAVILY_API_KEY
      if (!apiKey) return "Tavily API key is not configured."
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key:             apiKey,
            query,
            max_results:         5,
            include_answer:      true,
            include_raw_content: false,
          }),
        })
        if (!res.ok) return `Tavily error: ${res.status} ${res.statusText}`
        const data = await res.json() as {
          answer?:  string
          results?: { title: string; url: string; content: string }[]
        }
        const results = data.results?.slice(0, 5) ?? []
        const lines: string[] = []
        if (data.answer) lines.push(`Answer: ${data.answer}\n`)
        if (results.length) {
          lines.push("Search results:")
          results.forEach((r, i) => {
            lines.push(`\n[${i + 1}] ${r.title}`)
            lines.push(`URL: ${r.url}`)
            lines.push(`Snippet: ${r.content.slice(0, 300)}`)
          })
          lines.push(
            "\nIMPORTANT: You MUST include a '## Sources' section in your response " +
            "listing the URLs above that were relevant to your answer."
          )
        }
        return lines.join("\n") || "No results found."
      } catch (err) {
        return `Search failed: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }) as unknown as StructuredToolInterface
}

function buildCalculatorTool(): StructuredToolInterface {
  return new DynamicTool({
    name: "calculator",
    description:
      "Evaluates mathematical expressions. Use for arithmetic, percentages, " +
      "unit conversions, and algebra. Input: a math expression like '15% of 48' " +
      "or 'sqrt(144)' or '(5 * 8) / 2'.",
    func: async (input: string) => {
      try {
        // Normalise "X% of Y" → "(X/100)*Y" before handing off to mathjs
        const expr = input
          .trim()
          .replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/gi, "($1/100)*$2")

        // mathjs.evaluate() is a sandboxed parser — no eval(), no Function(),
        // no access to JS globals. Safe to run on untrusted LLM-supplied input.
        const result = evaluate(expr)

        if (typeof result !== "number" || !isFinite(result)) {
          return "Could not compute a valid number from that expression."
        }

        // format() trims floating-point noise (e.g. 0.1+0.2 → "0.3" not "0.30000000000000004")
        return `${input} = ${format(result, { precision: 10 })}`
      } catch {
        return "Could not evaluate that expression. Please rephrase it as a plain math expression."
      }
    },
  }) as unknown as StructuredToolInterface
}

function buildListDocumentsTool(sessionId: string, userId: string): StructuredToolInterface {
  return new DynamicTool({
    name: "list_documents",
    description:
      "Lists all documents uploaded to this chat session with filename and size. " +
      "Use this first if the user asks 'what files do I have?' or before a document_search " +
      "to confirm which files are available.",
    func: async () => {
      try {
        const docs = await listDocuments(sessionId, userId)
        if (docs.length === 0) return "No documents have been uploaded to this session."
        const lines = docs.map((d) => {
          const kb = (d.sizeBytes / 1024).toFixed(1)
          return `• ${d.filename} (${kb} KB, ${d.chunks} chunks)`
        })
        return `Documents in this session:\n${lines.join("\n")}`
      } catch (err) {
        return `Could not list documents: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }) as unknown as StructuredToolInterface
}

function buildDocumentSearchTool(sessionId: string, userId: string): StructuredToolInterface {
  return new DynamicTool({
    name: "document_search",
    description:
      "Searches documents uploaded to this chat session and returns the most relevant excerpts. " +
      "Use when the user asks about an uploaded file, PDF, contract, or report. " +
      "Input: a plain query describing what to find (e.g. 'payment terms', 'key findings').",
    func: async (query: string) => {
      try {
        const result = await retrieveRelevantChunks(sessionId, userId, query)
        return result || "No relevant content found in the uploaded documents."
      } catch (err) {
        return `Document search failed: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }) as unknown as StructuredToolInterface
}

function buildReadDocumentTool(sessionId: string, userId: string): StructuredToolInterface {
  return new DynamicTool({
    name: "read_document",
    description:
      "Reads the full content of a specific uploaded document by filename. " +
      "Use when the user wants a complete summary or full analysis of a file. " +
      "Input: the exact filename (e.g. 'report.pdf'). " +
      "Prefer document_search for targeted questions — use this only for whole-document tasks.",
    func: async (filename: string) => {
      try {
        await connectDB()
        const escapedFilename = filename.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        type LeanDoc = {
          filename:  string
          charCount: number
          chunks:    Array<{ index: number; text: string }>
        }
        const doc = await DocumentModel.findOne({
          sessionId: new Types.ObjectId(sessionId),
          userId:    new Types.ObjectId(userId),
          filename:  { $regex: new RegExp(escapedFilename, "i") },
        }).lean() as LeanDoc | null

        if (!doc) {
          return `No document named "${filename}" found in this session. Use list_documents to see available files.`
        }

        const fullText = doc.chunks
          .sort((a, b) => a.index - b.index)
          .map((c: { text: string }) => c.text)
          .join("\n\n")

        const MAX_CHARS = 8000
        const truncated = fullText.length > MAX_CHARS
        const output    = fullText.slice(0, MAX_CHARS)

        return [
          `File: ${doc.filename} (${doc.charCount} chars total, ${doc.chunks.length} chunks)`,
          truncated ? `[Showing first ${MAX_CHARS} characters — use document_search for specific sections]` : "",
          "---",
          output,
        ].filter(Boolean).join("\n")
      } catch (err) {
        return `Could not read document: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }) as unknown as StructuredToolInterface
}

function buildSendEmailTool(userId: string, sessionId?: string): StructuredToolInterface {
  let sendAttempted = false

  const encodeEmailToolResult = (
    message: string,
    code?: RecoveryCode,
    meta?: Record<string, string>
  ) => JSON.stringify({ message, code, meta })

  const inferEmailToolCode = (message: string): RecoveryCode => {
    const normalized = message.toLowerCase()
    if (
      normalized.includes("smtp_host is missing") ||
      normalized.includes("smtp is not configured on this server")
    ) {
      return "SMTP_SERVER_CONFIG_MISSING"
    }
    if (
      normalized.includes("credentials are missing") ||
      normalized.includes("save your email username and password")
    ) {
      return "SMTP_USER_CREDENTIALS_MISSING"
    }
    if (
      normalized.includes("could not connect to smtp server") ||
      normalized.includes("invalid login") ||
      normalized.includes("authentication")
    ) {
      return "SMTP_AUTH_FAILED"
    }
    return "UNKNOWN"
  }

  return new DynamicStructuredTool({
    name: "send_email_tool",
    description: "Sends an email. Required fields: to, subject, body.",
    schema: z.object({
      to:      z.string().email().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body:    z.string().describe("The plain text content of the email"),
    }),
    func: async ({ to, subject, body }: { to: string; subject: string; body: string }) => {
      const normalizedSubject = subject.trim()
      const normalizedBody = body.trim()

      if (sendAttempted) {
        return encodeEmailToolResult(
          "Email was already sent for this request. Do not call send_email_tool again unless the user asks to retry."
        )
      }

      if (
        !normalizedSubject ||
        !normalizedBody ||
        normalizedSubject === "(missing)" ||
        normalizedBody === "(missing)"
      ) {
        return encodeEmailToolResult(
          "Email subject and body are required before sending. Ask the user to provide the missing fields instead of inventing them.",
          "UNKNOWN",
          {
            status: "blocked",
            to,
            subject: normalizedSubject || "(missing)",
          }
        )
      }

      const userSettings = await getSettings(userId)
      if (!userSettings.smtpUser || !userSettings.smtpPass) {
        return encodeEmailToolResult(
          "Email credentials are missing. Update your Tools settings with your email username and password before sending email.",
          "SMTP_USER_CREDENTIALS_MISSING"
        )
      }

      sendAttempted = true

      try {
        const attachments = extractCodeAttachments(normalizedBody)
        await sendSmtpEmail(
          {
            user: userSettings.smtpUser,
            pass: userSettings.smtpPass,
          },
          {
            to,
            subject: normalizedSubject,
            text: normalizedBody,
            attachments,
          }
        )
        await logEmailDelivery({
          userId,
          sessionId,
          source: "chat_tool",
          smtpUser: userSettings.smtpUser,
          to,
          subject: normalizedSubject,
          status: "sent",
        })
        return encodeEmailToolResult(`Email sent successfully to ${to}!`, undefined, {
          status: "sent",
          to,
          subject: normalizedSubject,
          smtpUser: userSettings.smtpUser,
          attachments: attachments.map((attachment) => attachment.filename).join(", "),
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        await logEmailDelivery({
          userId,
          sessionId,
          source: "chat_tool",
          smtpUser: userSettings.smtpUser,
          to,
          subject: normalizedSubject,
          status: "failed",
          error: message,
        })
        return encodeEmailToolResult(
          `Email failed: ${message}`,
          inferEmailToolCode(message),
          {
            status: "failed",
            to,
            subject: normalizedSubject,
            smtpUser: userSettings.smtpUser,
          }
        )
      }
    },
  }) as unknown as StructuredToolInterface
}

// ── Registry builder ───────────────────────────────────────────────

export interface RegistryOptions {
  sessionId?:    string
  userId?:       string
  enabledTools?: string[]   // only agents in this list are activated; undefined = all active
}

export function buildAgentRegistry(opts: RegistryOptions = {}): AgentDefinition[] {
  const { sessionId = "", userId = "", enabledTools } = opts
  const hasSession = Boolean(sessionId && userId)

  const isEnabled = (name: string) =>
    enabledTools === undefined ? true : enabledTools.includes(name)

  const agents: AgentDefinition[] = []

  // 0. General agent — always included as fallback
  agents.push({
    name: "general_agent",
    description:
      "Use for greetings, general conversation, simple questions, explanations, " +
      "definitions, opinions, creative writing, or any topic the LLM can answer " +
      "from its own knowledge without needing to search or calculate anything. " +
      "This is the default — use it when no other agent is a clear better fit.",
    tools: [],
  })

  // 1. Research agent
  if (process.env.TAVILY_API_KEY && isEnabled("research_agent")) {
    agents.push({
      name: "research_agent",
      description:
        "REQUIRED for any queries about current events, today's news, real-time data, " +
        "live sports scores, stock prices, or recent world happenings. " +
        "Use this for anything that needs up-to-date information from the internet.",
      tools: [buildTavilyTool()],
    })
  }

  if (
    process.env.TAVILY_API_KEY &&
    process.env.SMTP_HOST &&
    isEnabled("research_agent") &&
    isEnabled("productivity_agent")
  ) {
    agents.push({
      name: "research_productivity_agent",
      description:
        "Use for requests that need current information gathered from the live web and then sent as an email. " +
        "Examples: 'send me today's India news by email', 'email the latest market update to X'. " +
        "This agent must research first, draft the email from the findings, then send it.",
      tools: [buildTavilyTool(), buildSendEmailTool(userId, sessionId)],
    })
  }

  // 2. Math agent
  if (isEnabled("math_agent")) {
    agents.push({
      name: "math_agent",
      description:
        "Use for any maths: calculations, percentages, unit conversions, algebra. " +
        "Examples: '15% of $48', 'square root of 144', '5 miles in km'.",
      tools: [buildCalculatorTool()],
    })
  }

  // 3. Code agent
  if (isEnabled("code_agent")) {
    agents.push({
      name: "code_agent",
      description:
        "Use for writing, debugging, reviewing, or explaining code. " +
        "Also use for questions about programming languages, frameworks, or software architecture.",
      tools: [],
    })
  }

  // 4. Knowledge agent
  if (isEnabled("knowledge_agent")) {
    agents.push({
      name: "knowledge_agent",
      description:
        "Use when the user asks about a document, PDF, file, or attachment they uploaded to this chat. " +
        "Examples: 'summarise my PDF', 'what does the contract say about X', " +
        "'list my files', 'analyse the report'.",
      tools: hasSession
        ? [
            buildListDocumentsTool(sessionId, userId),
            buildDocumentSearchTool(sessionId, userId),
            buildReadDocumentTool(sessionId, userId),
          ]
        : [
            notImplemented("list_documents",  "Lists uploaded documents in the session."),
            notImplemented("document_search", "Searches uploaded documents for relevant excerpts."),
            notImplemented("read_document",   "Reads the full text of an uploaded document."),
          ],
    })
  }

  // 5. Productivity agent — requires SMTP_HOST to be configured on the server.
  // This mirrors the availability check in lib/tools/catalog.ts so the agent
  // is never registered when the underlying transport isn't available.
  if (process.env.SMTP_HOST && isEnabled("productivity_agent")) {
    agents.push({
      name: "productivity_agent",
      description:
        "Use when the user wants to send an email and provides the recipient, subject, and body.",
      tools: [buildSendEmailTool(userId, sessionId)],
    })
  }

  return agents
}

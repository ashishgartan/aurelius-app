// app/api/export/notes/route.ts
// Uses Groq to analyse a conversation and produce structured study notes JSON.

import { getAuthUser } from "@/lib/jwt"
import { createRateLimiter } from "@/lib/rateLimit"
import { ExportNotesSchema, parseBody } from "@/lib/validation"
import { checkCsrf } from "@/lib/csrf"

// 5 exports per hour per user — this is an expensive Groq call (3000 tokens)
const notesLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60_000 })

export interface StudyNotesSection {
  heading:     string
  keyInsight:  string
  explanation: string
  bullets:     string[]
}

export interface StudyNotesOutput {
  summary:         string
  sections:        StudyNotesSection[]
  keyTerms:        { term: string; definition: string }[]
  reviewQuestions: string[]
}

export async function POST(req: Request) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  // Rate limit — 5 exports per hour per user
  const { allowed, resetMs } = notesLimiter(auth.userId)
  if (!allowed) {
    const retryAfterSecs = Math.ceil(resetMs / 1000)
    return Response.json(
      { error: `Too many exports. Please wait ${retryAfterSecs}s before trying again.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSecs) } }
    )
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey)  return Response.json({ error: "GROQ_API_KEY not configured" }, { status: 503 })

  const raw    = await req.json().catch(() => ({}))
  const parsed = parseBody(ExportNotesSchema, raw)
  if (!parsed.ok) return parsed.response

  const { title, messages } = parsed.data

  // Build compact transcript from the MOST RECENT messages backwards.
  // Iterating forward and breaking at MAX_CHARS would silently drop the latest
  // (most relevant) exchanges — exactly what study notes should focus on.
  const MAX_CHARS = 12_000
  const lines: string[] = []
  let totalChars = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg  = messages[i]
    const line = `${msg.role === "user" ? "USER" : "ASSISTANT"}: ${msg.content}\n\n`
    if (totalChars + line.length > MAX_CHARS) break
    lines.unshift(line)
    totalChars += line.length
  }
  const transcript = lines.join("")

  const prompt = `You are an expert study notes creator. Analyse the following conversation and produce comprehensive study notes in valid JSON.

CONVERSATION TITLE: ${title}

CONVERSATION:
${transcript}

Respond ONLY with a valid JSON object (no markdown, no backticks) matching this exact schema:
{
  "summary": "2-3 sentence overview of what was discussed",
  "sections": [
    {
      "heading": "<topic heading>",
      "keyInsight": "<the single most important takeaway from this section>",
      "explanation": "<detailed explanation in 2-4 sentences>",
      "bullets": ["<specific point>", "<specific point>", "<specific point>"]
    }
  ],
  "keyTerms": [
    { "term": "<term>", "definition": "<clear definition>" }
  ],
  "reviewQuestions": [
    "<question that tests genuine understanding?>",
    "<another question?>"
  ]
}

Rules:
- Create one section per major topic or concept discussed
- keyInsight must be the single most important takeaway — not a restatement of the question
- bullets should be concrete, specific, actionable points
- keyTerms: extract 3-8 important terms introduced in the conversation
- reviewQuestions: 3-6 questions that test genuine understanding (not just recall)
- Write as if creating notes for a student who will study from them later`

  // Declared outside try so clearTimeout is reachable in the catch block
  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), 25_000)

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:           "llama-3.1-8b-instant",
        max_tokens:      3000,
        temperature:     0.3,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message ?? `Groq API error ${res.status}`)
    }

    const data    = await res.json()
    const rawText = data.choices?.[0]?.message?.content ?? ""

    // Strip any accidental markdown fences
    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i,     "")
      .replace(/```$/,         "")
      .trim()

    // Parse and validate — Groq occasionally returns malformed JSON
    let notes: StudyNotesOutput
    try {
      notes = JSON.parse(cleaned)
    } catch {
      console.error("[export/notes] Invalid JSON from Groq:", cleaned.slice(0, 200))
      return Response.json({ error: "Failed to parse notes — please try again." }, { status: 500 })
    }

    // Basic sanity check to catch incomplete responses
    if (!notes.summary || !Array.isArray(notes.sections)) {
      console.error("[export/notes] Missing required fields in Groq response")
      return Response.json({ error: "Notes format was invalid — please try again." }, { status: 500 })
    }

    return Response.json({ notes })

  } catch (err) {
    clearTimeout(timeout)
    console.error("[export/notes]", err)
    const msg = err instanceof Error ? err.message : "Failed to generate notes"
    return Response.json({ error: msg }, { status: 500 })
  }
}
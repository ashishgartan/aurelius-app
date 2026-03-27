// app/api/chat/route.ts
// Streaming chat API — LangChain agent with Groq or LM Studio.
//
// Stream format (newline-delimited):
//   Tool events:     "event:<json>\n"  e.g. {"type":"tool_start",...}
//   Thinking tokens: "event:<json>\n"  e.g. {"type":"thinking_token","content":"..."}
//   Title update:    "event:<json>\n"  e.g. {"type":"title","title":"..."}
//   Text tokens:     raw text chunks   (no prefix)
//
// History is loaded from DB on every request — the client never sends it.
// This makes the DB the single source of truth and keeps request payloads small.
import { getAuthUser } from "@/lib/jwt"
import { createRateLimiter } from "@/lib/rateLimit"
import { createAgentStream } from "@/lib/agent"
import { logUsage } from "@/lib/services/usageLog"
import { retrieveRelevantChunks } from "@/lib/services/ragService"
import { getSession, appendMessage } from "@/lib/services/chatSession"
import { ingestMemoriesFromMessage } from "@/lib/services/userMemory"
import { ChatRequestSchema, parseBody } from "@/lib/validation"
import { checkCsrf } from "@/lib/csrf"
import type { AgentChunk } from "@/lib/agent"
import type { Provider } from "@/types/chat"
import { connectDB } from "@/lib/mongodb"
import { ArtifactModel } from "@/lib/models"
import { uploadArtifact } from "@/lib/cloudinary"
import { Types } from "mongoose"

const chatLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 })

export async function POST(req: Request) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) {
    return Response.json(
      { error: "Unauthorized", code: "UNKNOWN" },
      { status: 401 }
    )
  }

  const { allowed, remaining, resetMs } = chatLimiter(auth.userId)
  if (!allowed) {
    const retryAfterSecs = Math.ceil(resetMs / 1000)
    return Response.json(
      {
        error: `Too many requests — please wait ${retryAfterSecs}s before trying again.`,
        code: "CHAT_RATE_LIMIT",
      },
      {
        status: 429,
        headers: {
          "Retry-After":           String(retryAfterSecs),
          "X-RateLimit-Limit":     "20",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset":     String(Date.now() + resetMs),
        },
      }
    )
  }

  const raw    = await req.json().catch(() => ({}))
  const parsed = parseBody(ChatRequestSchema, raw)
  if (!parsed.ok) return parsed.response

  // Extract + assert types: Zod's default() values are always present but type inference
  // can widen them to include undefined in some versions.
  const message      = parsed.data.message
  const displayMessage = parsed.data.displayMessage ?? message
  const provider     = parsed.data.provider     as Provider
  const sessionId    = parsed.data.sessionId    ?? ""
  const saveUser     = parsed.data.saveUser     ?? true
  const instructions = parsed.data.instructions ?? ""
  const memory       = parsed.data.memory       ?? ""
  const language     = parsed.data.language     ?? "English"
  const length       = parsed.data.length       as "concise" | "balanced" | "detailed"
  const tone         = parsed.data.tone         as "professional" | "casual" | "technical"
  const enabledTools = (parsed.data as { enabledTools?: string[] }).enabledTools ?? undefined  // ← add


  // ── Load history from DB (source of truth) ──────────────────────
  // The client no longer sends history — we read it here so it can
  // never drift from what is actually persisted.
  type SessionDoc = { messages?: Array<{ role: string; content: string }> }
  let history: { role: string; content: string }[] = []
  if (sessionId) {
    const session = (await getSession(sessionId, auth.userId)) as SessionDoc | null
    if (session?.messages?.length) {
      history = session.messages.map((m) => ({ role: m.role, content: m.content }))

      // For regenerate (saveUser=false) the user message is already the last entry
      // in DB. Strip it from history so it isn't passed twice to the LLM.
      if (!saveUser && history[history.length - 1]?.role === "user") {
        history = history.slice(0, -1)
      }
    }
  }

  // ── Save user message BEFORE streaming ──────────────────────────
  // Persisting the user turn first means the DB is always consistent:
  // even if the stream is interrupted, the question is recorded.
  if (saveUser && sessionId) {
    const savedUserMessage = await appendMessage(
      sessionId,
      auth.userId,
      "user",
      displayMessage,
      provider
    ).catch((err) => {
      console.error(err)
      return null
    })

    const messageId =
      savedUserMessage?.message &&
      typeof savedUserMessage.message === "object" &&
      "_id" in savedUserMessage.message
        ? String(savedUserMessage.message._id)
        : undefined

    void ingestMemoriesFromMessage(auth.userId, displayMessage, {
      sessionId,
      messageId,
    }).catch((err) => {
      console.warn("[memory] ingestion failed:", err)
    })
  }

  // Fetch relevant document chunks for RAG (best-effort — never blocks the response)
  const ragContext = sessionId
    ? await retrieveRelevantChunks(sessionId, auth.userId, message).catch(() => "")
    : ""

  let agentStream: AsyncGenerator<AgentChunk>

  try {
    agentStream = await createAgentStream({
      message,
      history,
      provider,
      instructions,
      memory,
      language,
      length,
      tone,
      ragContext,
      sessionId,
      userId: auth.userId,
      enabledTools
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to start agent"
    const code = msg.toLowerCase().includes("rate limit")
      ? "MODEL_RATE_LIMIT"
      : "AGENT_START_FAILED"
    return Response.json({ error: msg, code }, { status: 502 })
  }

  const encoder = new TextEncoder()
  let streamClosed = false
  let streamCancelled = false

  const stream = new ReadableStream({
    async start(controller) {
      function safeEnqueue(payload: string) {
        if (streamClosed) return
        try {
          controller.enqueue(encoder.encode(payload))
        } catch (err) {
          streamClosed = true
          console.warn("[chat/stream] enqueue skipped after close:", err)
        }
      }

      // ── <think> block parser ───────────────────────────────────
      // Tokens stream in raw — we split them into thinking vs answer
      // in real time so the client can render both simultaneously.
      let thinkBuf    = ""
      let insideThink = false
      let finalContent = ""   // accumulates non-thinking text for DB save

      function flush(token: string) {
        thinkBuf += token
        while (true) {
          if (!insideThink) {
            const open = thinkBuf.indexOf("<think>")
            if (open === -1) {
              // No think tag — emit everything as a normal text token
              if (thinkBuf) {
                safeEnqueue(thinkBuf)
                finalContent += thinkBuf
                thinkBuf = ""
              }
              break
            }
            // Emit text before the tag as normal content
            if (open > 0) {
              safeEnqueue(thinkBuf.slice(0, open))
              finalContent += thinkBuf.slice(0, open)
            }
            thinkBuf    = thinkBuf.slice(open + 7)
            insideThink = true
          } else {
            const close = thinkBuf.indexOf("</think>")
            if (close === -1) {
              // Still inside think — emit what we have as thinking tokens,
              // but keep the last 8 chars buffered in case </think> spans chunks
              const safe = thinkBuf.length > 8 ? thinkBuf.slice(0, -8) : ""
              if (safe) {
                safeEnqueue(
                  `event:${JSON.stringify({ type: "thinking_token", content: safe })}\n`
                )
                thinkBuf = thinkBuf.slice(safe.length)
              }
              break
            }
            // Emit the thinking content up to </think>
            const thinkContent = thinkBuf.slice(0, close)
            if (thinkContent) {
              safeEnqueue(
                `event:${JSON.stringify({ type: "thinking_token", content: thinkContent })}\n`
              )
            }
            thinkBuf    = thinkBuf.slice(close + 8)
            insideThink = false
          }
        }
      }

      try {
        for await (const chunk of agentStream) {
          if (streamClosed) {
            await agentStream.return?.(undefined)
            break
          }

          if (chunk.type === "token") {
            flush(chunk.content)
          } else if (
            chunk.type === "plan"       ||
            chunk.type === "model"      ||
            chunk.type === "tool_start" ||
            chunk.type === "tool_end"   ||
            chunk.type === "thinking_token" ||
            chunk.type === "error"
          ) {
            safeEnqueue(`event:${JSON.stringify(chunk)}\n`)
          } else if (chunk.type === "usage") {
            // Log usage directly — fire and forget, never blocks the stream
            logUsage({
              userId:       auth.userId,
              sessionId:    sessionId,
              model:        provider,
              inputTokens:  chunk.inputTokens,
              outputTokens: chunk.outputTokens,
              toolCalls:    chunk.toolsUsed,
            }).catch(() => { /* swallow — usage logging is best-effort */ })
          }
        }
        // Flush anything remaining outside a think block
        if (thinkBuf && !insideThink) {
          safeEnqueue(thinkBuf)
          finalContent += thinkBuf
        }

        if (streamCancelled) {
          return
        }

        // ── Extract code fences → Cloudinary artifacts ──────────
        // Now that streaming is complete we have the full text, so we can
        // reliably regex-match code fences regardless of how tokens arrived.
        // Each fence is uploaded to Cloudinary, replaced with a placeholder,
        // and an artifact event is emitted so the client renders a file card.
        const CODE_FENCE = /```([\w+#.-]*)\n([\s\S]*?)\n```/g
        let cleanedContent = finalContent.trim()
        const artifactEvents: string[] = []

        if (sessionId) {
          await connectDB()
          const fenceMatches = [...cleanedContent.matchAll(CODE_FENCE)]

          for (const match of fenceMatches) {
            if (streamCancelled) break
            const lang      = (match[1] || "txt").toLowerCase()
            const codeBody  = match[2]
            if (!codeBody.trim()) continue  // skip empty fences

            try {
              const artifactId = new Types.ObjectId()
              const ext        = lang
              const filename   = `artifact.${ext}`
              const publicId   = `artifacts/${auth.userId}/${artifactId.toString()}`

              const { sizeBytes } = await uploadArtifact(codeBody, publicId, filename)

              await ArtifactModel.create({
                _id:                artifactId,
                sessionId:          new Types.ObjectId(sessionId),
                userId:             new Types.ObjectId(auth.userId),
                filename,
                lang,
                cloudinaryPublicId: publicId,
                sizeBytes,
              })

              const artifactEvent = JSON.stringify({
                type: "artifact",
                artifactId: artifactId.toString(),
                filename,
                lang,
                sizeBytes,
              })
              artifactEvents.push(artifactEvent)

              // Replace the raw code fence with a compact placeholder in the
              // stored message so the DB stays clean
              cleanedContent = cleanedContent.replace(
                match[0],
                `[artifact:${artifactId.toString()}]`
              )
            } catch (artifactErr) {
              console.error("[artifact] upload failed:", artifactErr)
              // Leave the raw fence in the content — user still sees the code
            }
          }
        }

        if (streamCancelled) {
          return
        }

        // ── Save assistant reply + emit artifact + title events ──
        if (cleanedContent && sessionId) {
          const result = await appendMessage(
            sessionId,
            auth.userId,
            "assistant",
            cleanedContent,
            provider,
            artifactEvents.map((raw) => {
              const event = JSON.parse(raw) as {
                artifactId: string
                filename: string
                lang: string
                sizeBytes: number
              }
              return {
                artifactId: event.artifactId,
                filename: event.filename,
                lang: event.lang,
                sizeBytes: event.sizeBytes,
              }
            })
          ).catch(() => null)

          // Emit artifact events first so the client attaches them to the message
          for (const ev of artifactEvents) {
            safeEnqueue(`event:${ev}\n`)
          }

          if (result?.title) {
            safeEnqueue(
              `event:${JSON.stringify({ type: "title", title: result.title })}\n`
            )
          }
        }
      } catch (streamErr: unknown) {
        const msg = streamErr instanceof Error ? streamErr.message : String(streamErr)
        console.error("[chat/stream] error:", streamErr)
        safeEnqueue(`\n\n[Error: ${msg}]`)
      } finally {
        if (!streamClosed) {
          streamClosed = true
          controller.close()
        }
      }
    },
    cancel() {
      // The client disconnected or the response was otherwise aborted.
      // Mark the stream closed so async work stops writing into it.
      streamClosed = true
      streamCancelled = true
      void agentStream.return?.(undefined)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type":          "text/plain; charset=utf-8",
      "Cache-Control":         "no-cache, no-transform",
      "X-Accel-Buffering":     "no",
      "X-RateLimit-Limit":     "20",
      "X-RateLimit-Remaining": String(remaining),
    },
  })
}

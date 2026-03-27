// hooks/useChat.ts
"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import type { ChatMessage, Provider, ToolCall, UserSettings, ArtifactRef } from "@/types/chat"
import type { AgentChunk } from "@/lib/agent"
import { formatRecoveryMessage, type RecoveryCode } from "@/lib/ai/workflow"

interface UseChatOptions {
  sessionId:       string
  initialMessages: ChatMessage[]
  provider:        Provider
  settings?:  Pick<UserSettings, "instructions" | "memory" | "language" | "length" | "tone" | "enabledTools">
  onNewTitle?:     (title: string) => void
  onBump?:         () => void
  onProviderFallback?: (provider: Provider, reason: string) => void
}

// Three explicit states for history initialisation:
//   "idle"    — waiting for initialMessages to arrive from the API
//   "loaded"  — history arrived and has been written to `messages`
//   "active"  — user has sent at least one message; history is locked in
type InitState = "idle" | "loaded" | "active"

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function shouldRetryWithQwen(provider: Provider, message: string): boolean {
  if (provider !== "groq") return false
  const normalized = message.toLowerCase()
  return (
    normalized.includes("rate limit") ||
    normalized.includes("rate-limit") ||
    normalized.includes("429") ||
    normalized.includes("tokens per minute")
  )
}

export function useChat({
  sessionId, initialMessages, provider, settings, onNewTitle, onBump, onProviderFallback,
}: UseChatOptions) {
  const [messages,  setMessages]  = useState<ChatMessage[]>(initialMessages)
  const [streaming, setStreaming] = useState(false)
  const abortRef    = useRef<AbortController | null>(null)
  const initRef     = useRef<InitState>("idle")

  // Always reflects the latest provider prop without re-creating callbacks.
  const providerRef  = useRef<Provider>(provider)
  const settingsRef  = useRef(settings)
  useEffect(() => { providerRef.current = provider }, [provider])
  useEffect(() => { settingsRef.current = settings }, [settings])

  // Sync history from API → local state.
  useEffect(() => {
    if (initRef.current === "idle") {
      setMessages(initialMessages)
      if (initialMessages.length > 0) initRef.current = "loaded"
    }
  }, [initialMessages])

  // Reset everything when the user navigates to a different chat.
  useEffect(() => {
    initRef.current = "idle"
    setMessages([])
    setStreaming(false)
  }, [sessionId])

  // ── Core stream function ──────────────────────────────────────────
  // Sends the current message to /api/chat and streams the response.
  // History is NOT sent — the backend loads it from DB on every request.
  // saveUser tells the backend whether to persist the user message
  // (false for regenerate, where the user message is already in DB).
  const streamAssistant = useCallback(async (
    userText:       string,
    displayText:    string,
    asstId:         string,
    activeProvider: Provider,
    saveUser        = true,
    allowFallback   = true
  ): Promise<boolean> => {
    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          message:  userText,
          displayMessage: displayText,
          provider: activeProvider,
          sessionId,
          saveUser,
          ...settingsRef.current,
        }),
        signal: abort.signal,
      })

      if (!res.ok) {
        const { error, code } = await res
          .json()
          .catch(() => ({ error: `Error ${res.status}`, code: "UNKNOWN" }))
        const message = typeof error === "string" ? error : `Error ${res.status}`
        const recoveryCode =
          typeof code === "string" ? (code as RecoveryCode) : undefined

        if (allowFallback && shouldRetryWithQwen(activeProvider, message)) {
          setMessages((prev) =>
            prev.map((m) =>
              m._id === asstId
                ? {
                    ...m,
                    model: "qwen",
                    content: "Groq is rate limited. Retrying this request with Qwen...\n",
                  }
                : m
            )
          )
          onProviderFallback?.("qwen", message)
          return streamAssistant(userText, displayText, asstId, "qwen", false, false)
        }

        setMessages((prev) =>
          prev.map((m) =>
            m._id === asstId
              ? { ...m, content: formatRecoveryMessage(message, recoveryCode) }
              : m
          )
        )
        return false
      }

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()

      const handleAgentChunk = (chunk: AgentChunk) => {
        if (chunk.type === "tool_start") {
          toolCalls.push({ tool: chunk.tool, input: chunk.input })
          setMessages((prev) =>
            prev.map((m) => m._id === asstId ? { ...m, toolCalls: [...toolCalls] } : m)
          )
        } else if (chunk.type === "plan") {
          setMessages((prev) =>
            prev.map((m) =>
              m._id === asstId ? { ...m, planSteps: [...chunk.steps] } : m
            )
          )
        } else if (chunk.type === "model") {
          setMessages((prev) =>
            prev.map((m) =>
              m._id === asstId ? { ...m, model: chunk.provider } : m
            )
          )
          onProviderFallback?.(chunk.provider, "automatic_routing")
        } else if (chunk.type === "tool_end") {
          const tc = [...toolCalls].reverse()
            .find((t) => t.tool === chunk.tool && t.output === undefined)
          if (tc) {
            tc.output = chunk.output
            tc.outputCode = chunk.code
            tc.outputMeta = chunk.meta
          }
          setMessages((prev) =>
            prev.map((m) => m._id === asstId ? { ...m, toolCalls: [...toolCalls] } : m)
          )
        } else if (chunk.type === "thinking_token") {
          thinkingContent += chunk.content
          const snap = thinkingContent
          setMessages((prev) =>
            prev.map((m) => m._id === asstId ? { ...m, thinking: snap } : m)
          )
        } else if (chunk.type === "error") {
          setMessages((prev) =>
            prev.map((m) =>
              m._id === asstId
                ? {
                    ...m,
                    content: formatRecoveryMessage(
                      chunk.message,
                      chunk.code
                    ),
                  }
                : m
            )
          )
        } else if (chunk.type === "title") {
          onNewTitle?.(chunk.title)
        } else if (chunk.type === "artifact") {
          const ref: ArtifactRef = {
            artifactId: chunk.artifactId,
            filename:   chunk.filename,
            lang:       chunk.lang,
            sizeBytes:  chunk.sizeBytes,
          }
          setMessages((prev) =>
            prev.map((m) => {
              if (m._id !== asstId) return m
              const fencePattern = new RegExp(
                "```" +
                  (chunk.lang
                    ? escapeForRegExp(chunk.lang)
                    : "[\\w+#.-]*") +
                  "\\n[\\s\\S]*?\\n```",
                ""
              )
              const stripped = (m.content ?? "").replace(fencePattern, "").trim()
              return {
                ...m,
                content: stripped,
                artifacts: [...(m.artifacts ?? []), ref],
              }
            })
          )
        }
      }

      // toolCalls is built up during streaming for UI only — the DB stores only text.
      let thinkingContent = ""
      let lineBuf         = ""
      const toolCalls: ToolCall[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        lineBuf += decoder.decode(value, { stream: true })

        // Split on newlines to find event: lines vs plain text
        const parts = lineBuf.split("\n")
        // The last part may be an incomplete line — keep it buffered
        lineBuf = parts.pop() ?? ""

        for (const part of parts) {
          if (part.startsWith("event:")) {
            try {
              const chunk = JSON.parse(part.slice(6)) as AgentChunk
              handleAgentChunk(chunk)
            } catch { /* malformed event line — skip */ }
          } else {
            const embeddedEventIndex = part.indexOf("event:{")
            if (embeddedEventIndex > 0) {
              const textPart = part.slice(0, embeddedEventIndex)
              if (textPart) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m._id === asstId
                      ? { ...m, content: (m.content ?? "") + textPart }
                      : m
                  )
                )
              }
              try {
                const chunk = JSON.parse(
                  part.slice(embeddedEventIndex + 6)
                ) as AgentChunk
                handleAgentChunk(chunk)
              } catch {
                // ignore malformed embedded event
              }
            } else {
              // Always include this line, even if empty.
              // Empty lines are meaningful in markdown — they separate headings,
              // paragraphs, and list endings. Skipping them merges content together.
              setMessages((prev) =>
                prev.map((m) =>
                  m._id === asstId ? { ...m, content: (m.content ?? "") + part + "\n" } : m
                )
              )
            }
          }
        }
      }

      // Flush any remaining buffered content that didn't end with \n.
      // This can be a plain text fragment OR a final event: line that arrived
      // without a trailing newline — handle both cases.
      if (lineBuf) {
        if (lineBuf.startsWith("event:")) {
          try {
            const chunk = JSON.parse(lineBuf.slice(6)) as AgentChunk
            handleAgentChunk(chunk)
          } catch { /* malformed — ignore */ }
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m._id === asstId ? { ...m, content: (m.content ?? "") + lineBuf } : m
            )
          )
        }
      }

      // Trim the trailing newline that the line-splitting loop adds to the
      // last text chunk. Every line from split("\n") has "\n" re-appended
      // so it round-trips correctly through markdown, but the very last line
      // ends up with a spurious trailing newline once streaming is complete.
      setMessages((prev) =>
        prev.map((m) =>
          m._id === asstId
            ? { ...m, content: (m.content ?? "").replace(/\n$/, "") }
            : m
        )
      )

      onBump?.()
      return true
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "AbortError") return false
      console.error("[useChat] stream error:", err)
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      setMessages((prev) =>
        prev.map((m) =>
          m._id === asstId
            ? { ...m, content: formatRecoveryMessage(message) }
            : m
        )
      )
      return false
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [sessionId, onBump, onNewTitle, onProviderFallback])

  // ── Send a new message ────────────────────────────────────────────
  const send = useCallback(async (text: string, displayText = text) => {
    if (!text.trim() || streaming) return

    const activeProvider = providerRef.current
    initRef.current = "active"

    const userMsg: ChatMessage = {
      _id: crypto.randomUUID(), role: "user", content: displayText,
      model: activeProvider, createdAt: new Date().toISOString(),
    }
    const asstMsg: ChatMessage = {
      _id: crypto.randomUUID(), role: "assistant", content: "",
      model: activeProvider, createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg, asstMsg])
    setStreaming(true)

    // saveUser=true (default): backend will persist user then assistant in correct order.
    await streamAssistant(text, displayText, asstMsg._id, activeProvider)
  }, [streaming, streamAssistant])

  // ── Regenerate ────────────────────────────────────────────────────
  const regenerate = useCallback(async () => {
    if (streaming) return

    const activeProvider = providerRef.current
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user")
    if (lastUserIdx === -1) return
    const lastUser = [...messages].reverse()[lastUserIdx]

    const lastUserAbsIdx = messages.length - 1 - lastUserIdx

    const newAsstId  = crypto.randomUUID()
    const newAsstMsg: ChatMessage = {
      _id:       newAsstId,
      role:      "assistant",
      content:   "",
      model:     activeProvider,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev.slice(0, lastUserAbsIdx + 1), newAsstMsg])
    setStreaming(true)

    // Truncate DB to remove the old assistant response so the backend loads
    // the correct history (ending with the user message, not the stale reply).
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/messages?fromIndex=${lastUserAbsIdx + 1}`,
        { method: "DELETE" }
      )

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: `Error ${res.status}` }))
        throw new Error(error)
      }
    } catch (err) {
      console.error("[useChat] regenerate truncate failed:", err)
      setMessages(messages)
      setStreaming(false)
      return
    }

    // saveUser=false: the user message is already in DB after the truncation above.
    await streamAssistant(lastUser.content, lastUser.content, newAsstId, activeProvider, false)
  }, [messages, streaming, sessionId, streamAssistant])


  // ── Edit a past message + resend from that point ─────────────────
  // Replaces the message at `messageId` with `newText`, removes all
  // subsequent messages, then streams a fresh assistant response.
  const editAndResend = useCallback(async (messageId: string, newText: string) => {
    if (!newText.trim() || streaming) return

    const activeProvider = providerRef.current

    const editIdx = messages.findIndex((m) => m._id === messageId)
    if (editIdx === -1) return

    const editedMsg: ChatMessage = { ...messages[editIdx], content: newText }
    const asstMsg: ChatMessage = {
      _id:       crypto.randomUUID(),
      role:      "assistant",
      content:   "",
      model:     activeProvider,
      createdAt: new Date().toISOString(),
    }

    setMessages([...messages.slice(0, editIdx), editedMsg, asstMsg])
    setStreaming(true)
    initRef.current = "active"

    // Truncate DB from editIdx onwards — the backend will save the edited user
    // message and the new assistant reply in the correct order.
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages?fromIndex=${editIdx}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: `Error ${res.status}` }))
        throw new Error(error)
      }
    } catch (err) {
      console.error("[useChat] edit truncate failed:", err)
      setMessages(messages)
      setStreaming(false)
      return
    }

    // saveUser=true: backend saves the edited user message before streaming.
    await streamAssistant(newText, newText, asstMsg._id, activeProvider, true)
  }, [messages, streaming, sessionId, streamAssistant])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  const clearLocal = useCallback(() => {
    setMessages([])
    initRef.current = "idle"
  }, [])

  return { messages, streaming, send, regenerate, editAndResend, stop, clearLocal }
}

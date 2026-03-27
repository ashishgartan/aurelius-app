// app/chat/[chatId]/page.tsx
"use client"

import { use, useEffect, useState, useCallback, useRef, startTransition } from "react"
import { useRouter } from "next/navigation"
import { useChat } from "@/hooks/useChat"
import { useChatStore } from "@/hooks/useChatStore"
import { useArtifactStore } from "@/hooks/useArtifactStore"
import { ChatHeader } from "@/components/chat/ChatHeader"
import { MessageList } from "@/components/chat/MessageList"
import { ChatInput } from "@/components/chat/ChatInput"
import { ArtifactPanel } from "@/components/chat/ArtifactPanel"
import { useSidebarOpener } from "@/context/SidebarContext"
import { useMessageSearch } from "@/hooks/useMessageSearch"
import { useSettings } from "@/context/SettingsContext"
import { useToolCatalog } from "@/hooks/useToolCatalog"
import { Bot } from "lucide-react"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { MessageSkeleton } from "@/components/chat/MessageSkeleton"
import type { ChatMessage, Provider } from "@/types/chat"
import type { UploadedDoc } from "@/components/chat/FileUpload"
import { ToolAvailabilityInfo } from "@/components/chat/ToolAvailabilityInfo"
import {
  buildChatDraftKey,
  clearChatDraft,
  readChatDraft,
  writeChatDraft,
} from "@/lib/chat/drafts"
import {
  buildDocumentSummaryPrompt,
  clearChatOnServer,
} from "@/lib/chat/pageActions"
import {
  buildSuggestedEmailSubject,
  buildStructuredEmailPrompt,
  classifyEmailIntent,
  requiresCurrentResearch,
  type EmailActionIntent,
  type EmailDraftFields,
} from "@/lib/ai/workflow"

interface PageProps {
  params: Promise<{ chatId: string }>
}

export default function ChatPage({ params }: PageProps) {
  const { chatId } = use(params)
  const draftKey = buildChatDraftKey(chatId)
  const router = useRouter()
  const openSidebar = useSidebarOpener()

  const { bumpSession, renameSession, updateProvider } = useChatStore()
  const { settings } = useSettings()
  const { byId: toolCatalogById } = useToolCatalog()

  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([])
  const [provider, setProvider] = useState<Provider>("groq")
  const [title, setTitle] = useState("")
  const [input, setInput] = useState("")
  const [emailAction, setEmailAction] = useState<{
    intent: Extract<EmailActionIntent, "draft" | "send">
    originalPrompt: string
    fields: EmailDraftFields
  } | null>(null)
  const [docs, setDocs] = useState<UploadedDoc[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [clearState, setClearState] = useState<"idle" | "clearing" | "error">(
    "idle"
  )
  const [artifactWidth, setArtifactWidth] = useState(480)
  const [artifactExpanded, setArtifactExpanded] = useState(false)
  const [isDraggingArtifact, setIsDraggingArtifact] = useState(false)
  const artifactStartX = useRef(0)
  const artifactStartWidth = useRef(480)
  const { isOpen: isArtifactOpen } = useArtifactStore()

  useEffect(() => {
    startTransition(() => {
      setPageLoading(true)
      setNotFound(false)
      setInitialMessages([])
      setTitle("")
      setClearState("idle")
    })
    try {
      const draft = readChatDraft(localStorage, chatId)
      startTransition(() => {
        setInput(draft)
      })
    } catch {
      startTransition(() => {
        setInput("")
      })
    }

    fetch(`/api/sessions/${chatId}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true)
          return
        }
        const { session } = await res.json()
        setInitialMessages(session.messages ?? [])
        setProvider(session.provider ?? "groq")
        setTitle(session.title ?? "")
        // Load existing documents for this session
        fetch(`/api/sessions/${chatId}/documents`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.documents) setDocs(d.documents)
          })
          .catch(console.error)
      })
      .catch(() => setNotFound(true))
      .finally(() => setPageLoading(false))
  }, [chatId, draftKey])

  useEffect(() => {
    try {
      writeChatDraft(localStorage, chatId, input)
    } catch {
      // Ignore storage errors in private mode / restricted contexts.
    }
  }, [chatId, input])

  const handleNewTitle = useCallback(
    (t: string) => {
      setTitle(t)
      void renameSession(chatId, t).catch((err) => {
        console.error("[chat/page] renameSession failed:", err)
      })
    },
    [chatId, renameSession]
  )

  const handleBump = useCallback(
    () => bumpSession(chatId),
    [chatId, bumpSession]
  )

  const {
    messages,
    streaming,
    send,
    regenerate,
    editAndResend,
    stop,
    clearLocal,
  } = useChat({
    sessionId: chatId,
    initialMessages,
    provider,
    settings,
    onNewTitle: handleNewTitle,
    onBump: handleBump,
    onProviderFallback: (nextProvider) => {
      setProvider(nextProvider)
      void updateProvider(chatId, nextProvider).catch((err) => {
        console.error("[chat/page] updateProvider after fallback failed:", err)
      })
    },
  })

  // Listen for Escape key stop-stream event dispatched by useKeyboardShortcuts
  useEffect(() => {
    const handler = () => {
      if (streaming) stop()
    }
    window.addEventListener("aurelius:stop-stream", handler)
    return () => window.removeEventListener("aurelius:stop-stream", handler)
  }, [streaming, stop])

  // Cmd+F → open in-chat search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent("aurelius:open-search"))
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const {
    searchQuery,
    onSearchChange,
    matchCount,
    matchIndex,
    onMatchNav,
    matches,
    activeMessageId,
  } = useMessageSearch(messages)

  const handleDocUploaded = (doc: UploadedDoc) => {
    setDocs((prev) => [...prev, doc])
  }

  const handleDocRemove = async (docId: string) => {
    const res = await fetch(`/api/sessions/${chatId}/documents/${docId}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      console.error("[handleDocRemove] failed:", await res.text().catch(() => "unknown error"))
      return
    }
    setDocs((prev) => prev.filter((d) => d._id !== docId))
  }

  const handleDocSummarize = (doc: UploadedDoc) => {
    const prompt = buildDocumentSummaryPrompt(doc)
    setInput("")
    send(prompt)
  }

  const handleSend = () => {
    if (!input.trim()) return
    const nextInput = input.trim()
    const emailToolEnabled =
      settings.enabledTools?.includes("productivity_agent") ?? false

    if (emailToolEnabled) {
      const emailIntent = classifyEmailIntent(nextInput)
      if (emailIntent.intent !== "none") {
        const inferredFields = emailIntent.fields ?? {
          to: "",
          subject: "",
          body: "",
        }
        setEmailAction({
          intent: emailIntent.intent,
          originalPrompt: nextInput,
          fields: {
            ...inferredFields,
            subject:
              inferredFields.subject || buildSuggestedEmailSubject(nextInput),
          },
        })
        return
      }
    }

    send(nextInput)
    setInput("")
    try {
      clearChatDraft(localStorage, chatId)
    } catch {
      // ignore storage errors
    }
  }

  const handleConfirmedEmailAction = useCallback(() => {
    if (!emailAction) return

    send(
      buildStructuredEmailPrompt(
        emailAction.intent,
        emailAction.fields,
        emailAction.originalPrompt
      ),
      emailAction.originalPrompt
    )
    setEmailAction(null)
    setInput("")
    try {
      clearChatDraft(localStorage, chatId)
    } catch {
      // ignore storage errors
    }
  }, [chatId, emailAction, send])

  const researchReady = Boolean(
    settings.enabledTools?.includes("research_agent") &&
      toolCatalogById.research_agent?.available
  )
  const emailActionNeedsResearch = emailAction
    ? requiresCurrentResearch(emailAction.originalPrompt)
    : false

  const handleSuggestion = useCallback(
    (prompt: string) => {
      setInput(prompt)
      // Defer send by one tick so the input state has updated before we read it
      setTimeout(() => {
        send(prompt)
        setInput("")
      }, 0)
    },
    [send]
  )

  const handleProviderChange = (p: Provider) => {
    const previous = provider
    setProvider(p)
    void updateProvider(chatId, p).catch((err) => {
      console.error("[chat/page] updateProvider failed:", err)
      setProvider(previous)
    })
  }

  // Server-first clear: persist to DB first, update UI only on success.
  // On failure: leave messages intact, show a retry-able error state.
  const handleClear = useCallback(async () => {
    if (clearState === "clearing") return
    setClearState("clearing")

    try {
      await clearChatOnServer(fetch, chatId)

      // Server confirmed — now safe to clear local state
      clearLocal()
      setTitle("New chat")
      await renameSession(chatId, "New chat")
      setInput("")
      try {
        clearChatDraft(localStorage, chatId)
      } catch {
        // ignore storage errors
      }
      setClearState("idle")
    } catch (err) {
      console.error("[handleClear] failed:", err)
      // Messages are untouched — user can retry via the error button
      setClearState("error")
      // Auto-reset error indicator after 4 s so it doesn't linger forever
      setTimeout(() => setClearState("idle"), 4_000)
    }
    }, [chatId, clearState, clearLocal, renameSession])

  const handleToggleArtifactWidth = useCallback(() => {
    setArtifactExpanded((prev) => {
      const next = !prev
      const nextWidth = next ? 740 : 480
      setArtifactWidth(nextWidth)
      return next
    })
  }, [])

  const handleArtifactDragStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    artifactStartX.current = event.clientX
    artifactStartWidth.current = artifactWidth
    setIsDraggingArtifact(true)
  }

  useEffect(() => {
    if (!isDraggingArtifact) return
    const handleMouseMove = (event: MouseEvent) => {
      const delta = artifactStartX.current - event.clientX
      let nextWidth = artifactStartWidth.current + delta
      nextWidth = Math.max(320, Math.min(820, nextWidth))
      setArtifactWidth(nextWidth)
      setArtifactExpanded(nextWidth >= 640)
    }

    const handleMouseUp = () => setIsDraggingArtifact(false)

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDraggingArtifact])

  if (pageLoading) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <ChatHeader
          title={title}
          sessionId={chatId}
          messages={[]}
          showClear={false}
          clearState="idle"
          onClear={() => {}}
          onMenuOpen={openSidebar}
          searchQuery=""
          onSearchChange={() => {}}
          matchIndex={0}
          matchCount={0}
          onMatchNav={() => {}}
        />
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <MessageSkeleton />
          </div>
        </div>
        <ChatInput
          value=""
          onChange={() => {}}
          onSend={() => {}}
          onStop={() => {}}
          streaming={false}
          provider="groq"
          onProvider={() => {}}
          disabled
        />
      </div>
    )
  }

  if (notFound) {
    return (
      <>
        <ChatHeader
          title="Not found"
          sessionId={chatId}
          messages={[]}
          showClear={false}
          clearState="idle"
          onClear={() => {}}
          onMenuOpen={openSidebar}
          searchQuery=""
          onSearchChange={() => {}}
          matchCount={0}
          matchIndex={0}
          onMatchNav={() => {}}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground/40">
          <Bot className="size-8" />
          <p className="text-sm">Chat not found</p>
          <button
            onClick={() => router.push("/chat")}
            className="text-xs underline underline-offset-2 transition-colors hover:text-muted-foreground"
          >
            Go back
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-row overflow-hidden bg-transparent">
      {/* Main Chat Area */}
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden transition-all duration-300">
        <div className="shrink-0">
          <ChatHeader
            title={title}
            sessionId={chatId}
            messages={messages}
            showClear={messages.length > 0}
            clearState={clearState}
            onClear={handleClear}
            onMenuOpen={openSidebar}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            matchCount={matchCount}
            matchIndex={matchIndex}
            onMatchNav={onMatchNav}
          />
          <ToolAvailabilityInfo />
        </div>
        <ErrorBoundary
          fallback={
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground/40">
              <Bot className="size-8" />
              <p className="text-sm">Failed to render messages</p>
              <button
                onClick={() => window.location.reload()}
                className="text-xs underline underline-offset-2 transition-colors hover:text-muted-foreground"
              >
                Reload
              </button>
            </div>
          }
        >
          <MessageList
            messages={messages}
            streaming={streaming}
            onRegenerate={regenerate}
            onEditMessage={editAndResend}
            onSuggestion={handleSuggestion}
            searchMatches={matches}
            activeMessageId={activeMessageId}
          />
        </ErrorBoundary>
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={stop}
          streaming={streaming}
          provider={provider}
          onProvider={handleProviderChange}
          sessionId={chatId}
          docs={docs}
          onDocUploaded={handleDocUploaded}
          onDocRemove={handleDocRemove}
          onDocSummarize={handleDocSummarize}
        />
      </div>

      {isArtifactOpen && (
        <div
          className="relative h-full w-2 cursor-col-resize bg-border/0 transition-colors hover:bg-border/60"
          onMouseDown={handleArtifactDragStart}
        >
          <div className="absolute inset-y-1/3 left-1/2 h-1/3 w-px -translate-x-1/2 bg-border/60" />
        </div>
      )}

      {/* Side Panel for Runnable Code Artifacts */}
      <ArtifactPanel
        width={artifactWidth}
        isExpanded={artifactExpanded}
        onToggleExpand={handleToggleArtifactWidth}
      />

      {emailAction && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-background p-5 shadow-2xl">
            <h2 className="text-sm font-semibold text-foreground">
              {emailAction.intent === "send"
                ? "Review email before sending"
                : "Review email draft request"}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {emailAction.intent === "send"
                ? "This request looks like a real send action. Confirm the structured fields before the agent uses the email tool."
                : "This request looks like a draft action. You can fill the structured fields so the assistant drafts the email cleanly without sending it."}
            </p>
            <div className="mt-4 grid gap-3">
              <label className="text-[11px] text-muted-foreground">
                Recipient
                <input
                  value={emailAction.fields.to}
                  onChange={(e) =>
                    setEmailAction((prev) =>
                      prev
                        ? {
                            ...prev,
                            fields: { ...prev.fields, to: e.target.value },
                          }
                        : prev
                    )
                  }
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                Subject
                <input
                  value={emailAction.fields.subject}
                  onChange={(e) =>
                    setEmailAction((prev) =>
                      prev
                        ? {
                            ...prev,
                            fields: { ...prev.fields, subject: e.target.value },
                          }
                        : prev
                    )
                  }
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                Body
                <textarea
                  value={emailAction.fields.body}
                  onChange={(e) =>
                    setEmailAction((prev) =>
                      prev
                        ? {
                            ...prev,
                            fields: { ...prev.fields, body: e.target.value },
                          }
                        : prev
                    )
                  }
                  rows={6}
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
            </div>
            <div className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-border bg-muted/30 px-3 py-2">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {emailAction.originalPrompt}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setEmailAction(null)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmedEmailAction}
                disabled={
                  emailAction.intent === "send" &&
                  emailActionNeedsResearch &&
                  !researchReady
                }
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                {emailAction.intent === "send"
                  ? "Run send flow"
                  : "Create draft"}
              </button>
            </div>
            {emailAction.intent === "send" &&
              (!emailAction.fields.subject.trim() ||
                !emailAction.fields.body.trim()) && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Aurelius will draft any missing subject or body content from your request before sending.
              </p>
            )}
            {emailAction.intent === "send" &&
              emailActionNeedsResearch &&
              !researchReady && (
                <p className="mt-2 text-[11px] text-destructive">
                  This request needs live web research before Aurelius can send it. Enable Web Search first, then retry.
                </p>
              )}
          </div>
        </div>
      )}
    </div>
  )
}

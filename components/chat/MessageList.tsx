"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  User,
  Copy,
  Check,
  RefreshCw,
  Globe,
  Calculator,
  FileText,
  ChevronDown,
  ChevronUp,
  Pencil,
  ArrowDown,
  Mail,
  Code,
  Star,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { stripMarkdown } from "@/lib/stripMarkdown"
import { buildRecoveryGuidance, type RecoveryCode } from "@/lib/ai/workflow"
import {
  MODELS,
  toolDisplayName,
  type ChatMessage,
  type Provider,
  type ToolCall,
} from "@/types/chat"
import type { SearchMatch } from "@/hooks/useMessageSearch"
import { MarkdownContent } from "./MarkdownContent"
import Image from "next/image"
import { useArtifactStore } from "@/hooks/useArtifactStore"
import type { ArtifactRef } from "@/types/chat"
import { FileCode, Download } from "lucide-react"
import { downloadArtifactText, fetchArtifactText } from "@/lib/artifacts/client"
import { useArtifactFavorites } from "@/hooks/useArtifactFavorites"

interface MessageListProps {
  messages: ChatMessage[]
  streaming: boolean
  onRegenerate: () => void
  onEditMessage: (messageId: string, newText: string) => void
  onSuggestion: (prompt: string) => void
  searchMatches?: SearchMatch[]
  activeMessageId?: string | null
  readOnly?: boolean
  artifactUrlBuilder?: (artifactId: string) => string
}

const BOTTOM_THRESHOLD = 100

export function MessageList({
  messages,
  streaming,
  onRegenerate,
  onEditMessage,
  onSuggestion,
  searchMatches,
  activeMessageId,
  readOnly = false,
  artifactUrlBuilder,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  const prevCountRef = useRef(messages.length)
  const [showScrollButton, setShowScrollButton] = useState(false)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const scrollPos = el.scrollTop
    const maxScroll = el.scrollHeight - el.clientHeight
    const isAtBottom = maxScroll - scrollPos <= BOTTOM_THRESHOLD
    pinnedRef.current = isAtBottom

    // Show button if we are scrolled up more than 400px, OR if streaming and not at bottom
    const significantlyScrolledUp = maxScroll - scrollPos > 400
    setShowScrollButton(significantlyScrolledUp || (streaming && !isAtBottom))
  }, [streaming])

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    pinnedRef.current = true
    setShowScrollButton(false)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  const mountedRef = useRef(false)
  const prevSessionId = useRef(messages[0]?._id) // simple proxy for session change

  useEffect(() => {
    // Reset mount flag if the first message changes (session change)
    const currentFirstId = messages[0]?._id
    if (currentFirstId !== prevSessionId.current) {
      mountedRef.current = false
      prevSessionId.current = currentFirstId
    }

    // Should we scroll?
    // 1. If we are pinned to the bottom.
    // 2. OR if this is the very first time we have messages for this session.
    const isFirstLoad = !mountedRef.current && messages.length > 0
    const messageCountIncreased = messages.length > prevCountRef.current

    if (pinnedRef.current || isFirstLoad) {
      // Use "auto" (instant) for the initial load of a session to prevent visible "shifts"
      // Use "smooth" only for new messages that arrive while we are already pinned
      const behavior = isFirstLoad || !messageCountIncreased ? "auto" : "smooth"

      bottomRef.current?.scrollIntoView({ behavior })

      if (isFirstLoad) {
        mountedRef.current = true
      }
    }

    prevCountRef.current = messages.length
  }, [messages, streaming])

  const matchMap = new Map(
    searchMatches?.map((m) => [m.messageId, m.ranges]) ?? []
  )
  const lastAsstIdx = messages.reduce(
    (acc, m, i) => (m.role === "assistant" ? i : acc),
    -1
  )

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
          {messages.length === 0 ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center select-none">
              {/* Animated Glow Hub */}
              <div className="relative mb-8">
                <div className="animate-pulse-glow absolute inset-0 rounded-3xl bg-primary/20 blur-2xl" />
                <Image
                  src="/appIcon.png"
                  alt="Aurelius"
                  width={48}
                  height={48}
                  className="rounded-xl transition-transform duration-500 hover:scale-120"
                />
              </div>

              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Aurelius
                </h1>
                <p className="max-w-[280px] text-sm leading-relaxed text-muted-foreground/60">
                  Your intelligent companion for research, code, and creative
                  exploration.
                </p>
              </div>

              {/* Suggestion Grid */}
              <div className="mt-10 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  {
                    title: "Deep Research",
                    icon: Globe,
                    prompt:
                      "Search for the latest news on room-temperature superconductors",
                    delay: "delay-100",
                  },
                  {
                    title: "Code Assistant",
                    icon: Code,
                    prompt:
                      "Write a high-performance React hook for window virtualization",
                    delay: "delay-200",
                  },
                  {
                    title: "Data Analysis",
                    icon: Calculator,
                    prompt:
                      "Calculate the compound interest for $5000 over 5 years at 7% annually",
                    delay: "delay-300",
                  },
                  {
                    title: "Document Help",
                    icon: FileText,
                    prompt:
                      "Summarize the key takeaways from the attached technical document",
                    delay: "delay-400",
                  },
                ].map((item) => (
                  <button
                    key={item.title}
                    onClick={() => onSuggestion(item.prompt)}
                    className={cn(
                      "animate-fade-up group flex flex-col items-start gap-2 rounded-2xl border border-border/50 bg-muted/30 p-4 text-left transition-all hover:scale-[1.02] hover:border-primary/30 hover:bg-muted/50 active:scale-[0.98]",
                      item.delay
                    )}
                  >
                    <item.icon className="size-4 text-primary/60 transition-transform group-hover:scale-110" />
                    <div className="space-y-1">
                      <p className="text-[13px] font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="line-clamp-2 text-[11px] leading-tight text-muted-foreground/60">
                        {item.prompt}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isLast = i === messages.length - 1
              const isStreaming =
                streaming && isLast && msg.role === "assistant"
              const isThinking =
                isStreaming &&
                msg.content === "" &&
                !msg.toolCalls?.length &&
                !msg.thinking
              const showRegen =
                msg.role === "assistant" && i === lastAsstIdx && !streaming

              return (
                <MessageRow
                  key={msg._id}
                  msg={msg}
                  isStreaming={isStreaming}
                  isThinking={isThinking}
                  showRegenerate={showRegen}
                  onRegenerate={onRegenerate}
                  onEditMessage={onEditMessage}
                  canEdit={!streaming && !readOnly}
                  highlightRanges={matchMap.get(msg._id)}
                  isActiveMatch={msg._id === activeMessageId}
                  readOnly={readOnly}
                  artifactUrlBuilder={artifactUrlBuilder}
                />
              )
            })
          )}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      {/* Floating Scroll Button — Higher up to avoid overlapping input */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute right-1/2 bottom-8 z-20 flex translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2.5 text-xs font-semibold text-foreground shadow-2xl backdrop-blur-md transition-all hover:bg-muted active:scale-95"
        >
          <ArrowDown className="size-3.5 animate-bounce" />
          {streaming ? "New responses below" : "Jump to latest"}
        </button>
      )}
    </div>
  )
}

// ── MessageRow ──────────────────────────────────────────────────────
function MessageRow({
  msg,
  isStreaming,
  isThinking,
  showRegenerate,
  onRegenerate,
  onEditMessage,
  canEdit,
  highlightRanges,
  isActiveMatch,
  readOnly,
  artifactUrlBuilder,
}: {
  msg: ChatMessage
  isStreaming: boolean
  isThinking: boolean
  showRegenerate: boolean
  canEdit: boolean
  onRegenerate: () => void
  onEditMessage: (messageId: string, newText: string) => void
  highlightRanges?: { start: number; end: number }[]
  isActiveMatch?: boolean
  readOnly: boolean
  artifactUrlBuilder?: (artifactId: string) => string
}) {
  const isUser = msg.role === "user"
  const modelCfg = MODELS[msg.model as Provider]
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(msg.content)
  const editRef = useRef<HTMLTextAreaElement>(null)
  const successfulEmailToolCall = msg.toolCalls
    ?.slice()
    .reverse()
    .find(
      (tc) =>
        tc.tool.includes("email") &&
        tc.outputMeta?.status === "sent" &&
        typeof tc.outputMeta.to === "string" &&
        typeof tc.outputMeta.subject === "string"
    )

  const handleCopy = async () => {
    const plain =
      msg.role === "assistant" ? stripMarkdown(msg.content) : msg.content
    await navigator.clipboard.writeText(plain)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const submitEdit = () => {
    if (!editText.trim() || editText === msg.content) {
      setEditing(false)
      return
    }
    onEditMessage(msg._id, editText.trim())
    setEditing(false)
  }

  return (
    <div
      className={cn(
        "group/row flex gap-3 rounded-2xl p-4 transition-all duration-300",
        isActiveMatch
          ? "bg-primary/10 shadow-md ring-1 ring-primary/30"
          : "hover:bg-muted/30",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full shadow-sm",
          isUser ? "bg-primary" : "border border-border bg-background"
        )}
      >
        {isUser ? (
          <User className="size-3.5 text-primary-foreground" />
        ) : (
          <Image
            src="/appIcon.png"
            alt="AI"
            width={20}
            height={20}
            className="rounded-sm"
          />
        )}
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-2",
          isUser ? "items-end" : "items-start"
        )}
      >
        {!isUser && modelCfg && (
          <span
            className={cn(
              "px-1 text-[10px] font-bold tracking-wider uppercase",
              modelCfg.color
            )}
          >
            {modelCfg.label}
          </span>
        )}

        {isUser && editing ? (
          <div className="w-full max-w-lg space-y-2">
            <textarea
              ref={editRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full resize-none rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditing(false)}
                className="text-xs text-muted-foreground"
              >
                Cancel
              </button>
              <button
                onClick={submitEdit}
                className="rounded-lg bg-primary px-3 py-1 text-xs text-white"
              >
                Save
              </button>
            </div>
          </div>
        ) : isUser ? (
          <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground shadow-sm">
            <HighlightedText
              text={msg.content}
              ranges={highlightRanges}
              variant="onPrimary"
            />
          </div>
        ) : null}

        {!isUser && (
          <>
            {msg.planSteps && msg.planSteps.length > 0 && (
              <PlanBlock steps={msg.planSteps} />
            )}
            {successfulEmailToolCall?.outputMeta && (
              <EmailDeliveryCard meta={successfulEmailToolCall.outputMeta} />
            )}
            {msg.thinking && (
              <ThoughtBlock
                thinking={msg.thinking}
                isStreaming={isStreaming && !msg.content}
              />
            )}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <ToolSteps toolCalls={msg.toolCalls} />
            )}
            {msg.artifacts && msg.artifacts.length > 0 && (
              <ArtifactCards
                artifacts={msg.artifacts}
                artifactUrlBuilder={artifactUrlBuilder}
              />
            )}
            {(isThinking || msg.content) && (
              <div
                className={cn(
                  "w-full rounded-2xl rounded-tl-sm border border-transparent bg-muted/50 px-4 py-3 text-sm leading-relaxed transition-all",
                  isStreaming && "border-primary/10 bg-muted/70 shadow-sm"
                )}
              >
                {isThinking ? (
                  <ThinkingDots />
                ) : (
                  <MarkdownContent
                    content={msg.content}
                    isStreaming={isStreaming}
                  />
                )}
              </div>
            )}
          </>
        )}

        <div className="mt-1 flex items-center gap-3 opacity-0 transition-opacity group-hover/row:opacity-100">
          {isUser && canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-2.5" /> Edit
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <Check className="size-2.5 text-green-500" />
            ) : (
              <Copy className="size-2.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          {showRegenerate && !readOnly && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-2.5" /> Regenerate
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function EmailDeliveryCard({ meta }: { meta: Record<string, string> }) {
  return (
    <div className="w-full rounded-xl border border-green-500/20 bg-green-500/[0.05] px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
          <Mail className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide text-green-700 uppercase dark:text-green-400">
            Email sent
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {meta.subject}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">To {meta.to}</p>
          {meta.smtpUser && (
            <p className="mt-1 text-[11px] text-muted-foreground/80">
              Sent from {meta.smtpUser}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function PlanBlock({ steps }: { steps: string[] }) {
  return (
    <div className="w-full rounded-xl border border-border/40 bg-background/70 px-3 py-3">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Plan
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {steps.map((step, index) => (
          <div key={`${index}-${step}`} className="flex gap-2">
            <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {index + 1}
            </div>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {step}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ThoughtBlock({
  thinking,
  isStreaming,
}: {
  thinking: string
  isStreaming: boolean
}) {
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border/40 bg-muted/20 text-[11px]">
      <div
        onClick={() => setOpen(!open)}
        className="flex cursor-pointer items-center justify-between px-3 py-2 transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center gap-2 font-medium text-muted-foreground/70">
          <div
            className={cn(
              "size-1.5 rounded-full bg-primary/40",
              isStreaming && "animate-pulse"
            )}
          />
          {isStreaming ? "Thinking..." : "Reasoning Process"}
        </div>
        <div className="flex items-center gap-2">
          {!isStreaming && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigator.clipboard.writeText(thinking)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="rounded p-1 hover:bg-background"
            >
              {copied ? (
                <Check className="size-3 text-green-500" />
              ) : (
                <Copy className="size-3 text-muted-foreground/30" />
              )}
            </button>
          )}
          {open ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
        </div>
      </div>
      {open && (
        <div className="border-t border-border/10 px-3 pt-2 pb-3">
          <div className="scrollbar-thin scrollbar-thumb-border max-h-40 overflow-y-auto pr-1 whitespace-pre-wrap text-muted-foreground/60 italic">
            {thinking}
            {isStreaming && (
              <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-primary/30" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ArtifactCards ─────────────────────────────────────────────────
function ArtifactCards({
  artifacts,
  artifactUrlBuilder,
}: {
  artifacts: ArtifactRef[]
  artifactUrlBuilder?: (artifactId: string) => string
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      {artifacts.map((a, index) => (
        <ArtifactCard
          key={a.artifactId}
          artifact={a}
          artifacts={artifacts}
          index={index}
          artifactUrlBuilder={artifactUrlBuilder}
        />
      ))}
    </div>
  )
}

function ArtifactCard({
  artifact,
  artifacts,
  index,
  artifactUrlBuilder,
}: {
  artifact: ArtifactRef
  artifacts: ArtifactRef[]
  index: number
  artifactUrlBuilder?: (artifactId: string) => string
}) {
  const { openArtifact } = useArtifactStore()
  const { isFavorite, toggleFavorite, seedFavorite } = useArtifactFavorites()
  const [copied, setCopied] = useState(false)
  const [busyAction, setBusyAction] = useState<"copy" | "download" | null>(null)
  const [favoriteError, setFavoriteError] = useState("")

  useEffect(() => {
    seedFavorite(artifact.artifactId, artifact.favorite ?? false)
  }, [artifact.artifactId, artifact.favorite, seedFavorite])
  const fmtBytes = (n: number) =>
    n < 1024
      ? `${n} B`
      : n < 1048576
        ? `${(n / 1024).toFixed(1)} KB`
        : `${(n / 1048576).toFixed(1)} MB`

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      setBusyAction("download")
      const { text } = await fetchArtifactText(
        artifact.artifactId,
        artifactUrlBuilder
      )
      downloadArtifactText(artifact.filename, text, artifact.lang)
    } catch (err) {
      console.error("[artifact card] download failed:", err)
    } finally {
      setBusyAction(null)
    }
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      setBusyAction("copy")
      const { text } = await fetchArtifactText(
        artifact.artifactId,
        artifactUrlBuilder
      )
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("[artifact card] copy failed:", err)
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div
      className="group/card flex cursor-pointer flex-col gap-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 transition-all hover:border-primary/30 hover:bg-muted/50"
      onClick={() => openArtifact(artifact, artifacts, index)}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary transition-colors group-hover/card:border-primary/40 group-hover/card:bg-primary/10">
          <FileCode className="size-4" />
          {isFavorite(artifact.artifactId) && (
            <Star className="absolute -top-1 -right-1 size-3 fill-current text-amber-500" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-foreground">
            {artifact.filename}
          </span>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase">
              {artifact.lang}
            </span>
            <span className="text-[11px] text-muted-foreground/50">
              {fmtBytes(artifact.sizeBytes)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-all group-hover/card:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation()
              void toggleFavorite(artifact.artifactId).catch((err) => {
                console.error("[artifact favorite] toggle failed:", err)
                setFavoriteError("Favorite update failed")
                window.setTimeout(() => setFavoriteError(""), 3000)
              })
            }}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors hover:bg-muted",
              isFavorite(artifact.artifactId)
                ? "text-amber-500"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={isFavorite(artifact.artifactId) ? "Unfavorite" : "Favorite"}
          >
            <Star
              className={cn(
                "size-3.5",
                isFavorite(artifact.artifactId) && "fill-current"
              )}
            />
          </button>
          <button
            onClick={handleCopy}
            disabled={busyAction !== null}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            title={copied ? "Copied" : "Copy"}
          >
            {copied ? (
              <Check className="size-3.5 text-green-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
          <button
            onClick={handleDownload}
            disabled={busyAction !== null}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Download"
          >
            <Download className="size-3.5" />
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary">
            Open
          </div>
        </div>
      </div>
      {favoriteError && (
        <div className="text-[11px] text-destructive">{favoriteError}</div>
      )}
    </div>
  )
}

function ToolSteps({ toolCalls }: { toolCalls: ToolCall[] }) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      {toolCalls.map((tc, i) => (
        <ToolStepCard key={i} tc={tc} />
      ))}
    </div>
  )
}

function toolRunningLabel(toolName: string): string {
  if (toolName.includes("calc")) return "calculating…"
  if (toolName.includes("email")) return "sending…"
  if (toolName.includes("list")) return "listing…"
  if (toolName.includes("read")) return "reading…"
  if (toolName.includes("code") || toolName.includes("repo")) return "running…"
  if (toolName.includes("search") || toolName.includes("web"))
    return "searching…"
  return "running…"
}

// ── Per-tool colour theme ──────────────────────────────────────────
interface ToolTheme {
  border: string
  bg: string
  iconBg: string
  iconColor: string
  labelColor: string
}

function toolTheme(toolName: string): ToolTheme {
  if (
    toolName.includes("tavily") ||
    toolName.includes("search") ||
    toolName.includes("web")
  )
    return {
      border: "border-blue-500/25",
      bg: "bg-blue-500/[0.04]",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
      labelColor: "text-blue-600/80 dark:text-blue-400/80",
    }
  if (toolName.includes("calc"))
    return {
      border: "border-violet-500/25",
      bg: "bg-violet-500/[0.04]",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-500",
      labelColor: "text-violet-600/80 dark:text-violet-400/80",
    }
  if (
    toolName.includes("doc") ||
    toolName.includes("list") ||
    toolName.includes("read")
  )
    return {
      border: "border-amber-500/25",
      bg: "bg-amber-500/[0.04]",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-500",
      labelColor: "text-amber-600/80 dark:text-amber-400/80",
    }
  if (toolName.includes("email"))
    return {
      border: "border-green-500/25",
      bg: "bg-green-500/[0.04]",
      iconBg: "bg-green-500/10",
      iconColor: "text-green-500",
      labelColor: "text-green-600/80 dark:text-green-400/80",
    }
  if (toolName.includes("code") || toolName.includes("repo"))
    return {
      border: "border-cyan-500/25",
      bg: "bg-cyan-500/[0.04]",
      iconBg: "bg-cyan-500/10",
      iconColor: "text-cyan-500",
      labelColor: "text-cyan-600/80 dark:text-cyan-400/80",
    }
  return {
    border: "border-border/40",
    bg: "bg-background/50",
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    labelColor: "text-foreground/70",
  }
}

function ToolIcon({
  toolName,
  className,
}: {
  toolName: string
  className?: string
}) {
  if (toolName.includes("calc")) return <Calculator className={className} />
  if (
    toolName.includes("doc") ||
    toolName.includes("list") ||
    toolName.includes("read")
  )
    return <FileText className={className} />
  if (toolName.includes("email")) return <Mail className={className} />
  if (toolName.includes("code") || toolName.includes("repo"))
    return <Code className={className} />
  return <Globe className={className} />
}

function ToolStepCard({ tc }: { tc: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  const isDone = tc.output !== undefined
  const theme = toolTheme(tc.tool)
  const recoverySteps =
    tc.output && tc.outputCode
      ? buildRecoveryGuidance(tc.output, tc.outputCode as RecoveryCode)
      : []
  const toolMeta = tc.outputMeta ?? {}
  const showEmailSummary =
    tc.tool.includes("email") &&
    typeof toolMeta.to === "string" &&
    typeof toolMeta.subject === "string"

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border text-[11px] transition-all",
        isDone
          ? cn(theme.border, "bg-background/50")
          : cn(theme.border, theme.bg)
      )}
    >
      <div
        className="flex cursor-pointer items-center gap-3 px-3 py-2"
        onClick={() => isDone && setExpanded(!expanded)}
      >
        <div
          className={cn(
            "rounded p-1",
            theme.iconBg,
            !isDone && "animate-pulse"
          )}
        >
          <ToolIcon
            toolName={tc.tool}
            className={cn("size-3", theme.iconColor)}
          />
        </div>
        <div
          className={cn(
            "flex-1 font-medium tracking-tight uppercase",
            theme.labelColor
          )}
        >
          {toolDisplayName(tc.tool)} —{" "}
          <span className="font-normal lowercase italic opacity-60">
            {isDone ? "done" : toolRunningLabel(tc.tool)}
          </span>
        </div>
        {isDone &&
          (expanded ? (
            <ChevronUp className="size-3 text-muted-foreground/50" />
          ) : (
            <ChevronDown className="size-3 text-muted-foreground/50" />
          ))}
      </div>
      {expanded && isDone && (
        <div className="max-h-40 overflow-y-auto border-t border-border/10 bg-muted/10 px-3 py-2">
          {showEmailSummary && (
            <div className="mb-2 rounded-lg border border-border/50 bg-background/70 px-3 py-2">
              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Delivery
              </p>
              <div className="mt-1 flex flex-col gap-1 text-[11px] text-foreground">
                <p>
                  To <span className="font-medium">{toolMeta.to}</span>
                </p>
                <p>
                  Subject{" "}
                  <span className="font-medium">{toolMeta.subject}</span>
                </p>
                {toolMeta.smtpUser && (
                  <p className="text-[10px] text-muted-foreground">
                    Sent from {toolMeta.smtpUser}
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="font-mono text-[10px] text-muted-foreground/70">
            {tc.output}
          </div>
          {recoverySteps.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Next steps
              </p>
              {recoverySteps.map((step) => (
                <p
                  key={step}
                  className="text-[10px] leading-relaxed text-muted-foreground/80"
                >
                  - {step}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HighlightedText({
  text,
  ranges,
  variant = "default",
}: {
  text: string
  ranges?: { start: number; end: number }[]
  variant?: "default" | "onPrimary"
}) {
  if (!ranges || ranges.length === 0) return <>{text}</>
  const markClass =
    variant === "onPrimary"
      ? "bg-white/30 text-white rounded-sm"
      : "bg-yellow-300/80 dark:bg-yellow-500/30 rounded-sm"
  const parts: React.ReactNode[] = []
  let last = 0
  ranges.forEach(({ start, end }, i) => {
    if (start > last) parts.push(text.slice(last, start))
    parts.push(
      <mark key={i} className={markClass}>
        {text.slice(start, end)}
      </mark>
    )
    last = end
  })
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="size-1.5 animate-bounce rounded-full bg-primary/40"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  )
}

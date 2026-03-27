// components/chat/ArtifactPanel.tsx
"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import {
  RefreshCw,
  X,
  Code2,
  Copy,
  Check,
  ChevronLeft,
  Download,
  ChevronRight,
  Star,
} from "lucide-react"
import { useArtifactStore, isPreviewable } from "@/hooks/useArtifactStore"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { darkTheme, lightTheme } from "@/lib/codeThemes"
import { cn } from "@/lib/utils"
import {
  downloadArtifactText,
  fetchArtifactText,
} from "@/lib/artifacts/client"
import { useArtifactFavorites } from "@/hooks/useArtifactFavorites"

interface ArtifactPanelProps {
  width?: number
  isExpanded?: boolean
  onToggleExpand?: () => void
  artifactUrlBuilder?: (artifactId: string) => string
  readOnly?: boolean
}

export function ArtifactPanel({
  width,
  isExpanded,
  onToggleExpand,
  artifactUrlBuilder,
  readOnly = false,
}: ArtifactPanelProps) {
  const {
    isOpen,
    artifact,
    artifacts,
    currentIndex,
    closeArtifact,
    nextArtifact,
    previousArtifact,
  } = useArtifactStore()
  const { isFavorite, toggleFavorite, seedFavorite } = useArtifactFavorites()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const sandboxReadyRef = useRef(false)

  const [code, setCode] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [favoriteError, setFavoriteError] = useState<string | null>(null)

  const [logs, setLogs] = useState<{ level: string; text: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [key, setKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview")

  // null on server to avoid hydration mismatch
  const [dark, setDark] = useState<boolean | null>(null)
  useEffect(() => {
    const el = document.documentElement
    const check = () => setDark(el.classList.contains("dark"))
    check()
    const obs = new MutationObserver(check)
    obs.observe(el, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])

  const lang = artifact?.lang || ""
  const filename = artifact?.filename || ""
  const sizeBytes = artifact?.sizeBytes || 0
  const canPreview = isPreviewable(lang)
  const remoteArtifactId = artifact?.artifactId ?? null

  useEffect(() => {
    if (artifact?.artifactId) {
      seedFavorite(artifact.artifactId, artifact.favorite ?? false)
    }
  }, [artifact?.artifactId, artifact?.favorite, seedFavorite])

  // Fetch file content from API when artifact opens
  useEffect(() => {
    if (!isOpen || !artifact) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setCode(null)
      setFetchError(null)
      setFetching(true)
      setViewMode(canPreview ? "preview" : "code")
    })

    if (!remoteArtifactId && artifact.sourceCode !== undefined) {
      queueMicrotask(() => {
        setCode(artifact.sourceCode ?? "")
        setFetching(false)
      })
      return
    }

    if (!remoteArtifactId) {
      queueMicrotask(() => {
        setFetchError("Missing artifact id")
        setFetching(false)
      })
      return
    }

    Promise.resolve(fetchArtifactText(remoteArtifactId, artifactUrlBuilder))
      .then(({ text }) => {
        if (cancelled) return
        setCode(text)
        setFetching(false)
      })
      .catch((err) => {
        if (cancelled) return
        setFetchError(
          err instanceof Error ? err.message : "Failed to load file"
        )
        setFetching(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, artifact, remoteArtifactId, canPreview, artifactUrlBuilder])

  const sendToSandbox = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "run", lang, code: code ?? "", dark },
      "*"
    )
  }, [lang, code, dark])

  const sendToSandboxRef = useRef(sendToSandbox)
  useEffect(() => {
    sendToSandboxRef.current = sendToSandbox
  }, [sendToSandbox])

  useEffect(() => {
    if (!isOpen || !artifact || !code) return
    sandboxReadyRef.current = false
    queueMicrotask(() => {
      setLogs([])
      setError(null)
      setLoading(true)
    })

    const handler = (e: MessageEvent) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow)
        return
      if (e.data.type === "sandbox-ready") {
        sandboxReadyRef.current = true
        sendToSandboxRef.current()
      }
      if (e.data.type === "ready") setLoading(false)
      if (e.data.type === "console") {
        setLoading(false)
        setLogs((p) => [...p, { level: e.data.level, text: e.data.text }])
      }
      if (e.data.type === "error") {
        setLoading(false)
        setError(e.data.text)
      }
      if (e.data.type === "open-link")
        window.open(e.data.href, "_blank", "noopener,noreferrer")
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [key, isOpen, artifact, code])

  if (!isOpen || !artifact) return null

  const handleCopy = async () => {
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!code) return
    downloadArtifactText(filename, code, lang)
  }

  const handleRerun = () => {
    sandboxReadyRef.current = false
    setKey((k) => k + 1)
    setLogs([])
    setError(null)
    setLoading(true)
  }

  const fmtBytes = (n: number) =>
    n < 1024
      ? `${n} B`
      : n < 1048576
        ? `${(n / 1024).toFixed(1)} KB`
        : `${(n / 1048576).toFixed(1)} MB`

  const panelStyle = width
    ? { width: `${width}px`, maxWidth: `${width}px` }
    : undefined

  return (
    <div
      className="flex h-full w-full flex-col border-l border-border bg-background md:w-[400px] lg:w-[480px]"
      style={panelStyle}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2.5">
        <button
          onClick={closeArtifact}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Close"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Code2 className="size-3.5" />
          </div>
          <span className="truncate text-sm font-semibold text-foreground">
            {filename}
          </span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            {lang}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground/50">
            {fmtBytes(sizeBytes)}
          </span>
        </div>

        {canPreview ? (
          <div className="flex shrink-0 items-center rounded-full border border-border bg-muted/40 p-0.5 text-xs">
            <button
              onClick={() => setViewMode("preview")}
              className={cn(
                "rounded-full px-3 py-1 font-semibold transition-all",
                viewMode === "preview"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Preview
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={cn(
                "rounded-full px-3 py-1 font-semibold transition-all",
                viewMode === "code"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Code
            </button>
          </div>
        ) : (
          <span className="shrink-0 rounded bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            Code
          </span>
        )}

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={previousArtifact}
            disabled={currentIndex === 0}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
            title="Previous artifact"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            onClick={nextArtifact}
            disabled={currentIndex >= artifacts.length - 1}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
            title="Next artifact"
          >
            <ChevronRight className="size-3.5" />
          </button>
          {artifact.artifactId && (
            <button
              onClick={() => {
                void toggleFavorite(artifact.artifactId!, !isFavorite(artifact.artifactId, artifact.favorite ?? false)).catch((err) => {
                  console.error("[artifact panel] favorite failed:", err)
                  setFavoriteError("Favorite update failed")
                  window.setTimeout(() => setFavoriteError(null), 3000)
                })
              }}
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-colors hover:bg-muted",
                isFavorite(artifact.artifactId, artifact.favorite ?? false)
                  ? "text-amber-500"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={isFavorite(artifact.artifactId, artifact.favorite ?? false) ? "Unfavorite" : "Favorite"}
            >
              <Star
                className={cn(
                  "size-3.5",
                  isFavorite(artifact.artifactId, artifact.favorite ?? false) && "fill-current"
                )}
              />
            </button>
          )}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              <span className="text-[10px] font-semibold uppercase">
                {isExpanded ? "In" : "Out"}
              </span>
            </button>
          )}
          <button
            onClick={handleCopy}
            disabled={!code}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            title={copied ? "Copied!" : "Copy"}
          >
            {copied ? (
              <Check className="size-3.5 text-green-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
          <button
            onClick={handleDownload}
            disabled={!code}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            title="Download"
          >
            <Download className="size-3.5" />
          </button>
          {canPreview && !readOnly && (
            <button
              onClick={handleRerun}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Re-run"
            >
              <RefreshCw className="size-3.5" />
            </button>
          )}
          <button
            onClick={closeArtifact}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
            title="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      {favoriteError && (
        <div className="border-b border-destructive/20 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
          {favoriteError}
        </div>
      )}

      {/* Content */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
        {fetching && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background">
            <div className="size-5 animate-spin rounded-full border-2 border-border border-t-primary" />
            <span className="text-xs text-muted-foreground">Loading file…</span>
          </div>
        )}

        {fetchError && !fetching && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <span className="text-sm font-medium text-destructive">
              Failed to load file
            </span>
            <span className="text-xs text-muted-foreground">{fetchError}</span>
          </div>
        )}

        {!fetching &&
          !fetchError &&
          loading &&
          canPreview &&
          viewMode === "preview" && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background">
              <div className="size-5 animate-spin rounded-full border-2 border-border border-t-primary" />
              <span className="text-xs text-muted-foreground">Running…</span>
            </div>
          )}

        {!fetching &&
          !fetchError &&
          canPreview &&
          viewMode === "preview" &&
          code !== null && (
            <iframe
              key={key}
              ref={iframeRef}
              src="/sandbox.html"
              sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
              className="h-full w-full border-0"
              title="Artifact Sandbox"
              onLoad={() => setTimeout(() => sendToSandboxRef.current(), 100)}
            />
          )}

        {!fetching &&
          !fetchError &&
          viewMode === "code" &&
          dark !== null &&
          code !== null && (
            <div className="absolute inset-0 overflow-y-auto bg-[#fafafa] p-4 dark:bg-[#1e1e2e]">
              <SyntaxHighlighter
                language={lang || "text"}
                useInlineStyles
                customStyle={{
                  background: "transparent",
                  margin: 0,
                  padding: 0,
                  fontSize: "0.8rem",
                  lineHeight: "1.7",
                }}
                style={dark ? darkTheme : lightTheme}
                wrapLongLines={false}
              >
                {code}
              </SyntaxHighlighter>
            </div>
          )}

        {error && canPreview && viewMode === "preview" && (
          <div className="absolute inset-x-0 bottom-0 border-t border-red-500/20 bg-red-500/5 px-4 py-2 font-mono text-[11px] text-red-400">
            ⚠ {error}
          </div>
        )}

        {logs.length > 0 &&
          canPreview &&
          viewMode === "preview" &&
          !["html", "css"].includes(lang.toLowerCase()) && (
            <div className="absolute inset-x-0 bottom-0 max-h-40 overflow-y-auto border-t border-border/40 bg-[#0e1117] px-4 py-3 font-mono text-[11.5px]">
              {logs.map((l, i) => (
                <div
                  key={i}
                  className="mb-1 leading-relaxed break-words whitespace-pre-wrap"
                  style={{
                    color:
                      l.level === "error"
                        ? "#f38ba8"
                        : l.level === "warn"
                          ? "#f9e2af"
                          : "#a6e3a1",
                  }}
                >
                  {l.text}
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}

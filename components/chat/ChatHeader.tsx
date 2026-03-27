// components/chat/ChatHeader.tsx
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Trash2,
  Menu,
  Loader2,
  AlertCircle,
  Share2,
  Check,
  Link,
  X,
  Download,
  FileDown,
  BookOpen,
  Search,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { exportAsPdf, exportAsNotesPdf } from "@/lib/exportChat"
import type { ChatMessage } from "@/types/chat"

interface ChatHeaderProps {
  title: string
  sessionId: string
  messages: ChatMessage[]
  showClear: boolean
  showMenuButton?: boolean
  showSearchButton?: boolean
  showExportButton?: boolean
  showShareButton?: boolean
  showClearButton?: boolean
  clearState: "idle" | "clearing" | "error"
  onClear: () => void
  onMenuOpen: () => void
  // Search
  searchQuery: string
  onSearchChange: (q: string) => void
  matchCount: number
  matchIndex: number
  onMatchNav: (dir: "prev" | "next") => void
}

const EXPORT_FORMATS = [
  {
    id: "pdf",
    label: "Download as PDF",
    icon: FileDown,
    desc: "Full chat transcript, printable",
  },
  {
    id: "notes",
    label: "Make study notes",
    icon: BookOpen,
    desc: "AI-structured notes, save as PDF",
  },
] as const

type ExportFormat = (typeof EXPORT_FORMATS)[number]["id"]

export function ChatHeader({
  title,
  sessionId,
  messages,
  showClear,
  showMenuButton = true,
  showSearchButton = true,
  showExportButton = true,
  showShareButton = true,
  showClearButton = true,
  clearState,
  onClear,
  onMenuOpen,
  searchQuery,
  onSearchChange,
  matchCount,
  matchIndex,
  onMatchNav,
}: ChatHeaderProps) {
  const [shareState, setShareState] = useState<
    "idle" | "loading" | "shared" | "error"
  >("idle")
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [generatingNotes, setGeneratingNotes] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Open search bar
  const openSearch = useCallback(() => {
    setSearchOpen(true)
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [])

  // Close + clear search
  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    onSearchChange("")
  }, [onSearchChange])

  // Expose openSearch so the keyboard shortcut hook can trigger it
  useEffect(() => {
    const handler = () => openSearch()
    window.addEventListener("aurelius:open-search", handler)
    return () => window.removeEventListener("aurelius:open-search", handler)
  }, [openSearch])

  // Close export on outside click
  useEffect(() => {
    if (!exportOpen) return
    const h = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setExportOpen(false)
    }
    document.addEventListener("click", h)
    return () => document.removeEventListener("click", h)
  }, [exportOpen])

  const handleExport = async (format: ExportFormat) => {
    setExportOpen(false)
    const t = title || "Aurelius Chat"
    if (format === "pdf") {
      exportAsPdf(t, messages)
      return
    }
    if (format === "notes") {
      setGeneratingNotes(true)
      try {
        await exportAsNotesPdf(t, messages)
      } catch (err) {
        console.error("[export notes]", err)
        alert(
          err instanceof Error ? err.message : "Failed to generate study notes"
        )
      } finally {
        setGeneratingNotes(false)
      }
    }
  }

  const handleShare = async () => {
    if (shareState === "loading") return
    if (shareUrl) {
      setShareUrl(null)
      setShareState("idle")
      return
    }
    setShareState("loading")
    try {
      const res = await fetch(`/api/sessions/${sessionId}/share`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShareUrl(data.url)
      setShareState("shared")
    } catch {
      setShareState("error")
      setTimeout(() => setShareState("idle"), 3000)
    }
  }

  const handleRevoke = async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/share`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to revoke link")
      setShareUrl(null)
      setShareState("idle")
      setCopied(false)
    } catch {
      setShareState("error")
      setTimeout(() => setShareState("shared"), 2000)
    }
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasMessages = messages.length > 0

  return (
    <>
      <header className="relative z-30 flex h-12 w-full shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md shadow-sm">
        {/* Hamburger */}
        {showMenuButton && (
          <button
            onClick={onMenuOpen}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </button>
        )}

        {/* Title — hidden when search is open on mobile */}
        {!searchOpen && (
          <p
            className={cn(
              "flex-1 truncate text-sm font-medium text-foreground transition-opacity"
            )}
          >
            {title || "New chat"}
          </p>
        )}

        {/* Inline search bar */}
        {searchOpen && (
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-primary/40 bg-muted/40 px-2.5 py-1 ring-2 ring-primary/10">
            <Search className="size-3 shrink-0 text-muted-foreground/60" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeSearch()
                if (e.key === "Enter") onMatchNav(e.shiftKey ? "prev" : "next")
              }}
              placeholder="Search messages…"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
            />
            {/* Match counter */}
            {searchQuery && (
              <span className="shrink-0 text-[11px] text-muted-foreground/60 tabular-nums">
                {matchCount === 0
                  ? "No results"
                  : `${matchIndex + 1} / ${matchCount}`}
              </span>
            )}
            {/* Prev / Next */}
            {matchCount > 0 && (
              <div className="flex items-center">
                <button
                  onClick={() => onMatchNav("prev")}
                  title="Previous match"
                  className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                >
                  <ChevronUp className="size-3" />
                </button>
                <button
                  onClick={() => onMatchNav("next")}
                  title="Next match"
                  className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className="size-3" />
                </button>
              </div>
            )}
            <button
              onClick={closeSearch}
              className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Search toggle */}
        {showSearchButton && hasMessages && !searchOpen && (
          <button
            onClick={openSearch}
            title="Search messages (Ctrl+F)"
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Search className="size-3" />
            <span className="hidden sm:inline">Search</span>
          </button>
        )}

        {/* Export */}
        {showExportButton && hasMessages && !searchOpen && (
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => !generatingNotes && setExportOpen((v) => !v)}
              title={
                generatingNotes ? "Generating notes…" : "Export conversation"
              }
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              disabled={generatingNotes}
            >
              {generatingNotes ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Download className="size-3" />
              )}
              <span className="hidden sm:inline">
                {generatingNotes ? "Generating…" : "Export"}
              </span>
            </button>
            {exportOpen && (
              <div className="absolute top-full right-0 z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
                <p className="px-3 py-2 text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
                  Download as
                </p>
                {EXPORT_FORMATS.map(({ id, label, icon: Icon, desc }) => (
                  <button
                    key={id}
                    onClick={() => handleExport(id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted",
                      id === "notes" && "bg-primary/5 hover:bg-primary/10"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-3.5 shrink-0",
                        id === "notes"
                          ? "text-primary/70"
                          : "text-muted-foreground"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-xs font-medium",
                          id === "notes" ? "text-primary/80" : "text-foreground"
                        )}
                      >
                        {label}
                        {id === "notes" && (
                          <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary/70">
                            NEW
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        {desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Share */}
        {showShareButton && sessionId && !searchOpen && (
          <button
            onClick={handleShare}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
              shareState === "shared"
                ? "text-primary hover:bg-primary/10"
                : shareState === "error"
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {shareState === "loading" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : shareState === "error" ? (
              <AlertCircle className="size-3" />
            ) : shareState === "shared" ? (
              <Link className="size-3" />
            ) : (
              <Share2 className="size-3" />
            )}
            <span className="hidden sm:inline">
              {shareState === "shared" ? "Shared" : "Share"}
            </span>
          </button>
        )}

        {/* Clear */}
        {showClearButton && showClear && !searchOpen && (
          <button
            onClick={onClear}
            disabled={clearState === "clearing"}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
              clearState === "error"
                ? "text-destructive hover:bg-destructive/10"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              clearState === "clearing" && "pointer-events-none opacity-50"
            )}
          >
            {clearState === "clearing" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : clearState === "error" ? (
              <AlertCircle className="size-3" />
            ) : (
              <Trash2 className="size-3" />
            )}
            <span className="hidden sm:inline">
              {clearState === "error" ? "Retry" : "Clear"}
            </span>
          </button>
        )}
      </header>

      {/* Share URL banner */}
      {shareUrl && (
        <div className="flex items-center gap-2 border-b border-border/50 bg-primary/5 px-4 py-2.5">
          <Link className="size-3 shrink-0 text-primary/60" />
          <input
            readOnly
            value={shareUrl}
            className="flex-1 truncate bg-transparent text-xs text-muted-foreground outline-none"
          />
          <button
            onClick={handleCopy}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
              copied
                ? "text-green-500"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {copied ? (
              <>
                <Check className="size-3" />
                Copied
              </>
            ) : (
              <>
                <Link className="size-3" />
                Copy
              </>
            )}
          </button>
          <button
            onClick={handleRevoke}
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          >
            <X className="size-3" />
            <span className="hidden sm:inline">Revoke</span>
          </button>
        </div>
      )}
    </>
  )
}

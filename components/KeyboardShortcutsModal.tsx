// components/KeyboardShortcutsModal.tsx
"use client"

import { useEffect, useState } from "react"
import { X, Command } from "lucide-react"
import { cn } from "@/lib/utils"

interface ShortcutsModalProps {
  open: boolean
  onClose: () => void
}

// Detect platform using the modern userAgentData API where available,
// falling back to userAgent string. navigator.platform is deprecated.
function detectPlatform(): "mac" | "windows" | "linux" {
  if (typeof navigator === "undefined") return "mac" // SSR default

  // Modern API — Chrome 90+, Edge 90+
  const uad = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData
  if (uad?.platform) {
    const p = uad.platform.toLowerCase()
    if (p.includes("mac") || p.includes("ios")) return "mac"
    if (p.includes("win")) return "windows"
    return "linux"
  }

  // Fallback — userAgent string
  const ua = navigator.userAgent.toLowerCase()
  if (/macintosh|mac os x|iphone|ipad|ipod/.test(ua)) return "mac"
  if (/windows/.test(ua)) return "windows"
  return "linux"
}

// Platform-specific modifier key labels
const MOD_LABELS = {
  mac: { mod: "⌘", alt: "⌥", shift: "⇧" },
  windows: { mod: "Ctrl", alt: "Alt", shift: "Shift" },
  linux: { mod: "Ctrl", alt: "Alt", shift: "Shift" },
}

function usePlatform() {
  // Default to mac during SSR to avoid hydration mismatch,
  // then correct on the client after mount.
  const [platform, setPlatform] = useState<"mac" | "windows" | "linux">("mac")
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detectPlatform())
  }, [])
  return platform
}

function Key({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border",
        "bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground",
        className
      )}
    >
      {children}
    </kbd>
  )
}

function Mod({ platform }: { platform: "mac" | "windows" | "linux" }) {
  return <Key>{MOD_LABELS[platform].mod}</Key>
}

function buildShortcuts(platform: "mac" | "windows" | "linux") {
  const { shift } = MOD_LABELS[platform]
  const M = <Mod key="mod" platform={platform} />
  const S = <Key key="shift">{shift}</Key>

  return [
    {
      group: "Navigation",
      items: [
        { keys: [M, <Key key="n">N</Key>], desc: "New chat" },
        { keys: [M, <Key key="k">K</Key>], desc: "Focus message input" },
        { keys: [M, S, <Key key="s">S</Key>], desc: "AI Settings" },
        { keys: [M, S, <Key key="d">D</Key>], desc: "Usage dashboard" },
        { keys: [M, S, <Key key="p">P</Key>], desc: "Profile" },
      ],
    },
    {
      group: "Chat",
      items: [
        { keys: [<Key key="enter">Enter</Key>], desc: "Send message" },
        { keys: [S, <Key key="enter">Enter</Key>], desc: "New line" },
        {
          keys: [<Key key="esc">Esc</Key>],
          desc: "Stop streaming / cancel edit",
        },
        { keys: [M, <Key key="f">F</Key>], desc: "Search in current chat" },
      ],
    },
    {
      group: "Help",
      items: [
        { keys: [M, <Key key="slash">/</Key>], desc: "Show this panel" },
        { keys: [<Key key="d">D</Key>], desc: "Toggle dark / light mode" },
      ],
    },
  ]
}

export function KeyboardShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  const platform = usePlatform()
  const SHORTCUTS = buildShortcuts(platform)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Command className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Keyboard shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="flex flex-col gap-5 px-5 py-5">
          {SHORTCUTS.map((group) => (
            <div key={group.group}>
              <p className="mb-2.5 text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
                {group.group}
              </p>
              <div className="flex flex-col gap-1.5">
                {group.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground/80">
                      {item.desc}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, j) => (
                        <span key={j}>{k}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-5 py-3">
          <p className="text-[10px] text-muted-foreground/40">
            Shortcuts are disabled when typing in an input field.
          </p>
        </div>
      </div>
    </div>
  )
}

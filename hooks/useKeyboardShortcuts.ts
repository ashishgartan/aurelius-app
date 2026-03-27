// hooks/useKeyboardShortcuts.ts
"use client"

import { useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"

interface ShortcutOptions {
  onNewChat:         () => void
  onToggleShortcuts: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

function isMod(e: KeyboardEvent): boolean {
  // Cmd on Mac, Ctrl on Windows/Linux
  return e.metaKey || e.ctrlKey
}

export function useKeyboardShortcuts(opts: ShortcutOptions) {
  const router = useRouter()

  // Use refs so the handler never needs to be re-registered when callbacks change
  const optsRef = useRef(opts)
  useEffect(() => { optsRef.current = opts }, [opts])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Never intercept when the user is typing — except for Escape which always works
    if (e.key !== "Escape" && isTypingTarget(e.target)) return

    const { onNewChat, onToggleShortcuts } = optsRef.current

    // ── Cmd+K — focus chat input ─────────────────────────────────
    if (isMod(e) && e.key === "k" && !e.shiftKey) {
      e.preventDefault()
      const textarea = document.querySelector<HTMLTextAreaElement>(
        "textarea[placeholder*='Message']"
      )
      textarea?.focus()
      return
    }

    // ── Cmd+N — new chat ─────────────────────────────────────────
    if (isMod(e) && e.key === "n" && !e.shiftKey) {
      e.preventDefault()
      onNewChat()
      return
    }

    // ── Cmd+/ — toggle shortcuts modal ───────────────────────────
    if (isMod(e) && e.key === "/") {
      e.preventDefault()
      onToggleShortcuts()
      return
    }

    // ── Cmd+Shift+S — AI Settings ─────────────────────────────────
    if (isMod(e) && e.shiftKey && e.key === "S") {
      e.preventDefault()
      router.push("/options")
      return
    }

    // ── Cmd+Shift+D — Dashboard ───────────────────────────────────
    if (isMod(e) && e.shiftKey && e.key === "D") {
      e.preventDefault()
      router.push("/dashboard")
      return
    }

    // ── Cmd+Shift+P — Profile ─────────────────────────────────────
    if (isMod(e) && e.shiftKey && e.key === "P") {
      e.preventDefault()
      router.push("/profile")
      return
    }

    // ── Escape — stop streaming OR close any open modal ──────────
    // (Escape on modals is handled by each modal itself)
    // Here we stop the active stream if one is running
    if (e.key === "Escape" && !isMod(e)) {
      // Dispatch a custom event that the active chat page can listen to
      window.dispatchEvent(new CustomEvent("aurelius:stop-stream"))
      return
    }
  }, [router])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}

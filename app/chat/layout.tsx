// app/chat/layout.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Sidebar } from "@/components/chat/Sidebar"
import { useChatStore } from "@/hooks/useChatStore"
import { useAuth } from "@/hooks/useAuth"
import { SidebarOpenerProvider } from "@/context/SidebarContext"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"

// Inner layout — rendered only after auth resolves, so all hooks are safe
function ChatLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const {
    sessions,
    loading: sessionsLoading,
    createSession,
    deleteSession,
  } = useChatStore()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const activeChatId = pathname.startsWith("/chat/")
    ? (pathname.split("/chat/")[1] ?? null)
    : null

  const handleNewChat = useCallback(async () => {
    // If the most recent session is still empty (title never changed from default)
    // AND we're not already on it, just navigate to it — no need to create another blank session.
    const mostRecent = sessions[0]
    if (mostRecent && mostRecent.title === "New chat" && mostRecent._id !== activeChatId) {
      router.push(`/chat/${mostRecent._id}`)
      return
    }

    try {
      const id = await createSession("groq")
      router.push(`/chat/${id}`)
    } catch (err) {
      console.error("[chat/layout] createSession failed:", err)
    }
  }, [createSession, router, sessions, activeChatId])

  const handleDeleteChat = useCallback(
    async (id: string) => {
      try {
        await deleteSession(id)
      } catch (err) {
        console.error("[chat/layout] deleteSession failed:", err)
        return
      }
      if (id === activeChatId) {
        const remaining = sessions.filter((s) => s._id !== id)
        router.push(
          remaining.length > 0 ? `/chat/${remaining[0]._id}` : "/chat"
        )
      }
    },
    [deleteSession, activeChatId, sessions, router]
  )

  // Register global keyboard shortcuts
  useKeyboardShortcuts({
    onNewChat: handleNewChat,
    onToggleShortcuts: () => setShortcutsOpen((v) => !v),
  })

  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-background">
      {/* Premium Aura Background Effects */}
      <div className="bg-noise" />
      <div className="glow-blob -top-[10%] -left-[10%] size-[50%] animate-pulse duration-[8s]" />
      <div className="glow-blob -bottom-[15%] -right-[15%] size-[60%] opacity-80 animate-pulse duration-[12s]" />
      <div className="glow-blob glow-blob-secondary top-[20%] right-[10%] size-[30%] opacity-40 animate-pulse duration-[10s]" />

      <Sidebar
        sessions={sessions}
        activeChatId={activeChatId}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        sessionsLoading={sessionsLoading}
      />
      <main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
        <SidebarOpenerProvider value={() => setSidebarOpen(true)}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </SidebarOpenerProvider>
      </main>

      <KeyboardShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  )
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (authLoading) return
    if (!user) router.replace("/login")
  }, [authLoading, user, router])

  if (authLoading) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {/* Sidebar skeleton */}
        <div className="hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="size-7 animate-pulse rounded-md bg-muted-foreground/10" />
            <div className="h-4 w-20 animate-pulse rounded-full bg-muted-foreground/10" />
          </div>
          <div className="px-3 pt-3 pb-2">
            <div className="h-8 w-full animate-pulse rounded-lg bg-muted-foreground/10" />
          </div>
          <div className="flex flex-1 flex-col gap-1 px-2 py-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2"
              >
                <div className="size-3.5 animate-pulse rounded-sm bg-muted-foreground/10" />
                <div className="h-3 flex-1 animate-pulse rounded-full bg-muted-foreground/10" />
              </div>
            ))}
          </div>
        </div>
        {/* Main area skeleton */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-12 items-center border-b border-border px-4">
            <div className="h-3.5 w-32 animate-pulse rounded-full bg-muted-foreground/10" />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="size-6 animate-pulse rounded-full bg-muted-foreground/10" />
          </div>
        </main>
      </div>
    )
  }

  if (!user) return null

  return <ChatLayoutInner>{children}</ChatLayoutInner>
}

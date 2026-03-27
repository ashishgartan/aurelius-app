// context/ChatStoreContext.tsx
"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import type { SessionSummary } from "@/types/chat"
import {
  applySessionArchived,
  applySessionBump,
  applySessionCreate,
  applySessionDelete,
  applySessionPinned,
  applySessionProvider,
  applySessionRename,
} from "@/lib/sessions/storeState"

interface ChatStoreContextValue {
  sessions: SessionSummary[]
  loading: boolean
  initialised: boolean
  loadSessions: () => Promise<void>
  createSession: (provider?: string) => Promise<string>
  deleteSession: (id: string) => Promise<void>
  updateProvider: (id: string, provider: string) => Promise<void>
  togglePinned: (id: string, pinned: boolean) => Promise<void>
  toggleArchived: (id: string, archived: boolean) => Promise<void>
  bumpSession: (id: string) => void
  renameSession: (id: string, title: string) => Promise<void>
}

const ChatStoreContext = createContext<ChatStoreContextValue | null>(null)

export function ChatStoreProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [initialised, setInitialised] = useState(false)

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions")
      if (res.ok) setSessions((await res.json()).sessions)
    } catch {
      /* swallow network errors — UI shows empty list */
    } finally {
      setLoading(false)
      setInitialised(true)
    }
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const createSession = useCallback(
    async (provider = "groq"): Promise<string> => {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: `Error ${res.status}` }))
        throw new Error(error)
      }
      const { session } = await res.json()
      setSessions((prev) => applySessionCreate(prev, session))
      return session._id
    },
    []
  )

  const deleteSession = useCallback(async (id: string) => {
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: `Error ${res.status}` }))
      throw new Error(error)
    }
    setSessions((prev) => applySessionDelete(prev, id))
  }, [])

  const updateProvider = useCallback(async (id: string, provider: string) => {
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: `Error ${res.status}` }))
      throw new Error(error)
    }
    setSessions((prev) => applySessionProvider(prev, id, provider as "groq" | "qwen"))
  }, [])

  const togglePinned = useCallback(async (id: string, pinned: boolean) => {
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: `Error ${res.status}` }))
      throw new Error(error)
    }
    setSessions((prev) => applySessionPinned(prev, id, pinned))
  }, [])

  const toggleArchived = useCallback(async (id: string, archived: boolean) => {
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: `Error ${res.status}` }))
      throw new Error(error)
    }
    setSessions((prev) => applySessionArchived(prev, id, archived))
  }, [])

  const bumpSession = useCallback((id: string) => {
    setSessions((prev) => applySessionBump(prev, id))
  }, [])

  const renameSession = useCallback(async (id: string, title: string) => {
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: `Error ${res.status}` }))
      throw new Error(error)
    }
    setSessions((prev) => applySessionRename(prev, id, title))
  }, [])

  return (
    <ChatStoreContext.Provider
      value={{
        sessions,
        loading,
        initialised,
        loadSessions,
        createSession,
        deleteSession,
        updateProvider,
        togglePinned,
        toggleArchived,
        bumpSession,
        renameSession,
      }}
    >
      {children}
    </ChatStoreContext.Provider>
  )
}

export function useChatStore(): ChatStoreContextValue {
  const ctx = useContext(ChatStoreContext)
  if (!ctx)
    throw new Error("useChatStore must be used inside <ChatStoreProvider>")
  return ctx
}

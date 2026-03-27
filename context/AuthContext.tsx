// context/AuthContext.tsx
"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import type { User } from "@/types/auth"

interface AuthContextValue {
  user: User | null
  loading: boolean
  logout: () => Promise<void>
  updateUser: (patch: Partial<User>) => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchMe(): Promise<User | null> {
  const res = await fetch("/api/auth/me")
  if (res.ok) return (await res.json()).user
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "5")
    await new Promise((r) => setTimeout(r, retryAfter * 1000))
    const retry = await fetch("/api/auth/me")
    if (retry.ok) return (await retry.json()).user
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch((err) => console.warn("[AuthContext] fetchMe failed:", err))
      .finally(() => setLoading(false))
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      setUser(null)
      router.push("/login")
    }
  }, [router])

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const refreshUser = useCallback(async () => {
    const u = await fetchMe()
    setUser(u)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, loading, logout, updateUser, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}

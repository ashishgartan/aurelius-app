// context/SettingsContext.tsx
"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react"
import type { UserSettings } from "@/types/auth"
import { DEFAULT_SETTINGS } from "@/types/auth"
import { saveSettingsRequest } from "@/lib/settings/saveSettings"

interface SettingsContextValue {
  settings: UserSettings
  loading: boolean
  saving: boolean
  save: (patch: Partial<UserSettings>) => Promise<void>
  reset: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    fetch("/api/settings", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.settings) setSettings({ ...DEFAULT_SETTINGS, ...d.settings })
      })
      .catch((err) =>
        console.warn("[SettingsContext] fetch initial settings failed:", err)
      )
      .finally(() => setLoading(false))
  }, [])

  const save = useCallback(async (patch: Partial<UserSettings>) => {
    setSaving(true)

    // Build the optimistic merged state — always carry forward smtp credentials
    // even when they aren't part of this particular patch.
    const merged: UserSettings = {
      ...settingsRef.current,
      ...patch,
      // If this patch does NOT include smtp fields, keep the persisted values
      // so they are never accidentally cleared from local state.
      smtpUser:
        patch.smtpUser !== undefined
          ? patch.smtpUser
          : settingsRef.current.smtpUser,
      smtpPass:
        patch.smtpPass !== undefined
          ? patch.smtpPass
          : settingsRef.current.smtpPass,
    }
    const prev = settingsRef.current

    setSettings(merged) // optimistic update
    settingsRef.current = merged

    try {
      // saveSettingsRequest handles routing:
      //   • smtp-only patches  → PUT /api/settings/smtp
      //   • everything else    → PUT /api/settings  (smtp fields stripped from body)
      const saved = await saveSettingsRequest(fetch, prev, patch)
      setSettings(saved)
      settingsRef.current = saved
    } catch (err) {
      console.error("[SettingsContext] save failed:", err)
      setSettings(prev) // rollback
      settingsRef.current = prev
      throw err
    } finally {
      setSaving(false)
    }
  }, [])

  const reset = useCallback(async () => {
    await save(DEFAULT_SETTINGS)
  }, [save])

  return (
    <SettingsContext.Provider
      value={{ settings, loading, saving, save, reset }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx)
    throw new Error("useSettings must be used inside <SettingsProvider>")
  return ctx
}

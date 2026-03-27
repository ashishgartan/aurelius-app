// app/(chat)/tools/page.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, CircleHelp, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSettings } from "@/context/SettingsContext"
import { useAuth } from "@/context/AuthContext"
import { useToolCatalog } from "@/hooks/useToolCatalog"
import { useModelCatalog } from "@/hooks/useModelCatalog"
import { buildRecoveryGuidance, type RecoveryCode } from "@/lib/ai/workflow"
import type { ToolId } from "@/types/auth"

interface EmailHistoryEntry {
  id: string
  sessionId?: string
  source: "chat_tool" | "smtp_test"
  smtpUser: string
  to: string
  subject: string
  status: "sent" | "failed"
  error?: string
  createdAt: string
}

type EmailHistoryFilter = "all" | "sent" | "failed" | "smtp_test" | "chat_tool"
const EMAIL_HISTORY_PAGE_SIZE = 12

function AppPasswordHelpModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">
              Gmail App Password help
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Use this if you send mail from a Gmail account.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-5 py-5 text-sm">
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
            Enter your full Gmail address as <span className="font-medium text-foreground">Username</span>.
            Enter the 16-character Google App Password as <span className="font-medium text-foreground">Password</span>.
            Do not use your normal Google account password here.
          </div>

          <div className="flex flex-col gap-3">
            {[
              "Sign in to the Google account you want to send email from.",
              "Open your Google Account settings, then go to Security.",
              "Turn on 2-Step Verification if it is not already enabled. Google will not show App Passwords until this is enabled.",
              "In Security, open App passwords.",
              "When Google asks what app you want, choose Mail if available, or create a custom app name such as Aurelius.",
              "Generate the password and copy the 16-character code Google shows.",
              "On this page, paste your full Gmail address into Username.",
              "Paste the 16-character App Password into Password.",
              "Click Save credentials, then enable the Email tool once the server SMTP setup is also configured.",
            ].map((step, index) => (
              <div key={step} className="flex gap-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {index + 1}
                </div>
                <p className="pt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  {step}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
            If App passwords does not appear in your Google Security settings,
            the account usually needs 2-Step Verification enabled first, or the
            account is restricted by an organization.
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ToolsPage() {
  const router = useRouter()
  const { settings, save } = useSettings()
  const { user } = useAuth()
  const { catalog, byId } = useToolCatalog()
  const { catalog: modelCatalog, loading: modelCatalogLoading } = useModelCatalog()
  const [helpOpen, setHelpOpen] = useState(false)

  const [smtpForm, setSmtpForm] = useState({
    user: settings.smtpUser ?? "",
    pass: settings.smtpPass ?? "",
  })
  const [smtpSaving, setSmtpSaving] = useState(false)
  const [smtpMessage, setSmtpMessage] = useState("")
  const [smtpTesting, setSmtpTesting] = useState(false)
  const [smtpTestMessage, setSmtpTestMessage] = useState("")
  const [smtpTestError, setSmtpTestError] = useState("")
  const [smtpTestCode, setSmtpTestCode] = useState<RecoveryCode | undefined>()
  const [emailHistory, setEmailHistory] = useState<EmailHistoryEntry[]>([])
  const [emailHistoryLoading, setEmailHistoryLoading] = useState(true)
  const [emailHistoryFilter, setEmailHistoryFilter] =
    useState<EmailHistoryFilter>("all")
  const [emailHistoryLimit, setEmailHistoryLimit] =
    useState(EMAIL_HISTORY_PAGE_SIZE)

  // Only trust values that have actually been persisted to the server.
  // Checking smtpForm.user/pass here would let a user enable the email tool
  // with credentials that haven't been saved yet, causing runtime failures.
  const smtpConfigured = Boolean(settings.smtpUser && settings.smtpPass)

  useEffect(() => {
    setSmtpForm({
      user: settings.smtpUser ?? "",
      pass: settings.smtpPass ?? "",
    })
  }, [settings.smtpUser, settings.smtpPass])

  // Optimistic override — non-null only while a save is in flight
  const [optimistic, setOptimistic] = useState<string[] | null>(null)
  const [savingTool, setSavingTool] = useState<ToolId | null>(null)
  const [lastSaved, setLastSaved] = useState<ToolId | null>(null)
  const [error, setError] = useState("")

  // Source of truth is settings.enabledTools from context.
  // During a save we show the optimistic value so the UI feels instant.
  const enabledTools = optimistic ?? settings.enabledTools ?? []
  const enabledCount = enabledTools.length
  const setupGuidance = catalog.filter((tool) => !tool.available && tool.envVar)
  const filteredEmailHistory = emailHistory.filter((entry) => {
    if (emailHistoryFilter === "all") return true
    if (emailHistoryFilter === "sent" || emailHistoryFilter === "failed") {
      return entry.status === emailHistoryFilter
    }
    return entry.source === emailHistoryFilter
  })
  const smtpRecoverySteps = smtpTestError
    ? buildRecoveryGuidance(smtpTestError, smtpTestCode)
    : []

  const loadEmailHistory = async () => {
    setEmailHistoryLoading(true)
    try {
      const res = await fetch(`/api/email/history?limit=${emailHistoryLimit}`)
      const data = await res.json().catch(() => ({ history: [] }))
      setEmailHistory(Array.isArray(data?.history) ? data.history : [])
    } catch (err) {
      console.warn("[tools/email-history] failed:", err)
      setEmailHistory([])
    } finally {
      setEmailHistoryLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const res = await fetch(`/api/email/history?limit=${emailHistoryLimit}`)
        const data = await res.json().catch(() => ({ history: [] }))
        if (cancelled) return
        setEmailHistory(Array.isArray(data?.history) ? data.history : [])
      } catch (err) {
        console.warn("[tools/email-history] failed:", err)
        if (!cancelled) setEmailHistory([])
      } finally {
        if (!cancelled) setEmailHistoryLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [emailHistoryLimit])

  const toggleTool = async (id: ToolId) => {
    if (
      id === "productivity_agent" &&
      !smtpConfigured &&
      !enabledTools.includes(id)
    ) {
      setError("Enter SMTP credentials before enabling the email tool.")
      return
    }
    if (!byId[id]?.available) return

    const next = enabledTools.includes(id)
      ? enabledTools.filter((t) => t !== id)
      : [...enabledTools, id]

    setOptimistic(next) // instant UI feedback
    setSavingTool(id)
    setError("")

    // Only pass the field that changed — let SettingsContext merge on top
    // of the latest state. Spreading `settings` here caused stale overwrites.
    try {
      await save({ enabledTools: next })
      setOptimistic(null) // hand back to context (now has the saved value)
      setSavingTool(null)
      setLastSaved(id)
      setTimeout(() => setLastSaved(null), 1500)
    } catch (err) {
      setOptimistic(null)
      setSavingTool(null)
      setError(
        err instanceof Error ? err.message : "Failed to save tool settings"
      )
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>

        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Tools
            {enabledCount > 0 && (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary">
                {enabledCount} active
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Toggle tools on or off — changes save automatically
          </p>
        </div>

        {setupGuidance.length > 0 && (
          <div className="rounded-xl border border-border bg-destructive/10 px-4 py-3 text-[11px] text-destructive">
            {setupGuidance.map((tool) => (
              <p key={tool.id}>
                {tool.label} requires <code>{tool.envVar}</code> to be set on
                the server before it can be enabled ({tool.note}).
              </p>
            ))}
          </div>
        )}

        {/* Info banner */}
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            All tools are{" "}
            <span className="font-medium text-foreground">off by default</span>.
            Enable only the capabilities that are actually available in this
            deployment. Your selection is saved automatically and applies to all
            chats.
          </p>
        </div>

        {/* Tool list */}
        <div className="flex flex-col gap-2">
          {catalog.map((meta) => {
            const id = meta.id
            const enabled = enabledTools.includes(id)
            const saving = savingTool === id
            const saved = lastSaved === id
            const unavailable = !meta.available

            return (
              <button
                key={id}
                onClick={() => toggleTool(id)}
                disabled={savingTool !== null || unavailable}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                  enabled
                    ? "border-primary/40 bg-primary/8 shadow-sm"
                    : "border-border bg-background hover:bg-muted/30",
                  savingTool !== null && savingTool !== id && "opacity-60",
                  unavailable && "cursor-not-allowed opacity-55"
                )}
              >
                <span className="text-xl leading-none">{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      enabled ? "text-primary" : "text-foreground"
                    )}
                  >
                    {meta.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {meta.description}
                  </p>
                  {meta.note && (
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground/80">
                      {meta.note}
                    </p>
                  )}
                </div>

                {/* Status pill */}
                <div
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all",
                    unavailable
                      ? "bg-muted text-muted-foreground"
                      : saved
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : enabled
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                  )}
                >
                  {unavailable ? null : saving ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : saved ? (
                    <Check className="size-3" />
                  ) : (
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        enabled ? "bg-primary" : "bg-muted-foreground/40"
                      )}
                    />
                  )}
                  {unavailable
                    ? meta.availabilityLabel
                    : saving
                      ? "Saving…"
                      : saved
                        ? "Saved"
                        : enabled
                          ? "On"
                          : "Off"}
                </div>
              </button>
            )
          })}
        </div>

        <section className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Email login</p>
            <span className="text-[10px] text-muted-foreground">
              Per-user SMTP auth
            </span>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            The app uses its configured SMTP server. In this section you only
            save your own mailbox login details.
          </p>
          {user?.email && (
            <div className="mb-3 rounded-lg border border-border bg-background/70 px-3 py-2">
              <p className="text-[11px] font-medium text-foreground">
                Test destination
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                The verification test sends to <span className="font-medium text-foreground">{user.email}</span> so you can confirm the full setup without emailing someone else.
              </p>
            </div>
          )}
          <div className="mb-3 flex flex-col gap-2">
            <div className="rounded-lg border border-border bg-background/70 px-3 py-2">
              <p className="text-[11px] font-medium text-foreground">
                Username
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                Enter the full email address you want to send from.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background/70 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium text-foreground">
                    Password
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    Enter the mailbox SMTP password. For Gmail, use an App Password.
                  </p>
                </div>
                <button
                  onClick={() => setHelpOpen(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[10px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <CircleHelp className="size-3.5" />
                  Gmail help
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2">
              <p className="text-[11px] font-medium text-foreground">
                Separate server setup
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                Saving your mailbox credentials here does not set up the app
                server. The deployment still needs
                <code className="mx-1">SMTP_HOST</code>
                and related SMTP env vars before the Email tool can be enabled.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] text-muted-foreground">
              Username
              <input
                value={smtpForm.user}
                onChange={(e) =>
                  setSmtpForm((prev) => ({ ...prev, user: e.target.value }))
                }
                className="mt-1 block w-full rounded-lg border border-border px-2 py-1 text-sm"
              />
            </label>
            <label className="text-[10px] text-muted-foreground">
              Password
              <input
                type="password"
                value={smtpForm.pass}
                onChange={(e) =>
                  setSmtpForm((prev) => ({ ...prev, pass: e.target.value }))
                }
                className="mt-1 block w-full rounded-lg border border-border px-2 py-1 text-sm"
              />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={async () => {
                setSmtpSaving(true)
                setSmtpTestMessage("")
                setSmtpTestError("")
                try {
                  await save({
                    smtpUser: smtpForm.user,
                    smtpPass: smtpForm.pass,
                  })
                  setSmtpMessage("Saved")
                } catch {
                  setSmtpMessage("Failed to save email credentials")
                } finally {
                  setSmtpSaving(false)
                  setTimeout(() => setSmtpMessage(""), 3000)
                }
              }}
              disabled={smtpSaving}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {smtpSaving ? "Saving..." : "Save credentials"}
            </button>
            <button
              onClick={async () => {
                setSmtpTesting(true)
                setSmtpMessage("")
                setSmtpTestMessage("")
                setSmtpTestError("")
                setSmtpTestCode(undefined)
                try {
                  const res = await fetch("/api/settings/smtp/test", {
                    method: "POST",
                  })
                  const data = await res.json().catch(() => ({}))
                  if (!res.ok) {
                    setSmtpTestCode(
                      typeof data?.code === "string"
                        ? (data.code as RecoveryCode)
                        : undefined
                    )
                    setSmtpTestError(
                      typeof data?.error === "string"
                        ? data.error
                        : "Failed to test email setup"
                    )
                    return
                  }
                  setSmtpTestMessage(
                    typeof data?.message === "string"
                      ? data.message
                      : "Test email sent"
                  )
                  await loadEmailHistory()
                } catch {
                  setSmtpTestError("Failed to test email setup")
                } finally {
                  setSmtpTesting(false)
                }
              }}
              disabled={smtpTesting || smtpSaving || !smtpConfigured}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {smtpTesting ? "Testing..." : "Send test email"}
            </button>
            {smtpMessage && (
              <span className="text-[11px] text-muted-foreground">
                {smtpMessage}
              </span>
            )}
          </div>
          {smtpTestMessage && (
            <p className="mt-2 text-[11px] text-green-600 dark:text-green-400">
              {smtpTestMessage}
            </p>
          )}
          {smtpTestError && (
            <div className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
              <p className="text-[11px] text-destructive">{smtpTestError}</p>
              {smtpRecoverySteps.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive/80">
                    Next steps
                  </p>
                  {smtpRecoverySteps.map((step) => (
                    <p
                      key={step}
                      className="text-[10px] leading-relaxed text-muted-foreground"
                    >
                      - {step}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          {!smtpConfigured && (
            <p className="mt-2 text-[11px] text-destructive">
              Email tool stays disabled until username and password are saved.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Models</p>
            <span className="text-[10px] text-muted-foreground">
              Runtime availability
            </span>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            The picker only tells you what model is selected. This section tells you what the deployment can actually use, and when the app will switch automatically.
          </p>
          <div className="flex flex-col gap-2">
            {modelCatalog.map((model) => (
              <div
                key={model.id}
                className="rounded-xl border border-border bg-background/70 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {model.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {model.sublabel}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-[10px] font-semibold",
                      model.available
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {model.availabilityLabel}
                  </span>
                </div>
                {model.note && (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {model.note}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            {modelCatalogLoading
              ? "Checking model availability…"
              : "If Groq returns a rate-limit error during chat, Aurelius retries that request with Qwen automatically."}
          </p>
        </section>

        <section className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">
              Recent email activity
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                Server delivery log
              </span>
              <button
                onClick={() => void loadEmailHistory()}
                disabled={emailHistoryLoading}
                className="rounded-lg border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            This log records actual SMTP send attempts from the chat email tool and the setup test action.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              ["all", "All"],
              ["sent", "Sent"],
              ["failed", "Failed"],
              ["smtp_test", "SMTP test"],
              ["chat_tool", "Chat tool"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() =>
                  setEmailHistoryFilter(value as EmailHistoryFilter)
                }
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
                  emailHistoryFilter === value
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {emailHistoryLoading ? (
            <p className="text-[11px] text-muted-foreground">
              Loading email activity…
            </p>
          ) : filteredEmailHistory.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No email activity matches this filter.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredEmailHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-border bg-background/70 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {entry.subject}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        To {entry.to} via {entry.smtpUser}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[10px] font-semibold",
                        entry.status === "sent"
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : "bg-destructive/10 text-destructive"
                      )}
                    >
                      {entry.status === "sent" ? "Sent" : "Failed"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-1">
                      {entry.source === "smtp_test" ? "SMTP test" : "Chat tool"}
                    </span>
                    <span>
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(entry.createdAt))}
                    </span>
                    {entry.sessionId && (
                      <button
                        onClick={() => router.push(`/chat/${entry.sessionId}`)}
                        className="rounded-full border border-border bg-background px-2 py-1 font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        Open chat
                      </button>
                    )}
                  </div>
                  {entry.error && (
                    <p className="mt-2 text-[11px] leading-relaxed text-destructive">
                      {entry.error}
                    </p>
                  )}
                </div>
              ))}
              {emailHistory.length >= emailHistoryLimit && emailHistoryLimit < 50 && (
                <button
                  onClick={() =>
                    setEmailHistoryLimit((prev) =>
                      Math.min(prev + EMAIL_HISTORY_PAGE_SIZE, 50)
                    )
                  }
                  disabled={emailHistoryLoading}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {emailHistoryLoading ? "Loading…" : "Load more"}
                </button>
              )}
            </div>
          )}
        </section>

        {error && (
          <p className="text-center text-[11px] text-destructive">{error}</p>
        )}

        {enabledCount === 0 && (
          <p className="text-center text-[11px] text-muted-foreground/50">
            No tools active — Aurelius will answer from its own knowledge only.
          </p>
        )}
      </div>
      <AppPasswordHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

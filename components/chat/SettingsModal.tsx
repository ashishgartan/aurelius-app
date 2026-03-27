// components/chat/SettingsModal.tsx
"use client"

import { useState, useEffect } from "react"
import {
  X,
  RotateCcw,
  Check,
  Loader2,
  Settings2,
  Wrench,
  SlidersHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSettings } from "@/context/SettingsContext"
import { useToolCatalog } from "@/hooks/useToolCatalog"
import type { ResponseLength, ResponseTone } from "@/types/auth"
import { ALL_TOOLS, TOOL_META } from "@/types/auth"
import type { ToolId } from "@/types/auth"

const LANGUAGES = [
  "English",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Arabic",
  "Japanese",
  "Chinese",
  "Korean",
]

const LENGTH_OPTIONS: { value: ResponseLength; label: string; desc: string }[] =
  [
    { value: "concise", label: "Concise", desc: "Short, direct answers" },
    { value: "balanced", label: "Balanced", desc: "Detail where it matters" },
    { value: "detailed", label: "Detailed", desc: "Thorough explanations" },
  ]

const TONE_OPTIONS: { value: ResponseTone; label: string; desc: string }[] = [
  { value: "professional", label: "Professional", desc: "Clear and formal" },
  { value: "casual", label: "Casual", desc: "Friendly and relaxed" },
  { value: "technical", label: "Technical", desc: "Precise, expert-level" },
]

type Tab = "preferences" | "tools"

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { settings, saving, save, reset } = useSettings()
  const { byId } = useToolCatalog()

  const [tab, setTab] = useState<Tab>("preferences")
  const [draft, setDraft] = useState(settings)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(settings)
      setSaved(false)
      setTab("preferences")
    }
  }, [open, settings])

  if (!open) return null

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings)

  const handleSave = async () => {
    try {
      await save(draft)
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        onClose()
      }, 800)
    } catch (err) {
      console.error(err)
      // the save function already handles the rollback
    }
  }

  const handleReset = async () => {
    await reset()
    setSaved(false)
  }

  const toggleTool = (id: ToolId) => {
    setDraft((d) => {
      const current = d.enabledTools ?? []
      const next = current.includes(id)
        ? current.filter((t) => t !== id)
        : [...current, id]
      return { ...d, enabledTools: next }
    })
  }

  const enabledCount = draft.enabledTools?.length ?? 0

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted">
            <Settings2 className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">
              AI Settings
            </h2>
            <p className="text-xs text-muted-foreground">
              Customise how Aurelius responds
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border px-5 pt-3">
          <TabButton
            active={tab === "preferences"}
            onClick={() => setTab("preferences")}
            icon={<SlidersHorizontal className="size-3.5" />}
            label="Preferences"
          />
          <TabButton
            active={tab === "tools"}
            onClick={() => setTab("tools")}
            icon={<Wrench className="size-3.5" />}
            label="Tools"
            badge={enabledCount > 0 ? `${enabledCount} active` : undefined}
          />
        </div>

        {/* Body */}
        <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto px-5 py-5">
          {tab === "preferences" && (
            <>
              <Section
                title="Custom Instructions"
                desc="Tell Aurelius how to behave across all your chats."
              >
                <textarea
                  value={draft.instructions}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, instructions: e.target.value }))
                  }
                  placeholder="e.g. Always explain your reasoning step by step."
                  maxLength={2000}
                  rows={4}
                  className={cn(
                    "w-full resize-none rounded-xl border border-border bg-muted/30 px-3 py-2.5",
                    "text-sm text-foreground placeholder:text-muted-foreground/40",
                    "leading-relaxed transition-all outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                  )}
                />
                <p className="text-right text-[10px] text-muted-foreground/40">
                  {draft.instructions.length} / 2000
                </p>
              </Section>

              <Section
                title="Memory"
                desc="Stable preferences and facts Aurelius should remember until you change them."
              >
                <textarea
                  value={draft.memory}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, memory: e.target.value }))
                  }
                  placeholder="e.g. I prefer bullet points, my default sign-off is 'Ashish', and I usually work in IST."
                  maxLength={1000}
                  rows={3}
                  className={cn(
                    "w-full resize-none rounded-xl border border-border bg-muted/30 px-3 py-2.5",
                    "text-sm text-foreground placeholder:text-muted-foreground/40",
                    "leading-relaxed transition-all outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                  )}
                />
                <p className="text-right text-[10px] text-muted-foreground/40">
                  {draft.memory.length} / 1000
                </p>
              </Section>

              <Section
                title="Response Length"
                desc="How much detail should responses include?"
              >
                <div className="grid grid-cols-3 gap-2">
                  {LENGTH_OPTIONS.map((opt) => (
                    <OptionCard
                      key={opt.value}
                      label={opt.label}
                      desc={opt.desc}
                      active={draft.length === opt.value}
                      onClick={() =>
                        setDraft((d) => ({ ...d, length: opt.value }))
                      }
                    />
                  ))}
                </div>
              </Section>

              <Section title="Tone" desc="What style should Aurelius use?">
                <div className="grid grid-cols-3 gap-2">
                  {TONE_OPTIONS.map((opt) => (
                    <OptionCard
                      key={opt.value}
                      label={opt.label}
                      desc={opt.desc}
                      active={draft.tone === opt.value}
                      onClick={() =>
                        setDraft((d) => ({ ...d, tone: opt.value }))
                      }
                    />
                  ))}
                </div>
              </Section>

              <Section
                title="Response Language"
                desc="Aurelius will always reply in this language."
              >
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      onClick={() =>
                        setDraft((d) => ({ ...d, language: lang }))
                      }
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                        draft.language === lang
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-border/80 hover:bg-muted/40 hover:text-foreground"
                      )}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </Section>
            </>
          )}

          {tab === "tools" && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                <p className="text-xs font-semibold text-foreground">
                  Plug &amp; Play Tools
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  All tools are{" "}
                  <span className="font-medium text-foreground">
                    off by default
                  </span>
                  . Activate only what you need — Aurelius will only use enabled
                  tools.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {ALL_TOOLS.map((id) => {
                  const meta = byId[id] ?? {
                    id,
                    ...TOOL_META[id],
                    available: true,
                    availabilityLabel: "Built-in",
                  }
                  const enabled = (draft.enabledTools ?? []).includes(id)
                  const unavailable = !meta.available
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        if (unavailable) return
                        toggleTool(id)
                      }}
                      disabled={unavailable}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                        enabled
                          ? "border-primary/40 bg-primary/8 shadow-sm"
                          : "border-border bg-background hover:bg-muted/30",
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
                      <div
                        className={cn(
                          "flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all",
                          unavailable
                            ? "bg-muted text-muted-foreground"
                            : enabled
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            enabled ? "bg-primary" : "bg-muted-foreground/40"
                          )}
                        />
                        {unavailable ? meta.availabilityLabel : enabled ? "On" : "Off"}
                      </div>
                    </button>
                  )
                })}
              </div>

              {enabledCount === 0 && (
                <p className="pt-1 text-center text-[11px] text-muted-foreground/50">
                  No tools active — Aurelius will answer from its own knowledge
                  only.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="size-3" />
            Reset to defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium transition-all",
                saved
                  ? "bg-green-500/10 text-green-500"
                  : "bg-primary text-primary-foreground hover:opacity-90",
                (saving || !isDirty) && "pointer-events-none opacity-50"
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Saving…
                </>
              ) : saved ? (
                <>
                  <Check className="size-3" />
                  Saved!
                </>
              ) : (
                "Save changes"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "-mb-px flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-medium transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
      {badge && (
        <span className="rounded-full bg-primary/15 px-1.5 py-px text-[9px] font-semibold text-primary">
          {badge}
        </span>
      )}
    </button>
  )
}

function Section({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground/70">{desc}</p>
      </div>
      {children}
    </div>
  )
}

function OptionCard({
  label,
  desc,
  active,
  onClick,
}: {
  label: string
  desc: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col gap-0.5 rounded-xl border p-3 text-left transition-all",
        active
          ? "border-primary/40 bg-primary/8 text-foreground"
          : "border-border bg-background text-muted-foreground hover:border-border/80 hover:bg-muted/30"
      )}
    >
      <span className={cn("text-xs font-semibold", active && "text-primary")}>
        {label}
      </span>
      <span className="text-[10px] leading-snug">{desc}</span>
    </button>
  )
}

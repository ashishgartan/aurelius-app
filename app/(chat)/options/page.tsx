// app/(chat)/options/page.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Loader2, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSettings } from "@/context/SettingsContext"
import { DEFAULT_SETTINGS } from "@/types/auth"
import type { ResponseLength, ResponseTone } from "@/types/auth"

const LANGUAGES = [
  "English", "Hindi", "Spanish", "French", "German",
  "Portuguese", "Arabic", "Japanese", "Chinese", "Korean",
]

const LENGTH_OPTIONS: { value: ResponseLength; label: string; desc: string }[] = [
  { value: "concise",  label: "Concise",  desc: "Short, direct answers" },
  { value: "balanced", label: "Balanced", desc: "Detail where it matters" },
  { value: "detailed", label: "Detailed", desc: "Thorough explanations" },
]

const TONE_OPTIONS: { value: ResponseTone; label: string; desc: string }[] = [
  { value: "professional", label: "Professional", desc: "Clear and formal" },
  { value: "casual",       label: "Casual",       desc: "Friendly and relaxed" },
  { value: "technical",    label: "Technical",    desc: "Precise, expert-level" },
]

function SectionCard({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-6">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {desc && (
          <p className="mt-0.5 text-xs text-muted-foreground/70">{desc}</p>
        )}
      </div>
      {children}
    </div>
  )
}

export default function OptionsPage() {
  const router = useRouter()
  const { settings, saving, save, reset } = useSettings()

  const [draft, setDraft] = useState(settings)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const userEdited = useRef(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!userEdited.current) setDraft(settings)
  }, [settings])

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings)

  const handleSave = async () => {
    setError("")
    try {
      await save(draft)
      userEdited.current = false
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings")
      setSaved(false)
    }
  }

  const patchDraft = (patch: Partial<typeof draft>) => {
    userEdited.current = true
    setDraft((d) => ({ ...d, ...patch }))
  }

  const handleReset = async () => {
    setError("")
    try {
      await reset()
      userEdited.current = false
      setDraft(DEFAULT_SETTINGS)
      setSaved(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset settings")
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
          <h1 className="text-xl font-semibold text-foreground">AI Settings</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Customise how Aurelius responds to you
          </p>
        </div>

        <SectionCard
          title="Custom Instructions"
          desc="Tell Aurelius how to behave across all your chats."
        >
          <textarea
            value={draft.instructions}
            onChange={(e) => patchDraft({ instructions: e.target.value })}
            placeholder="e.g. Always explain your reasoning step by step."
            maxLength={2000}
            rows={4}
            className={cn(
              "w-full resize-none rounded-xl border border-border bg-muted/30 px-3 py-2.5",
              "text-sm text-foreground placeholder:text-muted-foreground/40",
              "leading-relaxed outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            )}
          />
          <p className="mt-1 text-right text-[10px] text-muted-foreground/40">
            {draft.instructions.length} / 2000
          </p>
        </SectionCard>

        <SectionCard
          title="Response Length"
          desc="How much detail should responses include?"
        >
          <div className="grid grid-cols-3 gap-2">
            {LENGTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => patchDraft({ length: opt.value })}
                className={cn(
                  "flex flex-col gap-0.5 rounded-xl border p-3 text-left transition-all",
                  draft.length === opt.value
                    ? "border-primary/40 bg-primary/8 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-border/80 hover:bg-muted/30"
                )}
              >
                <span
                  className={cn(
                    "text-xs font-semibold",
                    draft.length === opt.value && "text-primary"
                  )}
                >
                  {opt.label}
                </span>
                <span className="text-[10px] leading-snug">{opt.desc}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Tone" desc="What style should Aurelius use?">
          <div className="grid grid-cols-3 gap-2">
            {TONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => patchDraft({ tone: opt.value })}
                className={cn(
                  "flex flex-col gap-0.5 rounded-xl border p-3 text-left transition-all",
                  draft.tone === opt.value
                    ? "border-primary/40 bg-primary/8 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-border/80 hover:bg-muted/30"
                )}
              >
                <span
                  className={cn(
                    "text-xs font-semibold",
                    draft.tone === opt.value && "text-primary"
                  )}
                >
                  {opt.label}
                </span>
                <span className="text-[10px] leading-snug">{opt.desc}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Response Language"
          desc="Aurelius will always reply in this language."
        >
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => patchDraft({ language: lang })}
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
        </SectionCard>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="size-3" />
            Reset to defaults
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-5 py-2 text-xs font-medium transition-all",
              saved
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
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
                Saved
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

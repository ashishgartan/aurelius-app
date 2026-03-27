"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Brain, Check, Loader2, Pin, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

type MemoryCategory = "profile" | "preference" | "interest" | "working"

interface MemoryRecord {
  id: string
  category: MemoryCategory
  key: string
  value: string
  confidence: number
  pinned: boolean
  evidenceCount: number
  status: string
  sensitivity: string
  sourceKind: string
  sourceExcerpt?: string
  updatedAt: string
}

const CATEGORY_META: Array<{
  category: MemoryCategory
  title: string
  desc: string
}> = [
  { category: "profile", title: "Profile", desc: "Stable identity details like your name, role, or timezone." },
  { category: "preference", title: "Preferences", desc: "How you want Aurelius to behave across chats." },
  { category: "interest", title: "Interests", desc: "Topics you repeatedly engage with." },
  { category: "working", title: "Working Context", desc: "Temporary ongoing context worth carrying for a while." },
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
        {desc ? <p className="mt-0.5 text-xs text-muted-foreground/70">{desc}</p> : null}
      </div>
      {children}
    </div>
  )
}

function MemoryRow({
  memory,
  saving,
  onSave,
  onDelete,
}: {
  memory: MemoryRecord
  saving: boolean
  onSave: (memoryId: string, patch: Partial<Pick<MemoryRecord, "value" | "pinned" | "category">>) => Promise<void>
  onDelete: (memoryId: string) => Promise<void>
}) {
  const [value, setValue] = useState(memory.value)
  const [saved, setSaved] = useState(false)

  const dirty = value.trim() !== memory.value

  async function handleSave() {
    await onSave(memory.id, { value: value.trim() })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="rounded-xl border border-border/70 bg-background/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{memory.key}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {memory.sourceKind.replaceAll("_", " ")}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {Math.round(memory.confidence * 100)}% confidence
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {memory.evidenceCount} signals
            </span>
          </div>
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={2}
            className={cn(
              "mt-3 w-full resize-none rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm",
              "text-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            )}
          />
          {memory.sourceExcerpt ? (
            <p className="mt-2 text-[11px] text-muted-foreground/70">
              Learned from: {memory.sourceExcerpt}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => void onSave(memory.id, { pinned: !memory.pinned })}
            disabled={saving}
            className={cn(
              "rounded-lg p-2 transition-colors hover:bg-muted",
              memory.pinned ? "text-primary" : "text-muted-foreground"
            )}
            title={memory.pinned ? "Unpin memory" : "Pin memory"}
          >
            <Pin className="size-3.5" />
          </button>
          <button
            onClick={() => void onDelete(memory.id)}
            disabled={saving}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            title="Delete memory"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground/60">
          Updated {new Date(memory.updatedAt).toLocaleString()}
        </p>
        <button
          onClick={() => void handleSave()}
          disabled={saving || !dirty || !value.trim()}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
            saved
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-primary text-primary-foreground hover:opacity-90",
            (saving || !dirty || !value.trim()) && "pointer-events-none opacity-50"
          )}
        >
          {saving ? <Loader2 className="size-3 animate-spin" /> : saved ? <Check className="size-3" /> : null}
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  )
}

export default function MemoryPage() {
  const router = useRouter()
  const [memories, setMemories] = useState<MemoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState({
    category: "profile" as MemoryCategory,
    key: "",
    value: "",
    pinned: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function loadMemories() {
    setLoading(true)
    try {
      const res = await fetch("/api/memory", { credentials: "include" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to load memory")
      setMemories(Array.isArray(data.memories) ? data.memories : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memory")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMemories()
  }, [])

  const grouped = useMemo(() => {
    return CATEGORY_META.map((meta) => ({
      ...meta,
      items: memories.filter((memory) => memory.category === meta.category),
    }))
  }, [memories])

  async function saveMemory(
    memoryId: string,
    patch: Partial<Pick<MemoryRecord, "value" | "pinned" | "category">>
  ) {
    setSavingIds((state) => ({ ...state, [memoryId]: true }))
    setError("")
    try {
      const res = await fetch(`/api/memory/${memoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to update memory")
      setMemories((state) =>
        state.map((memory) => (memory.id === memoryId ? data.memory : memory))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update memory")
    } finally {
      setSavingIds((state) => ({ ...state, [memoryId]: false }))
    }
  }

  async function deleteMemory(memoryId: string) {
    setSavingIds((state) => ({ ...state, [memoryId]: true }))
    setError("")
    try {
      const res = await fetch(`/api/memory/${memoryId}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Failed to delete memory")
      setMemories((state) => state.filter((memory) => memory.id !== memoryId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete memory")
    } finally {
      setSavingIds((state) => ({ ...state, [memoryId]: false }))
    }
  }

  async function createMemory() {
    if (!form.key.trim() || !form.value.trim()) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          key: form.key.trim(),
          value: form.value.trim(),
          pinned: form.pinned,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to create memory")
      setMemories((state) => [data.memory, ...state])
      setForm({ category: form.category, key: "", value: "", pinned: false })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create memory")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
        <button
          onClick={() => router.back()}
          className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>

        <div>
          <h1 className="text-xl font-semibold text-foreground">Memory</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Review what Aurelius should retain across chats and correct it when needed.
          </p>
        </div>

        <SectionCard
          title="Add Memory"
          desc="Use this for facts and preferences you want carried across new chats."
        >
          <div className="grid gap-3 md:grid-cols-[160px_1fr_1.4fr_auto]">
            <select
              value={form.category}
              onChange={(event) =>
                setForm((state) => ({ ...state, category: event.target.value as MemoryCategory }))
              }
              className="h-10 rounded-xl border border-border bg-muted/20 px-3 text-sm outline-none focus:border-primary/50"
            >
              {CATEGORY_META.map((item) => (
                <option key={item.category} value={item.category}>
                  {item.title}
                </option>
              ))}
            </select>
            <input
              value={form.key}
              onChange={(event) => setForm((state) => ({ ...state, key: event.target.value }))}
              placeholder="Key, e.g. name or preferred_stack"
              className="h-10 rounded-xl border border-border bg-muted/20 px-3 text-sm outline-none focus:border-primary/50"
            />
            <input
              value={form.value}
              onChange={(event) => setForm((state) => ({ ...state, value: event.target.value }))}
              placeholder="Value to remember"
              className="h-10 rounded-xl border border-border bg-muted/20 px-3 text-sm outline-none focus:border-primary/50"
            />
            <button
              onClick={() => void createMemory()}
              disabled={submitting || !form.key.trim() || !form.value.trim()}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(event) => setForm((state) => ({ ...state, pinned: event.target.checked }))}
              className="size-4 rounded border-border"
            />
            Pin this memory so it is always included
          </label>
        </SectionCard>

        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/40 px-4 py-5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading memory…
          </div>
        ) : (
          grouped.map((group) => (
            <SectionCard key={group.category} title={group.title} desc={group.desc}>
              {group.items.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                  <Brain className="size-4" />
                  No saved items in this category yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {group.items.map((memory) => (
                    <MemoryRow
                      key={`${memory.id}:${memory.updatedAt}`}
                      memory={memory}
                      saving={Boolean(savingIds[memory.id])}
                      onSave={saveMemory}
                      onDelete={deleteMemory}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          ))
        )}
      </div>
    </div>
  )
}

// app/(chat)/dashboard/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  MessageSquare,
  Zap,
  DollarSign,
  Wrench,
  TrendingUp,
  Loader2,
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { UsageSummary, DailyStats } from "@/lib/services/usageLog"

// ── Helpers ────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return String(n)
}

function fmtCost(n: number): string {
  if (n === 0) return "$0.00"
  if (n < 0.001) return "<$0.001"
  return "$" + n.toFixed(4)
}

function shortDate(iso: string, days: number): string {
  const d = new Date(iso)
  if (days === 7) return d.toLocaleDateString("en", { weekday: "short" })
  return d.toLocaleDateString("en", { month: "short", day: "numeric" })
}

function modelLabel(model: string): string {
  if (model === "groq") return "Groq"
  if (model === "qwen") return "Qwen (Local)"
  return model
    .replace("llama-", "Llama ")
    .replace("-versatile", "")
    .replace("-instant", " (fast)")
    .replace(/-/g, " ")
}

// ── Stat card ──────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/40 p-5">
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-xl border",
          color
        )}
      >
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {sub && (
          <p className="mt-0.5 text-[10px] text-muted-foreground/60">{sub}</p>
        )}
      </div>
    </div>
  )
}

// ── Bar chart ──────────────────────────────────────────────────────
function BarChart({
  data,
  days,
  field,
  color,
}: {
  data: DailyStats[]
  days: number
  field: keyof Pick<
    DailyStats,
    "messages" | "inputTokens" | "outputTokens" | "toolCalls" | "cost"
  >
  color: string
}) {
  const values = data.map((d) => Number(d[field]))
  const max = Math.max(...values, 1)

  return (
    <div className="flex h-32 items-end gap-0.5">
      {data.map((d) => {
        const val = Number(d[field])
        const height = Math.round((val / max) * 100)
        return (
          <div
            key={d.date}
            className="group relative flex flex-1 flex-col items-center gap-1"
          >
            {/* Tooltip */}
            <div className="pointer-events-none absolute bottom-full z-10 mb-1.5 hidden rounded-lg border border-border bg-popover px-2 py-1 text-center text-[10px] whitespace-nowrap shadow-lg group-hover:block">
              <p className="font-medium text-foreground">
                {field === "cost" ? fmtCost(val) : fmt(val)}
              </p>
              <p className="text-muted-foreground/70">
                {shortDate(d.date, days)}
              </p>
            </div>
            {/* Bar */}
            <div
              className={cn(
                "min-h-[2px] w-full rounded-sm transition-all",
                color
              )}
              style={{ height: `${Math.max(height, val > 0 ? 4 : 0)}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Chart section ──────────────────────────────────────────────────
function ChartSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <p className="mb-4 text-xs font-semibold text-foreground">{title}</p>
      {children}
    </div>
  )
}

// ── Model breakdown ────────────────────────────────────────────────
function ModelBreakdown({
  data,
}: {
  data: { model: string; messages: number; cost: number }[]
}) {
  if (data.length === 0)
    return (
      <p className="py-4 text-center text-xs text-muted-foreground/50">
        No data yet
      </p>
    )
  const total = data.reduce((s, d) => s + d.messages, 0)
  return (
    <div className="flex flex-col gap-3">
      {data.map((m) => (
        <div key={m.model} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground/80">
              {modelLabel(m.model)}
            </span>
            <span className="text-muted-foreground/60">
              {m.messages} msgs · {fmtCost(m.cost)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/60 transition-all"
              style={{
                width: `${total > 0 ? (m.messages / total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const [days, setDays] = useState<7 | 30>(7)
  const [data, setData] = useState<UsageSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError("")
    fetch(`/api/usage?days=${days}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setError("Failed to load usage data."))
      .finally(() => setLoading(false))
  }, [days])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Usage</h1>
              <p className="text-xs text-muted-foreground">
                Your AI usage and estimated costs
              </p>
            </div>
          </div>

          {/* Range toggle */}
          <div className="flex rounded-xl border border-border bg-muted/30 p-1">
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  days === d
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="size-5 animate-spin text-muted-foreground/40" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">
            {error}
          </div>
        ) : !data ? null : (
          <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={MessageSquare}
              label="Messages"
              value={fmt(data.totals.messages)}
              color="border-primary/20 bg-primary/8 text-primary"
            />
            <StatCard
              icon={Zap}
              label="Tokens used"
              value={fmt(data.totals.inputTokens + data.totals.outputTokens)}
              sub={`${fmt(data.totals.inputTokens)} in · ${fmt(data.totals.outputTokens)} out`}
              color="border-amber-500/20 bg-amber-500/8 text-amber-500"
            />
            <StatCard
              icon={DollarSign}
              label="Est. cost"
              value={fmtCost(data.totals.cost)}
              sub="Based on Groq pricing"
              color="border-green-500/20 bg-green-500/8 text-green-500"
            />
            <StatCard
              icon={Wrench}
              label="Tool calls"
              value={fmt(data.totals.toolCalls)}
              color="border-violet-500/20 bg-violet-500/8 text-violet-500"
            />
          </div>

          {/* Empty state */}
          {data.totals.messages === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted">
                <BarChart3 className="size-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No usage yet
              </p>
              <p className="max-w-xs text-xs text-muted-foreground/60">
                Start chatting and your usage stats will appear here.
              </p>
            </div>
          )}

          {data.totals.messages > 0 && (
            <>
              {/* Charts */}
              <div className="grid gap-3 sm:grid-cols-2">
                <ChartSection title="Messages per day">
                  <BarChart
                    data={data.daily}
                    days={days}
                    field="messages"
                    color="bg-primary/60"
                  />
                  <div className="mt-2 flex justify-between text-[10px] text-muted-foreground/40">
                    <span>{shortDate(data.daily[0].date, days)}</span>
                    <span>
                      {shortDate(data.daily[data.daily.length - 1].date, days)}
                    </span>
                  </div>
                </ChartSection>

                <ChartSection title="Tokens per day">
                  <BarChart
                    data={data.daily}
                    days={days}
                    field="outputTokens"
                    color="bg-amber-500/50"
                  />
                  <div className="mt-2 flex justify-between text-[10px] text-muted-foreground/40">
                    <span>{shortDate(data.daily[0].date, days)}</span>
                    <span>
                      {shortDate(data.daily[data.daily.length - 1].date, days)}
                    </span>
                  </div>
                </ChartSection>

                <ChartSection title="Estimated cost per day ($)">
                  <BarChart
                    data={data.daily}
                    days={days}
                    field="cost"
                    color="bg-green-500/50"
                  />
                  <div className="mt-2 flex justify-between text-[10px] text-muted-foreground/40">
                    <span>{shortDate(data.daily[0].date, days)}</span>
                    <span>
                      {shortDate(data.daily[data.daily.length - 1].date, days)}
                    </span>
                  </div>
                </ChartSection>

                <ChartSection title="Tool calls per day">
                  <BarChart
                    data={data.daily}
                    days={days}
                    field="toolCalls"
                    color="bg-violet-500/50"
                  />
                  <div className="mt-2 flex justify-between text-[10px] text-muted-foreground/40">
                    <span>{shortDate(data.daily[0].date, days)}</span>
                    <span>
                      {shortDate(data.daily[data.daily.length - 1].date, days)}
                    </span>
                  </div>
                </ChartSection>
              </div>

              {/* Model breakdown */}
              <div className="rounded-2xl border border-border bg-card/40 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <TrendingUp className="size-3.5 text-muted-foreground/60" />
                  <p className="text-xs font-semibold text-foreground">
                    Model breakdown
                  </p>
                </div>
                <ModelBreakdown data={data.modelBreakdown} />
              </div>

              <div className="rounded-2xl border border-border bg-card/40 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <MessageSquare className="size-3.5 text-muted-foreground/60" />
                  <p className="text-xs font-semibold text-foreground">
                    Top sessions
                  </p>
                </div>
                {data.sessionBreakdown.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground/50">
                    No session data yet
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.sessionBreakdown.slice(0, 6).map((session) => (
                      <Link
                        key={session.sessionId}
                        href={`/chat/${session.sessionId}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">
                            {session.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60">
                            {session.messages} messages
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                          {fmtCost(session.cost)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Pricing note */}
              <p className="text-center text-[10px] text-muted-foreground/40">
                Cost estimates based on Groq public pricing. Local models (Qwen)
                have no API cost. Actual billing may differ.
              </p>
            </>
          )}
          </>
        )}
      </div>
    </div>
  )
}

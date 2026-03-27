// components/ErrorBoundary.tsx
"use client"

import { Component, type ReactNode, type ErrorInfo } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"

interface Props {
  children: ReactNode
  fallback?: ReactNode // custom fallback — overrides the default UI
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  error: Error | null
  eventId: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, eventId: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, eventId: crypto.randomUUID().slice(0, 8) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console in all envs — swap for Sentry/Datadog here if needed
    console.error("[ErrorBoundary] caught:", error, info.componentStack)
    this.props.onError?.(error, info)
  }

  reset = () => this.setState({ error: null, eventId: null })

  render() {
    if (!this.state.error) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <DefaultErrorFallback
        error={this.state.error}
        eventId={this.state.eventId}
        onReset={this.reset}
      />
    )
  }
}

// ── Default fallback UI ────────────────────────────────────────────
function DefaultErrorFallback({
  error,
  eventId,
  onReset,
}: {
  error: Error
  eventId: string | null
  onReset: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
        <AlertTriangle className="size-5 text-destructive" />
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">
          Something went wrong
        </p>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          An unexpected error occurred in this part of the app. Your
          conversations are safe — try refreshing or clicking retry.
        </p>
      </div>

      {/* Error details — collapsed by default, useful for debugging */}
      <details className="w-full max-w-sm text-left">
        <summary className="cursor-pointer text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground">
          Show error details{" "}
          {eventId && <span className="font-mono">#{eventId}</span>}
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-[10px] leading-relaxed text-muted-foreground">
          {error.message}
          {error.stack &&
            "\n\n" + error.stack.split("\n").slice(1, 5).join("\n")}
        </pre>
      </details>

      <div className="flex items-center gap-2">
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <RotateCcw className="size-3" />
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Reload page
        </button>
      </div>
    </div>
  )
}

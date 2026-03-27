// app/not-found.tsx
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      {/* Grid background */}
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />

      {/* Radial fade mask so grid fades out toward edges */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, var(--background) 100%)",
        }}
      />

      {/* Ambient glow */}
      <div className="glow-blob pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 opacity-40" />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Big 404 */}
        <div className="relative select-none">
          <span
            className="font-display text-[9rem] leading-none font-bold tracking-tighter text-border sm:text-[12rem]"
            aria-hidden
          >
            404
          </span>
          <span className="absolute inset-0 flex items-center justify-center font-display text-[9rem] leading-none font-bold tracking-tighter text-primary opacity-20 blur-2xl sm:text-[12rem]">
            404
          </span>
        </div>

        {/* Icon */}
        <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-muted">
          <svg
            className="size-8 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
            <path d="M11 8v3" />
            <circle cx="11" cy="14.5" r="0.5" fill="currentColor" />
          </svg>
        </div>

        {/* Text */}
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl text-foreground sm:text-3xl">
            Page not found
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved. Let&apos;s get you back on track.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Go home
          </Link>
          <Link
            href="/chat"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Open chat
          </Link>
        </div>

        <p className="text-xs text-muted-foreground/50">
          If you think this is a mistake,{" "}
          <a
            href="mailto:support@aurelius.ai"
            className="underline underline-offset-2 transition-colors hover:text-muted-foreground"
          >
            let us know
          </a>
        </p>
      </div>
    </div>
  )
}

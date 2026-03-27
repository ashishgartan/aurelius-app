// app/(auth)/layout.tsx
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { CurrentYear } from "@/components/CurrentYear"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen bg-background">
      {/* ── Left panel — illustration (lg+ only) ─────────────────── */}
      <div className="auth-panel relative hidden flex-col overflow-hidden lg:flex lg:w-[52%] xl:w-[55%]">
        {/* Dot grid overlay */}
        <div className="auth-panel-dot-grid pointer-events-none absolute inset-0" />

        {/* Ambient orbs */}
        <div className="auth-panel-orb-a auth-orb pointer-events-none absolute -top-20 -right-12 h-72 w-72 rounded-full" />
        <div
          className="auth-panel-orb-b auth-orb pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 rounded-full"
          style={{ animationDirection: "reverse", animationDuration: "16s" }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5 p-7">
          <Link href="/" className="group flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl ring-1"
              style={{
                background:  "var(--auth-panel-surface)",
                outlineColor: "var(--auth-panel-border)",
              }}
            >
              <span
                className="font-display text-sm leading-none font-bold"
                style={{ color: "var(--auth-panel-text)" }}
              >
                A
              </span>
            </div>
            <span
              className="font-display text-lg font-semibold tracking-tight"
              style={{ color: "var(--auth-panel-text)", opacity: 0.88 }}
            >
              Aurelius
            </span>
          </Link>
        </div>

        {/* Centre — illustration + copy */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-10 pb-8">
          <IllustrationScene />

          <div className="mt-9 max-w-xs text-center">
            <h2
              className="font-display text-xl leading-snug font-semibold tracking-tight"
              style={{ color: "var(--auth-panel-text)" }}
            >
              Your AI that actually does things
            </h2>
            <p
              className="mt-3 text-[13px] leading-relaxed"
              style={{ color: "var(--auth-panel-muted)" }}
            >
              Search the web, analyse documents, run calculations — Aurelius
              acts, not just answers.
            </p>
          </div>

          {/* Feature pills */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {["Web search", "Document RAG", "Multi-agent", "Streaming"].map(
              (f) => (
                <span
                  key={f}
                  className="rounded-full px-3 py-1 text-[11px] font-medium"
                  style={{
                    color: "var(--auth-panel-pill-fg)",
                    background: "var(--auth-panel-surface)",
                    border: "1px solid var(--auth-panel-border)",
                  }}
                >
                  {f}
                </span>
              )
            )}
          </div>
        </div>

        {/* Testimonial */}
        <div
          className="relative z-10 mx-6 mb-7 rounded-xl p-4"
          style={{
            background: "var(--auth-panel-surface)",
            border: "1px solid var(--auth-panel-border)",
          }}
        >
          <p
            className="text-[12px] leading-relaxed italic"
            style={{ color: "var(--auth-panel-muted)" }}
          >
            &ldquo;It remembered my last report, searched for new data, and
            drafted the update — all in one message.&rdquo;
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
              style={{
                background: "var(--auth-panel-surface)",
                border: "1px solid var(--auth-panel-border)",
                color: "var(--auth-panel-faint)",
              }}
            >
              S
            </div>
            <div>
              <p
                className="text-[11px] font-medium"
                style={{ color: "var(--auth-panel-muted)" }}
              >
                Sneha R.
              </p>
              <p
                className="text-[10.5px]"
                style={{ color: "var(--auth-panel-faint)" }}
              >
                Product Manager
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ─────────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col">
        {/* Mobile-only background decorations */}
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-40 lg:hidden" />
        <div className="glow-blob pointer-events-none fixed -top-48 -right-48 h-[500px] w-[500px] lg:hidden" />

        {/* Top nav */}
        <nav className="relative z-10 flex items-center justify-between px-6 py-4 lg:justify-end">
          {/* Mobile logo only */}
          <Link href="/" className="group flex items-center gap-2 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <span className="font-display text-sm leading-none font-bold text-primary-foreground">
                A
              </span>
            </div>
            <span className="font-display text-lg text-foreground/80 transition-colors group-hover:text-foreground">
              Aurelius
            </span>
          </Link>
          <ThemeToggle />
        </nav>

        {/* Children (login / signup / forgot-password page) */}
        <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-8">
          <div className="w-full max-w-sm">{children}</div>
        </main>

        <footer className="relative z-10 py-4 text-center text-xs text-muted-foreground/40">
          © <CurrentYear /> Aurelius
        </footer>
      </div>

      {/* Orb drift animation — defined once, used by both orbs */}
      <style>{`
        .auth-orb {
          animation: auth-orb-drift 12s ease-in-out infinite;
        }
        @keyframes auth-orb-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(16px, -12px) scale(1.04); }
          66%       { transform: translate(-8px, 16px) scale(0.97); }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-orb { animation: none; }
        }
      `}</style>
    </div>
  )
}

/* ── Inline SVG illustration — all colors from CSS vars ─────────── */
function IllustrationScene() {
  return (
    <svg
      viewBox="0 0 300 222"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[280px]"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 12px 32px oklch(0 0 0 / 0.35))" }}
    >
      {/* Window */}
      <rect
        x="6"
        y="6"
        width="288"
        height="210"
        rx="13"
        fill="var(--auth-panel-surface)"
        stroke="var(--auth-panel-border)"
        strokeWidth="1"
      />

      {/* Chrome dots */}
      <circle cx="24" cy="23" r="4" fill="var(--auth-panel-border)" />
      <circle cx="37" cy="23" r="4" fill="var(--auth-panel-faint)" />
      <circle
        cx="50"
        cy="23"
        r="4"
        fill="var(--auth-panel-faint)"
        opacity="0.5"
      />
      <line
        x1="6"
        y1="37"
        x2="294"
        y2="37"
        stroke="var(--auth-panel-border)"
        strokeWidth="1"
      />

      {/* Sidebar */}
      <rect
        x="6"
        y="37"
        width="50"
        height="179"
        fill="var(--auth-panel-surface)"
        opacity="0.5"
      />
      <line
        x1="56"
        y1="37"
        x2="56"
        y2="216"
        stroke="var(--auth-panel-border)"
        strokeWidth="1"
      />

      {/* Sidebar nav items */}
      <rect
        x="14"
        y="49"
        width="33"
        height="6"
        rx="3"
        fill="var(--auth-panel-text)"
        opacity="0.22"
      />
      <rect
        x="14"
        y="62"
        width="26"
        height="5"
        rx="2.5"
        fill="var(--auth-panel-border)"
      />
      <rect
        x="14"
        y="74"
        width="30"
        height="5"
        rx="2.5"
        fill="var(--auth-panel-border)"
      />
      <rect
        x="14"
        y="86"
        width="22"
        height="5"
        rx="2.5"
        fill="var(--auth-panel-border)"
      />

      {/* Sidebar avatar */}
      <circle
        cx="31"
        cy="200"
        r="8"
        fill="var(--auth-panel-surface)"
        stroke="var(--auth-panel-border)"
        strokeWidth="1"
      />
      <circle cx="31" cy="197" r="3" fill="var(--auth-panel-muted)" />

      {/* User message bubble */}
      <rect
        x="140"
        y="44"
        width="140"
        height="27"
        rx="9"
        fill="var(--auth-panel-bubble)"
        stroke="var(--auth-panel-bubble-b)"
        strokeWidth="1"
      />
      <rect
        x="150"
        y="52"
        width="74"
        height="4.5"
        rx="2.2"
        fill="var(--auth-panel-text)"
        opacity="0.58"
      />
      <rect
        x="150"
        y="59"
        width="52"
        height="4"
        rx="2"
        fill="var(--auth-panel-text)"
        opacity="0.28"
      />

      {/* Tool-use card */}
      <rect
        x="66"
        y="80"
        width="130"
        height="34"
        rx="7"
        fill="var(--auth-panel-surface)"
        stroke="var(--auth-panel-border)"
        strokeWidth="1"
      />
      <rect
        x="75"
        y="88"
        width="6"
        height="6"
        rx="1.5"
        fill="var(--auth-panel-badge)"
      />
      <rect
        x="86"
        y="89"
        width="48"
        height="4"
        rx="2"
        fill="var(--auth-panel-text)"
        opacity="0.38"
      />
      <rect
        x="86"
        y="96"
        width="70"
        height="3.5"
        rx="1.8"
        fill="var(--auth-panel-muted)"
        opacity="0.40"
      />
      <rect
        x="75"
        y="104"
        width="110"
        height="3.5"
        rx="1.8"
        fill="var(--auth-panel-border)"
      />

      {/* Search result card */}
      <rect
        x="66"
        y="122"
        width="130"
        height="30"
        rx="7"
        fill="var(--auth-panel-surface)"
        stroke="var(--auth-panel-border)"
        strokeWidth="1"
      />
      <rect
        x="75"
        y="130"
        width="6"
        height="6"
        rx="1.5"
        fill="var(--auth-panel-tool)"
      />
      <rect
        x="86"
        y="131"
        width="52"
        height="4"
        rx="2"
        fill="var(--auth-panel-text)"
        opacity="0.30"
      />
      <rect
        x="86"
        y="138"
        width="36"
        height="3.5"
        rx="1.8"
        fill="var(--auth-panel-muted)"
        opacity="0.35"
      />
      <rect
        x="75"
        y="145"
        width="110"
        height="3"
        rx="1.5"
        fill="var(--auth-panel-border)"
      />

      {/* AI response bubble */}
      <rect
        x="66"
        y="160"
        width="158"
        height="36"
        rx="9"
        fill="var(--auth-panel-surface)"
        stroke="var(--auth-panel-border)"
        strokeWidth="1"
      />
      <rect
        x="76"
        y="168"
        width="108"
        height="4.5"
        rx="2.2"
        fill="var(--auth-panel-text)"
        opacity="0.40"
      />
      <rect
        x="76"
        y="176"
        width="84"
        height="4"
        rx="2"
        fill="var(--auth-panel-muted)"
        opacity="0.45"
      />
      <rect
        x="76"
        y="183"
        width="60"
        height="4"
        rx="2"
        fill="var(--auth-panel-muted)"
        opacity="0.25"
      />

      {/* Typing dots */}
      <rect
        x="66"
        y="202"
        width="44"
        height="14"
        rx="7"
        fill="var(--auth-panel-surface)"
        stroke="var(--auth-panel-border)"
        strokeWidth="1"
      />
      <circle cx="78" cy="209" r="2.8" fill="var(--auth-panel-muted)">
        <animate
          attributeName="opacity"
          values="0.4;1;0.4"
          dur="1.2s"
          repeatCount="indefinite"
          begin="0s"
        />
      </circle>
      <circle cx="88" cy="209" r="2.8" fill="var(--auth-panel-muted)">
        <animate
          attributeName="opacity"
          values="0.4;1;0.4"
          dur="1.2s"
          repeatCount="indefinite"
          begin="0.3s"
        />
      </circle>
      <circle cx="98" cy="209" r="2.8" fill="var(--auth-panel-muted)">
        <animate
          attributeName="opacity"
          values="0.4;1;0.4"
          dur="1.2s"
          repeatCount="indefinite"
          begin="0.6s"
        />
      </circle>

      {/* Live badge */}
      <rect
        x="216"
        y="8"
        width="70"
        height="20"
        rx="6"
        fill="var(--auth-panel-bubble)"
        stroke="var(--auth-panel-bubble-b)"
        strokeWidth="1"
      />
      <circle cx="227" cy="18" r="3.2" fill="var(--auth-panel-badge)" />
      <rect
        x="234"
        y="15"
        width="42"
        height="3.2"
        rx="1.6"
        fill="var(--auth-panel-text)"
        opacity="0.44"
      />
      <rect
        x="234"
        y="20"
        width="28"
        height="2.8"
        rx="1.4"
        fill="var(--auth-panel-muted)"
        opacity="0.50"
      />
    </svg>
  )
}

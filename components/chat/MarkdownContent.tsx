// components/chat/MarkdownContent.tsx
"use client"

import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { useState, useEffect } from "react"
import { Play, Check, Copy, Code2 } from "lucide-react"
import { useArtifactStore, isPreviewable, type ArtifactEntry } from "@/hooks/useArtifactStore"
import { darkTheme, lightTheme } from "@/lib/codeThemes"

interface MarkdownContentProps {
  content: string
  isStreaming?: boolean
}

const REMARK_PLUGINS = [remarkGfm]

const MD_COMPONENTS: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? "")
    const lang = match?.[1] ?? ""
    const codeText = String(children).replace(/\n$/, "")
    const isBlock = !!match || codeText.includes("\n")
    if (isBlock) return <CodeBlock lang={lang} code={codeText} />
    return (
      <code
        className="rounded px-[5px] py-[2px] text-[0.82em] text-foreground"
          style={{
            background: "oklch(0.38 0.06 273 / 0.25)",
            border: "1px solid oklch(0.55 0.1 273 / 0.25)",
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          }}
        {...props}
      >
        {children}
      </code>
    )
  },
  pre({ children }) {
    return <>{children}</>
  },

  p({ children }) {
    return <p className="mb-3 leading-relaxed last:mb-0">{children}</p>
  },
  h1({ children }) {
    return (
      <h1 className="mt-5 mb-3 text-xl font-semibold text-foreground first:mt-0">
        {children}
      </h1>
    )
  },
  h2({ children }) {
    return (
      <h2 className="mt-4 mb-2 text-base font-semibold text-foreground first:mt-0">
        {children}
      </h2>
    )
  },
  h3({ children }) {
    return (
      <h3 className="mt-3 mb-2 text-sm font-semibold text-foreground first:mt-0">
        {children}
      </h3>
    )
  },
  ul({ children }) {
    return (
      <ul className="mb-3 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>
    )
  },
  ol({ children }) {
    return (
      <ol className="mb-3 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>
    )
  },
  li({ children }) {
    return <li className="leading-relaxed">{children}</li>
  },
  blockquote({ children }) {
    return (
      <blockquote className="mb-3 border-l-2 border-primary/50 pl-4 text-muted-foreground italic last:mb-0">
        {children}
      </blockquote>
    )
  },
  hr() {
    return <hr className="my-4 border-border" />
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 transition-opacity hover:opacity-80"
      >
        {children}
      </a>
    )
  },
  strong({ children }) {
    return <strong className="font-semibold text-foreground">{children}</strong>
  },
  em({ children }) {
    return <em className="italic">{children}</em>
  },
  table({ children }) {
    return (
      <div className="mb-3 overflow-x-auto rounded-xl border border-border last:mb-0">
        <table className="w-full text-sm">{children}</table>
      </div>
    )
  },
  thead({ children }) {
    return (
      <thead className="border-b border-border bg-muted/50">{children}</thead>
    )
  },
  tbody({ children }) {
    return <tbody className="divide-y divide-border">{children}</tbody>
  },
  tr({ children }) {
    return <tr className="transition-colors hover:bg-muted/30">{children}</tr>
  },
  th({ children }) {
    return (
      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
        {children}
      </th>
    )
  },
  td({ children }) {
    return <td className="px-3 py-2 text-sm text-foreground">{children}</td>
  },
}

export function MarkdownContent({
  content,
  isStreaming,
}: MarkdownContentProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MD_COMPONENTS}>
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="animate-blink ml-0.5 inline-block h-4 w-0.5 bg-current align-middle opacity-70" />
      )}
    </div>
  )
}

// ── Theme detection ────────────────────────────────────────────────
function useDarkMode() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const el = document.documentElement
    const check = () => setDark(el.classList.contains("dark"))
    check()
    const obs = new MutationObserver(check)
    obs.observe(el, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])
  return dark
}

// ── Stable style objects ───────────────────────────────────────────
const CODE_CUSTOM_STYLE: React.CSSProperties = {
  margin: 0,
  padding: "1.1rem 1.25rem",
  background: "transparent",
  fontSize: "0.815rem",
  lineHeight: "1.7",
}

const CODE_TAG_PROPS = {
  style: {
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  },
}

// ── CodeBlock ──────────────────────────────────────────────────────
function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const dark = useDarkMode()
  const [copied, setCopied] = useState(false)
  const { openArtifact } = useArtifactStore()
  const canPreview = isPreviewable(lang)

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Surface colours from CSS vars — consistent with the rest of the theme
  const bg = dark ? "var(--code-bg-dark)" : "var(--code-bg-light)"
  const headerBg = dark
    ? "var(--code-header-bg-dark)"
    : "var(--code-header-bg-light)"
  const divider = dark
    ? "var(--code-divider-dark)"
    : "var(--code-divider-light)"
  const labelClr = dark ? "var(--code-label-dark)" : "var(--code-label-light)"
  const btnIdle = dark
    ? "var(--code-btn-idle-dark)"
    : "var(--code-btn-idle-light)"
  const btnHover = dark
    ? "var(--code-btn-hover-dark)"
    : "var(--code-btn-hover-light)"

  return (
    <div
      className="group relative mb-4 overflow-hidden rounded-xl border last:mb-0"
      style={{
        background: bg,
        borderColor: divider,
        boxShadow: dark
          ? "0 2px 16px rgba(0,0,0,0.35)"
          : "0 1px 6px rgba(0,0,0,0.07)",
      }}
    >
      {/* ── Header bar ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: headerBg, borderBottom: `1px solid ${divider}` }}
      >
        {/* Language tab — modern, sans-serif, uppercase */}
        <span
          className="text-[11px] font-bold tracking-wider uppercase"
          style={{ color: labelClr }}
        >
          {lang ? lang : "Plaintext"}
        </span>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={copy}
            title="Copy code"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all hover:bg-muted/10"
            style={{ color: copied ? "#10b981" : btnIdle }}
            onMouseEnter={(e) => {
              if (!copied)
                (e.currentTarget as HTMLElement).style.color = btnHover
            }}
            onMouseLeave={(e) => {
              if (!copied)
                (e.currentTarget as HTMLElement).style.color = btnIdle
            }}
          >
            {copied ? (
              <>
                <Check className="size-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-3" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Claude-style Artifact Card — only for previewable langs (HTML) ── */}
      {canPreview ? (
        <div
          className="group/card flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/20"
          style={{ background: bg }}
          onClick={() => {
            const entry: ArtifactEntry = {
              filename: `artifact.${lang || "txt"}`,
              lang,
              sizeBytes: new Blob([code]).size,
              sourceCode: code,
            }
            openArtifact(entry)
          }}
        >
          {/* File icon */}
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary transition-colors group-hover/card:border-primary/40 group-hover/card:bg-primary/10">
            <Code2 className="size-4" />
          </div>

          {/* Title & meta */}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">
              Untitled {lang.charAt(0).toUpperCase() + lang.slice(1)} Artifact
            </span>
            <span className="text-[11px] text-muted-foreground/70">
              Click to preview
            </span>
          </div>

          {/* Open button — appears on hover like Claude */}
          <div className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary opacity-0 transition-all group-hover/card:opacity-100">
            <Play className="size-2.5 fill-current" />
            Preview
          </div>
        </div>
      ) : (
        /* ── Syntax-highlighted code for non-runnable ────────────────────────────── */
        <SyntaxHighlighter
          language={lang || "text"}
          useInlineStyles
          customStyle={CODE_CUSTOM_STYLE}
          codeTagProps={CODE_TAG_PROPS}
          style={dark ? darkTheme : lightTheme}
          wrapLongLines={false}
        >
          {code}
        </SyntaxHighlighter>
      )}
    </div>
  )
}

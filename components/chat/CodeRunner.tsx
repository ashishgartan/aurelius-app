// components/chat/CodeRunner.tsx
"use client"

import { useRef, useEffect, useState } from "react"
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react"

interface CodeRunnerProps {
  lang: string
  code: string
  dark?: boolean
}

const RUNNABLE = ["javascript", "js", "html", "css", "typescript", "ts"]
export function isRunnable(lang: string) {
  return RUNNABLE.includes(lang.toLowerCase())
}

export function buildSrcdoc(lang: string, code: string, dark: boolean): string {
  const l = lang.toLowerCase()
  const consoleBg = dark ? "#0e1117" : "#f6f8fa"
  const consoleClr = dark ? "#c9d1d9" : "#24292e"

  const consoleShim = `
(function() {
  var o = { log: console.log, error: console.error, warn: console.warn };
  ['log','error','warn'].forEach(function(m) {
    console[m] = function() {
      var args = Array.from(arguments).map(function(a) {
        try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }
        catch(e) { return '[circular]'; }
      });
      window.parent.postMessage({ type: 'console', level: m, text: args.join(' ') }, '*');
      o[m].apply(console, arguments);
    };
  });
})();`

  const linkInterceptShim = `
document.addEventListener('click', function(e) {
  var el = e.target.closest('a[href]');
  if (!el) return;
  var href = el.getAttribute('href');
  if (!href || href.startsWith('#')) return;
  e.preventDefault();
  e.stopPropagation();
  window.open(href, '_blank', 'noopener,noreferrer');
}, true);`

  if (l === "html") {
    const shim = `<script>(${consoleShim.trim()}); ${linkInterceptShim.trim()}<\/script>`
    return code.includes("</body>")
      ? code.replace(/<\/body>/i, `${shim}</body>`)
      : `${code}${shim}`
  }

  if (l === "css") {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body { margin:0; padding:16px; font-family:system-ui,sans-serif;
         background:${dark ? "#1e1e2e" : "#fff"}; color:${dark ? "#cdd6f4" : "#111"}; }
  ${code}
</style></head><body>
  <h1>Heading 1</h1><h2>Heading 2</h2>
  <p>A paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
  <ul><li>List item one</li><li>List item two</li></ul>
  <button>Button</button> <a href="#">Link</a>
</body></html>`
  }

  // JS / TS
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  * { box-sizing:border-box; }
  body { margin:0; background:${consoleBg}; color:${consoleClr};
         font-family:ui-monospace,"SF Mono","Cascadia Code",monospace;
         font-size:12.5px; line-height:1.65; padding:14px 16px; }
</style></head><body>
<script>
  window.onerror = function(msg,s,line) {
    window.parent.postMessage({ type:'error', text: msg + (line ? ' (line '+line+')' : '') },'*');
    return true;
  };
  ${consoleShim}
  window.parent.postMessage({ type:'ready' },'*');
<\/script>
<script>
try { ${code} }
catch(e) { window.parent.postMessage({ type:'error', text:String(e) },'*'); }
<\/script>
</body></html>`
}

interface LogLine {
  level: "log" | "error" | "warn"
  text: string
}

export function CodeRunner({ lang, code, dark = false }: CodeRunnerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [logs, setLogs] = useState<LogLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [key, setKey] = useState(0)

  const isHtml = ["html", "css"].includes(lang.toLowerCase())

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLogs([])
    setError(null)
    setLoading(true)
    const handler = (e: MessageEvent) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow)
        return
      if (e.data.type === "ready") {
        setLoading(false)
      }
      if (e.data.type === "console") {
        setLoading(false)
        setLogs((p) => [...p, { level: e.data.level, text: e.data.text }])
      }
      if (e.data.type === "error") {
        setLoading(false)
        setError(e.data.text)
      }
    }
    window.addEventListener("message", handler)
    if (isHtml) setTimeout(() => setLoading(false), 300)
    return () => window.removeEventListener("message", handler)
  }, [key, isHtml])

  // Theme-aware colours — all derived from CSS vars
  const runnerBg = dark
    ? "var(--code-runner-bg-dark)"
    : "var(--code-runner-bg-light)"
  const divider = dark
    ? "var(--code-divider-dark)"
    : "var(--code-divider-light)"
  const labelClr = dark ? "var(--code-label-dark)" : "var(--code-label-light)"
  const outputClr = dark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.75)"

  return (
    <div style={{ background: runnerBg, borderTop: `1px solid ${divider}` }}>
      {/* Runner toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: `1px solid ${divider}` }}
      >
        <span
          className="font-mono text-[11px] font-medium tracking-wider uppercase"
          style={{ color: labelClr }}
        >
          {isHtml ? "Preview" : "Output"}
        </span>
        <button
          onClick={() => setKey((k) => k + 1)}
          className="flex items-center gap-1.5 font-mono text-[11px] transition-colors"
          style={{ color: labelClr }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.opacity = "1")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.opacity = "0.6")
          }
        >
          <RefreshCw className="size-3" /> Re-run
        </button>
      </div>

      {/* HTML/CSS preview */}
      {isHtml && (
        <div className="relative" style={{ minHeight: 160 }}>
          {loading && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)",
              }}
            >
              <Loader2
                className="size-4 animate-spin"
                style={{ color: labelClr }}
              />
            </div>
          )}
          <iframe
            key={key}
            ref={iframeRef}
            srcDoc={buildSrcdoc(lang, code, dark)}
            sandbox="allow-scripts"
            className="w-full border-0"
            style={{
              minHeight: 160,
              display: "block",
              background: dark ? "#1e1e2e" : "#fff",
            }}
            onLoad={() => isHtml && setLoading(false)}
            title="Code preview"
          />
        </div>
      )}

      {/* JS console output */}
      {!isHtml && (
        <div
          className="max-h-52 min-h-12 overflow-y-auto px-4 py-3 font-mono text-[12px]"
          style={{ color: outputClr }}
        >
          {loading && logs.length === 0 && !error && (
            <span className="animate-pulse" style={{ color: labelClr }}>
              Running…
            </span>
          )}
          {!loading && logs.length === 0 && !error && (
            <span style={{ color: labelClr }}>No output</span>
          )}
          {logs.map((l, i) => (
            <div
              key={i}
              className="leading-relaxed break-words whitespace-pre-wrap"
              style={{
                color:
                  l.level === "error"
                    ? dark
                      ? "#f38ba8"
                      : "#cf222e"
                    : l.level === "warn"
                      ? dark
                        ? "#f9e2af"
                        : "#b45309"
                      : dark
                        ? "#a6e3a1"
                        : "#116329",
              }}
            >
              {l.text}
            </div>
          ))}
          {error && (
            <div
              className="flex items-start gap-1.5"
              style={{ color: dark ? "#f38ba8" : "#cf222e" }}
            >
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              <span className="break-words whitespace-pre-wrap">{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import { Code2, Download, Eye, FileCode, X } from "lucide-react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { darkTheme, lightTheme } from "@/lib/codeThemes"

interface ArtifactRef {
  artifactId: string
  filename: string
  lang: string
  sizeBytes: number
}

export function SharedArtifactCards({
  token,
  artifacts,
}: {
  token: string
  artifacts: ArtifactRef[]
}) {
  const [previewArtifact, setPreviewArtifact] = useState<ArtifactRef | null>(null)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dark, setDark] = useState<boolean | null>(null)
  const previewRequestRef = useRef(0)

  useEffect(() => {
    const el = document.documentElement
    const check = () => setDark(el.classList.contains("dark"))
    check()
    const obs = new MutationObserver(check)
    obs.observe(el, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])

  const handlePreview = async (artifact: ArtifactRef) => {
    const requestId = previewRequestRef.current + 1
    previewRequestRef.current = requestId
    setPreviewArtifact(artifact)
    setPreviewContent(null)
    setError(null)
    setLoading(true)

    try {
      const metaRes = await fetch(
        `/api/share/${token}/artifacts/${artifact.artifactId}?format=json`
      )
      if (!metaRes.ok) {
        throw new Error(`Failed to load artifact (${metaRes.status})`)
      }

      const { url } = (await metaRes.json()) as { url: string }
      const fileRes = await fetch(url)
      if (!fileRes.ok) {
        throw new Error("Failed to download artifact")
      }

      const text = await fileRes.text()
      if (previewRequestRef.current !== requestId) return
      setPreviewContent(text)
    } catch (err) {
      if (previewRequestRef.current !== requestId) return
      setError(err instanceof Error ? err.message : "Failed to load artifact")
    } finally {
      if (previewRequestRef.current !== requestId) return
      setLoading(false)
    }
  }

  const closePreview = () => {
    previewRequestRef.current += 1
    setPreviewArtifact(null)
    setPreviewContent(null)
    setError(null)
    setLoading(false)
  }

  return (
    <>
      <div className="mb-3 flex flex-col gap-2">
        {artifacts.map((artifact) => (
          <SharedArtifactCard
            key={artifact.artifactId}
            token={token}
            artifact={artifact}
            onPreview={handlePreview}
          />
        ))}
      </div>

      {previewArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-5">
          <div className="flex h-[70dvh] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl sm:h-[64vh] sm:max-w-3xl sm:rounded-2xl">
            <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background shadow-sm px-2.5 py-2 sm:px-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Code2 className="size-3" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-foreground sm:text-sm">
                    {previewArtifact.filename}
                  </div>
                </div>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  {previewArtifact.lang}
                </span>
                <span className="hidden shrink-0 text-[10px] text-muted-foreground/50 sm:inline">
                  {fmtBytes(previewArtifact.sizeBytes)}
                </span>
                <span className="hidden shrink-0 rounded bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground sm:inline-flex">
                  {previewArtifact.lang.toLowerCase() === "html" ? "Preview" : "Code"}
                </span>
              </div>
              <button
                onClick={closePreview}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Close preview"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/20">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  Loading preview…
                </div>
              )}

              {error && !loading && (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-destructive">
                  {error}
                </div>
              )}

              {!loading &&
                !error &&
                previewContent !== null &&
                (previewArtifact.lang.toLowerCase() === "html" ? (
                  <iframe
                    title={`${previewArtifact.filename} preview`}
                    sandbox="allow-scripts allow-forms allow-modals allow-popups"
                    srcDoc={previewContent}
                    className="absolute inset-0 h-full w-full border-0 bg-white"
                  />
                ) : (
                  <div className="absolute inset-0 overflow-auto bg-[#fafafa] dark:bg-[#1e1e2e]">
                    <div className="min-h-full p-4">
                      {dark !== null && (
                        <SyntaxHighlighter
                          language={previewArtifact.lang || "text"}
                          useInlineStyles
                          customStyle={{
                            background: "transparent",
                            margin: 0,
                            padding: 0,
                            fontSize: "0.8rem",
                            lineHeight: "1.7",
                          }}
                          style={dark ? darkTheme : lightTheme}
                          wrapLongLines={false}
                        >
                          {previewContent}
                        </SyntaxHighlighter>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SharedArtifactCard({
  token,
  artifact,
  onPreview,
}: {
  token: string
  artifact: ArtifactRef
  onPreview: (artifact: ArtifactRef) => void
}) {
  const href = `/api/share/${token}/artifacts/${artifact.artifactId}`

  return (
    <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary">
          <FileCode className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {artifact.filename}
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase">
              {artifact.lang}
            </span>
            <span className="text-[11px] text-muted-foreground/60">
              {fmtBytes(artifact.sizeBytes)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3 sm:justify-end">
        <button
          onClick={() => onPreview(artifact)}
          className="flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted sm:flex-none"
        >
          <Eye className="size-3.5" />
          Preview
        </button>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-9 flex-1 items-center justify-center rounded-lg border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted sm:flex-none"
        >
          Open
        </a>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Download artifact"
        >
          <Download className="size-3.5" />
        </a>
      </div>
    </div>
  )
}

function fmtBytes(n: number) {
  return n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`
}

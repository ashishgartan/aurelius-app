// components/chat/FileUpload.tsx
"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Paperclip, X, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export interface UploadedDoc {
  _id: string
  filename: string
  sizeBytes: number
  chunks: number
}

interface FileUploadProps {
  sessionId: string
  docs: UploadedDoc[]
  onUploaded: (doc: UploadedDoc) => void
  onRemove: (docId: string) => void
  onSummarize?: (doc: UploadedDoc) => void
  disabled?: boolean
}

function fmtBytes(n: number): string {
  if (n < 1024) return n + " B"
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB"
  return (n / (1024 * 1024)).toFixed(1) + " MB"
}

function fileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase()
  const codeExts = [
    "py",
    "js",
    "ts",
    "jsx",
    "tsx",
    "go",
    "rs",
    "java",
    "c",
    "cpp",
    "rb",
    "php",
  ]
  if (ext === "pdf") return "📄"
  if (ext === "docx") return "📝"
  if (ext === "md") return "✍️"
  if (codeExts.includes(ext!)) return "💻"
  return "📃"
}

export function FileUploadButton({
  sessionId,
  docs,
  onUploaded,
  onRemove,
  onSummarize,
  disabled,
}: FileUploadProps) {
  const fileRef    = useRef<HTMLInputElement>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState("")
  const [dragActive, setDragActive] = useState(false)

  // Clear pending error timer on unmount to avoid setState on unmounted component
  useEffect(() => () => { if (errorTimer.current) clearTimeout(errorTimer.current) }, [])

  const handleFile = useCallback(
    async (file: File) => {
      setError("")
      setUploading(true)
      try {
        const form = new FormData()
        form.append("file", file)
        const res = await fetch(`/api/sessions/${sessionId}/documents`, {
          method: "POST",
          body: form,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Upload failed")
        onUploaded(data.document)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed")
        errorTimer.current = setTimeout(() => setError(""), 4000)
      } finally {
        setUploading(false)
        if (fileRef.current) fileRef.current.value = ""
      }
    },
    [sessionId, onUploaded]
  )

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    if (disabled || uploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-xl transition-colors",
        dragActive && "bg-primary/5 ring-1 ring-primary/30"
      )}
      onDragOver={(e) => {
        e.preventDefault()
        if (disabled || uploading) return
        setDragActive(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setDragActive(false)
      }}
      onDrop={handleDrop}
    >
      {/* Document chips */}
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {docs.map((doc) => (
            <div
              key={doc._id}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2 py-1 text-xs"
            >
              <span className="text-sm leading-none">
                {fileIcon(doc.filename)}
              </span>
              <span className="max-w-[140px] truncate font-medium text-foreground/80">
                {doc.filename}
              </span>
              <span className="text-muted-foreground/50">
                {fmtBytes(doc.sizeBytes)}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-muted-foreground/50">
                {doc.chunks} chunks
              </span>
              <button
                onClick={() => onSummarize?.(doc)}
                className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
                title="Summarize document"
              >
                Summarize
              </button>
              <button
                onClick={() => onRemove(doc._id)}
                className="ml-0.5 text-muted-foreground/40 transition-colors hover:text-destructive"
                title="Remove document"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-1.5 px-1 text-[11px] text-destructive">
          <AlertCircle className="size-3 shrink-0" />
          {error}
        </div>
      )}

      {dragActive && (
        <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-[11px] text-primary">
          Drop a document to upload it to this chat
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={disabled || uploading}
        title="Attach document"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          "text-muted-foreground hover:bg-muted hover:text-foreground",
          (disabled || uploading) && "pointer-events-none opacity-50"
        )}
      >
        {uploading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Paperclip className="size-3.5" />
        )}
      </button>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.txt,.md,.py,.js,.ts,.jsx,.tsx,.go,.rs,.java,.c,.cpp,.rb,.php,.swift,.kt,.sql,.sh,.yaml,.yml,.json,.xml,.csv"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}

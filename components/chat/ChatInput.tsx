// components/chat/ChatInput.tsx
"use client"

import { useRef, useEffect } from "react"
import { Send, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { ModelPicker } from "./ModelPicker"
import type { Provider } from "@/types/chat"
import {
  FileUploadButton,
  type UploadedDoc,
} from "@/components/chat/FileUpload"

interface ChatInputProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  streaming: boolean
  provider: Provider
  onProvider: (p: Provider) => void
  disabled?: boolean
  // RAG / file upload
  sessionId?: string
  docs?: UploadedDoc[]
  onDocUploaded?: (doc: UploadedDoc) => void
  onDocRemove?: (docId: string) => void
  onDocSummarize?: (doc: UploadedDoc) => void
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  provider,
  onProvider,
  disabled = false,
  sessionId,
  docs = [],
  onDocUploaded,
  onDocRemove,
  onDocSummarize,
}: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const composingRef = useRef(false)

  // Auto-resize
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 180) + "px"
  }, [value])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !composingRef.current) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="z-10 shrink-0 border-t border-border/40 bg-background/80 px-4 pt-4 pb-6 backdrop-blur-md sm:pb-8">
      <div className="mx-auto max-w-2xl">
        {/* Textarea + send */}
        <div
          className={cn(
            "flex items-end gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5",
            "transition-all focus-within:border-primary/40 focus-within:ring-3 focus-within:ring-primary/10"
          )}
        >
          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKey}
            onCompositionStart={() => {
              composingRef.current = true
            }}
            onCompositionEnd={() => {
              composingRef.current = false
            }}
            disabled={streaming || disabled}
            placeholder="Message Aurelius… (Enter to send)"
            className={cn(
              "flex-1 resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none",
              "placeholder:text-muted-foreground/50 disabled:opacity-60",
              "max-h-[180px] min-h-[22px]"
            )}
          />

          {streaming ? (
            <button
              onClick={onStop}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
              title="Stop"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!value.trim() || disabled}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
              title="Send"
            >
              <Send className="size-3.5" />
            </button>
          )}
        </div>

        {/* Bottom row */}
        <div className="mt-2 flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1">
            <ModelPicker
              value={provider}
              onChange={onProvider}
              disabled={streaming || disabled}
            />
            {sessionId && onDocUploaded && onDocRemove && (
              <FileUploadButton
                sessionId={sessionId}
                docs={docs}
                onUploaded={onDocUploaded}
                onRemove={onDocRemove}
                onSummarize={onDocSummarize}
                disabled={streaming || disabled}
              />
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/50">
            {streaming
              ? `Streaming from ${provider}…`
              : docs.length > 0
                ? `${docs.length} doc${docs.length > 1 ? "s" : ""} attached`
                : "Shift+Enter for newline"}
          </p>
        </div>
      </div>
    </div>
  )
}

// components/chat/MessageSkeleton.tsx
// Shimmer placeholder that mirrors the real MessageRow layout.
// Shown while the session's message history is loading from the API.

import React from "react"
import { cn } from "@/lib/utils"

function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-full bg-muted-foreground/8",
        className
      )}
      style={style}
    />
  )
}

// ── Single skeleton message ─────────────────────────────────────────
function SkeletonMessage({
  isUser,
  lines,
}: {
  isUser: boolean
  lines: number[]
}) {
  if (isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className="flex max-w-[60%] flex-col items-end gap-2">
          <div className="w-full animate-pulse rounded-2xl rounded-tr-sm bg-muted-foreground/8 px-4 py-3">
            {lines.map((w, i) => (
              <Shimmer
                key={i}
                className={cn(
                  "mb-2 h-3 rounded-sm last:mb-0",
                  i === lines.length - 1 ? `w-[${w}%]` : "w-full"
                )}
                style={{ width: `${w}%` } as React.CSSProperties}
              />
            ))}
          </div>
        </div>
        {/* User avatar */}
        <div className="mt-0.5 size-8 shrink-0 animate-pulse rounded-full bg-muted-foreground/10" />
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      {/* AI avatar */}
      <div className="mt-0.5 size-8 shrink-0 animate-pulse rounded-full bg-muted-foreground/10" />

      <div className="flex flex-1 flex-col gap-2">
        {/* Model label */}
        <Shimmer className="h-2.5 w-10" />

        {/* Bubble */}
        <div className="rounded-2xl rounded-tl-sm bg-muted/50 px-4 py-3">
          {lines.map((w, i) => (
            <Shimmer
              key={i}
              className="mb-2.5 h-3 rounded-sm last:mb-0"
              style={{ width: `${w}%` } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Pre-defined skeleton "conversations" ───────────────────────────
// Each entry represents one message with line widths as percentages.
// Vary the widths so it doesn't look like a uniform grid.
const SKELETON_PATTERN = [
  { isUser: true, lines: [80] },
  { isUser: false, lines: [100, 100, 72] },
  { isUser: true, lines: [55] },
  { isUser: false, lines: [100, 88] },
]

export function MessageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      {SKELETON_PATTERN.map((msg, i) => (
        <SkeletonMessage key={i} isUser={msg.isUser} lines={msg.lines} />
      ))}
      <style>{`
        @keyframes shimmer {
          0%   { opacity: 0.5 }
          50%  { opacity: 1   }
          100% { opacity: 0.5 }
        }
      `}</style>
    </div>
  )
}

// components/chat/ModelPicker.tsx
"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { MODELS, type Provider } from "@/types/chat"
import { useModelCatalog } from "@/hooks/useModelCatalog"

interface ModelPickerProps {
  value: Provider
  onChange: (p: Provider) => void
  disabled?: boolean
}

export function ModelPicker({ value, onChange, disabled }: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { catalog } = useModelCatalog()
  const active = MODELS[value]

  // Use `click` (not `mousedown`) for outside-click detection.
  // `mousedown` fires before the option's `onClick`, so it would close the
  // dropdown before the selection is registered — the user's click is lost.
  // `click` fires after, so the option's handler always runs first.
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("click", handleOutsideClick)
    return () => document.removeEventListener("click", handleOutsideClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors",
          "hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
          open && "bg-muted"
        )}
      >
        {/* Use bgColor directly — never derived from color at runtime */}
        <span className={cn("size-1.5 rounded-full", active?.bgColor)} />
        <span className="text-foreground">{active?.label}</span>
        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1.5 w-52 rounded-xl border border-border bg-popover py-1 shadow-xl">
          {catalog.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                if (!model.available) return
                onChange(model.id)
                setOpen(false)
              }}
              disabled={!model.available}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted",
                value === model.id && "bg-muted/60",
                !model.available && "cursor-not-allowed opacity-50"
              )}
            >
              {/* Explicit bgColor — no string manipulation */}
              <span
                className={cn("size-2 shrink-0 rounded-full", model.bgColor)}
              />
              <div className="flex-1 text-left">
                <p className="text-sm leading-none font-medium text-foreground">
                  {model.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {model.available
                    ? model.sublabel
                    : `${model.sublabel} · ${model.availabilityLabel}`}
                </p>
              </div>
              {value === model.id && (
                <Check className="size-3.5 shrink-0 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

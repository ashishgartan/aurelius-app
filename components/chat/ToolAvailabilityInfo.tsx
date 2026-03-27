"use client"

import { useToolCatalog } from "@/hooks/useToolCatalog"
import { useSettings } from "@/context/SettingsContext"

export function ToolAvailabilityInfo() {
  const { catalog, loading } = useToolCatalog()
  const { settings } = useSettings()

  const enabledTools = settings.enabledTools ?? []
  const available = catalog.filter(
    (tool) => enabledTools.includes(tool.id) && tool.available
  )
  const blocked = catalog.filter(
    (tool) => enabledTools.includes(tool.id) && !tool.available
  )
  if (loading || (available.length === 0 && blocked.length === 0)) {
    return null
  }

  return (
    <div className="border-b border-border/70 bg-muted/50 px-4 py-2 text-[11px] text-muted-foreground">
      <div className="flex flex-col gap-1">
        {available.length > 0 && (
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">Tools ready:</span>
            {available.map((tool) => (
              <span
                key={tool.id}
                className="rounded-full border border-border/50 bg-background px-2 py-0.5 text-[10px] font-semibold text-foreground"
              >
                {tool.label}
              </span>
            ))}
          </p>
        )}
        {blocked.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-destructive">
            <span className="font-semibold text-destructive">Unavailable:</span>
            {blocked.map((tool) => (
              <span key={tool.id} className="flex items-center gap-1 rounded-full border border-destructive/50 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold">
                {tool.label}
                <span className="text-destructive/70">{tool.availabilityLabel}</span>
              </span>
            ))}
          </p>
        )}
        {enabledTools.includes("productivity_agent") &&
          !(settings.smtpUser && settings.smtpPass) && (
            <p className="mt-1 text-[10px] text-destructive">
              Email tool disabled until you add your email username and password in Tools settings.
            </p>
          )}
      </div>
      {blocked.some((tool) => tool.note) && (
        <p className="mt-1 text-[10px] text-muted-foreground/70">
          {blocked.map((tool) => tool.note).filter(Boolean).join(" ")}
        </p>
      )}
    </div>
  )
}

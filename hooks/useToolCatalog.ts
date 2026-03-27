"use client"

import { useEffect, useState } from "react"
import { ALL_TOOLS, TOOL_META, type ToolId } from "@/types/auth"
import type { ToolCatalogItem } from "@/lib/tools/catalog"

function fallbackCatalog(): ToolCatalogItem[] {
  return ALL_TOOLS.map((id) => {
    if (id === "research_agent") {
      return {
        id,
        ...TOOL_META[id],
        available: false,
        availabilityLabel: "Checking setup",
        note: "Tool availability is loading.",
        envVar: "TAVILY_API_KEY",
      }
    }

    if (id === "productivity_agent") {
      return {
        id,
        ...TOOL_META[id],
        available: false,
        availabilityLabel: "Checking setup",
        note: "Tool availability is loading.",
        envVar: "SMTP_HOST",
      }
    }

    if (id === "knowledge_agent") {
      return {
        id,
        ...TOOL_META[id],
        available: true,
        availabilityLabel: "Session-based",
        note: "Works when documents are uploaded to the current chat.",
      }
    }

    return {
      id,
      ...TOOL_META[id],
      available: true,
      availabilityLabel: "Built-in",
    }
  })
}

export function useToolCatalog() {
  const [catalog, setCatalog] = useState<ToolCatalogItem[]>(fallbackCatalog)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/tools")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.tools) setCatalog(data.tools as ToolCatalogItem[])
      })
      .catch((err) => {
        console.warn("[useToolCatalog] failed:", err)
      })
      .finally(() => setLoading(false))
  }, [])

  const byId = catalog.reduce<Record<ToolId, ToolCatalogItem>>((acc, item) => {
    acc[item.id] = item
    return acc
  }, {} as Record<ToolId, ToolCatalogItem>)

  return { catalog, byId, loading }
}

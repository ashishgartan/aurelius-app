"use client"

import { useEffect, useState } from "react"
import { MODELS, type Provider } from "@/types/chat"
import type { ModelCatalogItem } from "@/lib/modelCatalog"

function fallbackCatalog(): ModelCatalogItem[] {
  return (Object.entries(MODELS) as [
    Provider,
    (typeof MODELS)[Provider],
  ][]).map(([id, meta]) => {
    const isQwen = id === "qwen"
    return {
      id,
      ...meta,
      available: false,
      availabilityLabel: "Checking setup",
      note: isQwen
        ? "Requires an OpenAI-compatible local endpoint such as LM Studio."
        : "Set GROQ_API_KEY to use Groq.",
    }
  })
}

export function useModelCatalog() {
  const [catalog, setCatalog] = useState<ModelCatalogItem[]>(fallbackCatalog)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/models")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.models) setCatalog(data.models as ModelCatalogItem[])
      })
      .catch((err) => {
        console.warn("[useModelCatalog] failed:", err)
      })
      .finally(() => setLoading(false))
  }, [])

  return { catalog, loading }
}

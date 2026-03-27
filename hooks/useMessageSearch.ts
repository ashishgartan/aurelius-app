// hooks/useMessageSearch.ts
"use client"

import { useState, useMemo, useCallback } from "react"
import type { ChatMessage } from "@/types/chat"

export interface SearchMatch {
  messageId: string
  // Start/end indices of the match within the message content
  // Used by MessageList to highlight the right span
  ranges:    { start: number; end: number }[]
}

export interface UseMessageSearchReturn {
  searchQuery:    string
  onSearchChange: (q: string) => void
  matchCount:     number
  matchIndex:     number
  onMatchNav:     (dir: "prev" | "next") => void
  matches:        SearchMatch[]
  activeMessageId: string | null
}

export function useMessageSearch(messages: ChatMessage[]): UseMessageSearchReturn {
  const [query,      setQuery]      = useState("")
  const [matchIndex, setMatchIndex] = useState(0)

  // Build match map — all occurrences across all messages
  const matches: SearchMatch[] = useMemo(() => {
    if (!query.trim()) return []

    const q      = query.toLowerCase()
    const result: SearchMatch[] = []

    for (const msg of messages) {
      const text  = msg.content
      const lower = text.toLowerCase()
      const ranges: { start: number; end: number }[] = []
      let pos = 0

      while (true) {
        const idx = lower.indexOf(q, pos)
        if (idx === -1) break
        ranges.push({ start: idx, end: idx + q.length })
        pos = idx + q.length
      }

      if (ranges.length > 0) {
        result.push({ messageId: msg._id, ranges })
      }
    }

    return result
  }, [query, messages])

  // Total individual match count (sum of all ranges across all messages)
  const matchCount = useMemo(
    () => matches.reduce((sum, m) => sum + m.ranges.length, 0),
    [matches]
  )

  // Reset matchIndex when query or results change
  const onSearchChange = useCallback((q: string) => {
    setQuery(q)
    setMatchIndex(0)
  }, [])

  const onMatchNav = useCallback((dir: "prev" | "next") => {
    if (matchCount === 0) return
    setMatchIndex((prev) => {
      if (dir === "next") return (prev + 1) % matchCount
      return (prev - 1 + matchCount) % matchCount
    })
  }, [matchCount])

  // Which message contains the currently active match
  const activeMessageId = useMemo(() => {
    if (matches.length === 0) return null
    // Walk through matches counting ranges until we reach matchIndex
    let count = 0
    for (const m of matches) {
      if (matchIndex < count + m.ranges.length) return m.messageId
      count += m.ranges.length
    }
    return null
  }, [matches, matchIndex])

  return {
    searchQuery:    query,
    onSearchChange,
    matchCount,
    matchIndex,
    onMatchNav,
    matches,
    activeMessageId,
  }
}
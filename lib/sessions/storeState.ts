import type { SessionSummary } from "@/types/chat"

export function sortSessionSummaries(items: SessionSummary[]): SessionSummary[] {
  return [...items].sort((a, b) => {
    const archivedDelta = Number(Boolean(a.archived)) - Number(Boolean(b.archived))
    if (archivedDelta !== 0) return archivedDelta

    const pinnedDelta = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
    if (pinnedDelta !== 0) return pinnedDelta

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

export function applySessionPinned(
  items: SessionSummary[],
  id: string,
  pinned: boolean
): SessionSummary[] {
  return sortSessionSummaries(
    items.map((session) => (session._id === id ? { ...session, pinned } : session))
  )
}

export function applySessionArchived(
  items: SessionSummary[],
  id: string,
  archived: boolean
): SessionSummary[] {
  return sortSessionSummaries(
    items.map((session) =>
      session._id === id
        ? { ...session, archived, pinned: archived ? false : session.pinned }
        : session
    )
  )
}

export function applySessionProvider(
  items: SessionSummary[],
  id: string,
  provider: SessionSummary["provider"]
): SessionSummary[] {
  return sortSessionSummaries(
    items.map((session) => (session._id === id ? { ...session, provider } : session))
  )
}

export function applySessionRename(
  items: SessionSummary[],
  id: string,
  title: string
): SessionSummary[] {
  return items.map((session) => (session._id === id ? { ...session, title } : session))
}

export function applySessionDelete(
  items: SessionSummary[],
  id: string
): SessionSummary[] {
  return items.filter((session) => session._id !== id)
}

export function applySessionCreate(
  items: SessionSummary[],
  session: SessionSummary
): SessionSummary[] {
  return sortSessionSummaries([session, ...items])
}

export function applySessionBump(
  items: SessionSummary[],
  id: string,
  now = new Date()
): SessionSummary[] {
  const index = items.findIndex((session) => session._id === id)
  if (index === -1) return items

  const updated = { ...items[index], updatedAt: now.toISOString() }
  return sortSessionSummaries([updated, ...items.filter((_, itemIndex) => itemIndex !== index)])
}

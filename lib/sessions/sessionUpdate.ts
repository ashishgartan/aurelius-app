interface SessionPatchInput {
  provider?: "groq" | "qwen"
  title?: string
  pinned?: boolean
  archived?: boolean
  clearMessages?: boolean
}

interface SessionUpdateDeps {
  sessionId: string
  userId: string
  data: SessionPatchInput
  updateProvider: (sessionId: string, userId: string, provider: "groq" | "qwen") => Promise<void>
  updateSessionTitle: (sessionId: string, userId: string, title: string) => Promise<void>
  updateSessionPinned: (sessionId: string, userId: string, pinned: boolean) => Promise<void>
  updateSessionArchived: (sessionId: string, userId: string, archived: boolean) => Promise<void>
  clearMessages: (sessionId: string, userId: string) => Promise<void>
}

export async function applySessionPatch({
  sessionId,
  userId,
  data,
  updateProvider,
  updateSessionTitle,
  updateSessionPinned,
  updateSessionArchived,
  clearMessages,
}: SessionUpdateDeps) {
  if (data.provider) await updateProvider(sessionId, userId, data.provider)
  if (data.title) await updateSessionTitle(sessionId, userId, data.title)
  if (data.pinned !== undefined) await updateSessionPinned(sessionId, userId, data.pinned)
  if (data.archived !== undefined) await updateSessionArchived(sessionId, userId, data.archived)
  if (data.clearMessages) await clearMessages(sessionId, userId)
}

type SessionLookup = (sessionId: string, userId: string) => Promise<unknown | null>

export async function assertOwnedSession(
  sessionId: string,
  userId: string,
  loadSession: SessionLookup
): Promise<void> {
  const session = await loadSession(sessionId, userId)
  if (!session) {
    throw new Error("Session not found")
  }
}

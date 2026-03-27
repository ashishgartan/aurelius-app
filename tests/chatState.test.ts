import test from "node:test"
import assert from "node:assert/strict"
import {
  applySessionArchived,
  applySessionBump,
  applySessionCreate,
  applySessionPinned,
  sortSessionSummaries,
} from "../lib/sessions/storeState.ts"
import {
  buildChatDraftKey,
  clearChatDraft,
  readChatDraft,
  writeChatDraft,
} from "../lib/chat/drafts.ts"
import type { SessionSummary } from "../types/chat.ts"
import { useArtifactFavorites } from "../hooks/useArtifactFavorites.ts"

function session(
  _id: string,
  updatedAt: string,
  patch: Partial<SessionSummary> = {}
): SessionSummary {
  return {
    _id,
    title: _id,
    provider: "groq",
    updatedAt,
    createdAt: updatedAt,
    ...patch,
  }
}

class MemoryStorage {
  private readonly map = new Map<string, string>()

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }
}

test("sortSessionSummaries keeps archived chats last, pinned chats first, then recency", () => {
  const sessions = sortSessionSummaries([
    session("recent", "2026-03-26T10:00:00.000Z"),
    session("archived", "2026-03-26T11:00:00.000Z", { archived: true, pinned: true }),
    session("pinned-old", "2026-03-25T10:00:00.000Z", { pinned: true }),
    session("pinned-new", "2026-03-26T09:00:00.000Z", { pinned: true }),
  ])

  assert.deepEqual(
    sessions.map((item) => item._id),
    ["pinned-new", "pinned-old", "recent", "archived"]
  )
})

test("applySessionArchived clears pinned state when a chat is archived", () => {
  const sessions = applySessionArchived(
    [session("a", "2026-03-26T10:00:00.000Z", { pinned: true })],
    "a",
    true
  )

  assert.equal(sessions[0]?.archived, true)
  assert.equal(sessions[0]?.pinned, false)
})

test("applySessionPinned reorders the pinned chat ahead of unpinned chats", () => {
  const sessions = applySessionPinned(
    [
      session("older", "2026-03-25T10:00:00.000Z"),
      session("newer", "2026-03-26T10:00:00.000Z"),
    ],
    "older",
    true
  )

  assert.deepEqual(
    sessions.map((item) => item._id),
    ["older", "newer"]
  )
})

test("applySessionCreate inserts a new pinned session into the sorted position", () => {
  const sessions = applySessionCreate(
    [session("existing", "2026-03-26T10:00:00.000Z")],
    session("new", "2026-03-25T10:00:00.000Z", { pinned: true })
  )

  assert.deepEqual(
    sessions.map((item) => item._id),
    ["new", "existing"]
  )
})

test("applySessionBump updates recency and moves the session to the front of its group", () => {
  const sessions = applySessionBump(
    [
      session("a", "2026-03-25T10:00:00.000Z"),
      session("b", "2026-03-26T10:00:00.000Z"),
    ],
    "a",
    new Date("2026-03-27T10:00:00.000Z")
  )

  assert.deepEqual(
    sessions.map((item) => item._id),
    ["a", "b"]
  )
  assert.equal(sessions[0]?.updatedAt, "2026-03-27T10:00:00.000Z")
})

test("draft helpers build, read, write, and clear per-chat drafts", () => {
  const storage = new MemoryStorage()
  const chatId = "chat-123"

  assert.equal(buildChatDraftKey(chatId), "chat-draft:chat-123")
  assert.equal(readChatDraft(storage, chatId), "")

  writeChatDraft(storage, chatId, "hello")
  assert.equal(readChatDraft(storage, chatId), "hello")

  writeChatDraft(storage, chatId, "")
  assert.equal(readChatDraft(storage, chatId), "")

  writeChatDraft(storage, chatId, "draft again")
  clearChatDraft(storage, chatId)
  assert.equal(readChatDraft(storage, chatId), "")
})

test("artifact favorites keep optimistic success state", async () => {
  useArtifactFavorites.setState({ favorites: {} })
  globalThis.fetch = async () => new Response(null, { status: 204 })

  await useArtifactFavorites.getState().toggleFavorite("artifact-1", true)

  assert.equal(useArtifactFavorites.getState().isFavorite("artifact-1"), true)
})

test("artifact favorites roll back optimistic state when the server rejects the update", async () => {
  useArtifactFavorites.setState({ favorites: { "artifact-1": false } })
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })

  await assert.rejects(
    () => useArtifactFavorites.getState().toggleFavorite("artifact-1", true),
    /Forbidden/
  )

  assert.equal(useArtifactFavorites.getState().isFavorite("artifact-1"), false)
})

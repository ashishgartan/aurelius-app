import test from "node:test"
import assert from "node:assert/strict"
import { handleArtifactFavoriteUpdate } from "../lib/artifacts/favoriteRoute.ts"
import { applySessionPatch } from "../lib/sessions/sessionUpdate.ts"

test("handleArtifactFavoriteUpdate returns 400 for invalid artifact IDs", async () => {
  const response = await handleArtifactFavoriteUpdate({
    artifactId: "bad-id",
    favorite: true,
    isValidArtifactId: () => false,
    updateArtifactFavorite: async () => true,
  })

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: "Invalid artifact ID" })
})

test("handleArtifactFavoriteUpdate returns 404 when artifact is missing", async () => {
  const response = await handleArtifactFavoriteUpdate({
    artifactId: "507f1f77bcf86cd799439011",
    favorite: true,
    isValidArtifactId: () => true,
    updateArtifactFavorite: async () => null,
  })

  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: "Not found" })
})

test("handleArtifactFavoriteUpdate returns updated favorite state", async () => {
  const response = await handleArtifactFavoriteUpdate({
    artifactId: "507f1f77bcf86cd799439011",
    favorite: true,
    isValidArtifactId: () => true,
    updateArtifactFavorite: async () => true,
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, favorite: true })
})

test("applySessionPatch dispatches archive and pin updates when provided", async () => {
  const calls: string[] = []

  await applySessionPatch({
    sessionId: "session-1",
    userId: "user-1",
    data: {
      archived: true,
      pinned: false,
    },
    updateProvider: async () => {
      calls.push("provider")
    },
    updateSessionTitle: async () => {
      calls.push("title")
    },
    updateSessionPinned: async (_sessionId, _userId, pinned) => {
      calls.push(`pinned:${String(pinned)}`)
    },
    updateSessionArchived: async (_sessionId, _userId, archived) => {
      calls.push(`archived:${String(archived)}`)
    },
    clearMessages: async () => {
      calls.push("clear")
    },
  })

  assert.deepEqual(calls, ["pinned:false", "archived:true"])
})

test("applySessionPatch only runs handlers for provided fields", async () => {
  const calls: string[] = []

  await applySessionPatch({
    sessionId: "session-1",
    userId: "user-1",
    data: {
      title: "Renamed",
      clearMessages: true,
    },
    updateProvider: async () => {
      calls.push("provider")
    },
    updateSessionTitle: async (_sessionId, _userId, title) => {
      calls.push(`title:${title}`)
    },
    updateSessionPinned: async () => {
      calls.push("pinned")
    },
    updateSessionArchived: async () => {
      calls.push("archived")
    },
    clearMessages: async () => {
      calls.push("clear")
    },
  })

  assert.deepEqual(calls, ["title:Renamed", "clear"])
})

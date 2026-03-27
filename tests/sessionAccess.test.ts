import test from "node:test"
import assert from "node:assert/strict"
import { assertOwnedSession } from "../lib/services/sessionAccess.ts"

test("assertOwnedSession resolves when the session exists for the user", async () => {
  await assert.doesNotReject(() =>
    assertOwnedSession("session-1", "user-1", async (sessionId, userId) => ({
      _id: sessionId,
      userId,
    }))
  )
})

test("assertOwnedSession throws when the session does not exist for the user", async () => {
  await assert.rejects(
    () => assertOwnedSession("session-1", "user-1", async () => null),
    /Session not found/
  )
})

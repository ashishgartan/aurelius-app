import test from "node:test"
import assert from "node:assert/strict"
import {
  buildDocumentSummaryPrompt,
  clearChatOnServer,
} from "../lib/chat/pageActions.ts"

test("buildDocumentSummaryPrompt formats the autosend summary prompt from the filename", () => {
  assert.equal(
    buildDocumentSummaryPrompt({ filename: "design-spec.pdf" }),
    'Summarize the document "design-spec.pdf" and highlight the key points.'
  )
})

test("clearChatOnServer sends the clear-messages patch request", async () => {
  let called = false
  let input = ""
  let init: RequestInit | undefined

  await clearChatOnServer(async (requestInput, requestInit) => {
    called = true
    input = String(requestInput)
    init = requestInit
    return new Response(null, { status: 200 })
  }, "session-123")

  assert.equal(called, true)
  assert.equal(input, "/api/sessions/session-123")
  assert.equal(init?.method, "PATCH")
  assert.equal(init?.headers && (init.headers as Record<string, string>)["Content-Type"], "application/json")
  assert.equal(init?.body, JSON.stringify({ clearMessages: true }))
})

test("clearChatOnServer throws when the server rejects the clear request", async () => {
  await assert.rejects(
    () =>
      clearChatOnServer(
        async () => new Response(null, { status: 500 }),
        "session-123"
      ),
    /Server returned 500/
  )
})

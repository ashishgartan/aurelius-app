import test from "node:test"
import assert from "node:assert/strict"
import {
  buildSharedArtifactMetadataUrl,
  normalizeSharedMessages,
} from "../lib/share/shared.ts"

test("normalizeSharedMessages returns plain serializable message objects", () => {
  const session = {
    provider: "groq" as const,
    updatedAt: new Date("2026-03-25T10:00:00.000Z"),
    messages: [
      {
        role: "user",
        content: "hello",
        model: "groq",
        createdAt: new Date("2026-03-25T09:00:00.000Z"),
      },
      {
        role: "assistant",
        content: "artifact response",
        createdAt: null,
        artifacts: [
          {
            artifactId: "507f1f77bcf86cd799439011",
            filename: "demo.ts",
            lang: "ts",
            sizeBytes: 42,
          },
        ],
      },
    ],
  }

  const messages = normalizeSharedMessages(session)

  assert.equal(messages.length, 2)
  assert.equal(messages[0]?._id, `user-${String(session.messages[0]?.createdAt)}-0`)
  assert.equal(messages[0]?.role, "user")
  assert.equal(messages[0]?.content, "hello")
  assert.equal(messages[0]?.model, "groq")
  assert.equal(messages[0]?.createdAt, "2026-03-25T09:00:00.000Z")
  assert.equal(messages[0]?.artifacts, undefined)

  assert.equal(messages[1]?._id, `assistant-${String(session.updatedAt)}-1`)
  assert.equal(messages[1]?.role, "assistant")
  assert.equal(messages[1]?.content, "artifact response")
  assert.equal(messages[1]?.model, "groq")
  assert.equal(messages[1]?.createdAt, "2026-03-25T10:00:00.000Z")
  assert.deepEqual(messages[1]?.artifacts, [
    {
      artifactId: "507f1f77bcf86cd799439011",
      filename: "demo.ts",
      lang: "ts",
      sizeBytes: 42,
    },
  ])
  assert.equal(JSON.parse(JSON.stringify(messages))[1].artifacts[0].filename, "demo.ts")
})

test("normalizeSharedMessages falls back to safe defaults for invalid values", () => {
  const messages = normalizeSharedMessages({
    provider: "qwen",
    updatedAt: "2026-03-26T12:00:00.000Z",
    messages: [
      {
        role: "unknown",
        content: 123,
        model: "invalid",
        createdAt: "invalid-date",
        artifacts: [
          {
            artifactId: "507f1f77bcf86cd799439011",
            filename: 99,
            lang: null,
            sizeBytes: "large",
          },
          {
            artifactId: 77,
          },
        ],
      },
    ],
  })

  assert.deepEqual(messages[0], {
    _id: "user-invalid-date-0",
    role: "user",
    content: "",
    model: "qwen",
    createdAt: "2026-03-26T12:00:00.000Z",
    artifacts: [
      {
        artifactId: "507f1f77bcf86cd799439011",
        filename: "artifact",
        lang: "text",
        sizeBytes: 0,
      },
    ],
  })
})

test("buildSharedArtifactMetadataUrl encodes token and artifact ID", () => {
  assert.equal(
    buildSharedArtifactMetadataUrl("team/demo token", "artifact/id"),
    "/api/share/team%2Fdemo%20token/artifacts/artifact%2Fid?format=json"
  )
})

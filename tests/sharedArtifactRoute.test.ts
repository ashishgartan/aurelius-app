import test from "node:test"
import assert from "node:assert/strict"
import { handleSharedArtifactRequest } from "../lib/share/sharedArtifactRoute.ts"

function createDeps(overrides: Partial<Parameters<typeof handleSharedArtifactRequest>[0]> = {}) {
  return {
    token: "share-token",
    artifactId: "507f1f77bcf86cd799439011",
    requestUrl:
      "https://example.com/api/share/share-token/artifacts/507f1f77bcf86cd799439011?format=json",
    isValidArtifactId: () => true,
    findSessionIdByToken: async () => "507f1f77bcf86cd799439012",
    findArtifactForSession: async () => ({
      filename: "demo.ts",
      lang: "ts",
      sizeBytes: 42,
      cloudinaryPublicId: "artifacts/demo",
    }),
    getSignedUrl: (publicId: string) => `https://cdn.example.com/${publicId}`,
    ...overrides,
  }
}

test("shared artifact route returns 400 for invalid artifact IDs", async () => {
  const response = await handleSharedArtifactRequest(
    createDeps({
      isValidArtifactId: () => false,
    })
  )

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: "Invalid artifact ID" })
})

test("shared artifact route returns 404 when the share token is unknown", async () => {
  const response = await handleSharedArtifactRequest(
    createDeps({
      findSessionIdByToken: async () => null,
    })
  )

  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: "Not found" })
})

test("shared artifact route returns 404 when the artifact is missing from the shared session", async () => {
  const response = await handleSharedArtifactRequest(
    createDeps({
      findArtifactForSession: async () => null,
    })
  )

  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: "Not found" })
})

test("shared artifact route returns signed metadata for format=json", async () => {
  const response = await handleSharedArtifactRequest(createDeps())

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    url: "https://cdn.example.com/artifacts/demo",
    filename: "demo.ts",
    lang: "ts",
    sizeBytes: 42,
  })
})

test("shared artifact route redirects to the signed URL by default", async () => {
  const response = await handleSharedArtifactRequest(
    createDeps({
      requestUrl:
        "https://example.com/api/share/share-token/artifacts/507f1f77bcf86cd799439011",
    })
  )

  assert.equal(response.status, 302)
  assert.equal(
    response.headers.get("location"),
    "https://cdn.example.com/artifacts/demo"
  )
})

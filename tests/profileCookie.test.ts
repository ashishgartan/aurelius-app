import test from "node:test"
import assert from "node:assert/strict"

process.env.JWT_SECRET = "12345678901234567890123456789012"

test("buildProfileAuthCookie refreshes the JWT payload without embedding avatar data", async () => {
  const { extractToken, verifyToken } = await import("../lib/jwt.ts")
  const { buildProfileAuthCookie } = await import("../lib/auth/profileCookie.ts")

  const cookie = await buildProfileAuthCookie({
    _id: {
      toString: () => "507f1f77bcf86cd799439011",
    },
    email: "user@example.com",
    displayName: "Updated Name",
    createdAt: {
      toISOString: () => "2026-03-26T12:00:00.000Z",
    },
  })

  const token = extractToken(
    new Request("https://example.com", {
      headers: { cookie },
    })
  )

  assert.ok(token)

  const payload = await verifyToken(token)

  assert.ok(payload)
  assert.equal(payload.userId, "507f1f77bcf86cd799439011")
  assert.equal(payload.email, "user@example.com")
  assert.equal(payload.displayName, "Updated Name")
  assert.equal(payload.avatarUrl, undefined)
  assert.equal(payload.createdAt, "2026-03-26T12:00:00.000Z")
  assert.equal(typeof payload.iat, "number")
  assert.equal(typeof payload.exp, "number")
})

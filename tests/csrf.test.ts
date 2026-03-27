import test from "node:test"
import assert from "node:assert/strict"
import { checkCsrf } from "../lib/csrf.ts"

test("checkCsrf allows localhost on any dev port", () => {
  const env = process.env as Record<string, string | undefined>
  const originalNodeEnv = env.NODE_ENV
  const originalNextauthUrl = env.NEXTAUTH_URL
  const originalAppUrl = env.APP_URL

  try {
    env.NODE_ENV = "development"
    env.NEXTAUTH_URL = ""
    env.APP_URL = ""

    const req = new Request("http://localhost:4321/api/settings", {
      method: "PUT",
      headers: { origin: "http://localhost:4321" },
    })

    assert.equal(checkCsrf(req), null)
  } finally {
    env.NODE_ENV = originalNodeEnv
    env.NEXTAUTH_URL = originalNextauthUrl
    env.APP_URL = originalAppUrl
  }
})

test("checkCsrf rejects production writes when server origin is not configured", () => {
  const env = process.env as Record<string, string | undefined>
  const originalNodeEnv = env.NODE_ENV
  const originalAllowedOrigins = env.ALLOWED_ORIGINS
  const originalNextauthUrl = env.NEXTAUTH_URL
  const originalAppUrl = env.APP_URL

  try {
    env.NODE_ENV = "production"
    env.ALLOWED_ORIGINS = ""
    env.NEXTAUTH_URL = ""
    env.APP_URL = ""

    const req = new Request("https://app.example.com/api/settings", {
      method: "PUT",
      headers: { origin: "https://evil.example.com" },
    })

    const res = checkCsrf(req)
    assert.ok(res)
    assert.equal(res.status, 403)
  } finally {
    env.NODE_ENV = originalNodeEnv
    env.ALLOWED_ORIGINS = originalAllowedOrigins
    env.NEXTAUTH_URL = originalNextauthUrl
    env.APP_URL = originalAppUrl
  }
})

test("checkCsrf rejects production writes without an Origin header", () => {
  const env = process.env as Record<string, string | undefined>
  const originalNodeEnv = env.NODE_ENV
  const originalAllowedOrigins = env.ALLOWED_ORIGINS
  const originalNextauthUrl = env.NEXTAUTH_URL
  const originalAppUrl = env.APP_URL

  try {
    env.NODE_ENV = "production"
    env.ALLOWED_ORIGINS = "https://app.example.com"
    env.NEXTAUTH_URL = ""
    env.APP_URL = ""

    const req = new Request("https://app.example.com/api/settings", {
      method: "PUT",
    })

    const res = checkCsrf(req)
    assert.ok(res)
    assert.equal(res.status, 403)
  } finally {
    env.NODE_ENV = originalNodeEnv
    env.ALLOWED_ORIGINS = originalAllowedOrigins
    env.NEXTAUTH_URL = originalNextauthUrl
    env.APP_URL = originalAppUrl
  }
})

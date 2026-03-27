import test from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_SETTINGS } from "../types/auth.ts"
import { saveSettingsRequest } from "../lib/settings/saveSettings.ts"
import { estimateCost } from "../lib/services/usageCost.ts"
import { buildModelCatalog } from "../lib/modelCatalog.ts"
import { buildToolCatalog } from "../lib/tools/catalog.ts"

test("saveSettingsRequest returns saved settings from the API response", async () => {
  const saved = await saveSettingsRequest(
    async () =>
      new Response(
        JSON.stringify({
          settings: {
            ...DEFAULT_SETTINGS,
            tone: "technical",
          },
        }),
        { status: 200 }
      ),
    DEFAULT_SETTINGS,
    { tone: "casual" }
  )

  assert.equal(saved.tone, "technical")
})

test("saveSettingsRequest clears SMTP credentials on a general settings reset", async () => {
  let calledUrl = ""
  let calledBody: unknown = null

  const saved = await saveSettingsRequest(
    async (input, init) => {
      calledUrl = String(input)
      calledBody = init?.body ? JSON.parse(String(init.body)) : null
      return new Response(
        JSON.stringify({
          settings: {
            ...DEFAULT_SETTINGS,
            smtpUser: "",
            smtpPass: "",
          },
        }),
        { status: 200 }
      )
    },
    {
      ...DEFAULT_SETTINGS,
      smtpUser: "user@example.com",
      smtpPass: "secret",
    },
    DEFAULT_SETTINGS
  )

  assert.equal(calledUrl, "/api/settings")
  assert.deepEqual(calledBody, DEFAULT_SETTINGS)
  assert.equal(saved.smtpUser, "")
  assert.equal(saved.smtpPass, "")
})

test("saveSettingsRequest uses the SMTP endpoint for credential-only updates", async () => {
  let calledUrl = ""
  let calledBody: unknown = null

  await saveSettingsRequest(
    async (input, init) => {
      calledUrl = String(input)
      calledBody = init?.body ? JSON.parse(String(init.body)) : null
      return new Response(
        JSON.stringify({
          settings: {
            ...DEFAULT_SETTINGS,
            smtpUser: "user@example.com",
            smtpPass: "secret",
          },
        }),
        { status: 200 }
      )
    },
    DEFAULT_SETTINGS,
    {
      smtpUser: "user@example.com",
      smtpPass: "secret",
    }
  )

  assert.equal(calledUrl, "/api/settings/smtp")
  assert.deepEqual(calledBody, {
    smtpUser: "user@example.com",
    smtpPass: "secret",
  })
})

test("saveSettingsRequest throws the server error on failed saves", async () => {
  await assert.rejects(
    () =>
      saveSettingsRequest(
        async () =>
          new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
        DEFAULT_SETTINGS,
        { tone: "casual" }
      ),
    /Forbidden/
  )
})

test("estimateCost reports zero cost for local qwen usage", () => {
  assert.equal(estimateCost("qwen", 100000, 100000), 0)
})

test("buildModelCatalog marks qwen unavailable without a local endpoint", () => {
  const catalog = buildModelCatalog({})
  const qwen = catalog.find((item) => item.id === "qwen")

  assert.ok(qwen)
  assert.equal(qwen.available, false)
})

test("buildToolCatalog marks email unavailable without SMTP server setup", () => {
  const catalog = buildToolCatalog({})
  const email = catalog.find((item) => item.id === "productivity_agent")

  assert.ok(email)
  assert.equal(email.available, false)
})

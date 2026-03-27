import test from "node:test"
import assert from "node:assert/strict"
import { buildToolCatalog } from "../lib/tools/catalog.ts"
import { UserSettingsSchema } from "../lib/validation.ts"

test("UserSettingsSchema rejects unknown tool ids", () => {
  const parsed = UserSettingsSchema.safeParse({
    enabledTools: ["research_agent", "not_a_tool"],
  })

  assert.equal(parsed.success, false)
})

test("UserSettingsSchema de-duplicates repeated tool ids", () => {
  const parsed = UserSettingsSchema.parse({
    enabledTools: ["math_agent", "math_agent"],
  })

  assert.deepEqual(parsed.enabledTools, ["math_agent"])
})

test("buildToolCatalog marks env-dependent tools unavailable without setup", () => {
  const catalog = buildToolCatalog({})
  const research = catalog.find((item) => item.id === "research_agent")
  const productivity = catalog.find((item) => item.id === "productivity_agent")

  assert.equal(research?.available, false)
  assert.equal(research?.availabilityLabel, "Setup required")
  assert.equal(productivity?.available, false)
})

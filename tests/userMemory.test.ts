import test from "node:test"
import assert from "node:assert/strict"
import { extractMemoryCandidates } from "../lib/memory/extractCandidates.ts"

test("extractMemoryCandidates captures the user's name from a direct introduction", () => {
  const candidates = extractMemoryCandidates("hi am ashish gartan")
  const name = candidates.find((candidate) => candidate.key === "name")

  assert.ok(name)
  assert.equal(name.category, "profile")
  assert.equal(name.value, "Ashish Gartan")
  assert.equal(name.confidence, 0.96)
})

test("extractMemoryCandidates captures names from more natural introductions", () => {
  const candidates = extractMemoryCandidates("hey, you can call me ashish gartan")
  const name = candidates.find((candidate) => candidate.key === "name")

  assert.ok(name)
  assert.equal(name.value, "Ashish Gartan")
})

test("extractMemoryCandidates captures response style preferences", () => {
  const candidates = extractMemoryCandidates("I prefer concise answers and technical detail when needed")
  const style = candidates.find((candidate) => candidate.key === "response_style")

  assert.ok(style)
  assert.equal(style.category, "preference")
  assert.equal(style.value, "concise")
})

test("extractMemoryCandidates normalizes casual preference phrasing", () => {
  const candidates = extractMemoryCandidates("keep it short answers please")
  const style = candidates.find((candidate) => candidate.key === "response_style")

  assert.ok(style)
  assert.equal(style.value, "concise")
})

test("extractMemoryCandidates captures tech stack from conversational phrasing", () => {
  const candidates = extractMemoryCandidates("I work with TypeScript and APIs all day")
  const stack = candidates.find((candidate) => candidate.key === "preferred_stack")

  assert.ok(stack)
  assert.equal(stack.value, "TypeScript")
})

test("extractMemoryCandidates infers durable interests from repeated topic keywords", () => {
  const candidates = extractMemoryCandidates("I am building an AI agent in Next.js with MongoDB")
  const keys = candidates.map((candidate) => candidate.key)

  assert.ok(keys.includes("interest:ai-tooling"))
  assert.ok(keys.includes("interest:frontend"))
  assert.ok(keys.includes("interest:databases"))
})

import test from "node:test"
import assert from "node:assert/strict"
import {
  buildExecutionPlan,
  buildStructuredEmailPrompt,
  chooseExecutionProvider,
  classifyEmailIntent,
} from "../lib/ai/workflow.ts"

test("classifyEmailIntent detects explicit send requests", () => {
  const result = classifyEmailIntent(
    "Send email to jane@example.com subject: Launch update body: We are live."
  )

  assert.equal(result.intent, "send")
  assert.equal(result.fields?.to, "jane@example.com")
  assert.equal(result.fields?.subject, "Launch update")
  assert.equal(result.fields?.body, "We are live.")
})

test("classifyEmailIntent treats write requests as draft only", () => {
  const result = classifyEmailIntent(
    "Write an email to jane@example.com about the new pricing plan"
  )

  assert.equal(result.intent, "draft")
  assert.equal(result.fields?.to, "jane@example.com")
})

test("buildStructuredEmailPrompt encodes intent and fields", () => {
  const prompt = buildStructuredEmailPrompt(
    "send",
    {
      to: "jane@example.com",
      subject: "Status",
      body: "Everything is on track.",
    },
    "Send an update to Jane"
  )

  assert.match(prompt, /approved sending this email now/i)
  assert.match(prompt, /Recipient: jane@example.com/)
  assert.match(prompt, /Subject: Status/)
  assert.match(prompt, /Body: Everything is on track\./)
})

test("chooseExecutionProvider routes lightweight prompts to qwen when available", () => {
  const provider = chooseExecutionProvider("What is polymorphism?", {
    provider: "groq",
    availableProviders: ["groq", "qwen"],
  })

  assert.equal(provider, "qwen")
})

test("chooseExecutionProvider keeps groq for heavier tasks", () => {
  const provider = chooseExecutionProvider(
    "Search the latest AI chip news and compare it with last quarter trends.",
    {
      provider: "groq",
      availableProviders: ["groq", "qwen"],
    }
  )

  assert.equal(provider, "groq")
})

test("buildExecutionPlan creates a concrete email send plan", () => {
  const plan = buildExecutionPlan(
    "Send email to jane@example.com subject: Hello body: Thanks.",
    "productivity_agent",
    "groq"
  )

  assert.equal(plan.provider, "groq")
  assert.equal(plan.steps.length, 3)
  assert.match(plan.steps[1], /validate recipient/i)
  assert.match(plan.steps[2], /send one email/i)
})

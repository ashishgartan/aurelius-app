import test from "node:test"
import assert from "node:assert/strict"
import {
  buildExecutionPlan,
  chooseExecutionProvider,
  classifyEmailIntent,
  isCodeHeavyPrompt,
  isResearchEmailRequest,
} from "../lib/ai/workflow.ts"
import { AI_TRANSCRIPT_FIXTURES } from "./fixtures/aiTranscriptFixtures.ts"

function inferAgentName(message: string): string {
  const lowered = message.toLowerCase()
  const emailIntent = classifyEmailIntent(message)

  if (isResearchEmailRequest(message)) return "research_productivity_agent"
  if (emailIntent.intent !== "none") return "productivity_agent"
  if (lowered.includes("latest") || lowered.includes("today")) {
    return "research_agent"
  }
  if (
    lowered.includes("document") ||
    lowered.includes("pdf") ||
    lowered.includes("upload")
  ) {
    return "knowledge_agent"
  }
  if (lowered.includes("code")) return "code_agent"
  return "general_agent"
}

for (const fixture of AI_TRANSCRIPT_FIXTURES) {
  test(`AI transcript eval: ${fixture.name}`, () => {
    const lastUserTurn = [...fixture.transcript]
      .reverse()
      .find((turn) => turn.role === "user")

    assert.ok(lastUserTurn, "fixture must include a user turn")

    const message = lastUserTurn.content
    const emailIntent = classifyEmailIntent(message)
    const agentName = inferAgentName(message)
    const provider = chooseExecutionProvider(message, {
      provider: fixture.selectedProvider,
      availableProviders: fixture.availableProviders,
    })
    const plan = buildExecutionPlan(message, agentName, provider)

    assert.equal(emailIntent.intent, fixture.expected.emailIntent)
    assert.equal(agentName, fixture.expected.agentName)
    assert.equal(provider, fixture.expected.provider)

    for (const expectedStep of fixture.expected.planIncludes) {
      assert.ok(
        plan.steps.includes(expectedStep),
        `expected plan step missing: ${expectedStep}`
      )
    }
  })
}

test("classifyEmailIntent treats send-plus-recipient prompts as real send actions", () => {
  const result = classifyEmailIntent(
    "Write javascript code to print 1 to 20 and send it to gartan.ashish@codequotient.com"
  )

  assert.equal(result.intent, "send")
  assert.equal(result.fields?.to, "gartan.ashish@codequotient.com")
})

test("isCodeHeavyPrompt treats frontend/CSS requests as implementation-heavy", () => {
  assert.equal(
    isCodeHeavyPrompt("Make this Next.js dashboard UI responsive and fix the Tailwind CSS"),
    true
  )
})

test("chooseExecutionProvider keeps groq for code-heavy prompts even when qwen is available", () => {
  const provider = chooseExecutionProvider(
    "Refactor this React component and improve the CSS layout",
    {
      provider: "groq",
      availableProviders: ["groq", "qwen"],
    }
  )

  assert.equal(provider, "groq")
})

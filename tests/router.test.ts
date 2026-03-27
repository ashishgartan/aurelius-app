import test from "node:test"
import assert from "node:assert/strict"
import { chooseDeterministicAgent } from "../lib/agents/router.ts"

const AGENTS = [
  { name: "general_agent", description: "", tools: [] },
  { name: "research_agent", description: "", tools: [] },
  { name: "research_productivity_agent", description: "", tools: [] },
  { name: "productivity_agent", description: "", tools: [] },
  { name: "math_agent", description: "", tools: [] },
  { name: "knowledge_agent", description: "", tools: [] },
  { name: "code_agent", description: "", tools: [] },
]

test("chooseDeterministicAgent keeps non-research email requests on productivity_agent", () => {
  const chosen = chooseDeterministicAgent(
    "Write javascript code to print 1 to 20 and send it to gartan.ashish@codequotient.com",
    AGENTS
  )

  assert.equal(chosen, "productivity_agent")
})

test("chooseDeterministicAgent routes research email requests to research_productivity_agent", () => {
  const chosen = chooseDeterministicAgent(
    "Send today's India news to gartan.ashish@codequotient.com",
    AGENTS
  )

  assert.equal(chosen, "research_productivity_agent")
})

test("chooseDeterministicAgent routes frontend styling requests to code_agent", () => {
  const chosen = chooseDeterministicAgent(
    "Fix the CSS for this React component and make the layout responsive",
    AGENTS
  )

  assert.equal(chosen, "code_agent")
})

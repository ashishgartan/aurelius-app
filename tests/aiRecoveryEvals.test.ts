import test from "node:test"
import assert from "node:assert/strict"
import { buildRecoveryGuidance } from "../lib/ai/workflow.ts"
import { AI_RECOVERY_FIXTURES } from "./fixtures/aiRecoveryFixtures.ts"

for (const fixture of AI_RECOVERY_FIXTURES) {
  test(`AI recovery eval: ${fixture.name}`, () => {
    const steps = buildRecoveryGuidance(fixture.errorMessage, fixture.code)
    assert.deepEqual(steps, fixture.expectedSteps)
  })
}

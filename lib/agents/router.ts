// lib/agents/router.ts
// Reads the user's message and picks the best agent to handle it.
// Makes one fast LLM call and returns an agent name — nothing more.

import { ChatGroq }                    from "@langchain/groq"
import { ChatOpenAI }                  from "@langchain/openai"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import type { AgentDefinition }        from "./index"
import type { Provider }               from "@/types/chat"
import {
  classifyEmailIntent,
  isResearchEmailRequest,
} from "../ai/workflow.ts"

// ── Pick a model for routing ───────────────────────────────────────
// We use a small fast model here (8b) because routing is simple —
// the model just needs to read descriptions and return one name.
// No need for the big 70b model we use for actual answers.

function buildRouterModel(provider: Provider) {
  if (provider === "groq") {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error("GROQ_API_KEY is not set in .env.local")

    return new ChatGroq({
      apiKey,
      model:       process.env.GROQ_ROUTER_MODEL ?? "llama-3.1-8b-instant",
      temperature: 0,      // temperature 0 = always same answer for same input
      streaming:   false,  // we need the full name before continuing, no streaming needed
    })
  }

  // Local model via LM Studio
  const baseURL = (process.env.LM_STUDIO_URL ?? "http://localhost:1234") + "/v1"
  return new ChatOpenAI({
    apiKey:        "lm-studio",
    model:         "qwen",
    temperature:   0,
    streaming:     false,
    configuration: { baseURL },
  })
}

// ── Build the prompt we send to the router model ───────────────────
// We list every agent with its name and description.
// The model reads these and returns the name of the best match.

function buildRoutingPrompt(agents: AgentDefinition[]): string {
  const agentList = agents
    .map((a) => `- ${a.name}: ${a.description}`)
    .join("\n")

  return `You are a professional router for an AI assistant. Your task is to select the single best agent for the user's request.

Available agents:
${agentList}

Selection Rules:
1. Use 'research_productivity_agent' when the user wants current/live information to be researched and then sent by email.
2. Use 'research_agent' for ANY query about current events, news, real-time data, or things that happen today/recently.
3. Use 'math_agent' for ANY math, calculations, or unit conversions.
4. Use 'knowledge_agent' for questions about files or documents the user has uploaded.
5. Use 'general_agent' ONLY if no other specialized agent fits (e.g. for greetings or general knowledge).
6. Respond with ONLY the chosen agent name. No preamble, no explanation, no backticks.

Valid names: ${agents.map((a) => a.name).join(", ")}`
}

export function chooseDeterministicAgent(
  query: string,
  agents: AgentDefinition[]
): string | null {
  const agentNames = new Set(agents.map((agent) => agent.name))
  const lowered = query.toLowerCase()
  const emailIntent = classifyEmailIntent(query)

  if (
    isResearchEmailRequest(query) &&
    agentNames.has("research_productivity_agent")
  ) {
    return "research_productivity_agent"
  }

  if (emailIntent.intent !== "none" && agentNames.has("productivity_agent")) {
    return "productivity_agent"
  }

  if (
    (lowered.includes("document") ||
      lowered.includes("pdf") ||
      lowered.includes("upload") ||
      lowered.includes("file")) &&
    agentNames.has("knowledge_agent")
  ) {
    return "knowledge_agent"
  }

  if (
    (lowered.includes("calculate") ||
      lowered.includes("percentage") ||
      lowered.includes("percent") ||
      lowered.includes("convert") ||
      lowered.includes("sum of") ||
      lowered.includes("average") ||
      lowered.includes("sqrt")) &&
    agentNames.has("math_agent")
  ) {
    return "math_agent"
  }

  if (
    (lowered.includes("code") ||
      lowered.includes("debug") ||
      lowered.includes("bug") ||
      lowered.includes("fix") ||
      lowered.includes("refactor") ||
      lowered.includes("implement") ||
      lowered.includes("react") ||
      lowered.includes("next.js") ||
      lowered.includes("nextjs") ||
      lowered.includes("javascript") ||
      lowered.includes("typescript") ||
      lowered.includes("python") ||
      lowered.includes("c++") ||
      lowered.includes("cpp") ||
      lowered.includes("java") ||
      lowered.includes("css") ||
      lowered.includes("tailwind") ||
      lowered.includes("ui") ||
      lowered.includes("layout") ||
      lowered.includes("responsive") ||
      lowered.includes("component")) &&
    agentNames.has("code_agent")
  ) {
    return "code_agent"
  }

  return null
}

// ── Main function ──────────────────────────────────────────────────
// Takes the user's message and the list of agents.
// Returns the name of the agent that should handle the message.

export async function routeQuery(
  query:    string,
  agents:   AgentDefinition[],
  provider: Provider
): Promise<string> {

  // If there is only one agent, no need to ask the LLM — just use it
  if (agents.length === 1) return agents[0].name

  const deterministic = chooseDeterministicAgent(query, agents)
  if (deterministic) return deterministic

  const model  = buildRouterModel(provider)
  const prompt = buildRoutingPrompt(agents)

  try {
    // Race the LLM call against a 5 second timeout.
    // If routing hangs, we fall through to the catch block and use the first agent.
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Router timed out")), 5000)
    )

    const response = await Promise.race([
      model.invoke([new SystemMessage(prompt), new HumanMessage(query)]),
      timeoutPromise,
    ])

    // Clean up the response — remove anything that isn't a letter, digit,
    // underscore, or hyphen. This preserves both snake_case and kebab-case
    // agent names correctly (stripping hyphens would silently break kebab names).
    const chosen = String(response.content)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")

    // Check the name actually exists in our registry
    // general_agent is already in agents so no need to add it again
    const validNames = agents.map((a) => a.name)
    if (validNames.includes(chosen)) return chosen

    // Model returned an unknown name — fall back to general_agent by explicit
    // lookup so we are never dependent on registry insertion order.
    console.warn(`[router] Model returned unknown agent "${chosen}" (Original: "${String(response.content).trim()}") — falling back to general_agent`)
    return agents.find((a) => a.name === "general_agent")?.name ?? agents[0].name

  } catch (err) {
    // LLM call failed entirely — find general_agent explicitly rather than
    // relying on agents[0] which is only general_agent by convention.
    console.error("[router] Routing failed:", err)
    return agents.find((a) => a.name === "general_agent")?.name ?? agents[0].name
  }
}

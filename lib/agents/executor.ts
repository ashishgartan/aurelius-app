// lib/agents/executor.ts
// Runs the chosen agent and streams the response back chunk by chunk.
// router.ts decides WHICH agent — this file actually runs it.

import { ChatGroq }          from "@langchain/groq"
import { ChatOpenAI }        from "@langchain/openai"
import { createReactAgent }  from "@langchain/langgraph/prebuilt"
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages"
import type { AgentDefinition } from "./index"
import type { AgentChunk }      from "@/lib/agent"
import type { Provider }        from "@/types/chat"
import type { RecoveryCode }    from "@/lib/ai/workflow"

// ── Build the LLM model ────────────────────────────────────────────
// We use a big powerful model here (70b) because this is doing the
// actual work — understanding the question, using tools, writing answers.

function buildModel(provider: Provider) {
  if (provider === "groq") {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error("GROQ_API_KEY is not set in .env.local")

    return new ChatGroq({
      apiKey,
      model:       process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      temperature: 0.7,   // some creativity in answers
      streaming:   true,  // send words as they are generated, not all at once
    })
  }

  // Local model via LM Studio
  const baseURL = (process.env.LM_STUDIO_URL ?? "http://localhost:1234") + "/v1"
  return new ChatOpenAI({
    apiKey:        "lm-studio",
    model:         "qwen",
    temperature:   0.7,
    streaming:     true,
    configuration: { baseURL },
  })
}

// ── Convert chat history to LangChain message format ──────────────
// Our DB stores messages as { role, content } plain objects.
// LangChain needs them as HumanMessage or AIMessage objects.

function toBaseMessages(history: { role: string; content: string }[]): BaseMessage[] {
  return history.map((m) =>
    m.role === "user"
      ? new HumanMessage(m.content)
      : new AIMessage(m.content)
  )
}

// ── Extract the tool input from a LangChain event ─────────────────
// LangChain wraps tool inputs in different shapes depending on the tool.
// This function unwraps them all into a plain string.

function extractToolInput(raw: unknown): string {
  if (!raw) return ""

  // Get the value — either the raw string or the "input" field of an object
  const value = typeof raw === "string"
    ? raw
    : (raw as Record<string, unknown>)?.input ?? raw

  // Sometimes the value is a JSON string like '{"input":"5+5"}'
  // In that case we unwrap it to get just "5+5"
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === "object" && parsed !== null && "input" in parsed) {
        return String(parsed.input)
      }
    } catch {
      // not JSON — use the string as-is
    }
    return value
  }

  return JSON.stringify(value)
}

// ── Extract the tool output from a LangChain event ────────────────
// LangChain wraps tool results in different shapes too.
// This function unwraps them all into a plain string, capped at 400 chars.

function extractToolOutput(raw: unknown): {
  output: string
  code?: RecoveryCode
  meta?: Record<string, string>
} {
  const coerce = (
    value: string
  ): {
    output: string
    code?: RecoveryCode
    meta?: Record<string, string>
  } => {
    try {
      const parsed = JSON.parse(value) as {
        message?: string
        code?: RecoveryCode
        meta?: Record<string, string>
      }
      if (typeof parsed?.message === "string") {
        return {
          output: parsed.message.slice(0, 400),
          code: parsed.code,
          meta: parsed.meta,
        }
      }
    } catch {
      // not JSON
    }

    return { output: value.slice(0, 400) }
  }

  if (!raw) return { output: "" }

  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>

    // Shape 1: { kwargs: { content: "result" } }
    if (obj.kwargs && typeof (obj.kwargs as Record<string, unknown>).content === "string") {
      return coerce((obj.kwargs as Record<string, unknown>).content as string)
    }

    // Shape 2: { content: "result" }
    if (typeof obj.content === "string") {
      return coerce(obj.content)
    }
  }

  // Shape 3: plain string
  if (typeof raw === "string") return coerce(raw)

  return { output: JSON.stringify(raw).slice(0, 400) }
}

function normalizeAgentError(err: unknown): {
  message: string
  code?: RecoveryCode
} {
  const msg = err instanceof Error ? err.message : String(err)

  if (
    msg.includes("rate_limit_exceeded") ||
    msg.includes("Rate limit reached for model")
  ) {
    return {
      message:
        "The model is temporarily rate limited. Please wait a few seconds and try again.",
      code: "MODEL_RATE_LIMIT",
    }
  }

  if (msg.includes("GRAPH_RECURSION_LIMIT")) {
    return {
      message:
        "The agent hit its tool-step limit before it could finish. Please retry with a shorter request.",
      code: "UNKNOWN",
    }
  }

  return { message: msg, code: "UNKNOWN" }
}

// ── Run the agent and stream results ──────────────────────────────
// This is a generator function — it yields chunks one at a time
// as the LLM generates them, instead of waiting for the full response.

export async function* executeAgent(
  agent:      AgentDefinition,
  message:    string,
  history:    { role: string; content: string }[],
  systemText: string,
  provider:   Provider
): AsyncGenerator<AgentChunk> {

  const model       = buildModel(provider)
  const chatHistory = toBaseMessages(history)

  // Create the agent with its model, tools, and system prompt
  const reactAgent = createReactAgent({
    llm:           model,
    tools:         agent.tools,
    stateModifier: new SystemMessage(systemText),
  })

  // Track token usage across the whole conversation
  let inputTokens  = 0
  let outputTokens = 0
  const toolsUsed: string[] = []

  console.log(`[executor] running ${agent.name} with ${agent.tools.length} tools:`, agent.tools.map(t => t.name))

  try {
    // Start streaming events from the agent
    const stream = reactAgent.streamEvents(
      { messages: [...chatHistory, new HumanMessage(message)] },
      {
        version: "v2",
        recursionLimit: 8,
      }
    )

    // Each event tells us what the agent is doing right now
    for await (const event of stream) {
      // Log every event type so we can see what the LLM is doing
      if (!["on_chat_model_stream"].includes(event.event)) {
        console.log(`[executor] event: ${event.event}`, event.name ?? "")
      }

      // Agent started using a tool (e.g. web search)
      if (event.event === "on_tool_start") {
        const toolName = event.name ?? "tool"
        toolsUsed.push(toolName)
        yield {
          type:  "tool_start",
          tool:  toolName,
          input: extractToolInput(event.data?.input),
        }
        continue
      }

      // Tool finished and returned a result
      if (event.event === "on_tool_end") {
        const toolOutput = extractToolOutput(event.data?.output)
        yield {
          type:   "tool_end",
          tool:   event.name ?? "tool",
          output: toolOutput.output,
          code:   toolOutput.code,
          meta:   toolOutput.meta,
        }
        continue
      }

      // LLM finished one generation — collect token counts for usage logging
      if (event.event === "on_chat_model_end") {
        const usage = event.data?.output?.usage_metadata
          ?? event.data?.output?.llmOutput?.tokenUsage
          ?? event.data?.output?.llmOutput?.usage

        if (usage) {
          inputTokens  += (usage.input_tokens  ?? usage.prompt_tokens     ?? 0)
          outputTokens += (usage.output_tokens ?? usage.completion_tokens ?? 0)
        }
        continue
      }

      // LLM generated one token — send it to the browser immediately
      if (event.event === "on_chat_model_stream") {
        const chunk   = event.data?.chunk
        const content = chunk?.content

        if (typeof content === "string" && content) {
          yield { type: "token", content }
        }
        continue
      }

      // Something went wrong inside the agent
      if (event.event === "on_chain_error") {
        const errMsg = String((event.data as Record<string, unknown>)?.error ?? "Agent error")

        // Ignore LangGraph internal noise — these are not real errors
        if (errMsg.includes("empty response") || errMsg.includes("no content")) continue

        // Yield usage before returning so callers always receive a usage chunk
        yield { type: "usage", inputTokens, outputTokens, toolsUsed }
        yield { type: "error", message: errMsg, code: "UNKNOWN" }
        return
      }
    }

    // Stream finished — send final token usage summary
    yield { type: "usage", inputTokens, outputTokens, toolsUsed }

  } catch (err: unknown) {
    const normalized = normalizeAgentError(err)
    const msg = normalized.message

    // Ignore LangGraph internal noise in the catch block too
    if (msg.includes("empty response") || msg.includes("no content")) {
      yield { type: "usage", inputTokens, outputTokens, toolsUsed }
      return
    }

    yield { type: "usage", inputTokens, outputTokens, toolsUsed }
    yield { type: "error", message: msg, code: normalized.code }
  }
}

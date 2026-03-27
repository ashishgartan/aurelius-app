import type { Provider } from "../../types/chat.ts"

export interface TranscriptTurn {
  role: "user" | "assistant"
  content: string
}

export interface AiTranscriptFixture {
  name: string
  transcript: TranscriptTurn[]
  selectedProvider: Provider
  availableProviders: Provider[]
  expected: {
    provider: Provider
    agentName: string
    emailIntent: "none" | "draft" | "send"
    planIncludes: string[]
  }
}

export const AI_TRANSCRIPT_FIXTURES: AiTranscriptFixture[] = [
  {
    name: "structured email send request remains a send action",
    transcript: [
      { role: "user", content: "Please send an update to jane@example.com subject: Launch body: We are shipping today." },
    ],
    selectedProvider: "groq",
    availableProviders: ["groq", "qwen"],
    expected: {
      provider: "groq",
      agentName: "productivity_agent",
      emailIntent: "send",
      planIncludes: [
        "Validate recipient, subject, and body before using the email tool.",
        "Send one email and report the final delivery result.",
      ],
    },
  },
  {
    name: "email writing request stays in draft mode",
    transcript: [
      { role: "user", content: "Write an email to hiring@example.com explaining that I am available next week." },
    ],
    selectedProvider: "groq",
    availableProviders: ["groq", "qwen"],
    expected: {
      provider: "groq",
      agentName: "productivity_agent",
      emailIntent: "draft",
      planIncludes: ["Draft the email clearly and wait for explicit send approval."],
    },
  },
  {
    name: "lightweight conceptual prompt routes to qwen when available",
    transcript: [
      { role: "user", content: "What is polymorphism in OOP?" },
    ],
    selectedProvider: "groq",
    availableProviders: ["groq", "qwen"],
    expected: {
      provider: "qwen",
      agentName: "general_agent",
      emailIntent: "none",
      planIncludes: ["Answer directly without unnecessary tool use."],
    },
  },
  {
    name: "current information request stays on groq",
    transcript: [
      { role: "user", content: "What are the latest Nvidia announcements today?" },
    ],
    selectedProvider: "groq",
    availableProviders: ["groq", "qwen"],
    expected: {
      provider: "groq",
      agentName: "research_agent",
      emailIntent: "none",
      planIncludes: [
        "Search the live web for current information.",
        "Answer using sourced findings only.",
      ],
    },
  },
  {
    name: "current information plus send email uses the hybrid agent",
    transcript: [
      {
        role: "user",
        content:
          "latest news in india and send it as mail to gartan.ashish@codequotient.com",
      },
    ],
    selectedProvider: "groq",
    availableProviders: ["groq", "qwen"],
    expected: {
      provider: "groq",
      agentName: "research_productivity_agent",
      emailIntent: "send",
      planIncludes: [
        "Search the live web for current information.",
        "Draft the email subject and body from the sourced findings.",
        "Send one email and report the final delivery result.",
      ],
    },
  },
]

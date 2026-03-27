import type { ArtifactRef, ChatMessage, Provider, Role } from "@/types/chat"

type SharedArtifactInput = {
  artifactId?: unknown
  filename?: unknown
  lang?: unknown
  sizeBytes?: unknown
}

type SharedMessageInput = {
  role?: unknown
  content?: unknown
  model?: unknown
  createdAt?: unknown
  artifacts?: SharedArtifactInput[] | null
}

type SharedSessionInput = {
  provider: string
  updatedAt: Date | string
  messages: SharedMessageInput[]
}

function asRole(value: unknown): Role {
  return value === "assistant" ? "assistant" : "user"
}

function asProvider(value: unknown, fallback: Provider): Provider {
  return value === "qwen" || value === "groq" ? value : fallback
}

function asIsoDate(value: unknown, fallback: Date | string): string {
  const date = value ? new Date(value as string | Date) : new Date(fallback)
  return Number.isNaN(date.getTime()) ? new Date(fallback).toISOString() : date.toISOString()
}

function normalizeArtifacts(artifacts?: SharedArtifactInput[] | null): ArtifactRef[] | undefined {
  const refs = artifacts
    ?.map((artifact) => {
      if (typeof artifact?.artifactId !== "string") return null
      return {
        artifactId: artifact.artifactId,
        filename: typeof artifact.filename === "string" ? artifact.filename : "artifact",
        lang: typeof artifact.lang === "string" ? artifact.lang : "text",
        sizeBytes: typeof artifact.sizeBytes === "number" ? artifact.sizeBytes : 0,
      }
    })
    .filter((artifact): artifact is ArtifactRef => artifact !== null)

  return refs && refs.length > 0 ? refs : undefined
}

export function normalizeSharedMessages(session: SharedSessionInput): ChatMessage[] {
  return session.messages.map((message, index) => {
    const role = asRole(message.role)
    const provider = asProvider(session.provider, "groq")

    return {
      _id: `${role}-${message.createdAt ?? session.updatedAt}-${index}`,
      role,
      content: typeof message.content === "string" ? message.content : "",
      model: asProvider(message.model, provider),
      createdAt: asIsoDate(message.createdAt, session.updatedAt),
      artifacts: normalizeArtifacts(message.artifacts),
    }
  })
}

export function buildSharedArtifactMetadataUrl(token: string, artifactId: string) {
  return `/api/share/${encodeURIComponent(token)}/artifacts/${encodeURIComponent(artifactId)}?format=json`
}

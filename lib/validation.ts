// lib/validation.ts — Zod schemas for all API route inputs
import { z } from "zod"
import { ALL_TOOLS } from "../types/auth.ts"

const ToolIdSchema = z.enum(ALL_TOOLS)

// ── Auth (passwordless) ────────────────────────────────────────────

export const SendOtpSchema = z.object({
  email:       z.string().email("Valid email is required").max(254),
  displayName: z.string().min(1, "Name is required").max(60).trim().optional(),
})

export const VerifyOtpSchema = z.object({
  email:       z.string().email("Valid email is required").max(254),
  displayName: z.string().min(1).max(60).trim().optional(),
  code:        z.string().length(6, "Code must be 6 digits").regex(/^\d{6}$/, "Code must be 6 digits"),
})

// ── Profile ────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(60).trim().optional(),
  avatarUrl:   z.string().url("Invalid avatar URL").max(2048).optional().or(z.literal("")),
})

// ── Chat ───────────────────────────────────────────────────────────

export const ChatRequestSchema = z.object({
  message:      z.string().min(1, "message is required").max(32_000),
  displayMessage: z.string().min(1).max(32_000).optional(),
  provider:     z.enum(["groq", "qwen"]).default("groq"),
  sessionId:    z.string().max(64).default(""),
  saveUser:     z.boolean().default(true),
  instructions: z.string().max(2000).default(""),
  memory:       z.string().max(1000).default(""),
  language:     z.string().max(50).default("English"),
  length:       z.enum(["concise", "balanced", "detailed"]).default("balanced"),
  tone:         z.enum(["professional", "casual", "technical"]).default("professional"),
  enabledTools: z
    .array(ToolIdSchema)
    .optional()
    .transform((items) => (items ? Array.from(new Set(items)) : items)),
})

// ── Sessions ───────────────────────────────────────────────────────

export const CreateSessionSchema = z.object({
  provider: z.enum(["groq", "qwen"]).default("groq"),
})

export const UpdateSessionSchema = z.object({
  provider: z.enum(["groq", "qwen"]).optional(),
  clearMessages: z.boolean().optional(),
  title: z.string().min(1).max(200).trim().optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
})

export const AppendMessageSchema = z.object({
  role:    z.enum(["user", "assistant"]),
  content: z.string().min(1).max(32_000),
  model:   z.string().max(64).default("groq"),
})

export const UsageLogSchema = z.object({
  sessionId: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid sessionId"),
  model: z.string().max(128),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  toolCalls: z.array(z.string().max(128)),
})

// ── Settings ───────────────────────────────────────────────────────

export const UserSettingsSchema = z.object({
  instructions: z.string().max(2000).default(""),
  memory:       z.string().max(1000).default(""),
  language:     z.string().max(50).default("English"),
  length:       z.enum(["concise", "balanced", "detailed"]).default("balanced"),
  tone:         z.enum(["professional", "casual", "technical"]).default("professional"),
  enabledTools: z
    .array(ToolIdSchema)
    .default([])
    .transform((items) => Array.from(new Set(items))),
  smtpUser:     z.string().max(256).optional(),
  smtpPass:     z.string().max(512).optional(),
})

export const SmtpCredentialsSchema = z.object({
  smtpUser: z.string().min(1).max(256),
  smtpPass: z.string().min(1).max(512),
})

// ── Export ─────────────────────────────────────────────────────────

export const ExportNotesSchema = z.object({
  title:    z.string().max(200).default("Untitled"),
  messages: z
    .array(z.object({
      role:    z.enum(["user", "assistant"]),
      content: z.string().max(32_000),
    }))
    .min(1, "No messages provided")
    .max(500),
})

// ── Helper ─────────────────────────────────────────────────────────

export function parseBody<T>(
  schema: z.ZodType<T>,
  data: unknown
): { ok: true; data: T } | { ok: false; response: Response } {
  const result = schema.safeParse(data)
  if (!result.success) {
    const message = result.error.errors[0]?.message ?? "Invalid request"
    return { ok: false, response: Response.json({ error: message }, { status: 400 }) }
  }
  return { ok: true, data: result.data }
}

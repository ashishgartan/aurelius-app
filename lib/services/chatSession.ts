// lib/services/chatSession.ts
import { deleteArtifacts } from "@/lib/cloudinary"
import { connectDB } from "@/lib/mongodb"
import { ChatSession } from "@/lib/models/ChatSession"
import { ArtifactModel } from "@/lib/models"
import { Types } from "mongoose"

// ── LLM title generator ────────────────────────────────────────────
// Calls Groq with a minimal prompt to produce a 4-6 word title.
// Falls back silently if the API key is missing or the call fails —
// the session keeps its "New chat" title rather than erroring out.
async function generateTitle(
  userMessage:      string,
  assistantMessage: string
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // Use the fastest/cheapest model for this — not the main chat model
        model:      "llama-3.1-8b-instant",
        max_tokens: 20,
        temperature: 0.3,
        messages: [
          {
            role:    "system",
            content: "Generate a concise 4-6 word title for this conversation. " +
                     "Return ONLY the title — no quotes, no punctuation, no explanation. " +
                     "Make it specific and descriptive, not generic.",
          },
          {
            role:    "user",
            content: `User: ${userMessage.slice(0, 300)}\n\nAssistant: ${assistantMessage.slice(0, 300)}`,
          },
        ],
      }),
    })

    if (!res.ok) return null

    const data  = await res.json()
    const raw   = data.choices?.[0]?.message?.content?.trim() ?? ""

    // Sanitise — strip any quotes the model might add despite instructions
    const title = raw.replace(/^["']|["']$/g, "").trim()
    return title.length > 0 && title.length < 80 ? title : null
  } catch {
    return null
  }
}

// ── Session title updater ──────────────────────────────────────────
export async function setSessionTitle(
  sessionId: string,
  userId:    string,
  title:     string
) {
  await connectDB()
  await ChatSession.updateOne(
    {
      _id:    new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
      // Only update if still on the default title — never overwrite
      // a title the user or a previous generation already set
      title: "New chat",
    },
    { $set: { title } }
  )
}

// ── Core session operations ────────────────────────────────────────

export async function listSessions(userId: string) {
  await connectDB()
  return ChatSession
    .find({ userId: new Types.ObjectId(userId) })
    .select("-messages")
    .sort({ archived: 1, pinned: -1, updatedAt: -1 })
    .lean()
}

export async function getSession(sessionId: string, userId: string) {
  await connectDB()
  const session = await ChatSession.findOne({
    _id:    new Types.ObjectId(sessionId),
    userId: new Types.ObjectId(userId),
  }).lean() as SessionWithMessages | null

  if (!session) return null
  return hydrateSessionArtifacts(session)
}

export async function createSession(userId: string, provider = "groq") {
  await connectDB()
  return ChatSession.create({ userId: new Types.ObjectId(userId), provider })
}

// Returns { message, title? }
// title is returned when the first assistant message triggers LLM auto-titling.
//
// Trigger logic:
//   - User message   → just append, no title generation
//   - Assistant message AND only one user message exists so far
//     → generate title from the first exchange (user Q + assistant A)
export async function appendMessage(
  sessionId: string,
  userId:    string,
  role:      "user" | "assistant",
  content:   string,
  model:     string,
  artifacts: Array<{
    artifactId: string
    filename: string
    lang: string
    sizeBytes: number
  }> = []
): Promise<{ message?: object; title?: string }> {
  await connectDB()

  const message = {
    _id:       new Types.ObjectId(),
    role, content, model,
    createdAt: new Date(),
    ...(artifacts.length > 0 ? { artifacts } : {}),
  }

  // Append the message atomically
  const updated = await ChatSession.findOneAndUpdate(
    { _id: new Types.ObjectId(sessionId), userId: new Types.ObjectId(userId) },
    [
      {
        $set: {
          messages:  { $concatArrays: ["$messages", [message]] },
          updatedAt: new Date(),
        },
      },
    ],
    { new: true, projection: { title: 1, messages: 1 } }
  )

  if (!updated) return {}

  // Check if this is the right moment to generate a title:
  // exactly one user message and one assistant message exist after this append
  // (i.e. this IS the first assistant reply)
  if (
    role === "assistant" &&
    updated.title === "New chat"
  ) {
    const msgs = updated.messages as Array<{ role: string; content: string }>
    const userMessages  = msgs.filter((m) => m.role === "user")
    const asstMessages  = msgs.filter((m) => m.role === "assistant")

    if (userMessages.length === 1 && asstMessages.length === 1) {
      const userText = userMessages[0].content
      const asstText = content   // use the freshly appended assistant content

      // Fire-and-forget title generation — don't block the response
      // The generated title is returned to the caller who sends it to the client
      const newTitle = await generateTitle(userText, asstText)
      if (newTitle) {
        await setSessionTitle(sessionId, userId, newTitle)
        return { message, title: newTitle }
      }
    }
  }

  return { message }
}

export async function updateProvider(sessionId: string, userId: string, provider: string) {
  await connectDB()
  await ChatSession.updateOne(
    { _id: new Types.ObjectId(sessionId), userId: new Types.ObjectId(userId) },
    { $set: { provider } }
  )
}

export async function updateSessionTitle(sessionId: string, userId: string, title: string) {
  await connectDB()
  await ChatSession.updateOne(
    { _id: new Types.ObjectId(sessionId), userId: new Types.ObjectId(userId) },
    { $set: { title, updatedAt: new Date() } }
  )
}

export async function updateSessionPinned(
  sessionId: string,
  userId: string,
  pinned: boolean
) {
  await connectDB()
  await ChatSession.updateOne(
    { _id: new Types.ObjectId(sessionId), userId: new Types.ObjectId(userId) },
    { $set: { pinned } }
  )
}

export async function updateSessionArchived(
  sessionId: string,
  userId: string,
  archived: boolean
) {
  await connectDB()
  await ChatSession.updateOne(
    { _id: new Types.ObjectId(sessionId), userId: new Types.ObjectId(userId) },
    { $set: archived ? { archived, pinned: false } : { archived } }
  )
}

export async function deleteSession(sessionId: string, userId: string) {
  await connectDB()
  await ChatSession.deleteOne({
    _id:    new Types.ObjectId(sessionId),
    userId: new Types.ObjectId(userId),
  })
}

export async function clearMessages(sessionId: string, userId: string) {
  await connectDB()
  await deleteArtifactsForRange(sessionId, userId, 0)
  await ChatSession.updateOne(
    { _id: new Types.ObjectId(sessionId), userId: new Types.ObjectId(userId) },
    { $set: { messages: [], title: "New chat", updatedAt: new Date() } }
  )
}

export async function truncateMessages(
  sessionId: string,
  userId:    string,
  fromIndex: number
) {
  await connectDB()
  await deleteArtifactsForRange(sessionId, userId, fromIndex)
  await ChatSession.updateOne(
    { _id: new Types.ObjectId(sessionId), userId: new Types.ObjectId(userId) },
    [
      {
        $set: {
          messages:  { $slice: ["$messages", fromIndex] },
          updatedAt: new Date(),
        },
      },
    ]
  )
}

// ── Sharing ────────────────────────────────────────────────────────

// Generates a random URL-safe token without external deps
function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("")
}

export async function createShareToken(
  sessionId: string,
  userId:    string
): Promise<string> {
  await connectDB()
  const token = generateToken()
  await ChatSession.updateOne(
    { _id: new Types.ObjectId(sessionId), userId: new Types.ObjectId(userId) },
    { $set: { shareToken: token } }
  )
  return token
}

export async function revokeShareToken(
  sessionId: string,
  userId:    string
): Promise<void> {
  await connectDB()
  await ChatSession.updateOne(
    { _id: new Types.ObjectId(sessionId), userId: new Types.ObjectId(userId) },
    { $set: { shareToken: null } }
  )
}

type SharedSession = {
  _id: Types.ObjectId
  title: string
  provider: string
  updatedAt: string
  messages: Array<{
    role: string
    content: string
    model?: string
    createdAt?: string
    artifacts?: Array<{
      artifactId: string
      filename: string
      lang: string
      sizeBytes: number
    }>
  }>
}

export async function getSessionByToken(token: string): Promise<SharedSession | null> {
  await connectDB()
  const session = await ChatSession.findOne({ shareToken: token }).lean() as SharedSession | null
  if (!session) return null
  return hydrateSessionArtifacts(session)
}

type SessionWithMessages = {
  _id: Types.ObjectId
  messages: Array<{
    role: string
    content: string
    artifacts?: Array<{
      artifactId: string
      filename: string
      lang: string
      sizeBytes: number
    }>
  }>
}

async function hydrateSessionArtifacts<T extends SessionWithMessages>(session: T): Promise<T> {
  const artifactIds = Array.from(
    new Set(
      session.messages.flatMap((message) => {
        const fromMessage = message.artifacts?.map((artifact) => artifact.artifactId) ?? []
        const fromPlaceholders = Array.from(
          message.content.matchAll(/\[artifact:([a-f0-9]{24})\]/g)
        ).map((match) => match[1])
        return [...fromMessage, ...fromPlaceholders]
      })
    )
  )

  if (artifactIds.length === 0) {
    return {
      ...session,
      messages: session.messages.map((message) => ({
        ...message,
        content: message.content.replace(/\s*\[artifact:[a-f0-9]{24}\]\s*/g, "\n").trim(),
      })),
    }
  }

  const artifacts = await ArtifactModel.find({
    _id: { $in: artifactIds.map((id) => new Types.ObjectId(id)) },
    sessionId: session._id,
  })
    .select("_id filename lang sizeBytes favorite")
    .lean()

  const artifactMap = new Map(
    artifacts.map((artifact) => [
      artifact._id.toString(),
      {
        artifactId: artifact._id.toString(),
        filename: artifact.filename,
        lang: artifact.lang,
        sizeBytes: artifact.sizeBytes,
        favorite: "favorite" in artifact ? Boolean(artifact.favorite) : false,
      },
    ])
  )

  return {
    ...session,
    messages: session.messages.map((message) => {
      const ids = Array.from(
        new Set([
          ...(message.artifacts?.map((artifact) => artifact.artifactId) ?? []),
          ...Array.from(message.content.matchAll(/\[artifact:([a-f0-9]{24})\]/g)).map(
            (match) => match[1]
          ),
        ])
      )

      const hydratedArtifacts = ids
        .map((id) => artifactMap.get(id))
        .filter((artifact): artifact is NonNullable<typeof artifact> => Boolean(artifact))

      return {
        ...message,
        content: message.content.replace(/\s*\[artifact:[a-f0-9]{24}\]\s*/g, "\n").trim(),
        ...(hydratedArtifacts.length > 0 ? { artifacts: hydratedArtifacts } : {}),
      }
    }),
  }
}

async function deleteArtifactsForRange(
  sessionId: string,
  userId: string,
  fromIndex: number
): Promise<void> {
  const session = await ChatSession.findOne({
    _id: new Types.ObjectId(sessionId),
    userId: new Types.ObjectId(userId),
  })
    .select("messages")
    .lean() as SessionWithMessages | null

  if (!session) return

  const removedMessages = session.messages.slice(fromIndex)
  const artifactIds = collectArtifactIds(removedMessages)
  if (artifactIds.length === 0) return

  const artifacts = await ArtifactModel.find({
    _id: { $in: artifactIds.map((id) => new Types.ObjectId(id)) },
    sessionId: new Types.ObjectId(sessionId),
    userId: new Types.ObjectId(userId),
  })
    .select("_id cloudinaryPublicId")
    .lean()

  if (artifacts.length === 0) return

  await deleteArtifacts(artifacts.map((artifact) => artifact.cloudinaryPublicId)).catch(
    console.error
  )
  await ArtifactModel.deleteMany({
    _id: { $in: artifacts.map((artifact) => artifact._id) },
    sessionId: new Types.ObjectId(sessionId),
    userId: new Types.ObjectId(userId),
  })
}

function collectArtifactIds(messages: SessionWithMessages["messages"]): string[] {
  return Array.from(
    new Set(
      messages.flatMap((message) => [
        ...(message.artifacts?.map((artifact) => artifact.artifactId) ?? []),
        ...Array.from(message.content.matchAll(/\[artifact:([a-f0-9]{24})\]/g)).map(
          (match) => match[1]
        ),
      ])
    )
  )
}

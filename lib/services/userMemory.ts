import { Types } from "mongoose"
import { connectDB } from "@/lib/mongodb"
import {
  extractMemoryCandidates,
} from "@/lib/memory/extractCandidates"
import {
  UserMemory,
  type IUserMemory,
  type MemoryCategory,
  type MemorySensitivity,
} from "@/lib/models"

export interface MemoryRecord {
  id: string
  category: MemoryCategory
  key: string
  value: string
  confidence: number
  pinned: boolean
  evidenceCount: number
  status: string
  sensitivity: MemorySensitivity
  sourceKind: string
  sourceExcerpt?: string
  lastSeenAt?: string
  lastConfirmedAt?: string
  createdAt: string
  updatedAt: string
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}
export { extractMemoryCandidates }

function toRecord(memory: IUserMemory): MemoryRecord {
  return {
    id: memory._id.toString(),
    category: memory.category,
    key: memory.key,
    value: memory.value,
    confidence: memory.confidence,
    pinned: memory.pinned,
    evidenceCount: memory.evidenceCount,
    status: memory.status,
    sensitivity: memory.sensitivity,
    sourceKind: memory.source.kind,
    sourceExcerpt: memory.source.excerpt,
    lastSeenAt: memory.lastSeenAt?.toISOString(),
    lastConfirmedAt: memory.lastConfirmedAt?.toISOString(),
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  }
}

export async function listUserMemories(userId: string): Promise<MemoryRecord[]> {
  await connectDB()
  const docs = (await UserMemory.find({
    userId: new Types.ObjectId(userId),
    status: { $ne: "dismissed" },
  })
    .sort({ pinned: -1, category: 1, confidence: -1, updatedAt: -1 })
    .lean()) as unknown as IUserMemory[]

  return docs.map(toRecord)
}

export async function createManualMemory(
  userId: string,
  input: {
    category: MemoryCategory
    key: string
    value: string
    pinned?: boolean
  }
): Promise<MemoryRecord> {
  await connectDB()
  const now = new Date()
  const key = input.key.trim().toLowerCase()
  const value = input.value.trim()
  const normalizedValue = normalizeValue(value)

  if (["name", "role", "timezone", "response_style", "preferred_stack"].includes(key)) {
    await UserMemory.updateMany(
      {
        userId: new Types.ObjectId(userId),
        key,
        status: "active",
        normalizedValue: { $ne: normalizedValue },
      },
      { $set: { status: "superseded" } }
    )
  }

  const doc = await UserMemory.findOneAndUpdate(
    {
      userId: new Types.ObjectId(userId),
      key,
      normalizedValue,
      status: "active",
    },
    {
      $set: {
        category: input.category,
        value,
        confidence: 1,
        pinned: Boolean(input.pinned),
        sensitivity: "low",
        source: { kind: "manual", excerpt: value },
        lastSeenAt: now,
        lastConfirmedAt: now,
      },
      $inc: { evidenceCount: 1 },
      $setOnInsert: {
        normalizedValue,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  return toRecord(doc as IUserMemory)
}

export async function updateUserMemoryRecord(
  userId: string,
  memoryId: string,
  patch: {
    value?: string
    pinned?: boolean
    category?: MemoryCategory
    status?: "active" | "dismissed"
  }
): Promise<MemoryRecord | null> {
  await connectDB()
  const update: Record<string, unknown> = {}
  if (patch.value !== undefined) {
    update.value = patch.value.trim()
    update.normalizedValue = normalizeValue(patch.value)
    update.lastConfirmedAt = new Date()
  }
  if (patch.pinned !== undefined) update.pinned = patch.pinned
  if (patch.category) update.category = patch.category
  if (patch.status) update.status = patch.status

  const doc = await UserMemory.findOneAndUpdate(
    {
      _id: new Types.ObjectId(memoryId),
      userId: new Types.ObjectId(userId),
    },
    { $set: update },
    { new: true }
  )

  return doc ? toRecord(doc) : null
}

export async function deleteUserMemoryRecord(
  userId: string,
  memoryId: string
): Promise<boolean> {
  await connectDB()
  const result = await UserMemory.deleteOne({
    _id: new Types.ObjectId(memoryId),
    userId: new Types.ObjectId(userId),
  })
  return result.deletedCount === 1
}

export async function ingestMemoriesFromMessage(
  userId: string,
  message: string,
  opts?: { sessionId?: string; messageId?: string }
): Promise<MemoryRecord[]> {
  const candidates = extractMemoryCandidates(message)
  if (candidates.length === 0) return []

  await connectDB()
  const now = new Date()
  const saved: MemoryRecord[] = []

  for (const candidate of candidates) {
    const normalizedValue = normalizeValue(candidate.value)

    if (["name", "role", "timezone", "response_style", "preferred_stack"].includes(candidate.key)) {
      await UserMemory.updateMany(
        {
          userId: new Types.ObjectId(userId),
          key: candidate.key,
          status: "active",
          normalizedValue: { $ne: normalizedValue },
        },
        { $set: { status: "superseded" } }
      )
    }

    const doc = await UserMemory.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        key: candidate.key,
        normalizedValue,
        status: "active",
      },
      {
        $set: {
          category: candidate.category,
          value: candidate.value,
          confidence: Math.min(1, candidate.confidence),
          sensitivity: candidate.sensitivity,
          source: {
            kind: candidate.sourceKind,
            ...(opts?.sessionId && Types.ObjectId.isValid(opts.sessionId)
              ? { sessionId: new Types.ObjectId(opts.sessionId) }
              : {}),
            ...(opts?.messageId ? { messageId: opts.messageId } : {}),
            ...(candidate.excerpt ? { excerpt: candidate.excerpt.slice(0, 500) } : {}),
          },
          lastSeenAt: now,
          ...(candidate.confidence >= 0.9 ? { lastConfirmedAt: now } : {}),
        },
        $inc: { evidenceCount: 1 },
        $setOnInsert: {
          normalizedValue,
          pinned: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    saved.push(toRecord(doc as IUserMemory))
  }

  return saved
}

export async function buildMemoryContext(
  userId: string,
  query: string
): Promise<string> {
  await connectDB()
  const docs = (await UserMemory.find({
    userId: new Types.ObjectId(userId),
    status: "active",
  })
    .sort({ pinned: -1, confidence: -1, evidenceCount: -1, updatedAt: -1 })
    .lean()) as unknown as IUserMemory[]

  if (docs.length === 0) return ""

  const normalizedQuery = normalizeValue(query)
  const profile = docs.filter((doc) => doc.category === "profile" || doc.category === "preference")
  const pinned = profile.filter((doc) => doc.pinned)
  const stable = profile.filter((doc) => !doc.pinned).slice(0, 6)
  const interests = docs
    .filter((doc) => doc.category === "interest")
    .map((doc) => {
      const tokens = normalizeValue(doc.value).split(" ")
      const score = tokens.reduce(
        (acc, token) => acc + (normalizedQuery.includes(token) ? 1 : 0),
        0
      ) + doc.evidenceCount
      return { doc, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => entry.doc)

  const working = docs.filter((doc) => doc.category === "working").slice(0, 3)

  const lines: string[] = []
  const stableItems = [...pinned, ...stable]
  if (stableItems.length > 0) {
    lines.push("Stable user memory:")
    for (const memory of stableItems) {
      lines.push(`- ${memory.key}: ${memory.value}`)
    }
  }

  if (interests.length > 0) {
    lines.push("", "Likely user interests:")
    for (const memory of interests) {
      lines.push(`- ${memory.value}`)
    }
  }

  if (working.length > 0) {
    lines.push("", "Current temporary context:")
    for (const memory of working) {
      lines.push(`- ${memory.key}: ${memory.value}`)
    }
  }

  return lines.join("\n").trim()
}

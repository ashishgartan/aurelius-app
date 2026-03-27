// lib/services/ragService.ts
// RAG pipeline: chunk → embed (TF-IDF) → store → search → inject
// Uses TF-IDF cosine similarity — no external API or vector DB needed.

import { connectDB } from "@/lib/mongodb"
import { DocumentModel } from "@/lib/models/Document"
import { Types } from "mongoose"
import { extractText } from "@/lib/services/textExtractor"
import { getSession } from "@/lib/services/chatSession"
import { assertOwnedSession } from "@/lib/services/sessionAccess"

// ── Chunking ────────────────────────────────────────────────────────
const CHUNK_SIZE    = 800    // chars per chunk
const CHUNK_OVERLAP = 150   // overlap between chunks

export function chunkText(text: string): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length)

    // Try to find a natural break point in the final 200 chars of the window
    if (end < text.length) {
      const lookback = text.slice(Math.max(end - 200, start), end)
      const paraBreak = lookback.lastIndexOf("\n\n")
      const sentBreak = Math.max(
        lookback.lastIndexOf(". "),
        lookback.lastIndexOf("! "),
        lookback.lastIndexOf("? ")
      )
      const lineBreak = lookback.lastIndexOf("\n")

      const offset =
        paraBreak  > 0 ? paraBreak  + 2 :
        sentBreak  > 0 ? sentBreak  + 2 :
        lineBreak  > 0 ? lineBreak  + 1 :
        lookback.length   // hard cut at window boundary

      const candidate = Math.max(end - 200, start) + offset
      // Only use the break point if it actually advances past start
      if (candidate > start) end = candidate
    }

    const chunk = text.slice(start, end).trim()
    if (chunk.length > 50) chunks.push(chunk)

    // Advance by at least 1 char to guarantee termination
    const next = end - CHUNK_OVERLAP
    start = next > start ? next : start + 1
  }

  return chunks
}

// ── TF-IDF vectorisation ───────────────────────────────────────────
// Builds a sparse term-frequency vector for a piece of text.
// Words are normalised (lowercase, stemmed by stripping common suffixes).

const STOPWORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","are","was","were","be","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might",
  "that","this","these","those","it","its","we","our","you","your","i",
  "my","he","his","she","her","they","their","what","which","who","when",
  "where","how","why","not","no","up","out","if","so","as","into","than",
  "more","also","all","any","both","each","few","most","other","some",
])

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

function tfVector(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1)
  const total = tokens.length || 1
  const tf = new Map<string, number>()
  for (const [t, c] of freq) tf.set(t, c / total)
  return tf
}

function cosineSimilarityDirect(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  let dot = 0
  let magA = 0
  let magB = 0

  for (const [term, va] of a) {
    magA += va * va
    const vb = b.get(term) ?? 0
    if (vb !== 0) dot += va * vb
  }
  for (const [, vb] of b) magB += vb * vb

  const mag = Math.sqrt(magA) * Math.sqrt(magB)
  return mag === 0 ? 0 : dot / mag
}


// ── Document CRUD ───────────────────────────────────────────────────

export interface UploadedDoc {
  _id:       string
  filename:  string
  sizeBytes: number
  charCount: number
  chunks:    number
  createdAt: string
}

export async function ensureSessionAccess(
  sessionId: string,
  userId: string
): Promise<void> {
  await assertOwnedSession(sessionId, userId, getSession)
}

export async function ingestDocument(
  userId:    string,
  sessionId: string,
  filename:  string,
  mimeType:  string,
  buffer:    Buffer
): Promise<UploadedDoc> {
  await ensureSessionAccess(sessionId, userId)
  await connectDB()

  // 1. Extract text
  let fullText: string
  try {
    fullText = extractText(filename, mimeType, buffer)
  } catch (err) {
    console.error("[RAG] text extraction failed:", err)
    throw new Error("Failed to extract text from this file.")
  }

  if (!fullText.trim()) {
    throw new Error(
      "No text could be extracted from this file. " +
      "PDFs must contain selectable text (not scanned images). " +
      "Try copying text from the file first — if you can't, it may be image-only."
    )
  }

  // Guard: limit documents per session to avoid unbounded storage growth
  const MAX_DOCS_PER_SESSION = 20
  const existingCount = await DocumentModel.countDocuments({
    sessionId: new Types.ObjectId(sessionId),
    userId:    new Types.ObjectId(userId),
  })
  if (existingCount >= MAX_DOCS_PER_SESSION) {
    throw new Error(
      `Session document limit reached (max ${MAX_DOCS_PER_SESSION} files per session). ` +
      "Delete an existing file before uploading a new one."
    )
  }

  // 2. Chunk
  const allChunkTexts = chunkText(fullText)
  // Cap at 100 chunks to stay well within MongoDB 16MB doc limit
  const MAX_CHUNKS = 100
  const chunkTexts = allChunkTexts.slice(0, MAX_CHUNKS)
  if (allChunkTexts.length > MAX_CHUNKS) {
    console.warn(`[RAG] ${filename}: truncated from ${allChunkTexts.length} to ${MAX_CHUNKS} chunks`)
  }

  // 3. Store chunks — embeddings are computed at query time from chunk text,
  //    so we store an empty array here to avoid hash collision issues.
  const chunks = chunkTexts.map((text, index) => {
    const tokens = tokenise(text)
    const tf     = tfVector(tokens)
    // Convert Map to plain object for Mongoose
    const tfMap: Record<string, number> = {}
    for (const [k, v] of tf) tfMap[k] = v

    return {
      index,
      text,
      embedding: [] as number[],
      tfMap,
    }
  })

  // 4. Store
  const doc = await DocumentModel.create({
    userId:    new Types.ObjectId(userId),
    sessionId: new Types.ObjectId(sessionId),
    filename,
    mimeType,
    sizeBytes: buffer.length,
    charCount: fullText.length,
    chunks,
  })

  return {
    _id:       doc._id.toString(),
    filename:  doc.filename,
    sizeBytes: doc.sizeBytes,
    charCount: doc.charCount,
    chunks:    chunks.length,
    createdAt: doc.createdAt.toISOString(),
  }
}

export async function listDocuments(
  sessionId: string,
  userId:    string
): Promise<UploadedDoc[]> {
  await ensureSessionAccess(sessionId, userId)
  await connectDB()
  const docs = await DocumentModel.find({
    sessionId: new Types.ObjectId(sessionId),
    userId:    new Types.ObjectId(userId),
  })
  .select("filename sizeBytes charCount createdAt chunks.index")
  .lean()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return docs.map((d: any) => ({
    _id:       d._id.toString(),
    filename:  d.filename,
    sizeBytes: d.sizeBytes,
    charCount: d.charCount,
    chunks:    d.chunks.length,
    createdAt: d.createdAt.toISOString(),
  }))
}

export async function deleteDocument(
  sessionId: string,
  docId:  string,
  userId: string
): Promise<void> {
  await ensureSessionAccess(sessionId, userId)
  await connectDB()
  await DocumentModel.deleteOne({
    _id:    new Types.ObjectId(docId),
    sessionId: new Types.ObjectId(sessionId),
    userId: new Types.ObjectId(userId),
  })
}

// ── Retrieval ────────────────────────────────────────────────────────

const TOP_K = 5   // number of chunks to inject

export async function retrieveRelevantChunks(
  sessionId: string,
  userId:    string,
  query:     string
): Promise<string> {
  await ensureSessionAccess(sessionId, userId)
  await connectDB()

  const docs = await DocumentModel.find({
    sessionId: new Types.ObjectId(sessionId),
    userId:    new Types.ObjectId(userId),
  }).lean()

  if (docs.length === 0) return ""

  // Build query vector
  const queryTokens = tokenise(query)
  const queryVec    = tfVector(queryTokens)

  // Score every chunk across all documents by computing TF vectors on the fly.
  // This avoids any hash collision issues — string keys are exact.
  const scored: { filename: string; text: string; score: number }[] = []

  for (const doc of docs) {
    for (const chunk of doc.chunks) {
      let chunkVec: Map<string, number>

      if (chunk.tfMap && Object.keys(chunk.tfMap).length > 0) {
        // Use pre-calculated TF map
        chunkVec = new Map(Object.entries(chunk.tfMap))
      } else {
        // Fallback for older documents: calculate on the fly
        chunkVec = tfVector(tokenise(chunk.text))
      }

      const score = cosineSimilarityDirect(queryVec, chunkVec)
      scored.push({ filename: doc.filename, text: chunk.text, score })
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Strategy:
  // - If query has meaningful keywords (score > 0.01), inject top-K relevant chunks
  // - If query is generic ("analyse this file", "summarise", "what does it say?"),
  //   inject the first N chunks from each doc so the LLM always has context
  const relevantChunks = scored.slice(0, TOP_K).filter((c) => c.score > 0.01)

  let topChunks: typeof scored
  if (relevantChunks.length > 0) {
    topChunks = relevantChunks
  } else {
    // Generic query — inject the first 2 chunks from each document.
    // Use a Set to deduplicate by chunk text across documents.
    const seen = new Set<string>()
    topChunks  = []
    for (const doc of docs) {
      for (const chunk of doc.chunks.slice(0, 2)) {
        if (!seen.has(chunk.text)) {
          seen.add(chunk.text)
          topChunks.push({ filename: doc.filename, text: chunk.text, score: 0 })
        }
      }
    }
    topChunks = topChunks.slice(0, TOP_K)
  }

  if (topChunks.length === 0) return ""

  // List all attached filenames in the header so the LLM knows what exists
  const allFilenames = [...new Set(docs.map((d) => d.filename))]
  const fileList = allFilenames.map((f) => `• ${f}`).join("\n")

  // Format for injection into the system prompt
  const sections = topChunks.map((c, i) =>
    `[Source: ${c.filename}, excerpt ${i + 1}]\n${c.text}`
  )

  return [
    `The user has attached the following document(s) to this conversation:`,
    fileList,
    "",
    "Relevant excerpts from these documents:",
    "---",
    sections.join("\n\n---\n\n"),
    "---",
    "Answer using the document content above. Always cite which file you are referencing.",
    "If the user asks to analyse, summarise, or explain the file — do so based on these excerpts.",
  ].join("\n")
}

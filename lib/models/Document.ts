// lib/models/Document.ts
import { Schema, model, models, Document, Types } from "mongoose"

export interface IDocumentChunk {
  index:     number
  text:      string
  embedding: number[]   // Dense embedding (unused for now)
  tfMap?:    Record<string, number> // Pre-calculated TF map for fast retrieval
}

export interface IDocument extends Document {
  userId:    Types.ObjectId
  sessionId: Types.ObjectId    // which chat session this belongs to
  filename:  string
  mimeType:  string
  sizeBytes: number
  charCount: number
  chunks:    IDocumentChunk[]
  createdAt: Date
}

const ChunkSchema = new Schema<IDocumentChunk>(
  {
    index:     { type: Number, required: true },
    text:      { type: String, required: true },
    embedding: { type: [Number], default: [] },
    tfMap:     { type: Map, of: Number },
  },
  { _id: false }
)

const DocumentSchema = new Schema<IDocument>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: "User",        required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "ChatSession", required: true, index: true },
    filename:  { type: String, required: true },
    mimeType:  { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    charCount: { type: Number, default: 0 },
    chunks:    { type: [ChunkSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

DocumentSchema.index({ sessionId: 1, createdAt: -1 })

export const DocumentModel =
  models.Document || model<IDocument>("Document", DocumentSchema)
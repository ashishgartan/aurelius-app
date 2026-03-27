import mongoose, { Schema, model, models, type Document, Types } from "mongoose"

export type MemoryCategory = "profile" | "preference" | "interest" | "working"
export type MemoryStatus = "active" | "superseded" | "dismissed"
export type MemorySensitivity = "low" | "medium" | "high"
export type MemorySourceKind = "user_message" | "manual" | "system_inferred"

export interface IUserMemory extends Document {
  userId: Types.ObjectId
  category: MemoryCategory
  key: string
  value: string
  normalizedValue?: string
  confidence: number
  pinned: boolean
  evidenceCount: number
  status: MemoryStatus
  sensitivity: MemorySensitivity
  source: {
    kind: MemorySourceKind
    sessionId?: Types.ObjectId
    messageId?: string
    excerpt?: string
  }
  lastSeenAt?: Date
  lastConfirmedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const UserMemorySchema = new Schema<IUserMemory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: {
      type: String,
      enum: ["profile", "preference", "interest", "working"],
      required: true,
      index: true,
    },
    key: { type: String, required: true, trim: true, maxlength: 120, index: true },
    value: { type: String, required: true, trim: true, maxlength: 500 },
    normalizedValue: { type: String, trim: true, maxlength: 500, index: true },
    confidence: { type: Number, required: true, min: 0, max: 1, default: 0.7 },
    pinned: { type: Boolean, default: false, index: true },
    evidenceCount: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: ["active", "superseded", "dismissed"],
      default: "active",
      index: true,
    },
    sensitivity: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "low",
    },
    source: {
      kind: {
        type: String,
        enum: ["user_message", "manual", "system_inferred"],
        required: true,
      },
      sessionId: { type: Schema.Types.ObjectId, ref: "ChatSession" },
      messageId: { type: String, trim: true },
      excerpt: { type: String, trim: true, maxlength: 500 },
    },
    lastSeenAt: { type: Date },
    lastConfirmedAt: { type: Date },
  },
  { timestamps: true }
)

UserMemorySchema.index(
  { userId: 1, key: 1, normalizedValue: 1, status: 1 },
  { partialFilterExpression: { status: "active" } }
)

const existingUserMemoryModel = models.UserMemory
if (
  existingUserMemoryModel &&
  (
    !existingUserMemoryModel.schema.path("confidence") ||
    !existingUserMemoryModel.schema.path("source.kind")
  )
) {
  mongoose.deleteModel("UserMemory")
}

export const UserMemory =
  models.UserMemory || model<IUserMemory>("UserMemory", UserMemorySchema)

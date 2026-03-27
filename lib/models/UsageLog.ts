// lib/models/UsageLog.ts
import { Schema, model, models, Types } from "mongoose"

export interface IUsageLog {
  userId:       Types.ObjectId
  sessionId:    Types.ObjectId
  model:        string
  inputTokens:  number
  outputTokens: number
  toolCalls:    string[]   // tool names used in this message e.g. ["tavily_search","calculator"]
  createdAt:    Date
}

const UsageLogSchema = new Schema<IUsageLog>(
  {
    userId:       { type: Schema.Types.ObjectId, ref: "User",        required: true, index: true },
    sessionId:    { type: Schema.Types.ObjectId, ref: "ChatSession", required: true },
    model:        { type: String, required: true },
    inputTokens:  { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    toolCalls:    { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

// Compound index for fast per-user date-range queries
UsageLogSchema.index({ userId: 1, createdAt: -1 })

export const UsageLog =
  models.UsageLog || model<IUsageLog>("UsageLog", UsageLogSchema)
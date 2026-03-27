// lib/models/ChatSession.ts
import { Schema, model, models, Document, Types } from "mongoose"

export interface ISessionArtifact {
  artifactId: string
  filename: string
  lang: string
  sizeBytes: number
}

export interface ISessionMessage {
  _id:       Types.ObjectId
  role:      "user" | "assistant"
  content:   string
  model:     string
  createdAt: Date
  artifacts?: ISessionArtifact[]
}

export interface IChatSession extends Document {
  userId:     Types.ObjectId
  title:      string
  provider:   string
  pinned:     boolean
  archived:   boolean
  messages:   ISessionMessage[]
  shareToken: string | null   // null = not shared, string = public token
  createdAt:  Date
  updatedAt:  Date
}

const SessionMessageSchema = new Schema<ISessionMessage>(
  {
    role:    { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    model:   { type: String, default: "groq" },
    artifacts: {
      type: [
        new Schema<ISessionArtifact>(
          {
            artifactId: { type: String, required: true },
            filename: { type: String, required: true },
            lang: { type: String, required: true },
            sizeBytes: { type: Number, required: true },
          },
          { _id: false }
        ),
      ],
      default: undefined,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: true }
)

const ChatSessionSchema = new Schema<IChatSession>(
  {
    userId:     { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title:      { type: String, default: "New chat", trim: true },
    provider:   { type: String, default: "groq" },
    pinned:     { type: Boolean, default: false, index: true },
    archived:   { type: Boolean, default: false, index: true },
    messages:   { type: [SessionMessageSchema], default: [] },
    shareToken: { type: String, default: null,sparse: true,  index: { sparse: true, unique: true } },
  },
  { timestamps: true }
)

ChatSessionSchema.index({ userId: 1, archived: 1, pinned: -1, updatedAt: -1 })

export const ChatSession =
  models.ChatSession || model<IChatSession>("ChatSession", ChatSessionSchema)

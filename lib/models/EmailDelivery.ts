import { Schema, model, models, Types } from "mongoose"

export interface IEmailDelivery {
  userId: Types.ObjectId
  sessionId?: Types.ObjectId
  source: "chat_tool" | "smtp_test"
  smtpUser: string
  to: string
  subject: string
  status: "sent" | "failed"
  error?: string
  createdAt: Date
}

const EmailDeliverySchema = new Schema<IEmailDelivery>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "ChatSession",
      required: false,
    },
    source: {
      type: String,
      enum: ["chat_tool", "smtp_test"],
      required: true,
    },
    smtpUser: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    status: { type: String, enum: ["sent", "failed"], required: true },
    error: { type: String, required: false, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

EmailDeliverySchema.index({ userId: 1, createdAt: -1 })

export const EmailDelivery =
  models.EmailDelivery ||
  model<IEmailDelivery>("EmailDelivery", EmailDeliverySchema)

import { Types } from "mongoose"
import { connectDB } from "@/lib/mongodb"
import { EmailDelivery } from "@/lib/models/EmailDelivery"

export interface LogEmailDeliveryInput {
  userId: string
  sessionId?: string
  source: "chat_tool" | "smtp_test"
  smtpUser: string
  to: string
  subject: string
  status: "sent" | "failed"
  error?: string
}

export interface EmailDeliveryRecord {
  id: string
  sessionId?: string
  source: "chat_tool" | "smtp_test"
  smtpUser: string
  to: string
  subject: string
  status: "sent" | "failed"
  error?: string
  createdAt: string
}

export async function logEmailDelivery(input: LogEmailDeliveryInput) {
  await connectDB()

  await EmailDelivery.create({
    userId: new Types.ObjectId(input.userId),
    sessionId: input.sessionId ? new Types.ObjectId(input.sessionId) : undefined,
    source: input.source,
    smtpUser: input.smtpUser,
    to: input.to,
    subject: input.subject,
    status: input.status,
    error: input.error,
  })
}

export async function listEmailDeliveries(
  userId: string,
  limit = 20
): Promise<EmailDeliveryRecord[]> {
  await connectDB()

  const docs = await EmailDelivery.find({
    userId: new Types.ObjectId(userId),
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return docs.map((doc) => ({
    id: String(doc._id),
    sessionId: doc.sessionId ? String(doc.sessionId) : undefined,
    source: doc.source,
    smtpUser: doc.smtpUser,
    to: doc.to,
    subject: doc.subject,
    status: doc.status,
    error: doc.error,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : new Date(doc.createdAt).toISOString(),
  }))
}

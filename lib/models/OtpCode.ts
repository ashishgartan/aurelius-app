// lib/models/OtpCode.ts
// Stores hashed OTP codes for email verification during signup.
// TTL index auto-deletes expired docs — no cron needed.
import { Schema, model, models, Document } from "mongoose"

export interface IOtpCode extends Document {
  email:     string       // normalised lowercase email
  code:      string       // SHA-256 hash of the 6-digit code
  expiresAt: Date
  attempts:  number       // how many wrong guesses have been made
  createdAt: Date
}

const OtpCodeSchema = new Schema<IOtpCode>(
  {
    email:     { type: String, required: true, lowercase: true, trim: true },
    code:      { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    attempts:  { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

// One active OTP per email at a time
OtpCodeSchema.index({ email: 1 }, { unique: true })

export const OtpCode = models.OtpCode || model<IOtpCode>("OtpCode", OtpCodeSchema)
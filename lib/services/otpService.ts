// lib/services/otpService.ts
// Issues and verifies 6-digit OTP codes — used for both login and signup.

import crypto from "crypto"
import { connectDB } from "@/lib/mongodb"
import { OtpCode } from "@/lib/models/OtpCode"
import { sendOtpEmail } from "@/lib/services/email"
import { findUserByEmail } from "@/lib/services/user"

const OTP_TTL_MS   = 10 * 60 * 1000  // 10 minutes
const MAX_ATTEMPTS = 5

function hasAppEmailConfig(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  )
}

function hashCode(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex")
}

function generateOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0")
}

// ── Issue OTP ──────────────────────────────────────────────────────
// For login: displayName is pulled from the existing user record if found.
// For signup: caller provides displayName for new users.

export async function issueOtp(
  email:        string,
  displayName?: string   // optional override; falls back to existing user name
): Promise<void> {
  await connectDB()

  // Resolve display name: use existing user's name if available
  const existing = await findUserByEmail(email)
  const name = existing?.displayName ?? displayName ?? "there"

  const code      = generateOtp()
  const hashed    = hashCode(code)
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)

  // Upsert — one active OTP per email.
  // Wrapped in try/catch to handle the rare duplicate-key error that can
  // occur when two requests race on the unique email index. On collision
  // we retry once with a fresh code — the second attempt always wins
  // because the first upsert already created the doc.
  let finalCode = code
  try {
    await OtpCode.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { code: hashed, expiresAt, attempts: 0 },
      { upsert: true, new: true }
    )
  } catch (err: unknown) {
    const isDuplicate =
      err instanceof Error &&
      (err.message.includes("E11000") || err.message.includes("duplicate key"))

    if (!isDuplicate) throw err

    // Retry once with a fresh code
    finalCode = generateOtp()
    await OtpCode.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { code: hashCode(finalCode), expiresAt, attempts: 0 },
      { upsert: true, new: true }
    )
  }

  if (!hasAppEmailConfig()) {
    console.log(`\n[OTP] SMTP auth mailer not configured. Code for ${email}: ${finalCode}\n`)
    return
  }

  try {
    await sendOtpEmail(email, name, finalCode)
  } catch (err) {
    // Keep local auth usable even when the SMTP credentials or transport
    // are still being set up on a dev machine.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[OTP] SMTP delivery failed for ${email}. Using console fallback instead.`
      )
      console.log(`\n[OTP] Code for ${email}: ${finalCode}\n`)
      return
    }

    throw err
  }
}

// ── Verify OTP ─────────────────────────────────────────────────────
// Throws a user-facing error on failure. Deletes the record on success.

export async function verifyOtp(email: string, rawCode: string): Promise<void> {
  await connectDB()

  const record = await OtpCode.findOne({ email: email.toLowerCase().trim() })

  if (!record)
    throw new Error("No verification code found. Please request a new one.")

  if (record.expiresAt < new Date()) {
    await OtpCode.deleteOne({ _id: record._id })
    throw new Error("Code has expired. Please request a new one.")
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await OtpCode.deleteOne({ _id: record._id })
    throw new Error("Too many incorrect attempts. Please request a new code.")
  }

  if (record.code !== hashCode(rawCode.trim())) {
    record.attempts += 1
    await record.save()
    const left = MAX_ATTEMPTS - record.attempts
    throw new Error(
      left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} remaining.`
        : "Too many incorrect attempts. Please request a new code."
    )
  }

  // Valid — consume it
  await OtpCode.deleteOne({ _id: record._id })
}

// app/api/auth/verify-otp/route.ts
// Verifies the OTP, then finds or creates the user account, and issues a
// session cookie. Works identically for login and signup.

import { createRateLimiter, getClientIp } from "@/lib/rateLimit"
import { VerifyOtpSchema, parseBody } from "@/lib/validation"
import { checkCsrf } from "@/lib/csrf"
import { verifyOtp } from "@/lib/services/otpService"
import { findOrCreateUser } from "@/lib/services/user"
import { createSession, listSessions } from "@/lib/services/chatSession"
import { signToken, makeAuthCookie } from "@/lib/jwt"
import { sendWelcomeEmail } from "@/lib/services/email"

// 10 verify attempts per 15 minutes per IP
const verifyLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60_000 })

export async function POST(req: Request) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const ip = getClientIp(req)
  const { allowed, resetMs } = verifyLimiter(ip)
  if (!allowed) {
    const retryAfterSecs = Math.ceil(resetMs / 1000)
    return Response.json(
      { error: `Too many attempts. Please wait ${retryAfterSecs}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSecs) } }
    )
  }

  const raw    = await req.json().catch(() => ({}))
  const parsed = parseBody(VerifyOtpSchema, raw)
  if (!parsed.ok) return parsed.response

  const { email, displayName, code } = parsed.data

  // 1. Verify OTP
  try {
    await verifyOtp(email, code)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid code"
    return Response.json({ error: msg }, { status: 400 })
  }

  // 2. Find or create user
  let user, created
  try {
    ;({ user, created } = await findOrCreateUser(email, displayName))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Authentication failed"
    return Response.json({ error: msg }, { status: 400 })
  }

  // 3. Find or create a default chat session to redirect to
  const sessions = await listSessions(user._id.toString())
  const defaultSession = sessions[0] ?? await createSession(user._id.toString(), "groq")

  // 4. Issue JWT
  const token = await signToken({
    userId:      user._id.toString(),
    email:       user.email,
    displayName: user.displayName,
    createdAt:   user.createdAt.toISOString(),
  })

  // 5. Send welcome email to new users only (fire-and-forget)
  if (created) {
    sendWelcomeEmail(user.email, user.displayName).catch((err) =>
      console.error("[verify-otp] Welcome email failed:", err)
    )
  }

  return Response.json(
    {
      user: {
        id:          user._id.toString(),
        email:       user.email,
        displayName: user.displayName,
        avatarUrl:   user.avatarUrl,
        createdAt:   user.createdAt.toISOString(),
      },
      defaultSessionId: (defaultSession._id as { toString(): string }).toString(),
      created,
    },
    { status: 200, headers: { "Set-Cookie": makeAuthCookie(token) } }
  )
}

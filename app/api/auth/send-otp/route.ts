// app/api/auth/send-otp/route.ts
// Works for both login and signup — sends a 6-digit OTP to the email.
// New users must provide displayName; existing users don't need to.

import { createRateLimiter, getClientIp } from "@/lib/rateLimit"
import { SendOtpSchema, parseBody } from "@/lib/validation"
import { checkCsrf } from "@/lib/csrf"
import { issueOtp } from "@/lib/services/otpService"

// 5 OTP requests per 15 minutes per IP
const otpLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 })

export async function POST(req: Request) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const ip = getClientIp(req)
  const { allowed, resetMs } = otpLimiter(ip)
  if (!allowed) {
    const retryAfterSecs = Math.ceil(resetMs / 1000)
    return Response.json(
      { error: `Too many requests. Please wait ${retryAfterSecs}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSecs) } }
    )
  }

  const raw    = await req.json().catch(() => ({}))
  const parsed = parseBody(SendOtpSchema, raw)
  if (!parsed.ok) return parsed.response

  const { email, displayName } = parsed.data

  try {
    await issueOtp(email, displayName)
    return Response.json({ ok: true, message: "Verification code sent. Check your inbox." })
  } catch (err: unknown) {
    console.error("[send-otp]", err)
    return Response.json({ error: "Failed to send verification code." }, { status: 500 })
  }
}
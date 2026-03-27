// app/api/auth/check-email/route.ts
// Returns { exists: boolean } — used by the login page to decide whether
// to show the "enter your name" step for new users.
// Rate-limited to prevent email enumeration at scale.

import { createRateLimiter, getClientIp } from "@/lib/rateLimit"
import { checkCsrf } from "@/lib/csrf"
import { z } from "zod"
import { parseBody } from "@/lib/validation"
import { findUserByEmail } from "@/lib/services/user"

const checkLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 })

const CheckEmailSchema = z.object({
  email: z.string().email().max(254),
})

export async function POST(req: Request) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const ip = getClientIp(req)
  const { allowed, resetMs } = checkLimiter(ip)
  if (!allowed) {
    return Response.json(
      { error: `Too many requests. Please wait ${Math.ceil(resetMs / 1000)}s.` },
      { status: 429 }
    )
  }

  const raw    = await req.json().catch(() => ({}))
  const parsed = parseBody(CheckEmailSchema, raw)
  if (!parsed.ok) return parsed.response

  const user = await findUserByEmail(parsed.data.email)
  return Response.json({ exists: Boolean(user) })
}
// app/api/auth/me/route.ts
import { getAuthUser } from "@/lib/jwt"
import { createRateLimiter, getClientIp } from "@/lib/rateLimit"

// Generous limit — called on every page load by AuthContext.
// 60 req/min per IP stops runaway loops without affecting real users.
const meLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 })

export async function GET(req: Request) {
  const ip = getClientIp(req)
  const { allowed, resetMs } = meLimiter(ip)
  if (!allowed) {
    return Response.json(
      { error: "Too many requests." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(resetMs / 1000)) },
      }
    )
  }

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return Response.json({
    user: {
      id:          auth.userId,
      email:       auth.email,
      displayName: auth.displayName,
      avatarUrl:   auth.avatarUrl,
      createdAt:   auth.createdAt,
    },
  })
}

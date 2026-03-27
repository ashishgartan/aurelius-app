// app/api/usage/route.ts
import { getAuthUser } from "@/lib/jwt"
import { checkCsrf } from "@/lib/csrf"
import { getUsageSummary, logUsage } from "@/lib/services/usageLog"
import { UsageLogSchema, parseBody } from "@/lib/validation"

// GET /api/usage?days=7|30
export async function GET(req: Request) {
  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const url  = new URL(req.url)
  const days = parseInt(url.searchParams.get("days") ?? "7", 10)
  if (![7, 30].includes(days))
    return Response.json({ error: "days must be 7 or 30" }, { status: 400 })

  const summary = await getUsageSummary(auth.userId, days)
  return Response.json(summary)
}

// POST /api/usage — called internally by the chat route after streaming
export async function POST(req: Request) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: "Invalid body" }, { status: 400 })

  const parsed = parseBody(UsageLogSchema, body)
  if (!parsed.ok) return parsed.response

  await logUsage({ userId: auth.userId, ...parsed.data })
  return Response.json({ ok: true }, { status: 201 })
}

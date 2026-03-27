import { getAuthUser } from "@/lib/jwt"
import { listEmailDeliveries } from "@/lib/services/emailDelivery"

export async function GET(req: Request) {
  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const rawLimit = Number(url.searchParams.get("limit") ?? "20")
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(50, Math.trunc(rawLimit)))
    : 20

  const history = await listEmailDeliveries(auth.userId, limit)
  return Response.json({ history })
}

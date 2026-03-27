// app/api/auth/logout/route.ts
import { getAuthUser, clearAuthCookie } from "@/lib/jwt"
import { checkCsrf } from "@/lib/csrf"

export async function POST(req: Request) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  // Verify a valid session exists before clearing — prevents anonymous
  // clients from hitting this endpoint needlessly and keeps the audit
  // trail clean (only real logouts reach here).
  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return Response.json(
    { message: "Logged out" },
    { headers: { "Set-Cookie": clearAuthCookie() } }
  )
}

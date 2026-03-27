// app/api/sessions/route.ts
import { getAuthUser } from "@/lib/jwt"
import { listSessions, createSession } from "@/lib/services/chatSession"
import { CreateSessionSchema, parseBody } from "@/lib/validation"
import { checkCsrf } from "@/lib/csrf"

export async function GET(req: Request) {
  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const sessions = await listSessions(auth.userId)
  return Response.json({ sessions })
}

export async function POST(req: Request) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const raw    = await req.json().catch(() => ({}))
  const parsed = parseBody(CreateSessionSchema, raw)
  if (!parsed.ok) return parsed.response

  const session = await createSession(auth.userId, parsed.data.provider)
  return Response.json({ session }, { status: 201 })
}

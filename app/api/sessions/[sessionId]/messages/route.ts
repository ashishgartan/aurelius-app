// app/api/sessions/[sessionId]/messages/route.ts
import { getAuthUser } from "@/lib/jwt"
import { appendMessage, truncateMessages } from "@/lib/services/chatSession"
import { AppendMessageSchema, parseBody } from "@/lib/validation"
import { checkCsrf } from "@/lib/csrf"
import { isValidObjectId } from "@/lib/objectId"

type Ctx = { params: Promise<{ sessionId: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  if (!isValidObjectId(sessionId))
    return Response.json({ error: "Invalid sessionId" }, { status: 400 })

  const raw    = await req.json().catch(() => ({}))
  const parsed = parseBody(AppendMessageSchema, raw)
  if (!parsed.ok) return parsed.response

  const { role, content, model } = parsed.data
  const result = await appendMessage(sessionId, auth.userId, role, content, model ?? "groq")
  if (!result.message)
    return Response.json({ error: "Session not found" }, { status: 404 })

  return Response.json(
    { message: result.message, title: result.title ?? null },
    { status: 201 }
  )
}

// DELETE /api/sessions/:id/messages?fromIndex=N
export async function DELETE(req: Request, { params }: Ctx) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  if (!isValidObjectId(sessionId))
    return Response.json({ error: "Invalid sessionId" }, { status: 400 })
  const url       = new URL(req.url)
  const fromIndex = parseInt(url.searchParams.get("fromIndex") ?? "", 10)

  if (isNaN(fromIndex) || fromIndex < 0)
    return Response.json({ error: "fromIndex must be a non-negative integer" }, { status: 400 })

  await truncateMessages(sessionId, auth.userId, fromIndex)
  return Response.json({ ok: true })
}

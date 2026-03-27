// app/api/sessions/[sessionId]/share/route.ts
import { getAuthUser } from "@/lib/jwt"
import { checkCsrf } from "@/lib/csrf"
import { createShareToken, revokeShareToken, getSession } from "@/lib/services/chatSession"
import { isValidObjectId } from "@/lib/objectId"

type Ctx = { params: Promise<{ sessionId: string }> }

// POST — create or refresh the share link
export async function POST(req: Request, { params }: Ctx) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  if (!isValidObjectId(sessionId))
    return Response.json({ error: "Invalid sessionId" }, { status: 400 })

  // Verify the session belongs to this user
  const session = await getSession(sessionId, auth.userId)
  if (!session) return Response.json({ error: "Not found" }, { status: 404 })

  const token   = await createShareToken(sessionId, auth.userId)
  const baseUrl = new URL(req.url).origin
  const url     = `${baseUrl}/share/${token}`

  return Response.json({ token, url })
}

// DELETE — revoke the share link
export async function DELETE(req: Request, { params }: Ctx) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  if (!isValidObjectId(sessionId))
    return Response.json({ error: "Invalid sessionId" }, { status: 400 })
  await revokeShareToken(sessionId, auth.userId)
  return Response.json({ ok: true })
}

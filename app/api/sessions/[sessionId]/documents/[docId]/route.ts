// app/api/sessions/[sessionId]/documents/[docId]/route.ts
import { getAuthUser } from "@/lib/jwt"
import { deleteDocument } from "@/lib/services/ragService"
import { checkCsrf } from "@/lib/csrf"
import { isValidObjectId } from "@/lib/objectId"

type Ctx = { params: Promise<{ sessionId: string; docId: string }> }

export async function DELETE(req: Request, { params }: Ctx) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId, docId } = await params
  if (!isValidObjectId(sessionId))
    return Response.json({ error: "Invalid sessionId" }, { status: 400 })
  if (!isValidObjectId(docId))
    return Response.json({ error: "Invalid docId" }, { status: 400 })

  try {
    await deleteDocument(sessionId, docId, auth.userId)
    return Response.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete document"
    return Response.json(
      { error: msg },
      { status: msg === "Session not found" ? 404 : 422 }
    )
  }
}

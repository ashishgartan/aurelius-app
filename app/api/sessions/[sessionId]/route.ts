// app/api/sessions/[sessionId]/route.ts
import { getAuthUser } from "@/lib/jwt"
import {
  getSession,
  updateProvider,
  deleteSession,
  clearMessages,
  updateSessionTitle,
  updateSessionPinned,
  updateSessionArchived,
} from "@/lib/services/chatSession"
import { checkCsrf } from "@/lib/csrf"
import { parseBody, UpdateSessionSchema } from "@/lib/validation"
import { connectDB } from "@/lib/mongodb"
import { ArtifactModel } from "@/lib/models"
import { DocumentModel } from "@/lib/models/Document"
import { deleteArtifacts } from "@/lib/cloudinary"
import { Types } from "mongoose"
import { applySessionPatch } from "@/lib/sessions/sessionUpdate"

type Ctx = { params: Promise<{ sessionId: string }> }

export async function GET(req: Request, { params }: Ctx) {
  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { sessionId } = await params
  const session = await getSession(sessionId, auth.userId)
  if (!session) return Response.json({ error: "Not found" }, { status: 404 })
  return Response.json({ session })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  const raw    = await req.json().catch(() => ({}))
  const parsed = parseBody(UpdateSessionSchema, raw)
  if (!parsed.ok) return parsed.response

  await applySessionPatch({
    sessionId,
    userId: auth.userId,
    data: parsed.data,
    updateProvider,
    updateSessionTitle,
    updateSessionPinned,
    updateSessionArchived,
    clearMessages,
  })
  return Response.json({ ok: true })
}

export async function DELETE(req: Request, { params }: Ctx) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { sessionId } = await params

  // Clean up all Cloudinary artifacts for this session before deleting the session
  await connectDB()
  const artifacts = await ArtifactModel.find({
    sessionId: new Types.ObjectId(sessionId),
    userId:    new Types.ObjectId(auth.userId),
  }).select("cloudinaryPublicId").lean()

  if (artifacts.length > 0) {
    await deleteArtifacts(artifacts.map((a) => a.cloudinaryPublicId)).catch(console.error)
    await ArtifactModel.deleteMany({
      sessionId: new Types.ObjectId(sessionId),
      userId:    new Types.ObjectId(auth.userId),
    })
  }

  await DocumentModel.deleteMany({
    sessionId: new Types.ObjectId(sessionId),
    userId: new Types.ObjectId(auth.userId),
  })

  await deleteSession(sessionId, auth.userId)
  return Response.json({ ok: true })
}

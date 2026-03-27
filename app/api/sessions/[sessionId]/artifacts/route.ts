// app/api/sessions/[sessionId]/artifacts/route.ts
// GET — lists all code artifacts saved for a session.
// Used by the sidebar or a future "Files" tab to browse saved code.

import { getAuthUser }   from "@/lib/jwt"
import { connectDB }     from "@/lib/mongodb"
import { ArtifactModel } from "@/lib/models"
import { Types }         from "mongoose"

interface RouteParams { params: Promise<{ sessionId: string }> }

export async function GET(req: Request, { params }: RouteParams) {
  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params

  if (!Types.ObjectId.isValid(sessionId))
    return Response.json({ error: "Invalid session ID" }, { status: 400 })

  await connectDB()

  const artifacts = await ArtifactModel.find({
    sessionId: new Types.ObjectId(sessionId),
    userId:    new Types.ObjectId(auth.userId),
  })
    .select("_id filename lang sizeBytes createdAt")
    .sort({ createdAt: -1 })
    .lean()

  return Response.json({ artifacts })
}
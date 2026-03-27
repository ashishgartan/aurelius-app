// app/api/profile/route.ts — update display name / avatar URL, or delete account
import { getAuthUser, clearAuthCookie } from "@/lib/jwt"
import { updateProfile, deleteUser } from "@/lib/services/user"
import { ChatSession } from "@/lib/models/ChatSession"
import { DocumentModel } from "@/lib/models/Document"
import { UsageLog } from "@/lib/models/UsageLog"
import { ArtifactModel } from "@/lib/models"
import { connectDB } from "@/lib/mongodb"
import { Types } from "mongoose"
import { UpdateProfileSchema, parseBody } from "@/lib/validation"
import { checkCsrf } from "@/lib/csrf"
import { deleteArtifacts } from "@/lib/cloudinary"
import { buildProfileAuthCookie } from "@/lib/auth/profileCookie"

export async function PATCH(req: Request) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const raw    = await req.json().catch(() => ({}))
  const parsed = parseBody(UpdateProfileSchema, raw)
  if (!parsed.ok) return parsed.response

  const user = await updateProfile(
    auth.userId,
    auth.email,
    parsed.data.displayName ?? auth.displayName,
    parsed.data.avatarUrl
  )

  const authCookie = await buildProfileAuthCookie(user)

  return Response.json({
      user: {
        id:          user._id.toString(),
        email:       user.email,
        displayName: user.displayName,
        avatarUrl:   user.avatarUrl,
        createdAt:   user.createdAt.toISOString(),
      },
    },
    { headers: { "Set-Cookie": authCookie } }
  )
}

export async function DELETE(req: Request) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const artifacts = await ArtifactModel.find({
    userId: new Types.ObjectId(auth.userId),
  }).select("cloudinaryPublicId").lean()

  if (artifacts.length > 0) {
    await deleteArtifacts(artifacts.map((artifact) => artifact.cloudinaryPublicId)).catch(
      console.error
    )
    await ArtifactModel.deleteMany({ userId: new Types.ObjectId(auth.userId) })
  }

  await ChatSession.deleteMany({ userId: new Types.ObjectId(auth.userId) })
  await DocumentModel.deleteMany({ userId: new Types.ObjectId(auth.userId) })
  await UsageLog.deleteMany({ userId: new Types.ObjectId(auth.userId) })
  await deleteUser(auth.userId)

  return Response.json(
    { message: "Account deleted" },
    { headers: { "Set-Cookie": clearAuthCookie() } }
  )
}

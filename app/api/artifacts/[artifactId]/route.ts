// app/api/artifacts/[artifactId]/route.ts
// GET  — returns a short-lived signed URL + metadata so ArtifactPanel
//         can fetch the file content directly from Cloudinary.
// DELETE — removes the file from Cloudinary and the DB record.
// PATCH — updates mutable artifact metadata such as favorite state.

import { getAuthUser } from "@/lib/jwt"
import { connectDB } from "@/lib/mongodb"
import { ArtifactModel } from "@/lib/models"
import { getSignedUrl, deleteArtifact } from "@/lib/cloudinary"
import { Types } from "mongoose"
import { parseBody } from "@/lib/validation"
import { z } from "zod"
import { checkCsrf } from "@/lib/csrf"
import { handleArtifactFavoriteUpdate } from "@/lib/artifacts/favoriteRoute"

interface RouteParams {
  params: Promise<{ artifactId: string }>
}

const PatchArtifactSchema = z.object({
  favorite: z.boolean(),
})

export async function GET(req: Request, { params }: RouteParams) {
  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { artifactId } = await params

  if (!Types.ObjectId.isValid(artifactId))
    return Response.json({ error: "Invalid artifact ID" }, { status: 400 })

  await connectDB()

  const artifact = await ArtifactModel.findOne({
    _id: new Types.ObjectId(artifactId),
    userId: new Types.ObjectId(auth.userId),
  }).lean()

  if (!artifact)
    return Response.json({ error: "Not found" }, { status: 404 })

  const url = getSignedUrl(artifact.cloudinaryPublicId)

  return Response.json({
    url,
    filename: artifact.filename,
    lang: artifact.lang,
    sizeBytes: artifact.sizeBytes,
    favorite: artifact.favorite ?? false,
  })
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { artifactId } = await params

  if (!Types.ObjectId.isValid(artifactId))
    return Response.json({ error: "Invalid artifact ID" }, { status: 400 })

  const raw = await req.json().catch(() => ({}))
  const parsed = parseBody(PatchArtifactSchema, raw)
  if (!parsed.ok) return parsed.response

  await connectDB()

  return handleArtifactFavoriteUpdate({
    artifactId,
    favorite: parsed.data.favorite,
    isValidArtifactId: (value) => Types.ObjectId.isValid(value),
    updateArtifactFavorite: async (id, favorite) => {
      const artifact = await ArtifactModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(auth.userId),
        },
        { $set: { favorite } },
        { new: true }
      ).lean()

      return artifact ? (artifact.favorite ?? false) : null
    },
  })
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { artifactId } = await params

  if (!Types.ObjectId.isValid(artifactId))
    return Response.json({ error: "Invalid artifact ID" }, { status: 400 })

  await connectDB()

  const artifact = await ArtifactModel.findOneAndDelete({
    _id: new Types.ObjectId(artifactId),
    userId: new Types.ObjectId(auth.userId),
  }).lean()

  if (!artifact)
    return Response.json({ error: "Not found" }, { status: 404 })

  await deleteArtifact(artifact.cloudinaryPublicId).catch(console.error)

  return Response.json({ ok: true })
}

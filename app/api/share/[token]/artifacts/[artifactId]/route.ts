import { getSignedUrl } from "@/lib/cloudinary"
import { connectDB } from "@/lib/mongodb"
import { ArtifactModel, ChatSession } from "@/lib/models"
import { handleSharedArtifactRequest } from "@/lib/share/sharedArtifactRoute"
import { Types } from "mongoose"

interface Ctx {
  params: Promise<{ token: string; artifactId: string }>
}

export async function GET(req: Request, { params }: Ctx) {
  const { token, artifactId } = await params
  await connectDB()

  return handleSharedArtifactRequest({
    token,
    artifactId,
    requestUrl: req.url,
    isValidArtifactId: (value) => Types.ObjectId.isValid(value),
    findSessionIdByToken: async (shareToken) => {
      const session = await ChatSession.findOne({ shareToken })
        .select("_id")
        .lean() as { _id: Types.ObjectId } | null

      return session?._id.toString() ?? null
    },
    findArtifactForSession: async (id, sessionId) => {
      return ArtifactModel.findOne({
        _id: new Types.ObjectId(id),
        sessionId: new Types.ObjectId(sessionId),
      })
        .select("filename lang sizeBytes cloudinaryPublicId")
        .lean()
    },
    getSignedUrl,
  })
}

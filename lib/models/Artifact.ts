// lib/models/Artifact.ts
import mongoose, { Schema, type Document, type Model } from "mongoose"

export interface IArtifact extends Document {
  sessionId:          mongoose.Types.ObjectId
  userId:             mongoose.Types.ObjectId
  filename:           string        // e.g. "component.tsx"
  lang:               string        // e.g. "tsx"
  cloudinaryPublicId: string        // used to generate signed URLs + delete
  sizeBytes:          number
  favorite:           boolean
  createdAt:          Date
}

const ArtifactSchema = new Schema<IArtifact>(
  {
    sessionId:          { type: Schema.Types.ObjectId, ref: "ChatSession", required: true, index: true },
    userId:             { type: Schema.Types.ObjectId, ref: "User",        required: true, index: true },
    filename:           { type: String, required: true },
    lang:               { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    sizeBytes:          { type: Number, required: true },
    favorite:           { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

// Compound index — quickly fetch all artifacts for a session
ArtifactSchema.index({ sessionId: 1, userId: 1 })

export const ArtifactModel: Model<IArtifact> =
  mongoose.models.Artifact ?? mongoose.model<IArtifact>("Artifact", ArtifactSchema)

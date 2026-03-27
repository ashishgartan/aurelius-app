// lib/cloudinary.ts
// Cloudinary helpers for code artifact storage.
// Files are uploaded as raw resources (not images) under the
// "artifacts/" folder, keyed by artifactId so they are easy to find and delete.

import { v2 as cloudinary } from "cloudinary"

// Configure once — safe to call multiple times (idempotent)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:    process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure:     true,
})

// ── Upload ─────────────────────────────────────────────────────────
// Uploads raw text content as a Cloudinary raw resource.
// Returns the public_id (used for signed URLs and deletion).
export async function uploadArtifact(
  content:    string,
  publicId:   string,   // e.g. "artifacts/userId/artifactId"
  filename:   string,   // original filename for Content-Disposition header
): Promise<{ publicId: string; sizeBytes: number }> {
  // Convert text to a Buffer and upload as a stream
  const buffer = Buffer.from(content, "utf-8")

  const result = await new Promise<{ public_id: string; bytes: number }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type:   "raw",
          public_id:       publicId,
          use_filename:    false,
          unique_filename: false,
          overwrite:       true,
          // Store original filename in context so we can serve correct Content-Disposition
          context: { filename },
        },
        (err, result) => {
          if (err || !result) return reject(err ?? new Error("Upload failed"))
          resolve(result as { public_id: string; bytes: number })
        }
      )
      stream.end(buffer)
    }
  )

  return { publicId: result.public_id, sizeBytes: result.bytes }
}

// ── Signed download URL ────────────────────────────────────────────
// Generates a time-limited signed URL for private file access.
// Expires in 15 minutes — enough to open + render in ArtifactPanel.
export function getSignedUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    resource_type: "raw",
    type:          "upload",
    sign_url:      true,
    expires_at:    Math.floor(Date.now() / 1000) + 60 * 15, // 15 min
  })
}

// ── Delete ─────────────────────────────────────────────────────────
// Permanently removes a file from Cloudinary.
export async function deleteArtifact(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "raw" })
}

// ── Batch delete ───────────────────────────────────────────────────
// Deletes multiple artifacts — used when a session is deleted.
// Cloudinary's delete_resources accepts up to 100 public_ids per call.
export async function deleteArtifacts(publicIds: string[]): Promise<void> {
  if (publicIds.length === 0) return
  const BATCH = 100
  for (let i = 0; i < publicIds.length; i += BATCH) {
    await cloudinary.api.delete_resources(publicIds.slice(i, i + BATCH), {
      resource_type: "raw",
    })
  }
}
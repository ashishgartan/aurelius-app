export interface SharedArtifactRecord {
  filename: string
  lang: string
  sizeBytes: number
  cloudinaryPublicId: string
}

interface HandleSharedArtifactRequestDeps {
  token: string
  artifactId: string
  requestUrl: string
  isValidArtifactId: (artifactId: string) => boolean
  findSessionIdByToken: (token: string) => Promise<string | null>
  findArtifactForSession: (
    artifactId: string,
    sessionId: string
  ) => Promise<SharedArtifactRecord | null>
  getSignedUrl: (publicId: string) => string
}

export async function handleSharedArtifactRequest({
  token,
  artifactId,
  requestUrl,
  isValidArtifactId,
  findSessionIdByToken,
  findArtifactForSession,
  getSignedUrl,
}: HandleSharedArtifactRequestDeps) {
  if (!isValidArtifactId(artifactId)) {
    return Response.json({ error: "Invalid artifact ID" }, { status: 400 })
  }

  const sessionId = await findSessionIdByToken(token)

  if (!sessionId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const artifact = await findArtifactForSession(artifactId, sessionId)

  if (!artifact) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const url = getSignedUrl(artifact.cloudinaryPublicId)
  const format = new URL(requestUrl).searchParams.get("format")

  if (format === "json") {
    return Response.json({
      url,
      filename: artifact.filename,
      lang: artifact.lang,
      sizeBytes: artifact.sizeBytes,
    })
  }

  return Response.redirect(url, 302)
}

interface HandleArtifactFavoriteUpdateDeps {
  artifactId: string
  favorite: boolean
  isValidArtifactId: (artifactId: string) => boolean
  updateArtifactFavorite: (
    artifactId: string,
    favorite: boolean
  ) => Promise<boolean | null>
}

export async function handleArtifactFavoriteUpdate({
  artifactId,
  favorite,
  isValidArtifactId,
  updateArtifactFavorite,
}: HandleArtifactFavoriteUpdateDeps) {
  if (!isValidArtifactId(artifactId)) {
    return Response.json({ error: "Invalid artifact ID" }, { status: 400 })
  }

  const updated = await updateArtifactFavorite(artifactId, favorite)
  if (updated === null) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  return Response.json({ ok: true, favorite: updated })
}

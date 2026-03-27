export interface ArtifactFilePayload {
  url: string
  filename?: string
  lang?: string
  sizeBytes?: number
}

export async function fetchArtifactFile(
  artifactId: string,
  artifactUrlBuilder?: (artifactId: string) => string
): Promise<ArtifactFilePayload> {
  const res = await fetch(
    artifactUrlBuilder
      ? artifactUrlBuilder(artifactId)
      : `/api/artifacts/${artifactId}`
  )
  if (!res.ok) {
    throw new Error(`Failed to load artifact (${res.status})`)
  }
  return res.json() as Promise<ArtifactFilePayload>
}

export async function fetchArtifactText(
  artifactId: string,
  artifactUrlBuilder?: (artifactId: string) => string
): Promise<{ text: string; file: ArtifactFilePayload }> {
  const file = await fetchArtifactFile(artifactId, artifactUrlBuilder)
  const fileRes = await fetch(file.url)
  if (!fileRes.ok) {
    throw new Error("Failed to download file content")
  }
  return {
    text: await fileRes.text(),
    file,
  }
}

export function downloadArtifactText(filename: string, text: string, lang?: string) {
  const mimeType =
    lang === "html"
      ? "text/html"
      : lang === "css"
        ? "text/css"
        : lang === "js" || lang === "javascript"
          ? "text/javascript"
          : lang === "json"
            ? "application/json"
            : lang === "xml"
              ? "application/xml"
              : "text/plain"

  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

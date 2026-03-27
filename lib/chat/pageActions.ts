import type { UploadedDoc } from "@/components/chat/FileUpload"

export function buildDocumentSummaryPrompt(doc: Pick<UploadedDoc, "filename">): string {
  return `Summarize the document "${doc.filename}" and highlight the key points.`
}

export async function clearChatOnServer(
  fetcher: typeof fetch,
  sessionId: string
): Promise<void> {
  const res = await fetcher(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clearMessages: true }),
  })

  if (!res.ok) throw new Error(`Server returned ${res.status}`)
}

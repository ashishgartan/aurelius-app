// app/api/sessions/[sessionId]/documents/route.ts
// Increase body size limit for file uploads (default is 4MB)
export const maxDuration = 60   // seconds — ingestion can be slow for large files
export const dynamic = "force-dynamic"

import { getAuthUser } from "@/lib/jwt"
import { ingestDocument, listDocuments } from "@/lib/services/ragService"
import { checkCsrf } from "@/lib/csrf"
import { isValidObjectId } from "@/lib/objectId"

type Ctx = { params: Promise<{ sessionId: string }> }

const MAX_FILE_SIZE = 10 * 1024 * 1024  // 10 MB

// Both extension AND MIME type must be allowed — extension alone can be spoofed
const ALLOWED_EXTENSIONS = new Set([
  "pdf","docx","txt","md","py","js","ts","jsx","tsx","go","rs","java",
  "c","cpp","h","cs","rb","php","swift","kt","r","sql","sh","yaml","yml","json","xml","csv",
])

const ALLOWED_MIME_PREFIXES = [
  "text/",
  "application/pdf",
  "application/json",
  "application/xml",
  "application/octet-stream",
  "application/vnd.openxmlformats-officedocument",
]

function isMimeAllowed(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))
}

// GET — list documents for a session
export async function GET(req: Request, { params }: Ctx) {
  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  if (!isValidObjectId(sessionId))
    return Response.json({ error: "Invalid sessionId" }, { status: 400 })

  try {
    const docs = await listDocuments(sessionId, auth.userId)
    return Response.json({ documents: docs })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list documents"
    return Response.json(
      { error: msg },
      { status: msg === "Session not found" ? 404 : 422 }
    )
  }
}

// POST — upload and ingest a document
export async function POST(req: Request, { params }: Ctx) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  if (!isValidObjectId(sessionId))
    return Response.json({ error: "Invalid sessionId" }, { status: 400 })

  let formData: FormData | null = null
  try {
    formData = await req.formData()
  } catch (err) {
    console.error("[upload] formData parse failed:", err)
    return Response.json({ error: "Failed to parse upload — file may be too large (max 10 MB)" }, { status: 400 })
  }
  if (!formData) return Response.json({ error: "Invalid form data" }, { status: 400 })

  const file = formData.get("file") as File | null
  if (!file) return Response.json({ error: "No file provided" }, { status: 400 })

  const ext      = file.name.split(".").pop()?.toLowerCase() ?? ""
  const mimeType = file.type || "application/octet-stream"

  if (!ALLOWED_EXTENSIONS.has(ext))
    return Response.json({ error: `File type .${ext} is not supported` }, { status: 400 })

  if (!isMimeAllowed(mimeType))
    return Response.json({ error: `MIME type ${mimeType} is not supported` }, { status: 400 })

  if (file.size > MAX_FILE_SIZE)
    return Response.json({ error: "File must be under 10 MB" }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const doc = await ingestDocument(auth.userId, sessionId, file.name, mimeType, buffer)
    return Response.json({ document: doc }, { status: 201 })
  } catch (err) {
    console.error("[documents/POST] ingest error:", err)
    const msg = err instanceof Error ? err.message : "Failed to process file"
    return Response.json(
      { error: msg },
      { status: msg === "Session not found" ? 404 : 422 }
    )
  }
}

import { z } from "zod"
import { Types } from "mongoose"
import { getAuthUser } from "@/lib/jwt"
import { checkCsrf } from "@/lib/csrf"
import { parseBody } from "@/lib/validation"
import {
  deleteUserMemoryRecord,
  updateUserMemoryRecord,
} from "@/lib/services/userMemory"

const UpdateMemorySchema = z.object({
  value: z.string().min(1).max(500).optional(),
  pinned: z.boolean().optional(),
  category: z.enum(["profile", "preference", "interest", "working"]).optional(),
  status: z.enum(["active", "dismissed"]).optional(),
})

interface Ctx {
  params: Promise<{ memoryId: string }>
}

export async function PATCH(req: Request, { params }: Ctx) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { memoryId } = await params
  if (!Types.ObjectId.isValid(memoryId)) {
    return Response.json({ error: "Invalid memory ID" }, { status: 400 })
  }

  const raw = await req.json().catch(() => ({}))
  const parsed = parseBody(UpdateMemorySchema, raw)
  if (!parsed.ok) return parsed.response

  const memory = await updateUserMemoryRecord(auth.userId, memoryId, parsed.data)
  if (!memory) return Response.json({ error: "Not found" }, { status: 404 })

  return Response.json({ memory })
}

export async function DELETE(req: Request, { params }: Ctx) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { memoryId } = await params
  if (!Types.ObjectId.isValid(memoryId)) {
    return Response.json({ error: "Invalid memory ID" }, { status: 400 })
  }

  const deleted = await deleteUserMemoryRecord(auth.userId, memoryId)
  if (!deleted) return Response.json({ error: "Not found" }, { status: 404 })

  return Response.json({ ok: true })
}

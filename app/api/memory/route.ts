import { z } from "zod"
import { getAuthUser } from "@/lib/jwt"
import { checkCsrf } from "@/lib/csrf"
import { parseBody } from "@/lib/validation"
import {
  createManualMemory,
  listUserMemories,
} from "@/lib/services/userMemory"

const CreateMemorySchema = z.object({
  category: z.enum(["profile", "preference", "interest", "working"]),
  key: z.string().min(1).max(120),
  value: z.string().min(1).max(500),
  pinned: z.boolean().optional(),
})

export async function GET(req: Request) {
  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const memories = await listUserMemories(auth.userId)
  return Response.json({ memories })
}

export async function POST(req: Request) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const raw = await req.json().catch(() => ({}))
  const parsed = parseBody(CreateMemorySchema, raw)
  if (!parsed.ok) return parsed.response

  const memory = await createManualMemory(auth.userId, parsed.data)
  return Response.json({ memory }, { status: 201 })
}

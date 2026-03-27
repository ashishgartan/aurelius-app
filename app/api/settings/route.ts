// app/api/settings/route.ts
import { getAuthUser } from "@/lib/jwt"
import { getSettings, saveSettings } from "@/lib/services/userSettings"
import { UserSettingsSchema, parseBody } from "@/lib/validation"
import { checkCsrf } from "@/lib/csrf"

export async function GET(req: Request) {
  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const settings = await getSettings(auth.userId)
  return Response.json({ settings })
}

export async function PUT(req: Request) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const raw    = await req.json().catch(() => ({}))
  const parsed = parseBody(UserSettingsSchema, raw)
  if (!parsed.ok) return parsed.response

  const settings = await saveSettings(auth.userId, parsed.data)
  return Response.json({ settings })
}

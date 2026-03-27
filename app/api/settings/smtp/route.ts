import { getAuthUser } from "@/lib/jwt"
import { saveSettings } from "@/lib/services/userSettings"
import { SmtpCredentialsSchema, parseBody } from "@/lib/validation"
import { checkCsrf } from "@/lib/csrf"

export async function PUT(req: Request) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) {
    console.error("[settings/smtp] unauthorized request")
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const raw = await req.json().catch(() => ({}))
  const parsed = parseBody(SmtpCredentialsSchema, raw)
  if (!parsed.ok) {
    console.error("[settings/smtp] invalid payload", {
      userId: auth.userId,
      hasSmtpUser: typeof raw === "object" && raw !== null && "smtpUser" in raw,
      hasSmtpPass: typeof raw === "object" && raw !== null && "smtpPass" in raw,
    })
    return parsed.response
  }

  console.log("[settings/smtp] saving credentials", {
    userId: auth.userId,
    smtpUser: parsed.data.smtpUser,
    smtpPassLength: parsed.data.smtpPass.length,
  })

  const settings = await saveSettings(auth.userId, parsed.data)
  console.log("[settings/smtp] saved credentials", {
    userId: auth.userId,
    smtpUser: settings.smtpUser,
    hasSmtpPass: Boolean(settings.smtpPass),
  })
  return Response.json({ settings })
}

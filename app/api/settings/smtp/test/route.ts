import { getAuthUser } from "@/lib/jwt"
import { checkCsrf } from "@/lib/csrf"
import { getSettings } from "@/lib/services/userSettings"
import { sendSmtpEmail } from "@/lib/services/sendSmtpEmail"
import { logEmailDelivery } from "@/lib/services/emailDelivery"

export async function POST(req: Request) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) {
    return Response.json(
      { error: "Unauthorized", code: "UNKNOWN" },
      { status: 401 }
    )
  }

  const serverIssues: string[] = []
  if (!process.env.SMTP_HOST) serverIssues.push("SMTP_HOST")
  if (!process.env.SMTP_PORT) serverIssues.push("SMTP_PORT")
  if (!process.env.SMTP_SECURE) serverIssues.push("SMTP_SECURE")

  if (serverIssues.length > 0) {
    return Response.json(
      {
        error: `Server SMTP is incomplete. Missing: ${serverIssues.join(", ")}.`,
        code: "SMTP_SERVER_CONFIG_MISSING",
      },
      { status: 400 }
    )
  }

  const settings = await getSettings(auth.userId)
  if (!settings.smtpUser || !settings.smtpPass) {
    return Response.json(
      {
        error:
          "Save your email username and password first, then run the test again.",
        code: "SMTP_USER_CREDENTIALS_MISSING",
      },
      { status: 400 }
    )
  }

  try {
    await sendSmtpEmail(
      {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
      {
        to: auth.email,
        subject: "Aurelius email setup test",
        text:
          `Hi ${auth.displayName || auth.email},\n\n` +
          "This is a test email from Aurelius.\n\n" +
          `Authenticated mailbox: ${settings.smtpUser}\n` +
          `Sent at: ${new Date().toISOString()}\n`,
      }
    )

    await logEmailDelivery({
      userId: auth.userId,
      source: "smtp_test",
      smtpUser: settings.smtpUser,
      to: auth.email,
      subject: "Aurelius email setup test",
      status: "sent",
    })

    return Response.json({
      ok: true,
      message: `Test email sent to ${auth.email}.`,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send test email."
    const code =
      message.toLowerCase().includes("invalid login") ||
      message.toLowerCase().includes("authentication")
        ? "SMTP_AUTH_FAILED"
        : "UNKNOWN"
    await logEmailDelivery({
      userId: auth.userId,
      source: "smtp_test",
      smtpUser: settings.smtpUser,
      to: auth.email,
      subject: "Aurelius email setup test",
      status: "failed",
      error: message,
    })
    return Response.json({ error: message, code }, { status: 400 })
  }
}

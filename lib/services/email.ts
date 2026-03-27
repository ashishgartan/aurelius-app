// lib/services/email.ts
// Transactional auth email service — uses app-level SMTP credentials from .env.

import nodemailer from "nodemailer"

function getAppSmtpConfig() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? "587")
  const secure = process.env.SMTP_SECURE === "true" || port === 465
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = user

  if (!host) throw new Error("SMTP_HOST is not set in .env.local")
  if (!user || !pass) {
    throw new Error("SMTP_USER / SMTP_PASS are not set in .env.local")
  }

  return { host, port, secure, user, pass, from }
}

async function sendAppEmail(options: {
  to: string
  subject: string
  html: string
  text: string
}) {
  const config = getAppSmtpConfig()

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })

  await transporter.verify().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Could not connect to SMTP server (${config.host}:${config.port}): ${msg}`
    )
  })

  await transporter.sendMail({
    from: config.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  })
}

function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Aurelius</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#6366f1;padding:24px 40px;">
            <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Aurelius</p>
          </td>
        </tr>
        <tr><td style="padding:36px 40px 28px;">${body}</td></tr>
        <tr>
          <td style="padding:16px 40px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#d1d5db;">
              You received this email because you signed up for Aurelius.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendOtpEmail(
  to: string,
  displayName: string,
  code: string
): Promise<void> {
  const html = layout(`
    <p style="margin:0 0 6px;font-size:22px;font-weight:600;color:#111827;">Verify your email</p>
    <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
      Hi ${displayName}, enter the code below to confirm your email address and create your account.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
      <tr>
        <td style="background:#f5f3ff;border:2px solid #e0d9ff;border-radius:12px;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:10px;color:#6366f1;font-variant-numeric:tabular-nums;">
            ${code}
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
      This code expires in <strong>10 minutes</strong> and can only be used once.
      If you did not request this, you can safely ignore this email.
    </p>
  `)

  await sendAppEmail({
    to,
    subject: "Your Aurelius verification code",
    html,
    text:
      `Hi ${displayName},\n\n` +
      `Your Aurelius verification code is: ${code}\n\n` +
      "It expires in 10 minutes. If you did not request this, ignore this email.\n",
  })
}

export async function sendWelcomeEmail(
  to: string,
  displayName: string
): Promise<void> {
  const appUrl =
    process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000"

  const html = layout(`
    <p style="margin:0 0 6px;font-size:22px;font-weight:600;color:#111827;">Welcome to Aurelius 👋</p>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
      Hi ${displayName}, your account is ready. Start a conversation, upload documents, and
      let Aurelius help you get things done.
    </p>
    <table cellpadding="0" cellspacing="0">
      <tr>
        <td style="border-radius:8px;background:#6366f1;">
          <a href="${appUrl}/chat"
             style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
            Open Aurelius
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
      If you have any questions, just reply to this email — we're happy to help.
    </p>
  `)

  try {
    await sendAppEmail({
      to,
      subject: "Welcome to Aurelius",
      html,
      text:
        `Hi ${displayName},\n\n` +
        "Welcome to Aurelius! Your account is ready.\n\n" +
        `Open the app: ${appUrl}/chat\n`,
    })
  } catch (error) {
    console.error("[email] Welcome email failed:", error)
  }
}

import nodemailer from "nodemailer"

export interface SmtpConfig {
  user:    string
  pass:    string
}

export interface EmailAttachment {
  filename: string
  content: string
  contentType?: string
}

const CODE_EXTENSIONS: Record<string, { ext: string; contentType: string }> = {
  cpp: { ext: "cpp", contentType: "text/x-c++src; charset=utf-8" },
  c: { ext: "c", contentType: "text/x-csrc; charset=utf-8" },
  h: { ext: "h", contentType: "text/x-chdr; charset=utf-8" },
  hpp: { ext: "hpp", contentType: "text/x-c++hdr; charset=utf-8" },
  cc: { ext: "cc", contentType: "text/x-c++src; charset=utf-8" },
  cxx: { ext: "cxx", contentType: "text/x-c++src; charset=utf-8" },
  py: { ext: "py", contentType: "text/x-python; charset=utf-8" },
  js: { ext: "js", contentType: "text/javascript; charset=utf-8" },
  ts: { ext: "ts", contentType: "text/typescript; charset=utf-8" },
  jsx: { ext: "jsx", contentType: "text/jsx; charset=utf-8" },
  tsx: { ext: "tsx", contentType: "text/tsx; charset=utf-8" },
  java: { ext: "java", contentType: "text/x-java-source; charset=utf-8" },
  go: { ext: "go", contentType: "text/x-go; charset=utf-8" },
  rs: { ext: "rs", contentType: "text/plain; charset=utf-8" },
  html: { ext: "html", contentType: "text/html; charset=utf-8" },
  css: { ext: "css", contentType: "text/css; charset=utf-8" },
  json: { ext: "json", contentType: "application/json; charset=utf-8" },
  xml: { ext: "xml", contentType: "application/xml; charset=utf-8" },
  sql: { ext: "sql", contentType: "application/sql; charset=utf-8" },
  sh: { ext: "sh", contentType: "application/x-sh; charset=utf-8" },
}

function inferAttachmentDetails(lang: string, index: number) {
  const normalized = lang.toLowerCase()
  const details = CODE_EXTENSIONS[normalized] ?? {
    ext: normalized || "txt",
    contentType: "text/plain; charset=utf-8",
  }

  return {
    filename: `artifact${index > 0 ? `-${index + 1}` : ""}.${details.ext}`,
    contentType: details.contentType,
  }
}

export function extractCodeAttachments(body: string): EmailAttachment[] {
  const normalized = body.replace(/\r\n/g, "\n")
  const fencePattern = /```([\w+#.-]*)\n([\s\S]*?)```/g
  const attachments: EmailAttachment[] = []
  let match: RegExpExecArray | null

  while ((match = fencePattern.exec(normalized)) !== null) {
    const lang = (match[1] || "txt").trim()
    const content = match[2].replace(/\n$/, "")
    if (!content.trim()) continue

    const details = inferAttachmentDetails(lang, attachments.length)
    attachments.push({
      filename: details.filename,
      content,
      contentType: details.contentType,
    })
  }

  return attachments
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatInlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code style=\"font-family:Menlo,Monaco,'Courier New',monospace;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:6px;padding:1px 5px;font-size:0.92em;\">$1</code>")
}

function renderMarkdownishHtml(body: string): string {
  const normalized = body.replace(/\r\n/g, "\n").trim()
  if (!normalized) return ""

  const codeBlocks: string[] = []
  const withPlaceholders = normalized.replace(
    /```([\w+#.-]*)\n([\s\S]*?)```/g,
    (_match, lang: string, code: string) => {
      const label = escapeHtml((lang || "code").toUpperCase())
      const html = [
        "<div style=\"margin:18px 0;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden;background:#fafafc;\">",
        `<div style="padding:10px 14px;background:#18181b;color:#f4f4f5;font-size:11px;font-weight:700;letter-spacing:0.08em;">${label}</div>`,
        `<pre style="margin:0;padding:16px 18px;overflow:auto;background:#0f172a;color:#e2e8f0;font-size:13px;line-height:1.65;font-family:Menlo,Monaco,'Courier New',monospace;"><code>${escapeHtml(
          code.replace(/\n$/, "")
        )}</code></pre>`,
        "</div>",
      ].join("")
      const index = codeBlocks.push(html) - 1
      return `__CODE_BLOCK_${index}__`
    }
  )

  const sections = withPlaceholders
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean)

  const htmlSections = sections.map((section) => {
    if (/^__CODE_BLOCK_\d+__$/.test(section)) {
      const index = Number(section.match(/\d+/)?.[0] ?? "-1")
      return codeBlocks[index] ?? ""
    }

    const lines = section.split("\n").map((line) => line.trimEnd())
    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      const items = lines
        .map((line) => line.replace(/^[-*]\s+/, ""))
        .map((line) => `<li style="margin:0 0 8px;">${formatInlineMarkdown(line)}</li>`)
        .join("")
      return `<ul style="margin:14px 0 14px 20px;padding:0;color:#374151;font-size:15px;line-height:1.7;">${items}</ul>`
    }

    const heading = lines.length === 1 ? lines[0].match(/^(#{1,3})\s+(.+)$/) : null
    if (heading) {
      const level = Math.min(heading[1].length + 1, 4)
      return `<h${level} style="margin:20px 0 10px;color:#111827;font-size:${level === 2 ? "24px" : level === 3 ? "20px" : "17px"};line-height:1.3;font-weight:700;">${formatInlineMarkdown(
        heading[2]
      )}</h${level}>`
    }

    const content = lines
      .map((line) => {
        if (/^__CODE_BLOCK_\d+__$/.test(line.trim())) {
          const index = Number(line.match(/\d+/)?.[0] ?? "-1")
          return codeBlocks[index] ?? ""
        }
        return formatInlineMarkdown(line)
      })
      .join("<br />")

    return `<p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.75;">${content}</p>`
  })

  return htmlSections.join("")
}

export function buildChatEmailContent(body: string): { text: string; html: string } {
  const text = body.replace(/\r\n/g, "\n").trim()
  const richBody = renderMarkdownishHtml(text)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Aurelius</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:28px 12px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:18px 24px;background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);">
              <div style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">Aurelius</div>
              <div style="margin-top:4px;font-size:12px;color:rgba(255,255,255,0.78);">AI-crafted response</div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 24px 18px;">${richBody}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { text, html }
}

export async function sendSmtpEmail(
  config: SmtpConfig,
  options: {
    to: string
    subject: string
    text: string
    html?: string
    attachments?: EmailAttachment[]
  }
) {
  const host   = process.env.SMTP_HOST
  const port   = Number(process.env.SMTP_PORT ?? "587")
  const secure = process.env.SMTP_SECURE === "true" || port === 465

  // Validate all required fields before attempting to connect.
  if (!host) {
    throw new Error("SMTP is not configured on this server (SMTP_HOST is missing).")
  }
  if (!config.user || !config.pass) {
    throw new Error("SMTP credentials are missing. Save your email username and password in Tools settings.")
  }

  // SMTP_FROM lets the server admin set a fixed sender address (e.g. a no-reply
  // address). If it is not set we fall back to the authenticated user's address.
  // On many SMTP servers the From header MUST match the authenticated user, so
  // keeping them the same is the safest default.
  const from = process.env.SMTP_FROM ?? config.user

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: config.user, pass: config.pass },
  })

  // Verify the connection before sending so we get a clear error message
  // instead of a generic nodemailer timeout if credentials are wrong.
  await transporter.verify().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Could not connect to SMTP server (${host}:${port}): ${msg}`)
  })

  const content = options.html
    ? { text: options.text.trim(), html: options.html }
    : buildChatEmailContent(options.text)

  await transporter.sendMail({
    from,
    to:      options.to,
    subject: options.subject,
    text:    content.text,
    html:    content.html,
    attachments: options.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  })
}

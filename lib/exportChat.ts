// lib/exportChat.ts
// Two export options: Chat PDF and Study Notes PDF.
// Both use window.print() via a hidden iframe — no dependencies needed.

import type { ChatMessage } from "@/types/chat"


function printIframe(html: string) {
  const iframe = document.createElement("iframe")
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;"
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument!
  doc.open(); doc.write(html); doc.close()
  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => document.body.removeChild(iframe), 3000)
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Minimal markdown → HTML (for PDF rendering)
function mdToHtml(md: string): string {
  let s = escHtml(md)
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>")
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>")
  s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>")
  s = s.replace(/^## (.+)$/gm,  "<h2>$1</h2>")
  s = s.replace(/^# (.+)$/gm,   "<h1>$1</h1>")
  s = s.replace(/^[\*\-] (.+)$/gm, "<li>$1</li>")
  s = s.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>")
  s = s.replace(/\n\n/g, "</p><p>")
  s = s.replace(/\n/g, "<br>")
  return `<p>${s}</p>`
}

// ── Shared print CSS ───────────────────────────────────────────────
const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 11pt; line-height: 1.65; color: #1a1a1a;
    max-width: 680px; margin: 0 auto; padding: 32px 24px;
  }
  h1 { font-size: 20pt; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 14pt; font-weight: 600; margin: 28px 0 10px; color: #111; }
  h3 { font-size: 11pt; font-weight: 600; margin: 16px 0 6px; color: #333; }
  p  { margin-bottom: 10px; }
  ul { margin: 8px 0 10px 20px; }
  li { margin-bottom: 4px; }
  code { background: #f0f0f0; padding: 1px 5px; border-radius: 3px; font-size: 9pt; font-family: monospace; }
  pre  { background: #1a1a1a; color: #e2e8f0; padding: 14px; border-radius: 6px; overflow-x: auto; font-size: 9pt; margin: 10px 0; }
  pre code { background: none; padding: 0; color: inherit; }
  strong { font-weight: 600; }
  em     { font-style: italic; }
  .meta  { font-size: 9pt; color: #888; margin-bottom: 28px; }
  .divider { border: none; border-top: 1px solid #e5e5e5; margin: 20px 0; }
  @media print { body { padding: 0; } }
`

// ── 1. Chat PDF ────────────────────────────────────────────────────
// Clean transcript: each message as a labelled bubble.
export function exportAsPdf(title: string, messages: ChatMessage[]) {
  const date = new Date().toLocaleDateString("en", { dateStyle: "long" })

  const messageHtml = messages.map((msg, i) => {
    const isUser = msg.role === "user"
    const label  = isUser ? "You" : "Aurelius"
    const bubble = isUser
      ? `<div style="background:#6366f1;color:#fff;border-radius:12px 12px 2px 12px;padding:12px 16px;font-size:10.5pt;white-space:pre-wrap;word-break:break-word">${escHtml(msg.content)}</div>`
      : `<div style="background:#f4f4f5;color:#111;border-radius:2px 12px 12px 12px;padding:12px 16px;font-size:10.5pt">${mdToHtml(msg.content)}</div>`

    return `
      <div style="margin-bottom:20px;page-break-inside:avoid">
        <div style="font-size:8pt;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#888;margin-bottom:6px">${label}</div>
        ${bubble}
      </div>
      ${i < messages.length - 1 ? '<hr class="divider">' : ""}
    `
  }).join("")

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escHtml(title)}</title>
  <style>${BASE_CSS}</style></head><body>
    <h1>${escHtml(title)}</h1>
    <p class="meta">Exported from Aurelius · ${date} · ${messages.length} messages</p>
    ${messageHtml}
  </body></html>`

  printIframe(html)
}

// ── 2. Study Notes PDF (AI-powered) ────────────────────────────────
// Calls the server to generate structured notes via Groq, then renders to PDF.
export async function exportAsNotesPdf(title: string, messages: ChatMessage[]): Promise<void> {
  const date = new Date().toLocaleDateString("en", { dateStyle: "long" })

  // Call the AI endpoint
  const res = await fetch("/api/export/notes", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ title, messages }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error ?? "Failed to generate study notes")
  }

  const { notes } = await res.json()

  // ── Render the AI-generated notes to HTML ─────────────────────
  const tocItems = notes.sections.map((s: { heading: string }, i: number) =>
    `<li style="margin-bottom:5px">
       <a href="#s${i+1}" style="color:#6366f1;text-decoration:none">${i+1}. ${escHtml(s.heading)}</a>
     </li>`
  ).join("")

  const sectionHtml = notes.sections.map((s: { heading: string; keyInsight: string; explanation: string; bullets: string[] }, i: number) => `
    <div id="s${i+1}" style="margin-bottom:32px;page-break-inside:avoid">
      <h2 style="color:#111;border-bottom:2px solid #e5e5e5;padding-bottom:8px;margin-bottom:14px">
        ${i+1}. ${escHtml(s.heading)}
      </h2>
      <div style="border-left:3px solid #6366f1;background:#f5f3ff;padding:10px 16px;border-radius:0 8px 8px 0;margin:0 0 14px;font-size:10pt;color:#3730a3;font-weight:500">
        💡 ${escHtml(s.keyInsight)}
      </div>
      <p style="margin-bottom:12px;font-size:10.5pt">${escHtml(s.explanation)}</p>
      <ul style="margin-left:20px">
        ${s.bullets.map((b: string) => `<li style="margin-bottom:5px;font-size:10pt">${escHtml(b)}</li>`).join("")}
      </ul>
    </div>
    ${i < notes.sections.length - 1 ? '<hr class="divider">' : ""}
  `).join("")

  const keyTermsHtml = notes.keyTerms?.length
    ? `<div style="margin-top:36px;border-top:2px solid #e5e5e5;padding-top:24px">
        <h2 style="margin-top:0">📖 Key Terms</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:10px">
          ${notes.keyTerms.map((t: { term: string; definition: string }) => `
            <tr style="border-bottom:1px solid #eee">
              <td style="padding:8px 12px 8px 0;font-weight:600;font-size:10pt;width:30%;vertical-align:top">${escHtml(t.term)}</td>
              <td style="padding:8px 0;font-size:10pt;color:#444">${escHtml(t.definition)}</td>
            </tr>
          `).join("")}
        </table>
      </div>`
    : ""

  const reviewQsHtml = notes.reviewQuestions?.length
    ? `<div style="margin-top:36px;border-top:2px solid #e5e5e5;padding-top:24px">
        <h2 style="margin-top:0">🔁 Review Questions</h2>
        <p style="font-size:9.5pt;color:#666;margin-bottom:12px">Test your understanding — try answering before checking your notes:</p>
        <ol style="margin-left:20px">
          ${notes.reviewQuestions.map((q: string) => `<li style="margin-bottom:10px;font-size:10.5pt">${escHtml(q)}</li>`).join("")}
        </ol>
      </div>`
    : ""

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Study Notes — ${escHtml(title)}</title>
    <style>
      ${BASE_CSS}
      .cover { text-align:center; padding:56px 0 36px; border-bottom:2px solid #e5e5e5; margin-bottom:32px; }
      .badge { display:inline-block; background:#f0f0ff; color:#6366f1; border:1px solid #c7d2fe; border-radius:20px; padding:4px 12px; font-size:9pt; font-weight:600; margin:3px; }
    </style>
    </head><body>

    <div class="cover">
      <div style="font-size:8.5pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6366f1;margin-bottom:12px">✦ AI Study Notes</div>
      <h1 style="font-size:22pt">${escHtml(title)}</h1>
      <p class="meta" style="margin-top:8px">Generated by Aurelius AI · ${date}</p>
      <div style="margin-top:14px">
        <span class="badge">📚 ${notes.sections.length} section${notes.sections.length !== 1 ? "s" : ""}</span>
        <span class="badge">💬 ${messages.length} messages</span>
        ${notes.keyTerms?.length ? `<span class="badge">📖 ${notes.keyTerms.length} key terms</span>` : ""}
      </div>
    </div>

    <div style="background:#f8f9fa;border-radius:8px;padding:16px 20px;margin-bottom:28px">
      <p style="font-size:9.5pt;font-weight:600;color:#444;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Summary</p>
      <p style="font-size:10.5pt;color:#222;line-height:1.7">${escHtml(notes.summary)}</p>
    </div>

    ${notes.sections.length > 1 ? `
      <h2 style="margin-top:0">Contents</h2>
      <ol style="margin:0 0 28px 20px">${tocItems}</ol>
      <hr class="divider">
    ` : ""}

    ${sectionHtml}
    ${keyTermsHtml}
    ${reviewQsHtml}

    <div style="margin-top:48px;text-align:center;font-size:8pt;color:#ccc;border-top:1px solid #eee;padding-top:16px">
      AI Study Notes · Generated by Aurelius · aurelius.app
    </div>
  </body></html>`

  printIframe(html)
}
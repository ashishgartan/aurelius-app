// lib/services/textExtractor.ts
// Pure Node.js text extraction — no external dependencies.
// Handles PDF, DOCX, TXT, Markdown, and code files.

// Node.js built-ins — available in Next.js App Router (Node runtime)
import { execFileSync } from "child_process"
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { inflateRawSync } from "zlib"

function decodePdfEscapes(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) =>
      String.fromCharCode(parseInt(octal, 8))
    )
    .replace(/\\(.)/g, "$1")
}

function decodePdfHex(value: string): string {
  const normalized = value.replace(/\s+/g, "")
  const padded = normalized.length % 2 === 1 ? `${normalized}0` : normalized
  let result = ""

  for (let i = 0; i < padded.length; i += 2) {
    const byte = Number.parseInt(padded.slice(i, i + 2), 16)
    if (!Number.isNaN(byte)) result += String.fromCharCode(byte)
  }

  return result
}

function isLikelyMeaningfulPdfText(value: string): boolean {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length < 20) return false

  const tokens = normalized.split(" ").filter(Boolean)
  if (tokens.length < 4) return false

  const alphaHeavyTokens = tokens.filter((token) => /[a-zA-Z]{2,}/.test(token))
  const alphaRatio = alphaHeavyTokens.length / tokens.length
  if (alphaRatio < 0.6) return false

  const printableChars = normalized.replace(/\s/g, "")
  const letterChars = (printableChars.match(/[a-zA-Z]/g) ?? []).length
  const digitChars = (printableChars.match(/[0-9]/g) ?? []).length
  const symbolChars = printableChars.length - letterChars - digitChars

  if (letterChars < Math.max(12, digitChars)) return false
  if (symbolChars > printableChars.length * 0.2) return false

  const longWords = alphaHeavyTokens.filter((token) => token.replace(/[^a-zA-Z]/g, "").length >= 4)
  return longWords.length >= 3
}

function runTesseractPdfOcr(buffer: Buffer, filename: string): string {
  if (process.env.ENABLE_TESSERACT_PDF_OCR !== "1") return ""

  const tempDir = mkdtempSync(join(tmpdir(), "aurelius-ocr-"))
  const tempPath = join(tempDir, filename.endsWith(".pdf") ? filename : "upload.pdf")
  const imagePrefix = join(tempDir, "page")

  try {
    writeFileSync(tempPath, buffer)
    execFileSync(
      "pdftoppm",
      ["-png", "-f", "1", "-l", "10", tempPath, imagePrefix],
      {
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      }
    )

    const imageFiles = readdirSync(tempDir)
      .filter((name) => /^page-\d+\.png$/i.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

    if (imageFiles.length === 0) return ""

    const pages: string[] = []
    for (const imageFile of imageFiles) {
      const imagePath = join(tempDir, imageFile)
      const text = execFileSync(
        "tesseract",
        [imagePath, "stdout", "--psm", "6"],
        {
          encoding: "utf8",
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
        }
      )
        .replace(/\s+/g, " ")
        .trim()

      if (text) pages.push(text)
    }

    const cleaned = pages.join(" ").trim()
    return isLikelyMeaningfulPdfText(cleaned) ? cleaned : ""
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message.slice(0, 400)
        : String(err).slice(0, 400)
    console.warn("[OCR] Tesseract PDF OCR failed:", message)
    return ""
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

// ── PDF extraction ─────────────────────────────────────────────────
// Parses PDF binary to extract text streams. Handles most text-based PDFs.
// Scanned/image PDFs will return empty text (OCR not supported without deps).
export function extractPdfText(buffer: Buffer): string {
  const str     = buffer.toString("latin1")
  const texts: string[] = []

  // Extract content between BT (begin text) and ET (end text) markers
  const btEtPattern = /BT([\s\S]*?)ET/g
  let match: RegExpExecArray | null

  while ((match = btEtPattern.exec(str)) !== null) {
    const block = match[1]

    // Extract strings from Tj and TJ operators
    // Tj: (text)Tj or <hex>Tj
    const tjPattern = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g
    let m: RegExpExecArray | null
    while ((m = tjPattern.exec(block)) !== null) {
      texts.push(decodePdfEscapes(m[1]))
    }

    const tjHexPattern = /<([0-9A-Fa-f\s]+)>\s*Tj/g
    while ((m = tjHexPattern.exec(block)) !== null) {
      const raw = decodePdfHex(m[1])
      if (raw) texts.push(raw)
    }

    // TJ array: [(text) offset (text)]TJ
    const tjArrayPattern = /\[([^\]]*)\]\s*TJ/g
    while ((m = tjArrayPattern.exec(block)) !== null) {
      const arrayContent = m[1]
      const innerPattern = /\(([^)\\]*(?:\\.[^)\\]*)*)\)|<([0-9A-Fa-f\s]+)>/g
      let inner: RegExpExecArray | null
      while ((inner = innerPattern.exec(arrayContent)) !== null) {
        const raw = inner[1]
          ? decodePdfEscapes(inner[1])
          : decodePdfHex(inner[2])
        if (raw) texts.push(raw)
      }
    }
  }

  // Also try to extract from stream objects (compressed content)
  // Look for FlateDecode streams and attempt simple text recovery
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  while ((match = streamPattern.exec(str)) !== null) {
    const streamContent = match[1]
    // Look for readable text patterns in uncompressed streams
    const readableText = streamContent
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    if (readableText.length > 50 && /[a-zA-Z]{3,}/.test(readableText)) {
      // Only include if it looks like real text (not binary noise)
      const words = readableText.match(/[a-zA-Z][a-zA-Z0-9\s.,!?;:'"()-]{10,}/g) || []
      const candidate = words.join(" ")
      if (words.length > 3 && isLikelyMeaningfulPdfText(candidate)) {
        texts.push(candidate)
      }
    }
  }

  const result = texts
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()

  return isLikelyMeaningfulPdfText(result) || result.length <= 20 ? result : ""
}

// ── DOCX extraction ────────────────────────────────────────────────
// A .docx file is a ZIP archive. We parse the XML to extract text.
// Uses the ZIP local file header structure to find word/document.xml.
export function extractDocxText(buffer: Buffer): string {
  // Find word/document.xml in the ZIP
  const target = "word/document.xml"

  // Scan for ZIP local file headers (PK\x03\x04)
  const texts: string[] = []
  let pos = 0

  while (pos < buffer.length - 30) {
    // Local file header signature
    if (
      buffer[pos]   === 0x50 && buffer[pos+1] === 0x4B &&
      buffer[pos+2] === 0x03 && buffer[pos+3] === 0x04
    ) {
      const filenameLen  = buffer.readUInt16LE(pos + 26)
      const extraLen     = buffer.readUInt16LE(pos + 28)
      const compSize     = buffer.readUInt32LE(pos + 18)
      const filename     = buffer.slice(pos + 30, pos + 30 + filenameLen).toString("utf8")
      const dataStart    = pos + 30 + filenameLen + extraLen

      if (filename === target) {
        // The data may be stored (method 0) or deflated (method 8)
        const method = buffer.readUInt16LE(pos + 8)
        let xmlContent: string

        if (method === 0) {
          // Stored — no compression
          xmlContent = buffer.slice(dataStart, dataStart + compSize).toString("utf8")
        } else {
          // Deflated — use Node.js zlib (static import at top)
          try {
            const compressed = buffer.slice(dataStart, dataStart + compSize)
            xmlContent = inflateRawSync(compressed).toString("utf8")
          } catch {
            xmlContent = ""
          }
        }

        if (xmlContent) {
          // Extract text from XML — strip tags, get text nodes
          const stripped = xmlContent
            .replace(/<w:p[ >][^>]*>/g, "\n")   // paragraphs → newlines
            .replace(/<[^>]+>/g, "")              // strip all tags
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&apos;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/\n{3,}/g, "\n\n")
            .trim()
          texts.push(stripped)
        }
        break
      }

      pos = dataStart + compSize
    } else {
      pos++
    }
  }

  return texts.join("\n\n")
}

// ── Plain text / Markdown / Code ───────────────────────────────────
export function extractPlainText(buffer: Buffer): string {
  return buffer.toString("utf8")
}

// ── Main dispatcher ────────────────────────────────────────────────
export function extractText(filename: string, mimeType: string, buffer: Buffer): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""

  if (mimeType === "application/pdf" || ext === "pdf") {
    const directText = extractPdfText(buffer)
    if (isLikelyMeaningfulPdfText(directText) || directText.length > 20) {
      return directText
    }

    const ocrText = runTesseractPdfOcr(buffer, filename)
    return ocrText || directText
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return extractDocxText(buffer)
  }

  // Everything else — treat as UTF-8 text
  return extractPlainText(buffer)
}

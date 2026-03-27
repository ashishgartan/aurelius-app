import test from "node:test"
import assert from "node:assert/strict"
import { extractDocxText, extractPdfText } from "../lib/services/textExtractor.ts"

test("extractPdfText decodes hex-encoded Tj strings", () => {
  const pdf = Buffer.from("%PDF-1.4\nBT\n<48656c6c6f20576f726c64> Tj\nET\n", "latin1")

  assert.equal(extractPdfText(pdf), "Hello World")
})

test("extractPdfText decodes mixed literal and hex TJ arrays", () => {
  const pdf = Buffer.from(
    "%PDF-1.4\nBT\n[(Hello) 120 <20576f726c64>] TJ\nET\n",
    "latin1"
  )

  assert.equal(extractPdfText(pdf), "Hello World")
})

test("extractPdfText rejects noisy stream output that does not look like document text", () => {
  const pdf = Buffer.from(
    "%PDF-1.4\nstream\n@@@ ### %% ^^^ 12 34 ;; __ ++ ==\nendstream\n",
    "latin1"
  )

  assert.equal(extractPdfText(pdf), "")
})

test("extractDocxText extracts paragraph text from a stored document.xml entry", () => {
  const xml = '<w:document><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p><w:p><w:r><w:t>World</w:t></w:r></w:p></w:body></w:document>'
  const xmlBuffer = Buffer.from(xml, "utf8")
  const filename = Buffer.from("word/document.xml", "utf8")
  const header = Buffer.alloc(30)

  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(0, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt16LE(0, 10)
  header.writeUInt16LE(0, 12)
  header.writeUInt32LE(0, 14)
  header.writeUInt32LE(xmlBuffer.length, 18)
  header.writeUInt32LE(xmlBuffer.length, 22)
  header.writeUInt16LE(filename.length, 26)
  header.writeUInt16LE(0, 28)

  const docxLike = Buffer.concat([header, filename, xmlBuffer])

  assert.equal(extractDocxText(docxLike), "Hello\nWorld")
})

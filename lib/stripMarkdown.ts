// lib/stripMarkdown.ts
// Converts markdown to plain readable text for clipboard copy.
// No external deps — pure regex transforms in the same order ChatGPT uses.

export function stripMarkdown(md: string): string {
  let text = md

  // Code blocks — keep content, drop fences and language tag
  text = text.replace(/```[\w]*\n([\s\S]*?)```/g, "$1")
  text = text.replace(/`([^`]+)`/g, "$1")

  // Headings → plain text (strip # prefix)
  text = text.replace(/^#{1,6}\s+/gm, "")

  // Bold / italic
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, "$1")
  text = text.replace(/___(.+?)___/g,       "$1")
  text = text.replace(/\*\*(.+?)\*\*/g,     "$1")
  text = text.replace(/__(.+?)__/g,         "$1")
  text = text.replace(/\*(.+?)\*/g,         "$1")
  text = text.replace(/_(.+?)_/g,           "$1")

  // Strikethrough
  text = text.replace(/~~(.+?)~~/g, "$1")

  // Links — keep label, drop URL
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")

  // Images — drop entirely
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")

  // Blockquotes — strip > prefix
  text = text.replace(/^>\s?/gm, "")

  // Unordered list markers
  text = text.replace(/^[\*\-\+]\s+/gm, "• ")

  // Ordered list markers — keep as-is (1. 2. 3.)
  text = text.replace(/^\d+\.\s+/gm, (m) => m)

  // Horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, "")

  // HTML tags (rare but possible)
  text = text.replace(/<[^>]+>/g, "")

  // Collapse multiple blank lines to one
  text = text.replace(/\n{3,}/g, "\n\n")

  return text.trim()
}
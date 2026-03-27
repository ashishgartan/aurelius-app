import type { MemoryCategory, MemorySensitivity } from "../models/index.ts"

export interface MemoryCandidate {
  category: MemoryCategory
  key: string
  value: string
  confidence: number
  sensitivity: MemorySensitivity
  sourceKind: "user_message" | "manual" | "system_inferred"
  excerpt?: string
}

const INTEREST_KEYWORDS = [
  { key: "ai-tooling", label: "AI tooling", pattern: /\b(ai|llm|agent|openai|prompt|rag)\b/i },
  { key: "frontend", label: "Frontend engineering", pattern: /\b(frontend|react|next\.?js|css|ui|ux)\b/i },
  { key: "backend", label: "Backend engineering", pattern: /\b(backend|node|api|server|express|fastify)\b/i },
  { key: "databases", label: "Databases", pattern: /\b(mongodb|postgres|mysql|sql|database)\b/i },
  { key: "product", label: "Product building", pattern: /\b(product|roadmap|users|growth|startup)\b/i },
]

function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function titleCaseWords(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

function techLabel(value: string): string {
  if (/^cpp$/i.test(value)) return "C++"
  if (/^next\.?js$/i.test(value)) return "Next.js"
  if (/^typescript$/i.test(value)) return "TypeScript"
  if (/^javascript$/i.test(value)) return "JavaScript"
  if (/^python$/i.test(value)) return "Python"
  if (/^react$/i.test(value)) return "React"
  return value
}

export function extractMemoryCandidates(message: string): MemoryCandidate[] {
  const trimmed = message.trim()
  const candidates: MemoryCandidate[] = []

  const add = (candidate: MemoryCandidate) => {
    const normalized = normalizeValue(candidate.value)
    if (!normalized) return
    const duplicate = candidates.find(
      (item) =>
        item.category === candidate.category &&
        item.key === candidate.key &&
        normalizeValue(item.value) === normalized
    )
    if (!duplicate) candidates.push(candidate)
  }

  const nameMatch = trimmed.match(
    /\b(?:my name is|this is|call me|you can call me|(?:hi|hello|hey)\s+am|i am|i'm|im)\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){0,2})\b/i
  )
  if (nameMatch) {
    const name = titleCaseWords(nameMatch[1])
    if (name.split(" ").length >= 1 && name.length <= 60) {
      add({
        category: "profile",
        key: "name",
        value: name,
        confidence: 0.96,
        sensitivity: "low",
        sourceKind: "user_message",
        excerpt: trimmed,
      })
    }
  }

  const roleMatch = trimmed.match(
    /\b(?:i am|i'm|im|i work as|i work like)\s+(?:a|an)?\s*([a-z][a-z\s/-]{2,40})\b/i
  )
  if (roleMatch) {
    const role = roleMatch[1].trim().replace(/\s+/g, " ")
    if (!/\b(name|timezone|based in|from|using|prefer|concise|detailed|technical|casual|professional)\b/i.test(role)) {
      add({
        category: "profile",
        key: "role",
        value: role,
        confidence: 0.82,
        sensitivity: "low",
        sourceKind: "user_message",
        excerpt: trimmed,
      })
    }
  }

  const timezoneMatch = trimmed.match(
    /\b(?:my timezone is|timezone is|i am in|i'm in|im in|i am based in|i'm based in|im based in)\s+([a-z/_+-]{2,50}(?:\s+[a-z/_+-]{2,50})?)\b/i
  )
  if (timezoneMatch) {
    add({
      category: "profile",
      key: "timezone",
      value: timezoneMatch[1].trim(),
      confidence: 0.88,
      sensitivity: "low",
      sourceKind: "user_message",
      excerpt: trimmed,
    })
  }

  const normalizedMessage = normalizeValue(trimmed)
  let normalizedStyle: string | null = null
  if (
    /\b(i prefer|prefer|keep it|make it|answers should be)\s+concise\b/i.test(trimmed) ||
    /\bshort answers\b/i.test(trimmed) ||
    /\bbrief answers\b/i.test(trimmed)
  ) {
    normalizedStyle = "concise"
  } else if (
    /\b(i prefer|prefer|keep it|make it|answers should be)\s+detailed\b/i.test(trimmed) ||
    /\bdetailed answers\b/i.test(trimmed)
  ) {
    normalizedStyle = "detailed"
  } else if (
    /\b(i prefer|prefer|keep it|make it|answers should be)\s+technical\b/i.test(trimmed) ||
    /\btechnical answers\b/i.test(trimmed)
  ) {
    normalizedStyle = "technical"
  } else if (
    /\b(i prefer|prefer|keep it|make it|answers should be)\s+casual\b/i.test(trimmed) ||
    /\bcasual tone\b/i.test(trimmed)
  ) {
    normalizedStyle = "casual"
  } else if (
    /\b(i prefer|prefer|keep it|make it|answers should be)\s+professional\b/i.test(trimmed) ||
    /\bprofessional tone\b/i.test(trimmed)
  ) {
    normalizedStyle = "professional"
  }

  if (!normalizedStyle) {
    if (normalizedMessage.includes("short answers") || normalizedMessage.includes("brief answers")) {
      normalizedStyle = "concise"
    } else if (normalizedMessage.includes("detailed answers")) {
      normalizedStyle = "detailed"
    } else if (normalizedMessage.includes("technical answers")) {
      normalizedStyle = "technical"
    } else if (normalizedMessage.includes("casual tone")) {
      normalizedStyle = "casual"
    } else if (normalizedMessage.includes("professional tone")) {
      normalizedStyle = "professional"
    }
  }

  if (normalizedStyle) {
    add({
      category: "preference",
      key: "response_style",
      value: normalizedStyle,
      confidence: 0.86,
      sensitivity: "low",
      sourceKind: "user_message",
      excerpt: trimmed,
    })
  }

  const techPreferenceMatch = trimmed.match(
    /\b(?:i prefer|prefer|mostly use|usually use|i use|i work with|my stack is|we use|working with)\s+(typescript|javascript|python|go|java|c\+\+|cpp|react|next\.?js)\b/i
  )
  if (techPreferenceMatch) {
    add({
      category: "preference",
      key: "preferred_stack",
      value: techLabel(techPreferenceMatch[1]),
      confidence: 0.84,
      sensitivity: "low",
      sourceKind: "user_message",
      excerpt: trimmed,
    })
  }

  for (const interest of INTEREST_KEYWORDS) {
    if (interest.pattern.test(trimmed)) {
      add({
        category: "interest",
        key: `interest:${interest.key}`,
        value: interest.label,
        confidence: 0.68,
        sensitivity: "low",
        sourceKind: "system_inferred",
        excerpt: trimmed,
      })
    }
  }

  return candidates
}

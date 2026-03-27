// lib/csrf.ts — origin-based CSRF protection for mutating API routes
//
// Since auth uses HttpOnly cookies with SameSite=Lax, the main CSRF risk
// is cross-origin requests that share the same origin (e.g. a subdomain).
// This check ensures the Origin header matches the app's own origin,
// rejecting any request from a different domain.
//
// Usage in an API route:
//   const csrfError = checkCsrf(req)
//   if (csrfError) return csrfError
//
// Skip this for GET/HEAD (read-only) and for the token-based auth endpoints
// (login/signup) which are intentionally public.

const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
)

function isLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    if (url.protocol !== "http:") return false
    return url.hostname === "localhost" || url.hostname === "127.0.0.1"
  } catch {
    return false
  }
}

function getExpectedOrigins(): Set<string> {
  const origins = new Set(ALLOWED_ORIGINS)

  // Always allow the app's own origin derived from NEXTAUTH_URL / APP_URL
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL
  if (appUrl) {
    try {
      origins.add(new URL(appUrl).origin)
    } catch {
      // ignore malformed env var
    }
  }

  // In development, allow localhost on any port
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000")
    origins.add("http://127.0.0.1:3000")
  }

  return origins
}

export function checkCsrf(req: Request): Response | null {
  // Only enforce on mutating methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return null

  const isProduction = process.env.NODE_ENV === "production"
  const origin = req.headers.get("origin")
  const expected = getExpectedOrigins()

  // In production, fail closed if server origin configuration is missing.
  if (isProduction && expected.size === 0) {
    return Response.json(
      { error: "Forbidden — server origin is not configured" },
      { status: 403 }
    )
  }

  // No Origin header — allow in development for local tooling, but require it
  // in production so browser-issued cookie requests are origin-checked.
  if (!origin) {
    return isProduction
      ? Response.json(
          { error: "Forbidden — missing Origin header" },
          { status: 403 }
        )
      : null
  }

  // If we have no configured origins (fresh dev setup), allow all
  if (expected.size === 0) return null

  // In development, allow any localhost / 127.0.0.1 port so local tooling
  // does not break settings saves when Next is not running on 3000.
  if (process.env.NODE_ENV !== "production" && isLocalDevOrigin(origin)) {
    return null
  }

  if (!expected.has(origin)) {
    return Response.json(
      { error: "Forbidden — cross-origin request rejected" },
      { status: 403 }
    )
  }

  return null
}

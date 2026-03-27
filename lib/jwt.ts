// lib/jwt.ts — jose (Web Crypto, works in Edge + Node)
import { SignJWT, jwtVerify, type JWTPayload } from "jose"
import type { AuthTokenPayload } from "@/types/auth"

// ── Secret validation — fail loudly at startup, not silently at runtime ──
const raw = process.env.JWT_SECRET

if (!raw) {
  throw new Error(
    "JWT_SECRET is not set. Add it to .env.local:\n" +
    "  JWT_SECRET=$(openssl rand -hex 32)"
  )
}

if (raw.length < 32) {
  throw new Error(
    `JWT_SECRET is too short (${raw.length} chars). It must be at least 32 characters.\n` +
    "  Generate one with: openssl rand -hex 32"
  )
}

const SECRET      = new TextEncoder().encode(raw)
const ALGORITHM   = "HS256"
const EXPIRES_IN  = "7d"
export const COOKIE_NAME = "auth_token"

export async function signToken(payload: AuthTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    const typed = payload as JWTPayload & AuthTokenPayload
    // Runtime validation — jwtVerify guarantees signature and expiry, but not shape
    if (
      typeof typed.userId      !== "string" || !typed.userId ||
      typeof typed.email       !== "string" || !typed.email ||
      typeof typed.displayName !== "string"
    ) {
      return null
    }
    return typed
  } catch {
    return null
  }
}

export function extractToken(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? ""
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))
  if (match?.[1]) return decodeURIComponent(match[1])
  const auth = req.headers.get("authorization") ?? ""
  if (auth.startsWith("Bearer ")) return auth.slice(7)
  return null
}

export async function getAuthUser(req: Request): Promise<AuthTokenPayload | null> {
  const token = extractToken(req)
  if (!token) return null
  const auth = await verifyToken(token)
  if (!auth) return null

  const { findUserById } = await import("./services/user.ts")
  const user = await findUserById(auth.userId).catch(() => null)
  if (!user) return null

  return {
    userId: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    iat: auth.iat,
    exp: auth.exp,
  }
}

export function makeAuthCookie(token: string): string {
  const maxAge = 7 * 24 * 60 * 60
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ].filter(Boolean).join("; ")
}

export function clearAuthCookie(): string {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`
}

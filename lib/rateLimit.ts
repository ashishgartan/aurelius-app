// lib/rateLimit.ts
// In-process sliding-window rate limiter — no Redis required.
//
// Works per-key (typically userId or IP). Stores request timestamps in a Map
// and evicts stale entries older than the window on every check.
//
// ⚠️  SCALING NOTE:
// This limiter is in-process. On serverless/edge deployments (Vercel, etc.)
// each function instance has its own Map, so the effective limit is
// per-instance — not per-user globally. For production horizontal scale,
// replace this with a Redis-backed limiter:
//
//   npm install @upstash/ratelimit @upstash/redis
//
// Then swap the implementation:
//
//   import { Ratelimit } from "@upstash/ratelimit"
//   import { Redis }     from "@upstash/redis"
//
//   const ratelimit = new Ratelimit({
//     redis:    Redis.fromEnv(),                          // UPSTASH_REDIS_REST_URL + TOKEN
//     limiter:  Ratelimit.slidingWindow(20, "60 s"),
//     prefix:   "aurelius:rl",
//   })
//
//   const { success, remaining, reset } = await ratelimit.limit(userId)
//
// For now, the in-process version is correct for single-instance deployments
// (Docker, Railway, Render, Fly.io with a single replica).


interface RateLimitOptions {
  /** Maximum number of requests allowed within the window */
  limit:      number
  /** Window size in milliseconds */
  windowMs:   number
}

interface RateLimitResult {
  allowed:    boolean
  remaining:  number   // requests left in the current window
  resetMs:    number   // ms until the oldest request falls outside the window
}

// One Map per limiter instance — each call to createRateLimiter gets its own.
export function createRateLimiter({ limit, windowMs }: RateLimitOptions) {
  const store = new Map<string, number[]>()

  // Periodically sweep keys with empty timestamp arrays to avoid memory leaks
  // on long-running servers with many unique users.
  const sweep = () => {
    const now = Date.now()
    for (const [key, timestamps] of store) {
      const valid = timestamps.filter((t) => now - t < windowMs)
      if (valid.length === 0) store.delete(key)
      else store.set(key, valid)
    }
  }
  // Sweep every 5 minutes — low overhead, prevents unbounded growth.
  if (typeof setInterval !== "undefined") {
    setInterval(sweep, 5 * 60 * 1_000).unref?.()
  }

  return function check(key: string): RateLimitResult {
    const now = Date.now()
    const timestamps = (store.get(key) ?? []).filter((t) => now - t < windowMs)

    if (timestamps.length >= limit) {
      // Oldest timestamp tells us when the window first frees up a slot.
      const resetMs = windowMs - (now - timestamps[0])
      return { allowed: false, remaining: 0, resetMs }
    }

    timestamps.push(now)
    store.set(key, timestamps)
    return { allowed: true, remaining: limit - timestamps.length, resetMs: 0 }
  }
}

// ── IP extraction helper ───────────────────────────────────────────
// Reads the real client IP from standard proxy headers, falling back
// to a sentinel so the limiter still works even without one.
// Works in both Node.js and Edge runtime.
export function getClientIp(req: Request): string {
  // Standard reverse-proxy headers (Vercel, Cloudflare, nginx, etc.)
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()

  const realIp = req.headers.get("x-real-ip")
  if (realIp) return realIp.trim()

  // Local dev / no proxy — use a fixed key so the limiter still applies
  return "127.0.0.1"
}
// app/(auth)/login/page.tsx
// Passwordless login — enter email, get OTP, verify.
// New users: prompted for a display name if email is not recognised.
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AuthInput } from "@/components/auth/AuthInput"
import { Button } from "@/components/ui/button"
import { ArrowRight, Loader2, Mail, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"

type Step = "email" | "name" | "otp"

export default function LoginPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (authLoading || !user) return
    router.replace("/chat")
  }, [authLoading, user, router])

  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [code, setCode] = useState("")
  const [isNewUser, setIsNewUser] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  // ── Step 1: check email ──────────────────────────────────────────
  // We peek at the DB to decide whether to ask for a name (new user).

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Something went wrong")

      if (data.exists) {
        // Existing user — send OTP immediately
        await doSendOtp(email.trim(), undefined)
        setIsNewUser(false)
        setStep("otp")
      } else {
        // New user — ask for name first
        setIsNewUser(true)
        setStep("name")
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  // ── Step 1b: collect name for new users, then send OTP ───────────

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!displayName.trim()) {
      setError("Please enter your name")
      return
    }
    setLoading(true)
    try {
      await doSendOtp(email.trim(), displayName.trim())
      setStep("otp")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code")
    } finally {
      setLoading(false)
    }
  }

  // ── Send OTP ─────────────────────────────────────────────────────

  const doSendOtp = async (em: string, name: string | undefined) => {
    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: em,
        ...(name ? { displayName: name } : {}),
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Failed to send code")
  }

  const handleResend = async () => {
    setResending(true)
    setError("")
    setResent(false)
    setCode("")
    try {
      await doSendOtp(email.trim(), displayName.trim() || undefined)
      setResent(true)
      setTimeout(() => setResent(false), 4000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend")
    } finally {
      setResending(false)
    }
  }

  // ── Step 2: verify OTP ───────────────────────────────────────────

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (code.length !== 6) {
      setError("Enter the 6-digit code")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code,
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Verification failed")
      router.push(
        data.defaultSessionId ? `/chat/${data.defaultSessionId}` : "/chat"
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed")
    } finally {
      setLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────

  const headings: Record<Step, { title: string; sub: string }> = {
    email: {
      title: "Welcome to Aurelius",
      sub: "Enter your email to sign in or create an account",
    },
    name: { title: "Create your account", sub: "Just your name and you're in" },
    otp: { title: "Check your inbox", sub: `We sent a code to ${email}` },
  }

  if (authLoading) return null

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl text-foreground">
          {headings[step].title}
        </h1>
        <p className="text-sm text-muted-foreground">{headings[step].sub}</p>
      </div>

      {/* Card */}
      <div className="relative flex flex-col gap-5 rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm">
        <div className="border-top-shine" />

        {/* ── Email step ── */}
        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
            <AuthInput
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading || !email.trim()}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Mail className="size-4" /> Continue with email
                </>
              )}
            </Button>
          </form>
        )}

        {/* ── Name step (new users only) ── */}
        {step === "name" && (
          <form onSubmit={handleNameSubmit} className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <Mail className="size-3.5 shrink-0" />
              <span className="truncate">{email}</span>
              <button
                type="button"
                onClick={() => {
                  setStep("email")
                  setError("")
                }}
                className="ml-auto shrink-0 text-xs text-primary hover:underline"
              >
                Change
              </button>
            </div>
            <AuthInput
              label="Your name"
              type="text"
              placeholder="Jane Smith"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              autoFocus
              required
            />
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading || !displayName.trim()}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Mail className="size-4" /> Send verification code
                </>
              )}
            </Button>
          </form>
        )}

        {/* ── OTP step ── */}
        {step === "otp" && (
          <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
            {/* Email badge */}
            <div className="flex items-center gap-2 rounded-lg bg-primary/8 px-3 py-2 text-sm">
              <Mail className="size-3.5 shrink-0 text-primary" />
              <span className="truncate text-muted-foreground">{email}</span>
              <button
                type="button"
                onClick={() => {
                  setStep("email")
                  setCode("")
                  setError("")
                }}
                className="ml-auto shrink-0 text-xs text-primary hover:underline"
              >
                Change
              </button>
            </div>

            {/* OTP input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className={cn(
                  "w-full rounded-xl border bg-background px-4 py-3 text-center",
                  "text-2xl font-bold tracking-[0.5em] text-foreground",
                  "placeholder:tracking-[0.5em] placeholder:text-muted-foreground/30",
                  "ring-offset-background transition-shadow outline-none focus:ring-2 focus:ring-primary/40",
                  error ? "border-destructive/60" : "border-border/60"
                )}
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading || code.length !== 6}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  {isNewUser ? "Create account" : "Sign in"}{" "}
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>

            {/* Resend */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>Didn&apos;t receive it?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="flex items-center gap-1 font-medium text-primary hover:underline disabled:opacity-50"
              >
                {resending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                {resending ? "Sending…" : resent ? "Sent!" : "Resend code"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Google placeholder (unchanged) */}
      {step === "email" && (
        <>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-xs text-muted-foreground/50">or</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>
          <Button variant="outline" className="w-full gap-2" disabled>
            <svg className="size-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>
        </>
      )}
    </div>
  )
}

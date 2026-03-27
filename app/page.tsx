// app/page.tsx — Landing page (redesigned)
"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import { CurrentYear } from "@/components/CurrentYear"
import {
  ArrowRight,
  Brain,
  Globe,
  FileText,
  BarChart3,
  Zap,
  Shield,
  ChevronDown,
  Check,
  X,
  Search,
  Calculator,
  Upload,
  MessageSquare,
  Sparkles,
  Menu,
} from "lucide-react"
import { cn } from "@/lib/utils"

const DEMO_MESSAGES = [
  {
    role: "user",
    text: "Analyse my Q3 report and compare to analyst consensus",
  },
  { role: "tool", text: "📄 Reading Q3_Earnings.pdf…", delay: 800 },
  { role: "tool", text: "🌐 Searching analyst estimates…", delay: 1600 },
  {
    role: "assistant",
    text: "Revenue hit $4.2B (+14% YoY), beating the $3.98B consensus by 5.5%. Operating margin expanded 210bps to 23.4% — analysts expected 21.8%. Your EBITDA came in $180M above street estimates.",
    delay: 2600,
  },
]

function AnimatedChat() {
  const [visible, setVisible] = useState(0)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    let i = 0
    function next() {
      if (i >= DEMO_MESSAGES.length) {
        setTimeout(() => {
          setVisible(0)
          setTyping(false)
          i = 0
          next()
        }, 3000)
        return
      }
      const msg = DEMO_MESSAGES[i]
      setTimeout(() => {
        if (msg.role === "assistant") setTyping(true)
        setTimeout(
          () => {
            setTyping(false)
            setVisible((v) => v + 1)
            i++
            next()
          },
          msg.role === "assistant" ? 900 : 0
        )
      }, msg.delay ?? 500)
    }
    next()
  }, [])

  return (
    <div className="flex min-h-[180px] flex-col gap-3 p-5 text-left text-sm">
      {DEMO_MESSAGES.slice(0, visible).map((msg, i) => (
        <div
          key={i}
          className={cn("flex gap-2.5", msg.role === "user" && "justify-end")}
        >
          {msg.role !== "user" && (
            <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
              {msg.role === "tool" ? "⚡" : "A"}
            </div>
          )}
          <div
            className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed",
              msg.role === "user" &&
                "rounded-tr-sm bg-primary text-primary-foreground",
              msg.role === "tool" &&
                "rounded-tl-sm border border-border/50 bg-muted/40 text-muted-foreground",
              msg.role === "assistant" &&
                "rounded-tl-sm bg-muted/60 text-foreground"
            )}
          >
            {msg.text}
          </div>
        </div>
      ))}
      {typing && (
        <div className="flex gap-2.5">
          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
            A
          </div>
          <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted/60 px-3.5 py-3">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const STATS = [
  { value: "50k+", label: "Active users" },
  { value: "2.4M", label: "Messages sent" },
  { value: "99.9%", label: "Uptime" },
  { value: "<200ms", label: "Median response" },
]

const STEPS = [
  {
    num: "01",
    icon: Upload,
    title: "Connect your context",
    desc: "Upload documents, paste URLs, or just start typing. Aurelius ingests and indexes everything instantly.",
    color: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    num: "02",
    icon: Search,
    title: "Ask anything",
    desc: "Natural language questions across your documents, the live web, and Aurelius's own reasoning — all in one turn.",
    color: "text-blue-500",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    num: "03",
    icon: Sparkles,
    title: "Get real answers",
    desc: "Not summaries. Not bullet-point hedging. Cited, verifiable answers with chain-of-thought reasoning you can inspect.",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
  },
]

const FEATURES = [
  {
    icon: Brain,
    title: "Deep reasoning",
    desc: "Multi-step chain-of-thought that breaks complex problems into verifiable steps.",
  },
  {
    icon: Globe,
    title: "Live web search",
    desc: "Pulls real-time data so answers are always grounded in current information.",
  },
  {
    icon: FileText,
    title: "Document intelligence",
    desc: "Upload PDFs, Word docs, code — ask questions across all of them at once.",
  },
  {
    icon: BarChart3,
    title: "Usage analytics",
    desc: "Track conversations, monitor costs, and understand your AI usage patterns.",
  },
  {
    icon: Zap,
    title: "Sub-second responses",
    desc: "Groq-powered inference delivers streaming answers in milliseconds.",
  },
  {
    icon: Shield,
    title: "Private by design",
    desc: "Encrypted in transit and at rest. We never train on your data.",
  },
  {
    icon: Calculator,
    title: "Built-in tools",
    desc: "Web search, calculator, and code execution — no plugins to install.",
  },
  {
    icon: MessageSquare,
    title: "Session memory",
    desc: "Conversations are saved and searchable. Pick up exactly where you left off.",
  },
]

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "For individuals exploring AI.",
    cta: "Get started",
    href: "/signup",
    popular: false,
    features: [
      { text: "50 messages / day", included: true },
      { text: "Web search", included: true },
      { text: "3 document uploads / month", included: true },
      { text: "Basic analytics", included: true },
      { text: "Groq models", included: true },
      { text: "Priority queue", included: false },
      { text: "Unlimited documents", included: false },
      { text: "API access", included: false },
    ],
  },
  {
    name: "Pro",
    price: "$12",
    period: "per month",
    desc: "For power users and professionals.",
    cta: "Start free trial",
    href: "/signup",
    popular: true,
    features: [
      { text: "Unlimited messages", included: true },
      { text: "Web search", included: true },
      { text: "Unlimited document uploads", included: true },
      { text: "Advanced analytics", included: true },
      { text: "All models incl. Groq Ultra", included: true },
      { text: "Priority queue", included: true },
      { text: "Export to PDF / Markdown", included: true },
      { text: "API access", included: false },
    ],
  },
  {
    name: "Team",
    price: "$49",
    period: "per month",
    desc: "For teams that need collaboration.",
    cta: "Contact us",
    href: "mailto:hello@aurelius.ai",
    popular: false,
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Up to 10 seats", included: true },
      { text: "Shared document library", included: true },
      { text: "Admin dashboard", included: true },
      { text: "SSO / SAML", included: true },
      { text: "Priority support", included: true },
      { text: "Custom model fine-tuning", included: true },
      { text: "API access", included: true },
    ],
  },
]

const FAQS = [
  {
    q: "What models does Aurelius use?",
    a: "Aurelius runs on Groq's ultra-fast inference — Llama 3.3 70B, Mixtral 8×7B, and Gemma 2 9B. You can also connect your own local model via LM Studio.",
  },
  {
    q: "How does document intelligence work?",
    a: "Upload a PDF, Word doc, or code file and Aurelius extracts, chunks, and indexes the content. When you ask a question, it retrieves the most relevant passages and feeds them to the model as context.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Conversations are encrypted in transit and at rest. We never use your data to train models. You can delete your account and all data at any time from the Profile page.",
  },
  {
    q: "Can I use Aurelius without a Groq API key?",
    a: "No Groq key is needed for the hosted version — it's included. If you're self-hosting, you'll need your own Groq API key (free tier available).",
  },
  {
    q: "What's the difference between Free and Pro?",
    a: "Free gives you 50 messages per day with basic document support — plenty to get started. Pro removes all limits, unlocks all models, and adds priority queue access for faster responses.",
  },
  {
    q: "Can I self-host Aurelius?",
    a: "Yes — Aurelius is fully open source. The repository includes a one-command Docker setup. You'll need MongoDB and a Groq API key.",
  },
]

const TESTIMONIALS = [
  {
    quote:
      "Aurelius replaced three tools in our stack. One assistant that actually reasons.",
    author: "Priya Mehta",
    role: "Head of Product, Fieldwork",
  },
  {
    quote:
      "Document search found an insight buried in 400 pages in under a second.",
    author: "Marcus Chen",
    role: "Research Lead, Novu Labs",
  },
  {
    quote:
      "I've tried everything. This is the first AI that doesn't feel like a toy.",
    author: "Sofia Andersen",
    role: "Independent Consultant",
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm font-medium text-foreground">{q}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <p className="pb-5 text-sm leading-relaxed text-muted-foreground">
          {a}
        </p>
      )}
    </div>
  )
}

export default function LandingPage() {
  const [mobileMenu, setMobileMenu] = useState(false)

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="bg-grid absolute inset-0 opacity-30" />
        <div className="glow-blob absolute -top-48 -right-48 h-[700px] w-[700px]" />
        <div className="glow-blob absolute -bottom-48 -left-48 h-[500px] w-[500px] opacity-60" />
      </div>

      {/* Nav */}
      <nav className="relative z-30 border-b border-border/30 bg-background/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <Image
              src="/appIcon.png"
              alt="Aurelius"
              width={30}
              height={30}
              className="rounded-lg"
            />
            <span className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
              Aurelius
            </span>
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            {[
              ["#features", "Features"],
              ["#how", "How it works"],
              ["#pricing", "Pricing"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-lg px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:block"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get started <ArrowRight className="size-3.5" />
            </Link>
            <ThemeToggle />
            <button
              onClick={() => setMobileMenu((v) => !v)}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
            >
              <Menu className="size-4" />
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="border-t border-border/30 bg-background px-4 pb-4 md:hidden">
            {[
              ["#features", "Features"],
              ["#how", "How it works"],
              ["#pricing", "Pricing"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileMenu(false)}
                className="block py-2.5 text-sm text-muted-foreground hover:text-foreground"
              >
                {label}
              </a>
            ))}
            <Link
              href="/login"
              className="mt-2 block py-2.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6 sm:pt-20 sm:pb-28">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              <span className="text-xs font-medium tracking-wide text-primary">
                Now in public beta
              </span>
            </div>
            <h1 className="mb-5 text-[2.5rem] leading-[1.08] font-bold tracking-tight sm:text-5xl lg:text-[3rem]">
              The AI assistant that{" "}
              <span className="text-primary">actually thinks.</span>
            </h1>
            <p className="mb-8 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Real-time web search, document intelligence, and multi-step
              reasoning — all in one fast, private interface. Built for answers,
              not approximations.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Start for free <ArrowRight className="size-4" />
              </Link>
              <a
                href="#how"
                className="flex items-center gap-2 rounded-xl border border-border bg-background px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                See how it works
              </a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground/50">
              No credit card · Free tier always available
            </p>
            <div className="mt-7 flex items-center gap-3">
              <div className="flex -space-x-2">
                {["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"].map(
                  (c, i) => (
                    <div
                      key={i}
                      className="flex size-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold text-white"
                      style={{ background: c }}
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                  )
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">50,000+</span>{" "}
                users trust Aurelius
              </p>
            </div>
          </div>

          {/* Animated demo */}
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/60 shadow-2xl backdrop-blur-sm">
              <div className="flex items-center gap-2 border-b border-border/30 bg-muted/20 px-4 py-3">
                <div className="size-2.5 rounded-full bg-red-500/70" />
                <div className="size-2.5 rounded-full bg-yellow-500/70" />
                <div className="size-2.5 rounded-full bg-green-500/70" />
                <div className="mx-3 flex-1 rounded-md bg-muted/40 py-1 text-center text-[10px] text-muted-foreground/50">
                  aurelius.app
                </div>
              </div>
              <AnimatedChat />
              <div className="border-t border-border/30 px-4 py-3">
                <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                  <span className="flex-1 text-xs text-muted-foreground/40">
                    Ask Aurelius anything…
                  </span>
                  <div className="size-5 rounded bg-primary/80" />
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 left-1/2 h-12 w-3/4 -translate-x-1/2 rounded-full bg-primary/15 blur-2xl" />
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="relative z-10 border-y border-border/30 bg-muted/20 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-2 divide-x divide-y divide-border/30 sm:grid-cols-4 sm:divide-y-0">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center gap-0.5 px-6 py-6"
              >
                <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {s.value}
                </span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how"
        className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28"
      >
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold tracking-widest text-primary uppercase">
            How it works
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            From question to insight in three steps
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="flex flex-col gap-5 rounded-2xl border border-border/50 bg-card/40 p-7 backdrop-blur-sm"
            >
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "flex size-11 items-center justify-center rounded-xl border",
                    step.bg
                  )}
                >
                  <step.icon className={cn("size-5", step.color)} />
                </div>
                <span className="font-mono text-4xl font-bold text-muted-foreground/12">
                  {step.num}
                </span>
              </div>
              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:px-6"
      >
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold tracking-widest text-primary uppercase">
            Features
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need,{" "}
            <span className="text-primary">nothing you don&apos;t.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            We spent a year working out what makes an AI assistant actually
            useful day-to-day.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group flex flex-col gap-3.5 rounded-xl border border-border/40 bg-card/40 p-5 backdrop-blur-sm transition-all hover:border-primary/25 hover:bg-card/70"
            >
              <div className="flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/8 transition-colors group-hover:bg-primary/15">
                <f.icon className="size-4 text-primary" />
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">
          What people are saying
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.author}
              className="flex flex-col gap-4 rounded-xl border border-border/40 bg-card/30 p-6 backdrop-blur-sm"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className="size-3.5 fill-primary"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="flex-1 text-sm leading-relaxed text-foreground/80">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t.author}
                </p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28"
      >
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold tracking-widest text-primary uppercase">
            Pricing
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, honest pricing
          </h2>
          <p className="mt-4 text-muted-foreground">
            Start free. Upgrade when you need more. Cancel any time.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-2xl border p-7",
                plan.popular
                  ? "border-primary/40 bg-primary/5 shadow-xl shadow-primary/10"
                  : "border-border/50 bg-card/40 backdrop-blur-sm"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                    Most popular
                  </span>
                </div>
              )}
              <div className="mb-6">
                <h3 className="mb-1 text-base font-semibold text-foreground">
                  {plan.name}
                </h3>
                <p className="text-xs text-muted-foreground">{plan.desc}</p>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold tracking-tight text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    /{plan.period}
                  </span>
                </div>
              </div>
              <ul className="mb-7 flex flex-col gap-2.5">
                {plan.features.map((f) => (
                  <li
                    key={f.text}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    {f.included ? (
                      <Check className="size-3.5 shrink-0 text-primary" />
                    ) : (
                      <X className="size-3.5 shrink-0 text-muted-foreground/30" />
                    )}
                    <span
                      className={
                        f.included
                          ? "text-foreground/80"
                          : "text-muted-foreground/40"
                      }
                    >
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={cn(
                  "mt-auto flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all",
                  plan.popular
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "border border-border bg-background text-foreground hover:bg-muted"
                )}
              >
                {plan.cta} {plan.popular && <ArrowRight className="size-3.5" />}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="relative z-10 mx-auto max-w-3xl px-4 py-20 sm:px-6"
      >
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold tracking-widest text-primary uppercase">
            FAQ
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Common questions
          </h2>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/40 px-6 backdrop-blur-sm">
          {FAQS.map((faq) => (
            <FaqItem key={faq.q} {...faq} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 px-6 py-16 text-center backdrop-blur-sm sm:px-12">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to think differently?
          </h2>
          <p className="mx-auto mb-8 max-w-md text-muted-foreground">
            Create your free account in seconds. No credit card. No commitments.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Start for free <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/appIcon.png"
                alt="Aurelius"
                width={28}
                height={28}
                className="rounded-lg"
              />
              <span className="font-semibold text-foreground">Aurelius</span>
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground/60">
              {[
                ["#", "Privacy"],
                ["#", "Terms"],
                ["#", "Status"],
                ["#", "GitHub"],
                ["#", "Docs"],
              ].map(([href, label]) => (
                <a
                  key={label}
                  href={href}
                  className="transition-colors hover:text-muted-foreground"
                >
                  {label}
                </a>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/30">
              © <CurrentYear /> Aurelius. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

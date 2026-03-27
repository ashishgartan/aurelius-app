// app/(chat)/profile/page.tsx
"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import {
  Camera,
  Link2,
  Trash2,
  ArrowLeft,
  Check,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Shared sub-components ──────────────────────────────────────────

function SectionCard({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-6">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {desc && (
          <p className="mt-0.5 text-xs text-muted-foreground/70">{desc}</p>
        )}
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground/80">
        {label}
      </label>
      {children}
    </div>
  )
}

function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-lg border border-border bg-muted/30 px-3 text-sm",
        "text-foreground outline-none placeholder:text-muted-foreground/40",
        "transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10",
        "disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function SaveButton({
  saving,
  saved,
  disabled,
  onClick,
}: {
  saving: boolean
  saved: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving || disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all",
        saved
          ? "bg-green-500/10 text-green-600 dark:text-green-400"
          : "bg-primary text-primary-foreground hover:opacity-90",
        (saving || disabled) && "pointer-events-none opacity-50"
      )}
    >
      {saving ? (
        <>
          <Loader2 className="size-3 animate-spin" />
          Saving…
        </>
      ) : saved ? (
        <>
          <Check className="size-3" />
          Saved
        </>
      ) : (
        "Save changes"
      )}
    </button>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
      <AlertTriangle className="size-3 shrink-0" />
      {message}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth()
  const router = useRouter()

  if (!user) return null

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>

        <div>
          <h1 className="text-xl font-semibold text-foreground">Profile</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Manage your account details
          </p>
        </div>

        <AvatarSection user={user} updateUser={updateUser} />
        <DisplayNameSection user={user} updateUser={updateUser} />
        <DeleteAccountSection logout={logout} />
      </div>
    </div>
  )
}

// ── Avatar section ─────────────────────────────────────────────────
function AvatarSection({
  user,
  updateUser,
}: {
  user: { displayName: string; avatarUrl?: string }
  updateUser: (patch: { avatarUrl?: string }) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(user.avatarUrl ?? "")
  const [urlMode, setUrlMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<string | null>(null)

  const initials = user.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const currentAvatar = preview ?? user.avatarUrl

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError("")

    // Client-side preview
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    // Upload
    setSaving(true)
    try {
      const form = new FormData()
      form.append("avatar", file)
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Upload failed")
      updateUser({ avatarUrl: data.avatarUrl })
      setPreview(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
      setPreview(null)
    } finally {
      setSaving(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleUrlSave = async () => {
    if (!url.trim()) return
    setError("")
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to save")
      updateUser({ avatarUrl: url.trim() })
      setSaved(true)
      setUrlMode(false)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: "" }),
      })
      if (!res.ok) throw new Error("Failed to remove")
      updateUser({ avatarUrl: undefined })
      setUrl("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove")
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title="Avatar" desc="Upload a photo or use an image URL.">
      <div className="flex items-center gap-5">
        {/* Avatar preview */}
        <div className="relative shrink-0">
          <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border border-border bg-primary">
            {currentAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentAvatar}
                alt="Avatar"
                className="size-full object-cover"
              />
            ) : (
              <span className="text-xl font-bold text-primary-foreground">
                {initials}
              </span>
            )}
          </div>
          {saving && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
              <Loader2 className="size-5 animate-spin text-white" />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Camera className="size-3" />
              Upload photo
            </button>
            <button
              onClick={() => setUrlMode((v) => !v)}
              disabled={saving}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                urlMode
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              <Link2 className="size-3" />
              Use URL
            </button>
            {currentAvatar && (
              <button
                onClick={handleRemove}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/30 hover:text-destructive disabled:opacity-50"
              >
                <X className="size-3" />
                Remove
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/50">
            JPG, PNG, GIF, WebP · Max 2 MB
          </p>
          {saved && (
            <p className="text-[11px] text-green-500">Avatar updated!</p>
          )}
        </div>
      </div>

      {/* URL input */}
      {urlMode && (
        <div className="mt-4 flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
            className="flex-1"
          />
          <button
            onClick={handleUrlSave}
            disabled={saving || !url.trim()}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving ? <Loader2 className="size-3 animate-spin" /> : "Save"}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </SectionCard>
  )
}

// ── Display name section ───────────────────────────────────────────
function DisplayNameSection({
  user,
  updateUser,
}: {
  user: { displayName: string }
  updateUser: (patch: { displayName: string }) => void
}) {
  const [name, setName] = useState(user.displayName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const isDirty = name.trim() !== user.displayName

  const handleSave = async () => {
    if (!name.trim() || !isDirty) return
    setError("")
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to save")
      updateUser({ displayName: name.trim() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard
      title="Display Name"
      desc="This is the name shown in the sidebar."
    >
      <div className="flex flex-col gap-3">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Your display name"
            maxLength={60}
          />
        </Field>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end">
          <SaveButton
            saving={saving}
            saved={saved}
            disabled={!isDirty}
            onClick={handleSave}
          />
        </div>
      </div>
    </SectionCard>
  )
}

// ── Delete account section ─────────────────────────────────────────
function DeleteAccountSection({ logout }: { logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  const CONFIRM_PHRASE = "delete my account"
  const canDelete = confirm.toLowerCase() === CONFIRM_PHRASE

  const handleDelete = async () => {
    if (!canDelete) return
    setDeleting(true)
    setError("")
    try {
      const res = await fetch("/api/profile", { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to delete account")
      }
      await logout()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account")
      setDeleting(false)
    }
  }

  return (
    <SectionCard title="Danger Zone">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-foreground">
              Delete account
            </p>
            <p className="text-[11px] text-muted-foreground/70">
              Permanently delete your account and all conversations.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-background px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="size-3" />
            Delete
          </button>
        </div>
      </div>

      {/* Confirmation modal */}
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10">
              <Trash2 className="size-4 text-destructive" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Delete your account?
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              This will permanently delete your account and all conversations.
              This action <strong>cannot be undone</strong>.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground/70">
                  Type{" "}
                  <span className="font-mono font-semibold text-foreground">
                    delete my account
                  </span>{" "}
                  to confirm
                </label>
                <Input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="delete my account"
                  className={cn(canDelete && "border-destructive/40")}
                />
              </div>
              {error && <ErrorBanner message={error} />}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  setOpen(false)
                  setConfirm("")
                }}
                disabled={deleting}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!canDelete || deleting}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {deleting ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3" />
                    Delete account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

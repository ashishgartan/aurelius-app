// components/chat/Sidebar.tsx
"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  SquarePen,
  Trash2,
  ChevronDown,
  Search,
  LogOut,
  X,
  Settings2,
  Wrench,
  UserCircle,
  BarChart3,
  Brain,
  Keyboard,
  PanelLeftOpen,
  PanelLeftClose,
  Pencil,
  Plus,
  MessageSquare,
  Pin,
  Archive,
  ArchiveRestore,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { useChatStore } from "@/hooks/useChatStore"
import { ThemeToggle } from "@/components/theme-toggle"
import type { SessionSummary } from "@/types/chat"
import Link from "next/link"
import Image from "next/image"

interface SidebarProps {
  sessions: SessionSummary[]
  activeChatId: string | null
  onNewChat: () => void
  onDeleteChat: (id: string) => void
  sessionsLoading: boolean
  open: boolean
  onOpenChange: (v: boolean) => void
}

// ── Date grouping ─────────────────────────────────────────────────────
function getDateGroup(iso: string): number {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffDays = Math.floor((now - then) / 86_400_000)
  if (diffDays < 1)  return 0 // Today
  if (diffDays < 2)  return 1 // Yesterday
  if (diffDays < 7)  return 2 // Previous 7 days
  if (diffDays < 30) return 3 // Previous 30 days
  return 4                    // Older
}

const GROUP_LABELS = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"]

function groupSessions(sessions: SessionSummary[]) {
  const archived = sessions.filter((s) => s.archived)
  const active = sessions.filter((s) => !s.archived)
  const pinned = active.filter((s) => s.pinned)
  const regular = active.filter((s) => !s.pinned)
  const buckets: SessionSummary[][] = [[], [], [], [], []]
  for (const s of regular) buckets[getDateGroup(s.updatedAt)].push(s)
  const groups = GROUP_LABELS
    .map((label, i) => ({ label, items: buckets[i] }))
    .filter((g) => g.items.length > 0)
  const prefixed = pinned.length > 0 ? [{ label: "Pinned", items: pinned }, ...groups] : groups
  return archived.length > 0
    ? [...prefixed, { label: "Archived", items: archived }]
    : prefixed
}

// ── Keyboard shortcut hint ────────────────────────────────────────────
function ShortcutsHint() {
  const [mod, setMod] = React.useState("⌘")
  React.useEffect(() => {
    const uad = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
    const platform = uad?.platform ?? navigator.userAgent
    setMod(/mac|iphone|ipad|ipod/i.test(platform) ? "⌘" : "Ctrl")
  }, [])

  return (
    <button
      onClick={() =>
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", metaKey: true, bubbles: true }))
      }
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-muted-foreground"
    >
      <Keyboard className="size-3 shrink-0" />
      <span>Keyboard shortcuts</span>
      <span className="ml-auto font-mono opacity-70">{mod}/</span>
    </button>
  )
}

function Avatar({ url, name, initials }: { url?: string | null; name?: string | null; initials: string }) {
  return (
    <div className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-[11px] font-semibold text-primary-foreground shadow-inner">
      {url ? (
        <Image src={url} alt={name ?? "Avatar"} fill className="object-cover" sizes="28px" />
      ) : (
        initials
      )}
    </div>
  )
}

// ── User menu dropdown ────────────────────────────────────────────────
function UserMenuDropdown({ onClose, onSignOut }: { onClose: () => void; onSignOut: () => void }) {
  return (
    <div className="absolute right-0 bottom-full left-0 mb-1.5 overflow-hidden rounded-xl border border-border bg-popover shadow-xl shadow-black/10">
      {[
        { href: "/dashboard", icon: BarChart3, label: "Usage" },
        { href: "/profile",   icon: UserCircle, label: "Profile" },
        { href: "/memory",    icon: Brain,      label: "Memory" },
        { href: "/options",   icon: Settings2,  label: "AI Settings" },
        { href: "/tools",     icon: Wrench,     label: "Tools" },
      ].map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          onClick={onClose}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
        >
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          {label}
        </Link>
      ))}
      <div className="my-1 mx-3 h-px bg-border" />
      <button
        onClick={onSignOut}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-destructive transition-colors hover:bg-muted"
      >
        <LogOut className="size-3.5 shrink-0" />
        Sign out
      </button>
    </div>
  )
}

// ── SessionItem ───────────────────────────────────────────────────────
function SessionItem({
  session, active, onClick, onDelete, onRename,
  onTogglePinned,
  onToggleArchived,
}: {
  session: SessionSummary
  active: boolean
  onClick: () => void
  onDelete: () => void
  onRename: (newTitle: string) => Promise<void>
  onTogglePinned: (pinned: boolean) => Promise<void>
  onToggleArchived: (archived: boolean) => Promise<void>
}) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title,    setTitle]   = useState(session.title)
  const [actionError, setActionError] = useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const handleRename = () => {
    if (title.trim() && title !== session.title) {
      void onRename(title.trim()).catch((err) => {
        console.error("[sidebar] rename failed:", err)
        setTitle(session.title)
      })
    } else {
      setTitle(session.title)
    }
    setEditing(false)
  }

  const showActionError = (message: string) => {
    setActionError(message)
    window.setTimeout(() => setActionError(""), 3000)
  }

  return (
    <div
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200",
        active
          ? "bg-primary/10 text-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.05)]"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={editing ? undefined : onClick}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => e.key === "Enter" && handleRename()}
          className="w-full bg-transparent text-[13px] font-medium outline-none"
        />
      ) : (
        <>
          <div className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
            active 
              ? "border-primary/30 bg-primary/10 text-primary" 
              : "border-border/50 bg-sidebar-accent/50 text-sidebar-foreground/40 group-hover:border-border group-hover:text-sidebar-foreground/60"
          )}>
            <MessageSquare className="size-3.5" />
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-xs font-medium">{session.title || "New chat"}</p>
            {actionError && (
              <p className="mt-0.5 truncate text-[10px] text-destructive">
                {actionError}
              </p>
            )}
          </div>
          
          {/* Action buttons */}
          <div
            className={cn(
              "flex items-center gap-0.5 transition-opacity duration-200",
              hovered ? "opacity-100" : "opacity-0"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                void onToggleArchived(!session.archived).catch((err) => {
                  console.error("[sidebar] archive failed:", err)
                  showActionError("Archive update failed")
                })
              }}
              className="rounded-md p-1 color-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={session.archived ? "Restore from archive" : "Archive"}
            >
              {session.archived ? (
                <ArchiveRestore className="size-3" />
              ) : (
                <Archive className="size-3" />
              )}
            </button>
            <button
              onClick={() => {
                void onTogglePinned(!session.pinned).catch((err) => {
                  console.error("[sidebar] pin failed:", err)
                  showActionError("Pin update failed")
                })
              }}
              className={cn(
                "rounded-md p-1 transition-colors hover:bg-muted",
                session.pinned
                  ? "text-primary hover:text-primary"
                  : "color-muted-foreground hover:text-foreground"
              )}
              title={session.pinned ? "Unpin" : "Pin"}
            >
              <Pin className="size-3" />
            </button>
            <button
              onClick={() => {
                setTitle(session.title)
                setEditing(true)
              }}
              className="rounded-md p-1 color-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Rename"
            >
              <Pencil className="size-3" />
            </button>
            <button
              onClick={onDelete}
              className="rounded-md p-1 color-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}


// ── Icon button ───────────────────────────────────────────────────────
function IconBtn({
  onClick, title, className, children,
}: {
  onClick?: () => void
  title?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════
export function Sidebar({
  sessions, activeChatId, onNewChat, onDeleteChat,
  open, onOpenChange, sessionsLoading,
}: SidebarProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const [search,      setSearch]      = useState("")
  const [userMenu,    setUserMenu]    = useState(false)
  const [logoutModal, setLogoutModal] = useState(false)
  const [deleteId,    setDeleteId]    = useState<string | null>(null)
  const [loggingOut,  setLoggingOut]  = useState(false)
  const [collapsed,   setCollapsed]   = useState(false)
  const [mounted,     setMounted]     = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const { renameSession, togglePinned, toggleArchived } = useChatStore()

  // Sidebar search shortcut (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setCollapsed(false)
        setTimeout(() => searchRef.current?.focus(), 50)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [collapsed])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "true")
    setMounted(true)
  }, [])

  const toggleCollapsed = () =>
    setCollapsed((v) => {
      localStorage.setItem("sidebar-collapsed", String(!v))
      return !v
    })

  // Close mobile sidebar on navigation
  useEffect(() => { onOpenChange(false) }, [pathname, onOpenChange])

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenu) return
    const h = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-user-menu]")) setUserMenu(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [userMenu])

  // Lock body scroll on mobile drawer open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  const filtered = useMemo(
    () => sessions.filter((s) => s.title.toLowerCase().includes(search.toLowerCase())),
    [sessions, search]
  )
  const groups = useMemo(() => {
    const grouped = groupSessions(filtered)
    return showArchived
      ? grouped
      : grouped.filter((group) => group.label !== "Archived")
  }, [filtered, showArchived])
  const archivedCount = filtered.filter((s) => s.archived).length

  const initials = user?.displayName
    ? user.displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?"

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    setLoggingOut(false)
    setLogoutModal(false)
  }

  // ── Desktop sidebar ────────────────────────────────────────────────
  const desktop = (
    <aside
      className={cn(
        "flex h-full flex-col bg-sidebar overflow-hidden",
        mounted && "transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[56px] border-r border-border" : "w-[260px] border-r border-border"
      )}
    >
      {/* ── Header ── */}
      <div className={cn(
        "flex shrink-0 items-center border-b border-border/60 px-3",
        collapsed ? "h-14 justify-center" : "h-14 gap-1"
      )}>
        {collapsed ? (
          <Link href="/" className="flex items-center justify-center rounded-lg p-1 transition-colors hover:bg-sidebar-accent">
            <Image src="/appIcon.png" alt="Aurelius" width={26} height={26} className="rounded-md" />
          </Link>
        ) : (
          <>
            <Link href="/" className="group flex flex-1 items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-sidebar-accent">
              <Image src="/appIcon.png" alt="Aurelius" width={26} height={26} className="rounded-md" />
              <span className="font-display text-[15px] font-semibold text-sidebar-foreground">
                Aurelius
              </span>
            </Link>
            <ThemeToggle />
            <IconBtn onClick={onNewChat} title="New chat">
              <SquarePen className="size-[15px]" />
            </IconBtn>
            <IconBtn onClick={toggleCollapsed} title="Collapse sidebar">
              <PanelLeftClose className="size-[15px]" />
            </IconBtn>
          </>
        )}
      </div>

      {/* ── Collapsed: action icons ── */}
      {collapsed && (
        <div className="flex flex-col items-center gap-1 border-b border-border/60 px-2 py-3">
          <IconBtn onClick={toggleCollapsed} title="Expand sidebar">
            <PanelLeftOpen className="size-[15px]" />
          </IconBtn>
          <div className="my-1 h-px w-6 bg-border/40" />
          <IconBtn onClick={onNewChat} title="New chat">
            <Plus className="size-[18px]" />
          </IconBtn>
        </div>
      )}

      {/* ── Search ── */}
      {!collapsed && (
        <div className="shrink-0 px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-2 transition-colors focus-within:border-border focus-within:bg-background">
            <Search className="size-3.5 shrink-0 text-muted-foreground/60" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
            />
            {search ? (
              <button onClick={() => setSearch("")} className="text-muted-foreground/60 hover:text-foreground">
                <X className="size-3.5" />
              </button>
            ) : (
              <span className="shrink-0 rounded bg-muted-foreground/10 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground/40">
                {typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘K" : "Ctrl+K"}
              </span>
            )}
          </div>
          {archivedCount > 0 && (
            <div className="mt-2 flex items-center gap-3 text-[11px]">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="flex items-center gap-1.5 text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                {showArchived ? (
                  <ArchiveRestore className="size-3" />
                ) : (
                  <Archive className="size-3" />
                )}
                {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
              </button>
              <Link
                href="/chat/archived"
                className="text-primary transition-colors hover:text-primary/80"
              >
                Open archive
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Session list ── */}
      <div className={cn("flex-1 overflow-y-auto", collapsed ? "px-1.5 py-2" : "px-2 py-1")}>
        {sessionsLoading ? (
          // Skeleton
          <div className={cn("flex flex-col", collapsed ? "gap-1 items-center" : "gap-0.5")}>
            {collapsed
              ? [1, 2, 3, 4].map((i) => (
                  <div key={i} className="size-8 rounded-lg bg-muted-foreground/[0.07]" />
                ))
              : [80, 60, 72, 50, 65].map((w, i) => (
                  <div key={i} className="flex items-center rounded-lg px-3 py-2">
                    <div className="h-3 rounded-full bg-muted-foreground/[0.08]" style={{ width: `${w}%` }} />
                  </div>
                ))}
          </div>
        ) : collapsed ? (
          null
        ) : groups.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-muted-foreground/50">
            {search ? "No chats found" : "No chats yet"}
          </p>
        ) : (
          // Grouped list
          groups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="mb-2.5 mt-2 px-3 text-[10.5px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                {group.label}
              </p>
              {group.items.map((session) => (
                <SessionItem
                  key={session._id}
                  session={session}
                  active={session._id === activeChatId}
                  onClick={() => router.push(`/chat/${session._id}`)}
                  onDelete={() => setDeleteId(session._id)}
                  onRename={(title) => renameSession(session._id, title)}
                  onTogglePinned={(pinned) => togglePinned(session._id, pinned)}
                  onToggleArchived={(archived) => toggleArchived(session._id, archived)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* ── Shortcuts hint ── */}
      {!collapsed && (
        <div className="shrink-0 px-2 pb-1">
          <ShortcutsHint />
        </div>
      )}

      {/* ── User section ── */}
      <div className="shrink-0 border-t border-border/60 p-2">
        <div className="relative" data-user-menu="">
          {collapsed ? (
            <button
              onClick={() => setUserMenu((v) => !v)}
              title={user?.displayName ?? "Account"}
              className="flex w-full items-center justify-center rounded-lg p-2 transition-colors hover:bg-sidebar-accent"
            >
              <Avatar url={user?.avatarUrl}  name={user?.displayName} initials={initials} />
            </button>
          ) : (
            <button
              onClick={() => setUserMenu((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent"
            >
              <Avatar url={user?.avatarUrl} name={user?.displayName} initials={initials} />
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[12px] font-medium text-sidebar-foreground leading-tight">
                  {user?.displayName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground/60 leading-tight">
                  {user?.email}
                </p>
              </div>
              <ChevronDown className={cn(
                "size-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200",
                userMenu && "rotate-180"
              )} />
            </button>
          )}

          {userMenu && (
            <UserMenuDropdown
              onClose={() => setUserMenu(false)}
              onSignOut={() => { setUserMenu(false); setLogoutModal(true) }}
            />
          )}
        </div>
      </div>
    </aside>
  )

  // ── Mobile sidebar (always full, no collapse) ──────────────────────
  const mobile = (
    <aside className="flex h-full w-[260px] flex-col border-r border-border bg-sidebar">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-border/60 px-3">
        <Link href="/" className="group flex flex-1 items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-sidebar-accent">
          <Image src="/appIcon.png" alt="Aurelius" width={26} height={26} className="rounded-md" />
          <span className="font-display text-[15px] font-semibold text-sidebar-foreground">Aurelius</span>
        </Link>
        <ThemeToggle />
        <IconBtn onClick={() => { onNewChat(); onOpenChange(false) }} title="New chat">
          <SquarePen className="size-[15px]" />
        </IconBtn>
        <IconBtn onClick={() => onOpenChange(false)} title="Close">
          <X className="size-[15px]" />
        </IconBtn>
      </div>

      {/* Search */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-2">
          <Search className="size-3.5 shrink-0 text-muted-foreground/60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats…"
            className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted-foreground/60 hover:text-foreground">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {archivedCount > 0 && (
          <div className="mt-2 flex items-center gap-3 text-[11px]">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="flex items-center gap-1.5 text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              {showArchived ? (
                <ArchiveRestore className="size-3" />
              ) : (
                <Archive className="size-3" />
              )}
              {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
            </button>
            <Link
              href="/chat/archived"
              onClick={() => onOpenChange(false)}
              className="text-primary transition-colors hover:text-primary/80"
            >
              Open archive
            </Link>
          </div>
        )}
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {sessionsLoading ? (
          <div className="flex flex-col gap-0.5">
            {[80, 60, 72, 50, 65].map((w, i) => (
              <div key={i} className="flex items-center rounded-lg px-3 py-2">
                <div className="h-3 rounded-full bg-muted-foreground/[0.08]" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-muted-foreground/50">
            {search ? "No chats found" : "No chats yet"}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="mb-2.5 mt-2 px-3 text-[10.5px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                {group.label}
              </p>
              {group.items.map((session) => (
                <SessionItem
                  key={session._id}
                  session={session}
                  active={session._id === activeChatId}
                  onClick={() => router.push(`/chat/${session._id}`)}
                  onDelete={() => setDeleteId(session._id)}
                  onRename={(title) => renameSession(session._id, title)}
                  onTogglePinned={(pinned) => togglePinned(session._id, pinned)}
                  onToggleArchived={(archived) => toggleArchived(session._id, archived)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Shortcuts hint */}
      <div className="shrink-0 px-2 pb-1">
        <ShortcutsHint />
      </div>

      {/* User section */}
      <div className="shrink-0 border-t border-border/60 p-2">
        <div className="relative" data-user-menu="">
          <button
            onClick={() => setUserMenu((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent"
          >
            <Avatar url={user?.avatarUrl} name={user?.displayName} initials={initials} />
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-[12px] font-medium text-sidebar-foreground leading-tight">{user?.displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground/60 leading-tight">{user?.email}</p>
            </div>
            <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200", userMenu && "rotate-180")} />
          </button>
          {userMenu && (
            <UserMenuDropdown
              onClose={() => setUserMenu(false)}
              onSignOut={() => { setUserMenu(false); setLogoutModal(true) }}
            />
          )}
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop */}
      <div className="hidden h-full shrink-0 md:flex">{desktop}</div>

      {/* Mobile backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 md:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => onOpenChange(false)}
      />
      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 h-full transition-transform duration-300 ease-in-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {mobile}
      </div>

      {/* Logout confirmation modal */}
      {logoutModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !loggingOut && setLogoutModal(false)}
        >
          <div
            className="relative mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLogoutModal(false)}
              disabled={loggingOut}
              className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <X className="size-4" />
            </button>

            <div className="px-6 pt-6 pb-5">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10">
                <LogOut className="size-5 text-destructive" />
              </div>
              <h2 className="mb-1.5 text-base font-semibold text-foreground">Sign out of Aurelius?</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                You&apos;ll need to sign back in to access your chats. Your conversation history is safely saved.
              </p>
            </div>

            <div className="flex items-center gap-2 border-t border-border px-6 py-4">
              <button
                onClick={() => setLogoutModal(false)}
                disabled={loggingOut}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {loggingOut ? (
                  <>
                    <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing out…
                  </>
                ) : (
                  <>
                    <LogOut className="size-3.5" />
                    Sign out
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete confirmation modal */}
      {deleteId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="relative mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-5">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10">
                <Trash2 className="size-5 text-destructive" />
              </div>
              <h2 className="mb-1.5 text-base font-semibold text-foreground">Delete this chat?</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                This will permanently delete the conversation history. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-2 border-t border-border px-6 py-4">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteChat(deleteId)
                  setDeleteId(null)
                }}
                className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArchiveRestore, ArrowLeft, MessageSquare } from "lucide-react"
import { ChatHeader } from "@/components/chat/ChatHeader"
import { useChatStore } from "@/hooks/useChatStore"
import { useSidebarOpener } from "@/context/SidebarContext"

export default function ArchivedChatsPage() {
  const router = useRouter()
  const openSidebar = useSidebarOpener()
  const { sessions, loading, toggleArchived } = useChatStore()
  const archived = sessions.filter((session) => session.archived)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ChatHeader
        title="Archived chats"
        sessionId=""
        messages={[]}
        showClear={false}
        showMenuButton
        showSearchButton={false}
        showExportButton={false}
        showShareButton={false}
        showClearButton={false}
        clearState="idle"
        onClear={() => {}}
        onMenuOpen={openSidebar}
        searchQuery=""
        onSearchChange={() => {}}
        matchCount={0}
        matchIndex={0}
        onMatchNav={() => {}}
      />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to chats
          </Link>
          <span className="text-sm text-muted-foreground">
            {archived.length} archived
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-20 rounded-2xl border border-border bg-muted/30"
              />
            ))}
          </div>
        ) : archived.length === 0 ? (
          <div className="rounded-2xl border border-border bg-muted/20 px-6 py-10 text-center">
            <p className="text-base font-semibold text-foreground">No archived chats</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Archived sessions will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {archived.map((session) => (
              <div
                key={session._id}
                className="flex items-center gap-4 rounded-2xl border border-border bg-muted/20 px-4 py-4"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background">
                  <MessageSquare className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {session.title || "New chat"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {new Date(session.updatedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    void toggleArchived(session._id, false).catch((err) => {
                      console.error("[archived page] restore failed:", err)
                    })
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <ArchiveRestore className="size-4" />
                  Restore
                </button>
                <button
                  onClick={() => router.push(`/chat/${session._id}`)}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

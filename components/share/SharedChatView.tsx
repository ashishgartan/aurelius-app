"use client"

import { useEffect, useRef, useState } from "react"
import { useMessageSearch } from "@/hooks/useMessageSearch"
import { ChatHeader } from "@/components/chat/ChatHeader"
import { MessageList } from "@/components/chat/MessageList"
import { ArtifactPanel } from "@/components/chat/ArtifactPanel"
import { type ChatMessage } from "@/types/chat"
import { useArtifactStore } from "@/hooks/useArtifactStore"
import { buildSharedArtifactMetadataUrl } from "@/lib/share/shared"

interface SharedChatViewProps {
  token: string
  title: string
  messages: ChatMessage[]
}

export function SharedChatView({
  token,
  title,
  messages,
}: SharedChatViewProps) {
  const [artifactWidth, setArtifactWidth] = useState(480)
  const [artifactExpanded, setArtifactExpanded] = useState(false)
  const [isDraggingArtifact, setIsDraggingArtifact] = useState(false)
  const artifactStartX = useRef(0)
  const artifactStartWidth = useRef(480)
  const { isOpen: isArtifactOpen } = useArtifactStore()

  const artifactUrlBuilder = (artifactId: string) =>
    buildSharedArtifactMetadataUrl(token, artifactId)

  const {
    searchQuery,
    onSearchChange,
    matchCount,
    matchIndex,
    onMatchNav,
    matches,
    activeMessageId,
  } = useMessageSearch(messages)

  const handleToggleArtifactWidth = () => {
    setArtifactExpanded((prev) => {
      const next = !prev
      const nextWidth = next ? 740 : 480
      setArtifactWidth(nextWidth)
      return next
    })
  }

  const handleArtifactDragStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    artifactStartX.current = event.clientX
    artifactStartWidth.current = artifactWidth
    setIsDraggingArtifact(true)
  }

  useEffect(() => {
    if (!isDraggingArtifact) return

    const handleMouseMove = (event: MouseEvent) => {
      const delta = artifactStartX.current - event.clientX
      let nextWidth = artifactStartWidth.current + delta
      nextWidth = Math.max(320, Math.min(820, nextWidth))
      setArtifactWidth(nextWidth)
      setArtifactExpanded(nextWidth >= 640)
    }

    const handleMouseUp = () => setIsDraggingArtifact(false)

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDraggingArtifact])

  return (
    <div className="flex h-screen min-h-0 flex-row overflow-hidden bg-transparent">
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <ChatHeader
          title={title}
          sessionId=""
          messages={messages}
          showClear={false}
          showMenuButton={false}
          showExportButton={false}
          showShareButton={false}
          showClearButton={false}
          clearState="idle"
          onClear={() => {}}
          onMenuOpen={() => {}}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          matchCount={matchCount}
          matchIndex={matchIndex}
          onMatchNav={onMatchNav}
        />

        <MessageList
          messages={messages}
          streaming={false}
          onRegenerate={() => {}}
          onEditMessage={() => {}}
          onSuggestion={() => {}}
          searchMatches={matches}
          activeMessageId={activeMessageId}
          readOnly
          artifactUrlBuilder={artifactUrlBuilder}
        />
      </div>

      {isArtifactOpen && (
        <div
          className="relative hidden h-full w-2 cursor-col-resize bg-border/0 transition-colors hover:bg-border/60 lg:block"
          onMouseDown={handleArtifactDragStart}
        >
          <div className="absolute inset-y-1/3 left-1/2 h-1/3 w-px -translate-x-1/2 bg-border/60" />
        </div>
      )}

      {isArtifactOpen && (
        <div className="fixed inset-0 z-40 bg-background lg:hidden">
          <ArtifactPanel
            artifactUrlBuilder={artifactUrlBuilder}
            readOnly
          />
        </div>
      )}

      <div className="hidden lg:flex">
        <ArtifactPanel
          width={artifactWidth}
          isExpanded={artifactExpanded}
          onToggleExpand={handleToggleArtifactWidth}
          artifactUrlBuilder={artifactUrlBuilder}
          readOnly
        />
      </div>
    </div>
  )
}

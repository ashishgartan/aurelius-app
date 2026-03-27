// app/chat/loading.tsx
"use client"

import { MessageSkeleton } from "@/components/chat/MessageSkeleton"
import { ChatHeader } from "@/components/chat/ChatHeader"
import { ChatInput } from "@/components/chat/ChatInput"

export default function ChatLoading() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ChatHeader
        title=""
        sessionId=""
        messages={[]}
        showClear={false}
        clearState="idle"
        onClear={() => {}}
        onMenuOpen={() => {}}
        searchQuery=""
        onSearchChange={() => {}}
        matchIndex={0}
        matchCount={0}
        onMatchNav={() => {}}
      />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <MessageSkeleton />
        </div>
      </div>
      <ChatInput
        value=""
        onChange={() => {}}
        onSend={() => {}}
        onStop={() => {}}
        streaming={false}
        provider="groq"
        onProvider={() => {}}
        disabled
      />
    </div>
  )
}

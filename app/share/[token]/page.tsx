// app/share/[token]/page.tsx
// Public read-only view of a shared conversation.
import { notFound } from "next/navigation"
import { getSessionByToken } from "@/lib/services/chatSession"
import { SharedChatView } from "@/components/share/SharedChatView"
import { normalizeSharedMessages } from "@/lib/share/shared"

interface Props {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: Props) {
  const { token } = await params
  const session = await getSessionByToken(token)
  if (!session) return { title: "Not found" }
  return {
    title: `${session.title} — Aurelius`,
    description: "A shared Aurelius conversation",
  }
}

export default async function SharedPage({ params }: Props) {
  const { token } = await params
  const session = await getSessionByToken(token)
  if (!session) notFound()

  return (
    <SharedChatView
      token={token}
      title={session.title}
      messages={normalizeSharedMessages(session)}
    />
  )
}

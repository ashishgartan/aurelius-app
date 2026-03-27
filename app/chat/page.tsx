// app/chat/page.tsx
// Server component — runs on the server so there's zero client-side delay.
// Reads the auth cookie, fetches the user's latest session from MongoDB,
// and redirects. No loading spinner, no client JS needed.
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { verifyToken, COOKIE_NAME } from "@/lib/jwt"
import { listSessions, createSession } from "@/lib/services/chatSession"
import { findUserById } from "@/lib/services/user"

export default async function ChatIndexPage() {
  // 1. Verify auth (middleware already protects this route,
  //    but we need the userId to query sessions)
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) redirect("/login")

  const auth = await verifyToken(token)
  if (!auth) redirect("/login")

  const user = await findUserById(auth.userId).catch(() => null)
  if (!user) redirect("/login")

  // 2. Get the most recent session
  const sessions = await listSessions(user._id.toString())

  if (sessions.length > 0) {
    // Returning user — go to their latest chat
    redirect(`/chat/${sessions[0]._id}`)
  } else {
    // First-time user with no sessions — create one and go to it
    // (shouldn't normally happen since signup creates a default session,
    //  but handles edge cases like manual DB cleanup)
    const session = await createSession(user._id.toString(), "groq")
    redirect(`/chat/${session._id}`)
  }
}

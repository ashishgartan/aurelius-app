// app/api/profile/avatar/route.ts — upload avatar image, store as data URL
import { getAuthUser } from "@/lib/jwt"
import { checkCsrf } from "@/lib/csrf"
import { updateProfile } from "@/lib/services/user"
import { buildProfileAuthCookie } from "@/lib/auth/profileCookie"

const MAX_SIZE_BYTES = 2 * 1024 * 1024   // 2 MB

export async function POST(req: Request) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const auth = await getAuthUser(req)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData().catch(() => null)
  if (!formData) return Response.json({ error: "Invalid form data" }, { status: 400 })

  const file = formData.get("avatar") as File | null
  if (!file) return Response.json({ error: "No file provided" }, { status: 400 })

  if (!file.type.startsWith("image/"))
    return Response.json({ error: "File must be an image" }, { status: 400 })

  if (file.size > MAX_SIZE_BYTES)
    return Response.json({ error: "Image must be under 2 MB" }, { status: 400 })

  // Convert to base64 data URL so it's self-contained in MongoDB
  const buffer   = await file.arrayBuffer()
  const base64   = Buffer.from(buffer).toString("base64")
  const dataUrl  = `data:${file.type};base64,${base64}`

  const user = await updateProfile(
    auth.userId,
    auth.email,
    auth.displayName,
    dataUrl
  )
  if (!user) return Response.json({ error: "User not found" }, { status: 404 })

  const authCookie = await buildProfileAuthCookie(user)

  return Response.json(
    { avatarUrl: dataUrl },
    { headers: { "Set-Cookie": authCookie } }
  )
}

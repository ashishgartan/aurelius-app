import { makeAuthCookie, signToken } from "../jwt.ts"

interface ProfileCookieUser {
  _id: { toString(): string }
  email: string
  displayName: string
  createdAt: { toISOString(): string }
}

export async function buildProfileAuthCookie(user: ProfileCookieUser): Promise<string> {
  const token = await signToken({
    userId: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  })

  return makeAuthCookie(token)
}

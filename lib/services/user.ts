// lib/services/user.ts — all user DB operations (passwordless)
import { connectDB } from "@/lib/mongodb"
import { User, type IUser } from "@/lib/models"
import { Types } from "mongoose"

export async function findOrCreateUser(
  email:       string,
  displayName?: string   // only used when creating a new account
): Promise<{ user: IUser; created: boolean }> {
  await connectDB()
  const normalised = email.toLowerCase().trim()
  const existing = await User.findOne({ email: normalised })
  if (existing) return { user: existing, created: false }

  // New user — displayName is required
  const name = (displayName ?? "").trim()
  if (!name) throw new Error("Display name is required for new accounts.")

  const user = await User.create({ email: normalised, displayName: name })
  return { user, created: true }
}

export async function findUserByEmail(email: string): Promise<IUser | null> {
  await connectDB()
  return User.findOne({ email: email.toLowerCase().trim() })
}

export async function findUserById(id: string): Promise<IUser | null> {
  await connectDB()
  return User.findById(id)
}

export async function updateProfile(
  id:          string,
  email:       string,
  displayName: string,
  avatarUrl?:  string
): Promise<IUser> {
  await connectDB()
  // Upsert — the JWT is the source of truth. If the User document was deleted
  // (e.g. DB reset in dev) while the JWT is still valid, recreate it transparently.
  const doc = await User.findOneAndUpdate(
    { _id: new Types.ObjectId(id) },
    {
      $set: {
        displayName,
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      $setOnInsert: { email: email.toLowerCase().trim() },
    } as Parameters<typeof User.findOneAndUpdate>[1],
    { new: true, upsert: true }
  )
  return doc!
}

export async function deleteUser(id: string): Promise<void> {
  await connectDB()
  await User.findByIdAndDelete(id)
}
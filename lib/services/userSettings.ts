import { connectDB } from "@/lib/mongodb"
import { UserSettings } from "@/lib/models/UserSettings"
import { Types } from "mongoose"
import { ALL_TOOLS, type UserSettings as UserSettingsType } from "@/types/auth"

function normalizeEnabledTools(enabledTools: unknown): string[] {
  if (!Array.isArray(enabledTools)) return []
  return Array.from(new Set(enabledTools.filter((tool): tool is string => typeof tool === "string" && ALL_TOOLS.includes(tool as (typeof ALL_TOOLS)[number]))))
}

export async function getSettings(userId: string): Promise<UserSettingsType> {
  await connectDB()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await UserSettings.findOne({ userId: new Types.ObjectId(userId) }).lean() as any
  return {
    instructions: doc?.instructions ?? "",
    memory:       doc?.memory       ?? "",
    language:     doc?.language     ?? "English",
    length:       doc?.length       ?? "balanced",
    tone:         doc?.tone         ?? "professional",
    enabledTools: normalizeEnabledTools(doc?.enabledTools),
    smtpUser:     doc?.smtpUser,
    smtpPass:     doc?.smtpPass,
  }
}

export async function saveSettings(
  userId:   string,
  settings: Partial<UserSettingsType>
): Promise<UserSettingsType> {
  await connectDB()
  const normalized = {
    ...settings,
    enabledTools: settings.enabledTools
      ? normalizeEnabledTools(settings.enabledTools)
      : settings.enabledTools,
  }
  const doc = await UserSettings.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    {
      $set: normalized,
      $setOnInsert: { userId: new Types.ObjectId(userId) },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  )
  return {
    instructions: doc.instructions,
    memory:       doc.memory,
    language:     doc.language,
    length:       doc.length,
    tone:         doc.tone,
    enabledTools: normalizeEnabledTools(doc.enabledTools),
    smtpUser:     doc.smtpUser,
    smtpPass:     doc.smtpPass,
  }
}

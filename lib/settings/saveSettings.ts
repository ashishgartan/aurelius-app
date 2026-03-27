import type { UserSettings } from "../../types/auth.ts"

interface SettingsResponse {
  settings?: UserSettings
  error?: string
}

const SMTP_FIELDS = new Set<keyof UserSettings>(["smtpUser", "smtpPass"])

function isSmtpOnlyPatch(patch: Partial<UserSettings>): boolean {
  return (
    Object.keys(patch).length > 0 &&
    Object.keys(patch).every((k) => SMTP_FIELDS.has(k as keyof UserSettings))
  )
}

export async function saveSettingsRequest(
  fetchImpl: typeof fetch,
  current: UserSettings,
  patch: Partial<UserSettings>
): Promise<UserSettings> {
  const merged = { ...current, ...patch }

  // Use the dedicated SMTP endpoint only for a pure credential update with
  // non-empty values. Any mixed patch, or a patch that clears SMTP fields,
  // goes through the general settings endpoint so the server can persist the
  // full state in one request.
  if (
    isSmtpOnlyPatch(patch) &&
    typeof patch.smtpUser === "string" &&
    patch.smtpUser.trim() &&
    typeof patch.smtpPass === "string" &&
    patch.smtpPass.trim()
  ) {
    const res = await fetchImpl("/api/settings/smtp", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        smtpUser: patch.smtpUser,
        smtpPass: patch.smtpPass,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({} as SettingsResponse))
      throw new Error(body.error ?? `Save failed (${res.status})`)
    }

    const data = (await res.json()) as SettingsResponse
    // Merge returned settings back onto current so the caller always gets
    // a full UserSettings object even if the smtp endpoint returns a partial.
    return { ...merged, ...(data.settings ?? {}) }
  }

  const res = await fetchImpl("/api/settings", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(merged),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({} as SettingsResponse))
    throw new Error(body.error ?? `Save failed (${res.status})`)
  }

  const data = (await res.json()) as SettingsResponse
  return { ...merged, ...(data.settings ?? {}) }
}

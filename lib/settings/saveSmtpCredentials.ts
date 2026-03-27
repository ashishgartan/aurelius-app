import type { UserSettings } from "../../types/auth.ts"

interface SettingsResponse {
  settings?: UserSettings
  error?: string
}

export async function saveSmtpCredentialsRequest(
  fetchImpl: typeof fetch,
  smtpUser: string,
  smtpPass: string
): Promise<UserSettings> {
  const res = await fetchImpl("/api/settings/smtp", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ smtpUser, smtpPass }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({} as SettingsResponse))
    throw new Error(body.error ?? `Save failed (${res.status})`)
  }

  const data = (await res.json()) as SettingsResponse
  return data.settings ?? { smtpUser, smtpPass } as UserSettings
}

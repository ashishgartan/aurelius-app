export interface AiRecoveryFixture {
  name: string
  errorMessage: string
  code?:
    | "SMTP_SERVER_CONFIG_MISSING"
    | "SMTP_USER_CREDENTIALS_MISSING"
    | "SMTP_AUTH_FAILED"
    | "MODEL_RATE_LIMIT"
    | "CHAT_RATE_LIMIT"
    | "AGENT_START_FAILED"
    | "UNKNOWN"
  expectedSteps: string[]
}

export const AI_RECOVERY_FIXTURES: AiRecoveryFixture[] = [
  {
    name: "missing SMTP server setup returns deployment guidance",
    errorMessage: "SMTP is not configured on this server (SMTP_HOST is missing).",
    expectedSteps: [
      "Set SMTP_HOST, SMTP_PORT, and SMTP_SECURE on the server.",
      "Retry the email action after the server SMTP transport is configured.",
    ],
  },
  {
    name: "SMTP auth failures return credential guidance",
    errorMessage:
      "Could not connect to SMTP server (smtp.gmail.com:587): Invalid login: 535-5.7.8 Username and Password not accepted.",
    expectedSteps: [
      "Recheck the saved mailbox username and password.",
      "If you use Gmail, generate and save a Google App Password instead of the normal account password.",
    ],
  },
  {
    name: "Groq rate limits return fallback guidance",
    errorMessage: "Temporary upstream failure",
    code: "MODEL_RATE_LIMIT",
    expectedSteps: [
      "Retry the request after a short wait.",
      "If Qwen is available, fall back to Qwen for this request.",
    ],
  },
]

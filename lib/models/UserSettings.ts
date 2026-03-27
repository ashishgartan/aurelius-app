import mongoose, { Schema, model, models, Document, Types } from "mongoose"

export interface IUserSettings extends Document {
  userId:       Types.ObjectId
  instructions: string
  memory:       string
  language:     string
  length:       "concise" | "balanced" | "detailed"
  tone:         "professional" | "casual" | "technical"
  enabledTools: string[]
  smtpUser?:    string
  smtpPass?:    string
  updatedAt:    Date
}

const UserSettingsSchema = new Schema<IUserSettings>(
  {
    userId:       { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    instructions: { type: String, default: "", maxlength: 2000, trim: true },
    memory:       { type: String, default: "", maxlength: 1000, trim: true },
    language:     { type: String, default: "English", trim: true },
    length:       { type: String, enum: ["concise", "balanced", "detailed"], default: "balanced" },
    tone:         { type: String, enum: ["professional", "casual", "technical"], default: "professional" },
    enabledTools: { type: [String], default: [] },
    smtpUser:     { type: String, trim: true },
    smtpPass:     { type: String, trim: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
)

const existingUserSettingsModel = models.UserSettings

// In dev, Next/Mongoose can keep a compiled model across reloads. If that
// cached model predates newer schema fields like smtpUser/smtpPass, Mongoose
// silently strips those paths from updates. Recompile when the cached schema
// is missing required fields.
if (
  existingUserSettingsModel &&
  (
    !existingUserSettingsModel.schema.path("smtpUser") ||
    !existingUserSettingsModel.schema.path("smtpPass") ||
    !existingUserSettingsModel.schema.path("memory")
  )
) {
  mongoose.deleteModel("UserSettings")
}

export const UserSettings =
  models.UserSettings || model<IUserSettings>("UserSettings", UserSettingsSchema)

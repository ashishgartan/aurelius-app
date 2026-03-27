// lib/models/User.ts
import { Schema, model, models, type Document } from "mongoose"

export interface IUser extends Document {
  email:       string
  displayName: string
  avatarUrl?:  string
  createdAt:   Date
  updatedAt:   Date
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type:      String,
      required:  [true, "Email is required"],
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    displayName: {
      type:      String,
      required:  [true, "Display name is required"],
      trim:      true,
      maxlength: 60,
    },
    avatarUrl: { type: String, trim: true },
  },
  { timestamps: true }
)

UserSchema.set("toJSON", {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id.toString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = ret as any
    delete r._id
    delete r.__v
    return ret
  },
})

export const User = models.User || model<IUser>("User", UserSchema)
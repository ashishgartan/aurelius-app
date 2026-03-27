// lib/models/index.ts — single import point for all models
export { User }         from "./User"
export type { IUser }   from "./User"

export { ChatSession }  from "./ChatSession"
export type { IChatSession, ISessionMessage } from "./ChatSession"

export { UserSettings } from "./UserSettings"
export type { IUserSettings } from "./UserSettings"

export { UsageLog }     from "./UsageLog"
export type { IUsageLog } from "./UsageLog"

export { DocumentModel } from "./Document"
export type { IDocument, IDocumentChunk } from "./Document"

export { OtpCode }      from "./OtpCode"
export type { IOtpCode } from "./OtpCode"
export { ArtifactModel } from "./Artifact"
export type { IArtifact } from "./Artifact"
export { EmailDelivery } from "./EmailDelivery"
export type { IEmailDelivery } from "./EmailDelivery"
export { UserMemory } from "./UserMemory"
export type { IUserMemory, MemoryCategory, MemoryStatus, MemorySensitivity } from "./UserMemory"

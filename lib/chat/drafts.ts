interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function buildChatDraftKey(chatId: string): string {
  return `chat-draft:${chatId}`
}

export function readChatDraft(
  storage: StorageLike,
  chatId: string
): string {
  return storage.getItem(buildChatDraftKey(chatId)) ?? ""
}

export function writeChatDraft(
  storage: StorageLike,
  chatId: string,
  value: string
): void {
  const key = buildChatDraftKey(chatId)
  if (value) {
    storage.setItem(key, value)
  } else {
    storage.removeItem(key)
  }
}

export function clearChatDraft(storage: StorageLike, chatId: string): void {
  storage.removeItem(buildChatDraftKey(chatId))
}

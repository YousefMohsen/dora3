import type { ChatMessage, Conversation } from "@/lib/chat/types";

export const CONVERSATIONS_STORAGE_KEY = "dora3.conversations";
const CONVERSATIONS_CHANGE_EVENT = "dora3.conversationsChange";
const UNTITLED_CONVERSATION_TITLE = "New conversation";
const EMPTY_CONVERSATIONS_SNAPSHOT: Conversation[] = [];

let cachedConversationsRaw: string | null = null;
let cachedConversationsSnapshot: Conversation[] = [];

export function createConversation(): Conversation {
  const now = new Date().toISOString();

  return {
    id: createLocalId(),
    title: UNTITLED_CONVERSATION_TITLE,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createChatMessage(
  role: ChatMessage["role"],
  content: string,
): ChatMessage {
  return {
    id: createLocalId(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function getConversationTitleFromMessage(content: string): string {
  const normalizedContent = content.trim().replace(/\s+/g, " ");

  if (!normalizedContent) {
    return UNTITLED_CONVERSATION_TITLE;
  }

  if (normalizedContent.length <= 48) {
    return normalizedContent;
  }

  return `${normalizedContent.slice(0, 45)}...`;
}

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") {
    return [];
  }

  const storedConversations = window.localStorage.getItem(
    CONVERSATIONS_STORAGE_KEY,
  );

  if (storedConversations === cachedConversationsRaw) {
    return cachedConversationsSnapshot;
  }

  if (!storedConversations) {
    cachedConversationsRaw = storedConversations;
    cachedConversationsSnapshot = [];
    return cachedConversationsSnapshot;
  }

  try {
    const parsedConversations: unknown = JSON.parse(storedConversations);

    if (!Array.isArray(parsedConversations)) {
      cachedConversationsRaw = storedConversations;
      cachedConversationsSnapshot = [];
      return cachedConversationsSnapshot;
    }

    cachedConversationsRaw = storedConversations;
    cachedConversationsSnapshot =
      parsedConversations.filter(isPersistedConversation);
    return cachedConversationsSnapshot;
  } catch {
    cachedConversationsRaw = storedConversations;
    cachedConversationsSnapshot = [];
    return cachedConversationsSnapshot;
  }
}

export function getConversationsServerSnapshot(): Conversation[] {
  return EMPTY_CONVERSATIONS_SNAPSHOT;
}

export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const storedConversations = JSON.stringify(conversations);

  cachedConversationsRaw = storedConversations;
  cachedConversationsSnapshot = conversations;

  window.localStorage.setItem(CONVERSATIONS_STORAGE_KEY, storedConversations);
  window.dispatchEvent(new Event(CONVERSATIONS_CHANGE_EVENT));
}

export function subscribeToConversations(
  onStoreChange: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key === CONVERSATIONS_STORAGE_KEY) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(CONVERSATIONS_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(CONVERSATIONS_CHANGE_EVENT, onStoreChange);
  };
}

function createLocalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isPersistedConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.messages) &&
    candidate.messages.every(isPersistedChatMessage) &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function isPersistedChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    isChatRole(candidate.role) &&
    typeof candidate.content === "string" &&
    typeof candidate.createdAt === "string"
  );
}

function isChatRole(value: unknown): value is ChatMessage["role"] {
  return value === "user" || value === "assistant" || value === "system";
}

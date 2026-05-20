import type { ChatSettings, ProviderId } from "@/lib/chat/types";

export const CHAT_SETTINGS_STORAGE_KEY = "dora3.chatSettings";
const CHAT_SETTINGS_CHANGE_EVENT = "dora3.chatSettingsChange";

export const PROVIDER_IDS = ["openai", "openrouter"] as const satisfies readonly ProviderId[];

export const OPENAI_MODELS = ["gpt-5.4-mini", "gpt-5-nano"];

export const OPENROUTER_MODELS = [
  "google/gemma-4-31b-it",
  "google/gemma-4-26b-a4b-it",
  "qwen/qwen3.6-35b-a3b",
  "qwen/qwen3.6-flash",
  "tencent/hy3-preview:free",
];

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: OPENAI_MODELS[0],
  openrouter: OPENROUTER_MODELS[0],
};

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  provider: "openai",
  model: DEFAULT_MODELS.openai,
};

let cachedSettingsRaw: string | null = null;
let cachedSettingsSnapshot: ChatSettings = DEFAULT_CHAT_SETTINGS;

export function isProviderId(value: unknown): value is ProviderId {
  return PROVIDER_IDS.some((providerId) => providerId === value);
}

export function getDefaultModelForProvider(provider: ProviderId): string {
  return DEFAULT_MODELS[provider];
}

export function getModelsForProvider(provider: ProviderId): readonly string[] {
  if (provider === "openai") {
    return OPENAI_MODELS;
  }

  return OPENROUTER_MODELS;
}

export function isModelForProvider(
  provider: ProviderId,
  model: string,
): boolean {
  return getModelsForProvider(provider).includes(model);
}

export function loadChatSettings(): ChatSettings {
  if (typeof window === "undefined") {
    return DEFAULT_CHAT_SETTINGS;
  }

  const storedSettings = window.localStorage.getItem(CHAT_SETTINGS_STORAGE_KEY);

  if (storedSettings === cachedSettingsRaw) {
    return cachedSettingsSnapshot;
  }

  if (!storedSettings) {
    cachedSettingsRaw = storedSettings;
    cachedSettingsSnapshot = DEFAULT_CHAT_SETTINGS;
    return cachedSettingsSnapshot;
  }

  try {
    const parsedSettings: unknown = JSON.parse(storedSettings);

    if (!isPersistedChatSettings(parsedSettings)) {
      cachedSettingsRaw = storedSettings;
      cachedSettingsSnapshot = DEFAULT_CHAT_SETTINGS;
      return cachedSettingsSnapshot;
    }

    cachedSettingsRaw = storedSettings;
    cachedSettingsSnapshot = {
      provider: parsedSettings.provider,
      model: isModelForProvider(parsedSettings.provider, parsedSettings.model)
        ? parsedSettings.model
        : getDefaultModelForProvider(parsedSettings.provider),
    };
    return cachedSettingsSnapshot;
  } catch {
    cachedSettingsRaw = storedSettings;
    cachedSettingsSnapshot = DEFAULT_CHAT_SETTINGS;
    return cachedSettingsSnapshot;
  }
}

export function getChatSettingsServerSnapshot(): ChatSettings {
  return DEFAULT_CHAT_SETTINGS;
}

export function saveChatSettings(settings: ChatSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  const storedSettings = JSON.stringify(settings);

  cachedSettingsRaw = storedSettings;
  cachedSettingsSnapshot = settings;

  window.localStorage.setItem(CHAT_SETTINGS_STORAGE_KEY, storedSettings);
  window.dispatchEvent(new Event(CHAT_SETTINGS_CHANGE_EVENT));
}

export function subscribeToChatSettings(
  onStoreChange: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key === CHAT_SETTINGS_STORAGE_KEY) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(CHAT_SETTINGS_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(CHAT_SETTINGS_CHANGE_EVENT, onStoreChange);
  };
}

function isPersistedChatSettings(value: unknown): value is ChatSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return isProviderId(candidate.provider) && typeof candidate.model === "string";
}

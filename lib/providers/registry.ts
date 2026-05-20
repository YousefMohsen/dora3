import type { ProviderId } from "@/lib/chat/types";
import { openAIProvider } from "@/lib/providers/openai";
import { openRouterProvider } from "@/lib/providers/openrouter";
import type { ChatProvider } from "@/lib/providers/types";

const providers = {
  openai: openAIProvider,
  openrouter: openRouterProvider,
} satisfies Record<ProviderId, ChatProvider>;

export function getChatProvider(providerId: ProviderId): ChatProvider {
  return providers[providerId];
}

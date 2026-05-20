import { streamOpenAICompatibleChat } from "@/lib/providers/openaiCompatible";
import type { ChatCompletionInput, ChatProvider } from "@/lib/providers/types";

export const openRouterProvider: ChatProvider = {
  id: "openrouter",
  streamChat(input: ChatCompletionInput) {
    return streamOpenAICompatibleChat(input, {
      apiKey: process.env.OPENROUTER_API_KEY,
      apiKeyName: "OPENROUTER_API_KEY",
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      extraHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Dora3",
      },
    });
  },
};

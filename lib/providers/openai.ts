import { streamOpenAICompatibleChat } from "@/lib/providers/openaiCompatible";
import type { ChatCompletionInput, ChatProvider } from "@/lib/providers/types";

export const openAIProvider: ChatProvider = {
  id: "openai",
  streamChat(input: ChatCompletionInput) {
    return streamOpenAICompatibleChat(input, {
      apiKey: process.env.OPENAI_API_KEY,
      apiKeyName: "OPENAI_API_KEY",
      endpoint: "https://api.openai.com/v1/chat/completions",
    });
  },
};

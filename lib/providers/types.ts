import type { ProviderId } from "@/lib/chat/types";

export type ChatCompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionInput = {
  model: string;
  messages: ChatCompletionMessage[];
};

export type ChatProvider = {
  id: ProviderId;
  streamChat(input: ChatCompletionInput): Promise<ReadableStream<Uint8Array>>;
};

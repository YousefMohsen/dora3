export type ProviderId = "openai" | "openrouter";

export type ChatSettings = {
  provider: ProviderId;
  model: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type ChatStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "message_done" }
  | { type: "error"; message: string };

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

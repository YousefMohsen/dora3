import type { ChatCompletionInput } from "@/lib/providers/types";

type OpenAICompatibleConfig = {
  apiKey: string | undefined;
  apiKeyName: string;
  endpoint: string;
  extraHeaders?: Record<string, string>;
};

type ChatCompletionChunk = {
  choices?: {
    delta?: {
      content?: string;
    };
  }[];
};

const textEncoder = new TextEncoder();

export async function streamOpenAICompatibleChat(
  input: ChatCompletionInput,
  config: OpenAICompatibleConfig,
): Promise<ReadableStream<Uint8Array>> {
  if (!config.apiKey) {
    throw new Error(`Missing ${config.apiKeyName}.`);
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...config.extraHeaders,
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(await getProviderErrorMessage(response));
  }

  if (!response.body) {
    throw new Error("Provider returned an empty response stream.");
  }

  return parseOpenAICompatibleStream(response.body);
}

function parseOpenAICompatibleStream(
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          enqueueTextDeltasFromLines(buffer, controller);
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        const didEnqueueText = enqueueTextDeltasFromLines(
          lines.join("\n"),
          controller,
        );

        if (didEnqueueText) {
          return;
        }
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
}

function enqueueTextDeltasFromLines(
  rawLines: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
): boolean {
  let didEnqueueText = false;
  const lines = rawLines.split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine.startsWith("data:")) {
      continue;
    }

    const data = trimmedLine.slice("data:".length).trim();

    if (!data || data === "[DONE]") {
      continue;
    }

    try {
      const chunk = JSON.parse(data) as ChatCompletionChunk;
      const text = chunk.choices?.[0]?.delta?.content;

      if (text) {
        controller.enqueue(textEncoder.encode(text));
        didEnqueueText = true;
      }
    } catch {
      continue;
    }
  }

  return didEnqueueText;
}

async function getProviderErrorMessage(response: Response): Promise<string> {
  const fallback = `Provider API failed with status ${response.status}.`;

  try {
    const body = (await response.json()) as unknown;

    if (!body || typeof body !== "object") {
      return fallback;
    }

    const candidate = body as Record<string, unknown>;
    const error = candidate.error;

    if (error && typeof error === "object") {
      const message = (error as Record<string, unknown>).message;

      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }

    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message;
    }

    return fallback;
  } catch {
    const text = await response.text();
    return text.trim() || fallback;
  }
}

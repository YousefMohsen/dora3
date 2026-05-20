import type { ChatMessage, ProviderId } from "@/lib/chat/types";
import { encodeChatStreamEvent } from "@/lib/chat/streamEvents";
import { getChatProvider } from "@/lib/providers/registry";
import type { ChatCompletionMessage } from "@/lib/providers/types";
import { isProviderId } from "@/lib/settings/settingsStorage";

const SYSTEM_PROMPT =
  "You are a helpful assistant in a local document-chat app prototype. In this phase, documents are not connected yet.";

type ChatRequestBody = {
  provider: ProviderId;
  model: string;
  messages: ChatCompletionMessage[];
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const validationResult = validateChatRequestBody(body);

  if (!validationResult.ok) {
    return jsonError(validationResult.message, validationResult.status);
  }

  const provider = getChatProvider(validationResult.body.provider);

  try {
    const providerStream = await provider.streamChat({
      model: validationResult.body.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...validationResult.body.messages,
      ],
    });

    return new Response(createChatEventStream(providerStream), {
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Provider API failure.";
    const status = message.startsWith("Missing ") ? 500 : 502;

    return jsonError(message, status);
  }
}

function validateChatRequestBody(
  body: unknown,
):
  | { ok: true; body: ChatRequestBody }
  | { ok: false; message: string; status: number } {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      message: "Request body must be an object.",
      status: 400,
    };
  }

  const candidate = body as Record<string, unknown>;

  if (!isProviderId(candidate.provider)) {
    return {
      ok: false,
      message: "Unsupported provider.",
      status: 400,
    };
  }

  if (typeof candidate.model !== "string" || !candidate.model.trim()) {
    return {
      ok: false,
      message: "A model name is required.",
      status: 400,
    };
  }

  if (!Array.isArray(candidate.messages) || candidate.messages.length === 0) {
    return {
      ok: false,
      message: "At least one message is required.",
      status: 400,
    };
  }

  const messages = candidate.messages.filter(isChatCompletionMessage);

  if (messages.length !== candidate.messages.length) {
    return {
      ok: false,
      message: "Messages must include only valid chat roles and text content.",
      status: 400,
    };
  }

  return {
    ok: true,
    body: {
      provider: candidate.provider,
      model: candidate.model.trim(),
      messages,
    },
  };
}

function isChatCompletionMessage(value: unknown): value is ChatCompletionMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Pick<ChatMessage, "role" | "content">;

  return (
    (candidate.role === "system" ||
      candidate.role === "user" ||
      candidate.role === "assistant") &&
    typeof candidate.content === "string" &&
    candidate.content.trim().length > 0
  );
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function createChatEventStream(
  providerStream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const reader = providerStream.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          const finalText = decoder.decode();

          if (finalText) {
            controller.enqueue(
              encodeChatStreamEvent({ type: "text_delta", text: finalText }),
            );
          }

          controller.enqueue(encodeChatStreamEvent({ type: "message_done" }));
          controller.close();
          return;
        }

        const text = decoder.decode(value, { stream: true });

        if (text) {
          controller.enqueue(
            encodeChatStreamEvent({ type: "text_delta", text }),
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Provider stream failed.";

        controller.enqueue(encodeChatStreamEvent({ type: "error", message }));
        controller.close();
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
}

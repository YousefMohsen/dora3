import type { ChatStreamEvent } from "@/lib/chat/types";

const textEncoder = new TextEncoder();

export function encodeChatStreamEvent(event: ChatStreamEvent): Uint8Array {
  return textEncoder.encode(`${JSON.stringify(event)}\n`);
}

export async function readChatStreamEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatStreamEvent) => void | Promise<void>,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      buffer += decoder.decode();
      await emitBufferedEvents(buffer, onEvent);
      return;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    await emitBufferedEvents(lines.join("\n"), onEvent);
  }
}

async function emitBufferedEvents(
  rawLines: string,
  onEvent: (event: ChatStreamEvent) => void | Promise<void>,
): Promise<void> {
  const lines = rawLines.split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      continue;
    }

    await onEvent(parseChatStreamEvent(trimmedLine));
  }
}

function parseChatStreamEvent(rawEvent: string): ChatStreamEvent {
  try {
    const event = JSON.parse(rawEvent) as unknown;

    if (isChatStreamEvent(event)) {
      return event;
    }
  } catch {
    // Fall through to the shared invalid-event error below.
  }

  throw new Error("Received an invalid chat stream event.");
}

function isChatStreamEvent(event: unknown): event is ChatStreamEvent {
  if (!event || typeof event !== "object") {
    return false;
  }

  const candidate = event as Record<string, unknown>;

  if (candidate.type === "text_delta") {
    return typeof candidate.text === "string";
  }

  if (candidate.type === "message_done") {
    return true;
  }

  if (candidate.type === "error") {
    return typeof candidate.message === "string";
  }

  return false;
}

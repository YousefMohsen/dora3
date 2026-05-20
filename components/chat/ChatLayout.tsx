"use client";

import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import type {
  ChatMessage,
  ChatSettings,
  ChatStreamEvent,
  Conversation,
} from "@/lib/chat/types";
import {
  createChatMessage,
  createConversation,
  getConversationTitleFromMessage,
  getConversationsServerSnapshot,
  loadConversations,
  saveConversations,
  subscribeToConversations,
} from "@/lib/chat/localStorage";
import { readChatStreamEvents } from "@/lib/chat/streamEvents";
import {
  getChatSettingsServerSnapshot,
  getDefaultModelForProvider,
  getModelsForProvider,
  isProviderId,
  loadChatSettings,
  PROVIDER_IDS,
  saveChatSettings,
  subscribeToChatSettings,
} from "@/lib/settings/settingsStorage";

type VisibleStreamEvent = {
  type: ChatStreamEvent["type"] | "waiting";
  label: string;
  status: "active" | "done" | "error";
};

type VisibleStreamStep = VisibleStreamEvent & {
  id: string;
};

export function ChatLayout() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [visibleStreamEvents, setVisibleStreamEvents] = useState<
    Record<string, VisibleStreamStep[]>
  >({});
  const [expandedStreamEvents, setExpandedStreamEvents] = useState<
    Record<string, boolean>
  >({});
  const chatSettings = useSyncExternalStore(
    subscribeToChatSettings,
    loadChatSettings,
    getChatSettingsServerSnapshot,
  );
  const conversations = useSyncExternalStore(
    subscribeToConversations,
    loadConversations,
    getConversationsServerSnapshot,
  );
  const activeConversation =
    conversations.find(
      (conversation) => conversation.id === activeConversationId,
    ) ??
    conversations[0] ??
    null;
  const activeConversationKey = activeConversation?.id ?? null;

  useEffect(() => {
    if (loadConversations().length > 0) {
      return;
    }

    const firstConversation = createConversation();
    saveConversations([firstConversation]);
  }, []);

  function handleProviderChange(event: ChangeEvent<HTMLSelectElement>) {
    const provider = event.target.value;

    if (!isProviderId(provider)) {
      return;
    }

    const nextSettings: ChatSettings = {
      provider,
      model: getDefaultModelForProvider(provider),
    };

    saveChatSettings(nextSettings);
  }

  function handleModelChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextSettings: ChatSettings = {
      ...chatSettings,
      model: event.target.value,
    };

    saveChatSettings(nextSettings);
  }

  function handleNewConversation() {
    const nextConversation = createConversation();

    saveConversations([nextConversation, ...conversations]);
    setActiveConversationId(nextConversation.id);
    setDraftMessage("");
    setErrorMessage(null);
    setIsSettingsOpen(false);
  }

  function handleSelectConversation(conversationId: string) {
    setActiveConversationId(conversationId);
    setErrorMessage(null);
    setIsSettingsOpen(false);
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function addVisibleStreamEvent(
    messageId: string,
    streamEvent: VisibleStreamEvent,
  ) {
    setVisibleStreamEvents((currentEvents) => ({
      ...currentEvents,
      [messageId]: [
        ...(currentEvents[messageId] ?? []),
        {
          ...streamEvent,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
      ],
    }));
  }

  function toggleStreamEvents(messageId: string) {
    setExpandedStreamEvents((currentEvents) => ({
      ...currentEvents,
      [messageId]: !currentEvents[messageId],
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = draftMessage.trim();

    if (!content || isSending) {
      return;
    }

    const userMessage = createChatMessage("user", content);
    const assistantMessage = createChatMessage("assistant", "");
    const now = new Date().toISOString();
    const conversationToUpdate = activeConversation ?? createConversation();
    const shouldGenerateTitle = conversationToUpdate.messages.length === 0;
    const updatedConversation: Conversation = {
      ...conversationToUpdate,
      title: shouldGenerateTitle
        ? getConversationTitleFromMessage(content)
        : conversationToUpdate.title,
      messages: [...conversationToUpdate.messages, userMessage],
      updatedAt: now,
    };

    saveConversation(
      appendAssistantMessage(updatedConversation, assistantMessage, ""),
      conversations,
    );
    setActiveConversationId(updatedConversation.id);
    setDraftMessage("");
    setErrorMessage(null);
    setIsSending(true);
    addVisibleStreamEvent(assistantMessage.id, {
      type: "waiting",
      label: "Waiting for provider response...",
      status: "active",
    });

    let assistantContent = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: chatSettings.provider,
          model: chatSettings.model,
          messages: updatedConversation.messages.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(await getChatApiErrorMessage(response));
      }

      if (!response.body) {
        throw new Error("The chat API returned an empty response.");
      }

      await readChatStreamEvents(response.body, (streamEvent) => {
        if (streamEvent.type === "text_delta") {
          addVisibleStreamEvent(assistantMessage.id, {
            type: "text_delta",
            label: `Received ${streamEvent.text.length} characters`,
            status: "active",
          });
          assistantContent += streamEvent.text;
          saveConversation(
            appendAssistantMessage(
              updatedConversation,
              assistantMessage,
              assistantContent,
            ),
          );
          return;
        }

        if (streamEvent.type === "message_done") {
          addVisibleStreamEvent(assistantMessage.id, {
            type: "message_done",
            label: "message_done received",
            status: "done",
          });
          return;
        }

        if (streamEvent.type === "error") {
          addVisibleStreamEvent(assistantMessage.id, {
            type: "error",
            label: streamEvent.message,
            status: "error",
          });
          throw new Error(streamEvent.message);
        }
      });

      saveConversation(
        appendAssistantMessage(
          updatedConversation,
          assistantMessage,
          assistantContent || "The assistant returned no text.",
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The chat request failed.";

      setErrorMessage(message);
      addVisibleStreamEvent(assistantMessage.id, {
        type: "error",
        label: message,
        status: "error",
      });
      saveConversation(
        appendAssistantMessage(
          updatedConversation,
          assistantMessage,
          assistantContent
            ? `${assistantContent}\n\nError: ${message}`
            : `Error: ${message}`,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-zinc-100 text-zinc-950">
      <aside className="flex min-h-0 w-72 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Dora3
          </p>
          <h1 className="mt-2 text-xl font-semibold">Document Chat</h1>
        </div>

        <nav className="space-y-2 border-b border-zinc-200 p-3">
          <Link
            className="block rounded-xl bg-zinc-950 px-3 py-2 text-sm font-medium text-white"
            href="/chat"
          >
            Chat
          </Link>
          <Link
            className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            href="/documents"
          >
            Documents
          </Link>
        </nav>

        <section className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-zinc-700">
              Conversations
            </h2>
            <button
              className="mt-3 w-full rounded-xl border border-zinc-950 bg-zinc-950 px-3 py-3 text-left text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
              onClick={handleNewConversation}
              type="button"
            >
              New chat
            </button>
          </div>

          <div className="space-y-2">
            {conversations.map((conversation) => (
              <button
                className={`w-full rounded-xl border px-3 py-3 text-left ${
                  conversation.id === activeConversationKey
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-zinc-50 text-zinc-950 hover:bg-zinc-100"
                }`}
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation.id)}
                type="button"
              >
                <span className="block text-sm font-medium">
                  {conversation.title}
                </span>
                <span
                  className={`mt-1 block text-xs ${
                    conversation.id === activeConversationKey
                      ? "text-zinc-300"
                      : "text-zinc-500"
                  }`}
                >
                  {conversation.messages.length === 0
                    ? "No messages yet"
                    : `${conversation.messages.length} messages`}
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="border-t border-zinc-200 p-3">
          <button
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            onClick={() => setIsSettingsOpen((current) => !current)}
            type="button"
          >
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {isSettingsOpen ? (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
          <header className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
            <div>
              <p className="text-sm text-zinc-500">Phase 2 chat foundation</p>
              <h2 className="text-lg font-semibold">Settings</h2>
            </div>
            <button
              aria-label="Close settings"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100"
              onClick={() => setIsSettingsOpen(false)}
              type="button"
            >
              X
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
            <form className="mx-auto max-w-3xl space-y-5">
              <div>
                <label
                  className="block text-sm font-medium text-zinc-700"
                  htmlFor="chat-provider"
                >
                  Provider
                </label>
                <select
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-300 focus:ring-4"
                  id="chat-provider"
                  onChange={handleProviderChange}
                  value={chatSettings.provider}
                >
                  {PROVIDER_IDS.map((providerId) => (
                    <option key={providerId} value={providerId}>
                      {providerId === "openai" ? "OpenAI" : "OpenRouter"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-zinc-700"
                  htmlFor="chat-model"
                >
                  Model
                </label>
                <select
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-300 focus:ring-4"
                  id="chat-model"
                  onChange={handleModelChange}
                  value={chatSettings.model}
                >
                  {getModelsForProvider(chatSettings.provider).map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  This is saved locally and used for the next chat request.
                </p>
              </div>
            </form>
          </div>
        </section>
      ) : (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="border-b border-zinc-200 bg-white px-6 py-4">
            <p className="text-sm text-zinc-500">Phase 2 chat foundation</p>
            <h2 className="text-lg font-semibold">
              {activeConversation?.title ?? "New conversation"}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Using {chatSettings.provider} / {chatSettings.model}
            </p>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {activeConversation && activeConversation.messages.length > 0 ? (
                activeConversation.messages.map((message) => {
                  const isUser = message.role === "user";
                  const streamEvents = isUser
                    ? []
                    : (visibleStreamEvents[message.id] ?? []);
                  const latestStreamEvent =
                    streamEvents[streamEvents.length - 1] ?? null;
                  const isStreamExpanded =
                    expandedStreamEvents[message.id] ?? false;

                  return (
                    <article
                      className={
                        isUser
                          ? "ml-auto max-w-xl rounded-2xl bg-zinc-950 p-5 text-white shadow-sm"
                          : "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                      }
                      key={message.id}
                    >
                      {latestStreamEvent ? (
                        <div className="mb-3">
                          <button
                            className={`inline-flex w-fit items-center rounded-xl border px-3 py-2 text-left text-xs ${
                              latestStreamEvent.status === "error"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : latestStreamEvent.status === "done"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-blue-200 bg-blue-50 text-blue-700"
                            }`}
                            onClick={() => toggleStreamEvents(message.id)}
                            type="button"
                          >
                            <span className="mr-2" aria-hidden="true">
                              {isStreamExpanded ? "v" : ">"}
                            </span>
                            <span className="font-semibold">
                              {latestStreamEvent.type}
                            </span>
                            <span className="ml-2">
                              {latestStreamEvent.label}
                            </span>
                          </button>

                          {isStreamExpanded ? (
                            <div className="mt-2 inline-flex w-fit flex-col gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-600">
                              {streamEvents.map((streamEvent, index) => (
                                <div
                                  className="flex items-center gap-2"
                                  key={streamEvent.id}
                                >
                                  <span className="tabular-nums text-zinc-400">
                                    {index + 1}
                                  </span>
                                  <span className="font-semibold">
                                    {streamEvent.type}
                                  </span>
                                  <span>{streamEvent.label}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <p
                        className={`text-sm font-medium ${
                          isUser ? "text-zinc-300" : "text-zinc-500"
                        }`}
                      >
                        {isUser ? "You" : "Assistant"}
                      </p>
                      <p
                        className={`mt-2 whitespace-pre-wrap leading-7 ${
                          isUser ? "text-white" : "text-zinc-700"
                        }`}
                      >
                        {message.content}
                      </p>
                    </article>
                  );
                })
              ) : (
                <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-zinc-500">Assistant</p>
                  <p className="mt-2 leading-7 text-zinc-700">
                    Start a conversation here. Messages are saved locally in this
                    browser, and assistant replies stream in from the selected
                    provider.
                  </p>
                </article>
              )}
            </div>
          </div>

          <form
            className="shrink-0 border-t border-zinc-200 bg-white p-4"
            onSubmit={handleSubmit}
          >
            {errorMessage ? (
              <div className="mx-auto mb-3 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}
            <div className="mx-auto flex max-w-3xl gap-3">
              <label className="sr-only" htmlFor="chat-message">
                Message
              </label>
              <textarea
                className="flex-1 resize-none rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none ring-zinc-300 placeholder:text-zinc-400 focus:ring-4"
                disabled={isSending}
                id="chat-message"
                onChange={(event) => setDraftMessage(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder="Ask a question..."
                value={draftMessage}
              />
              <button
                className="self-end rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
                disabled={!draftMessage.trim() || isSending}
                type="submit"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </section>
      )}

      <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-zinc-200 bg-white p-5 xl:block">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Sources
        </h2>
        <p className="mt-4 text-sm leading-6 text-zinc-600">
          Sources and agent activity will appear here in later phases.
        </p>
        <div className="mt-6 space-y-3 text-sm text-zinc-500">
          <p className="rounded-xl border border-dashed border-zinc-300 p-3">
            No documents connected yet.
          </p>
          <p className="rounded-xl border border-dashed border-zinc-300 p-3">
            No sources for this message.
          </p>
          <p className="rounded-xl border border-dashed border-zinc-300 p-3">
            Future: search traces, citations, and document chunks.
          </p>
        </div>
      </aside>

    </main>
  );
}

function saveConversation(
  conversation: Conversation,
  sourceConversations = loadConversations(),
) {
  const remainingConversations = sourceConversations.filter(
    (existingConversation) => existingConversation.id !== conversation.id,
  );

  saveConversations([conversation, ...remainingConversations]);
}

function appendAssistantMessage(
  conversation: Conversation,
  assistantMessage: ChatMessage,
  content: string,
): Conversation {
  return {
    ...conversation,
    messages: [
      ...conversation.messages,
      {
        ...assistantMessage,
        content,
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

async function getChatApiErrorMessage(response: Response): Promise<string> {
  const fallback = `Chat request failed with status ${response.status}.`;

  try {
    const body = (await response.json()) as unknown;

    if (!body || typeof body !== "object") {
      return fallback;
    }

    const error = (body as Record<string, unknown>).error;

    return typeof error === "string" && error.trim() ? error : fallback;
  } catch {
    return fallback;
  }
}

# Phase 2 Plan: Next.js Chat Foundation

## Phase Objective

Phase 2 creates the first working application shell for the project: a TypeScript Next.js app with a minimal chat interface that can talk directly to OpenAI and OpenRouter models.

This phase does not implement PDF upload, indexing, RAG, embeddings, or the final document agent. It should still be built in a way that points toward the final goal: a document-grounded assistant inspired by Claude Code's streaming loop, typed provider boundaries, persisted local state, and future tool-based retrieval.

The Phase 2 output should be:

```text
A Next.js app with /chat and /documents routes,
where /chat can send messages to OpenAI or OpenRouter,
stream responses into the UI,
persist conversations locally,
and save the selected provider/model across restarts.
```

## Context From Phase 1

Phase 1 recommended building the final project as a document-grounded agent with:

- A streaming-first architecture.
- A small typed tool loop inspired by Claude Code.
- Local single-user MVP assumptions.
- No advanced permissions in the MVP.
- Memory used only for app/user preferences, not as the document knowledge base.
- Future hybrid RAG over indexed PDF chunks, with citations and refusal when evidence is missing.

Phase 2 should therefore avoid building throwaway chat code. Even though the current chat talks directly to LLM providers without documents, the design should prepare for a later `runDocumentAgent()` layer that streams events such as text deltas, tool calls, source updates, and final cited answers.

## Scope

In scope:

- Initialize a TypeScript Next.js project.
- Create `/chat` as the default useful screen.
- Create a placeholder `/documents` route.
- Build a three-column chat layout:
  - Left conversation/sidebar panel.
  - Middle chat panel.
  - Right future context/sources/tools panel.
- Add settings UI for provider and model selection.
- Support OpenAI and OpenRouter via environment variables.
- Persist provider/model choice in local storage.
- Persist conversations in local storage.
- Stream assistant responses when possible.

Out of scope:

- PDF upload.
- Local document storage.
- Dataset management.
- Indexing.
- Embeddings.
- Vector database.
- RAG.
- Agent tool loop.
- Citations.
- Advanced permissions.
- Multi-user auth.

## Design Direction

Use a simple architecture that can grow into the final agent:

```text
UI components
  -> chat state and local persistence
  -> /api/chat route
  -> provider adapter
  -> OpenAI or OpenRouter
```

Later phases can replace or wrap `/api/chat` with:

```text
UI components
  -> /api/chat route
  -> runDocumentAgent()
  -> retrieval tools
  -> indexed document store
```

The UI should not know whether the backend is doing direct model chat or document-agent retrieval. It should mostly consume streamed chat events.

## Recommended Project Structure

Future agents can adjust this to match the installed Next.js template, but the intent should stay similar:

```text
src/
  app/
    page.tsx
    chat/
      page.tsx
    documents/
      page.tsx
    api/
      chat/
        route.ts
  components/
    chat/
      ChatLayout.tsx
      ConversationSidebar.tsx
      ChatMessageList.tsx
      ChatComposer.tsx
      RightPanel.tsx
      SettingsPanel.tsx
    ui/
      Button.tsx
      Input.tsx
      Select.tsx
  lib/
    chat/
      types.ts
      localStorage.ts
    providers/
      types.ts
      openai.ts
      openrouter.ts
      registry.ts
    settings/
      settingsStorage.ts
```

Keep provider code outside React components. Keep local storage helpers isolated so they can later be replaced with a database or server persistence.

## Step 1: Initialize The Next.js App

Goal: Create a clean TypeScript Next.js project.

Implementation notes:

- Use the current stable Next.js setup.
- Use TypeScript.
- Use the App Router.
- Use a simple styling approach. Tailwind is fine if selected during initialization.
- Create `.env.example` with:

```text
OPENAI_API_KEY=
OPENROUTER_API_KEY=
```

- Do not commit real secrets.

Verification:

- `npm run dev` starts the app.
- Visiting the root route works.
- TypeScript compiles.
- `.env.example` documents the required keys.

## Step 2: Add Basic Routes

Goal: Create the route structure that matches the project vision.

Implementation notes:

- `/` should redirect to `/chat` or render a simple link to `/chat`.
- `/chat` should render the chat interface shell.
- `/documents` should render a placeholder page saying documents will be implemented in Phase 3.

Verification:

- `/chat` loads.
- `/documents` loads.
- Browser navigation between the two works.

## Step 3: Build The Chat Layout Shell

Goal: Create the visual structure before wiring model calls.

Layout requirements:

- Left sidebar for conversations and navigation.
- Main center area for messages and composer.
- Right panel reserved for future document sources, tool traces, citations, and metadata.
- The right panel can be empty or show placeholder text in Phase 2.
- Add a settings icon in the left sidebar.
- Add a documents button/link in the left sidebar if it is easy now; it can point to `/documents`.

Why this matters:

The final document agent will need room for retrieved sources and citations. The right panel should exist now so the future UI does not require a large layout rewrite.

Verification:

- The layout has three visible areas on desktop.
- The center chat area remains usable.
- Settings can be opened from the left sidebar.
- `/documents` can be reached from the UI.

## Step 4: Define Chat And Settings Types

Goal: Add stable TypeScript types before implementing persistence and API calls.

Suggested types:

```typescript
type ProviderId = "openai" | "openrouter";

type ChatSettings = {
  provider: ProviderId;
  model: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};
```

Keep these types simple, but leave room to add future source/citation metadata to assistant messages.

Verification:

- Types are used by the chat UI state.
- No `any` is needed for core chat state.

## Step 5: Implement Local Settings Persistence

Goal: Save provider and model selection across browser restarts.

Implementation notes:

- Store settings in local storage.
- Use a stable key such as `dora3.chatSettings`.
- Default provider can be `openai`.
- Default models can be simple hardcoded values:
  - OpenAI: `gpt-4o-mini` or another configured default.
  - OpenRouter: a user-editable model string.
- Settings panel should allow:
  - Select provider.
  - Edit/select model name.

Verification:

- Change provider/model.
- Refresh the browser.
- The selected provider/model remains.

## Step 6: Implement Conversation Persistence

Goal: Save chat conversations locally.

Implementation notes:

- Store conversations in local storage.
- Use a stable key such as `dora3.conversations`.
- Allow creating a new conversation.
- Show conversations in the left sidebar.
- Selecting a conversation loads its messages.
- On first user message, generate a basic title from the first message.

Keep this local-only for Phase 2. This follows the MVP assumption: one user, local machine, no advanced auth.

Verification:

- Send or manually add messages through the UI.
- Refresh the browser.
- Conversations and messages remain.
- Creating and switching conversations works.

## Step 7: Add Provider Adapter Layer

Goal: Keep OpenAI/OpenRouter details out of the UI and prepare for future agent routing.

Implementation notes:

- Create a provider interface, for example:

```typescript
type ChatCompletionInput = {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
};

type ChatProvider = {
  id: "openai" | "openrouter";
  streamChat(input: ChatCompletionInput): Promise<ReadableStream>;
};
```

- Implement `openai` using `OPENAI_API_KEY`.
- Implement `openrouter` using `OPENROUTER_API_KEY`.
- Keep the API route responsible for choosing the provider.

Future direction:

This provider adapter is the first small version of the boundary that later lets the app route through `runDocumentAgent()` instead of direct model calls.

Verification:

- Provider registry can resolve `openai`.
- Provider registry can resolve `openrouter`.
- Missing provider id returns a clear error.

## Step 8: Implement `/api/chat`

Goal: Send chat messages to the selected provider/model.

Request body should include:

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "messages": []
}
```

Implementation notes:

- Validate request body.
- Validate provider is supported.
- Never expose API keys to the client.
- Return a streaming response if practical.
- Return clear errors for:
  - Missing API key.
  - Unsupported provider.
  - Empty messages.
  - Provider API failure.

For now, the system prompt can be minimal and should not pretend to be document-grounded yet. Example:

```text
You are a helpful assistant in a local document-chat app prototype. In this phase, documents are not connected yet.
```

Verification:

- Sending a request from the UI returns an assistant response.
- OpenAI works when `OPENAI_API_KEY` is set.
- OpenRouter works when `OPENROUTER_API_KEY` is set.
- Missing keys produce a readable error.

## Step 9: Wire The Chat UI To The API

Goal: Make `/chat` usable end-to-end.

Implementation notes:

- User enters a message in the composer.
- The message is added to the current conversation.
- The API is called with the current conversation messages and selected settings.
- Assistant response streams into the message list if streaming is available.
- Disable submit while a response is in progress.
- Add basic error display.

Verification:

- User can send a message.
- Assistant replies.
- Conversation persists after refresh.
- Switching provider/model changes which backend is used.

## Step 10: Add Basic Streaming Event Shape

Goal: Make the Phase 2 chat response compatible with future agent events.

Implementation notes:

Even if the provider returns plain text deltas, the UI should internally treat updates like events:

```typescript
type ChatStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "message_done" }
  | { type: "error"; message: string };
```

Later phases can extend this with:

```typescript
| { type: "tool_call_start"; toolName: string }
| { type: "tool_call_result"; toolName: string }
| { type: "sources_update"; sources: SourceRef[] }
| { type: "final_answer"; citations: Citation[] }
```

Verification:

- UI message rendering still works.
- Chat code is not tightly coupled to provider-specific streaming formats.

## Step 11: Add Minimal Right Panel Placeholder

Goal: Reserve future UX space for RAG and agent traces.

Implementation notes:

The right panel can show:

```text
Sources and agent activity will appear here in later phases.
```

Optional placeholders:

- "No documents connected yet."
- "No sources for this message."
- "Future: search traces, citations, document chunks."

Verification:

- Right panel renders consistently.
- It does not block normal chat usage.

## Step 12: Add Basic Documentation

Goal: Make the app easy for the next agent or developer to run.

Implementation notes:

- Add or update `README.md`.
- Include:
  - Install command.
  - Dev command.
  - Required `.env` keys.
  - Current Phase 2 scope.
  - What is intentionally not implemented yet.

Verification:

- A new agent can follow `README.md` to run the app.
- The documented scope matches this `phase2.md`.


## step 12.5: update AGENTS.md
Update AGENTS.md with things that will help future agents maintin and develop new code. 

## Step 13: Final Phase 2 Verification

Goal: Confirm the phase is complete and stable.

Run the available checks for the chosen project setup, likely:

```text
npm run lint
npm run typecheck
npm run build
```

If some scripts do not exist, either add them or document which checks were run.

Manual test checklist:

- `/chat` loads.
- `/documents` loads.
- Settings open from sidebar.
- Provider/model selection persists.
- Conversations persist.
- New conversation works.
- OpenAI chat works with `OPENAI_API_KEY`.
- OpenRouter chat works with `OPENROUTER_API_KEY`.
- Missing API keys show understandable errors.
- Right panel exists for future sources.

## Acceptance Criteria

Phase 2 is done when:

- The project is initialized as a TypeScript Next.js app.
- `/chat` and `/documents` routes exist.
- `/chat` has the planned left, middle, and right layout.
- Settings allow OpenAI/OpenRouter provider and model selection.
- Settings persist in local storage.
- Conversations persist in local storage.
- `/api/chat` can call OpenAI and OpenRouter without exposing secrets to the client.
- Assistant responses render in the chat UI.
- The code structure leaves a clear path to future document retrieval and agent streaming.

## Guidance For Future Agents

Implement one step at a time and verify it before continuing. Do not jump ahead into PDF upload, RAG, embeddings, or the final agent loop during Phase 2.

Prefer simple local MVP choices. This app is currently one user on one machine. The important thing is to create a clean chat foundation that later phases can extend into:

```text
documents -> indexing -> hybrid RAG -> Claude Code-style tool loop -> cited answers
```

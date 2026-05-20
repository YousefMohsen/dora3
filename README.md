## Dora3

Dora3 is a local document-chat prototype. Phase 2 builds the Next.js chat foundation: `/chat` can send messages to OpenAI or OpenRouter, stream responses into the UI, persist conversations locally, and remember the selected provider/model in local storage.

## Install

Install dependencies:

```bash
npm install
```

## Environment

Create `.env` with the provider keys you want to use:

```bash
OPENAI_API_KEY=
OPENROUTER_API_KEY=
```

Only the key for the selected provider is required at runtime. Keep real secrets out of source control.

## Development

Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Useful routes:

- `/chat`: the Phase 2 chat interface.
- `/documents`: a placeholder for Phase 3 document workflows.

## Current Scope

Implemented in Phase 2:

- Three-column chat layout with conversation sidebar, message panel, and future sources/activity panel.
- Local storage persistence for conversations and chat settings.
- Provider/model selection for OpenAI and OpenRouter.
- `/api/chat` route that calls provider adapters without exposing API keys to the client.
- Streaming chat event shape for assistant text deltas, completion, and errors.

Intentionally not implemented yet:

- PDF upload.
- Document storage or indexing.
- Embeddings or vector search.
- RAG, citations, or grounded refusal behavior.
- Agent tools or trace execution.
- Multi-user authentication.

## Checks

Run the Phase 2 verification checks before handing off changes:

```bash
npm run lint
npm run typecheck
npm run build
```

## Dora3

Dora3 is a local document-chat prototype. It has a Next.js chat foundation, local PDF dataset uploads, and a Phase 4 indexing pipeline that extracts PDF text into chunks, embeds them with OpenAI, and stores vectors in local Postgres with `pgvector`.

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
DATABASE_URL=postgres://dora:dora@localhost:5432/dora3
EMBEDDING_MODEL=text-embedding-3-small
```

Only the chat provider key for the selected provider is required for `/chat`. `OPENAI_API_KEY` and `DATABASE_URL` are required when indexing or searching documents. Keep real secrets out of source control.

## Local Indexing Database

Start Postgres with `pgvector`:

```bash
docker compose -f docker-compose-db.yml up -d
```

Apply the schema:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

Then upload PDFs in `/documents`, open a dataset, and click `Index dataset`.

To test retrieval after indexing:

```bash
curl -X POST http://localhost:3000/api/retrieval/test-search \
  -H "Content-Type: application/json" \
  -d '{"datasetId":"dataset_...","query":"what is noxiustoxin?","limit":5}'
```

## Development

Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Useful routes:

- `/chat`: the chat interface.
- `/documents`: local datasets, PDF upload, indexing, and document status.
- `/api/retrieval/test-search`: basic vector retrieval test endpoint.

## Current Scope

Implemented:

- Three-column chat layout with conversation sidebar, message panel, and future sources/activity panel.
- Local storage persistence for conversations and chat settings.
- Provider/model selection for OpenAI and OpenRouter.
- `/api/chat` route that calls provider adapters without exposing API keys to the client.
- Streaming chat event shape for assistant text deltas, completion, and errors.
- Local document datasets, PDF upload, deletion, and document status metadata.
- Local Postgres/pgvector indexing with PDF extraction, chunking, OpenAI embeddings, and vector search.

Intentionally not implemented yet:

- RAG, citations, or grounded refusal behavior.
- Agent tools or trace execution.
- Multi-user authentication.

## Checks

Run verification checks before handing off changes:

```bash
npm run lint
npm run typecheck
npm run build
```

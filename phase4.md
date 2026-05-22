# Phase 4 Plan: Document Indexing Foundation

## Phase Objective

Phase 4 turns the dummy "index dataset" action from Phase 3 into a real local indexing pipeline.

The goal is not to build the final document chat agent yet. The goal is to process uploaded PDFs into searchable chunks and store those chunks in a local Postgres database with `pgvector`, so Phase 5 can build the agent on top of a working retrieval layer.

The Phase 4 output should be:

```text
A local indexing setup where a user can:
start Postgres with Docker,
click "Index dataset" in /documents,
extract text from uploaded PDFs,
split extracted text into chunks,
generate embeddings for those chunks,
store chunks and vectors in Postgres/pgvector,
update document indexing status,
and run a basic retrieval query that returns relevant chunks with source metadata.
```

## Context From Earlier Phases

Phase 1 recommended building the project as a document-grounded assistant with:

- Local single-user MVP assumptions.
- PDF documents as the factual source of truth.
- Hybrid RAG later, but not GraphRAG first.
- Citations tied to document, page, and chunk metadata.
- A Claude Code-inspired agent/tool loop in a later phase.

Phase 2 created the Next.js chat foundation.

Phase 3 created local datasets, local PDF uploads, document metadata, delete behavior, and a dummy index button.

Phase 4 should now replace the dummy index action with real processing, while still avoiding the full agent loop. This phase should produce a clean indexing and retrieval foundation.

## Scope

In scope:

- Add a local Postgres database with `pgvector`.
- Add a simple `docker-compose-db.yml` for local startup.
- Add database schema for indexing runs, indexed documents, and document chunks.
- Add a small database client/helper layer.
- Add PDF text extraction.
- Preserve source metadata such as dataset id, document id, original file name, and page numbers when possible.
- Add chunking with overlap.
- Generate embeddings for chunks.
- Store chunk text and embeddings in Postgres.
- Replace the dummy dataset index route with real indexing.
- Update document status to `indexing`, `indexed`, or `failed`.
- Add a basic vector search function or API endpoint for testing retrieval.
- Add minimal logging/diagnostics for indexing failures.

Out of scope:

- Full document chat/RAG answer generation.
- Claude Code-style agent loop.
- Tool calling.
- Reranking.
- GraphRAG.
- OCR for scanned PDFs.
- Multi-user auth.
- Dataset permissions.
- Remote file storage or Google Drive.
- Production deployment setup.
- Advanced job queues.
- Complex migrations framework unless the project already uses one.

## MVP Assumptions

The MVP is local and single-user:

- The existing local file storage from Phase 3 remains valid.
- The existing document metadata JSON can stay as the UI/source-of-truth for datasets and uploaded files.
- Postgres is introduced for indexing and retrieval data, not to rewrite all document management.
- Datasets are organizational folders, not security boundaries.
- It is acceptable for indexing to run synchronously from the API route for the MVP.
- If indexing takes longer than expected, the UI can simply show `indexing` and then update after completion.
- Only PDF files need to be supported.

## Design Direction

Keep Phase 4 backend-focused and modular:

```text
/documents UI
  -> POST /api/datasets/[datasetId]/index
  -> indexing service
  -> PDF extraction
  -> chunking
  -> embeddings
  -> Postgres/pgvector
  -> retrieval service
```

Do not put PDF parsing, database writes, or embedding calls inside React components. Keep indexing code in server-side library modules.

The current `/documents` UI should not need a major rewrite. It should only call the real index API and display the existing document status values.

## Recommended Project Structure

Adjust to match the current app structure. This repo currently uses root-level `app/`, `components/`, and `lib/` folders rather than `src/`.

Recommended additions:

```text
docker-compose-db.yml

db/
  schema.sql

lib/
  db/
    client.ts
    schema.ts
  indexing/
    chunkText.ts
    embeddings.ts
    extractPdf.ts
    indexDataset.ts
    indexDocument.ts
    types.ts
  retrieval/
    vectorSearch.ts
    types.ts

app/
  api/
    datasets/
      [datasetId]/
        index/
          route.ts
    retrieval/
      test-search/
        route.ts
```

The `app/api/retrieval/test-search/route.ts` route is optional but useful for verifying Phase 4 without building the Phase 5 agent.

## Environment Variables

Add or update `.env.example` with:

```text
OPENAI_API_KEY=
DATABASE_URL=postgres://dora:dora@localhost:5432/dora3
EMBEDDING_MODEL=text-embedding-3-small
```

Notes:

- Do not commit real secrets.
- Reuse the existing `OPENAI_API_KEY` if it already exists.
- Embeddings can use OpenAI first because the app already supports OpenAI configuration.
- Do not add OpenRouter embeddings in Phase 4 unless it is already simple in the current provider setup.

## Step 1: Add Local Postgres With pgvector

Goal: Make the database easy to start locally.

Create `docker-compose-db.yml`:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: dora3-postgres
    environment:
      POSTGRES_USER: dora
      POSTGRES_PASSWORD: dora
      POSTGRES_DB: dora3
    ports:
      - "5432:5432"
    volumes:
      - dora3-postgres-data:/var/lib/postgresql/data

volumes:
  dora3-postgres-data:
```

Verification:

- `docker compose -f docker-compose-db.yml up -d` starts Postgres.
- The database is reachable at `localhost:5432`.
- The connection string matches `DATABASE_URL`.

## Step 2: Add Database Schema

Goal: Store indexed document chunks and vectors with source metadata.

Create `db/schema.sql`.

Recommended MVP schema:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS index_runs (
  id text PRIMARY KEY,
  dataset_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS indexed_documents (
  id text PRIMARY KEY,
  dataset_id text NOT NULL,
  document_id text NOT NULL UNIQUE,
  original_name text NOT NULL,
  file_path text NOT NULL,
  content_hash text,
  status text NOT NULL CHECK (status IN ('indexing', 'indexed', 'failed')),
  error_message text,
  chunk_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id text PRIMARY KEY,
  dataset_id text NOT NULL,
  document_id text NOT NULL,
  indexed_document_id text NOT NULL REFERENCES indexed_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  original_name text NOT NULL,
  page_start integer,
  page_end integer,
  section_heading text,
  text text NOT NULL,
  token_count integer NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_chunks_dataset_id_idx
  ON document_chunks(dataset_id);

CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx
  ON document_chunks(document_id);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

Notes:

- `text-embedding-3-small` returns 1536-dimensional vectors.
- If a different embedding model is chosen, update the vector dimension.
- Keep JSON metadata from Phase 3 for datasets/uploads unless there is a strong reason to migrate it now.

Verification:

- The schema can be applied to the local database.
- `CREATE EXTENSION vector` succeeds.
- Tables exist after running the SQL.

## Step 3: Add Database Client

Goal: Give server-side code a small typed way to query Postgres.

Implementation notes:

- Add the minimal database dependency needed to connect to Postgres.
- Prefer a small helper around `pg` unless the project already uses an ORM.
- Do not introduce a large ORM just for this phase.
- Read `DATABASE_URL` from environment variables.
- Keep the client in `lib/db/client.ts`.

Suggested shape:

```typescript
export async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  // execute parameterized query and return rows
}
```

Verification:

- Server-side code can run `SELECT 1`.
- Missing `DATABASE_URL` returns a clear error.

## Step 4: Add PDF Text Extraction

Goal: Extract text from each uploaded PDF file.

Implementation notes:

- Add one PDF extraction library only if needed.
- Prefer the simplest library that works for text-based PDFs.
- OCR is out of scope.
- The extractor should return text with page metadata when possible.

Recommended return type:

```typescript
export type ExtractedPdfPage = {
  pageNumber: number;
  text: string;
};

export type ExtractedPdf = {
  pages: ExtractedPdfPage[];
  pageCount: number;
};
```

If the chosen PDF library cannot reliably preserve pages, still return extracted text and set `page_start` / `page_end` to `null`. Do not block Phase 4 on perfect extraction.

Verification:

- A text-based PDF uploaded in Phase 3 can be extracted.
- Empty or unreadable PDFs fail gracefully and mark the document as `failed`.

## Step 5: Add Chunking

Goal: Split extracted PDF text into chunks that are useful for retrieval.

Implementation notes:

- Chunk by pages first, then split long page text into smaller chunks.
- Use a simple approximate token counter for MVP.
- A character-based approximation is acceptable at this stage.
- Recommended target: around 800-1200 tokens per chunk.
- Recommended overlap: around 100-200 tokens.
- Preserve page start/page end on every chunk.
- Keep chunk text clean: trim repeated whitespace and ignore empty chunks.

Recommended chunk type:

```typescript
export type DocumentChunkInput = {
  id: string;
  datasetId: string;
  documentId: string;
  chunkIndex: number;
  originalName: string;
  pageStart: number | null;
  pageEnd: number | null;
  sectionHeading: string | null;
  text: string;
  tokenCount: number;
};
```

Verification:

- A PDF creates multiple non-empty chunks.
- Every chunk has dataset id, document id, chunk index, source file name, and page metadata where available.

## Step 6: Generate Embeddings

Goal: Generate a vector for each chunk.

Implementation notes:

- Use `OPENAI_API_KEY`.
- Default to `text-embedding-3-small`.
- Use `fetch` directly unless an OpenAI SDK is already installed or clearly needed.
- Batch embeddings where possible, but keep the code simple.
- Handle provider/API errors and mark affected documents as `failed`.
- Do not embed empty chunks.

Verification:

- Given a list of chunk texts, the embedding function returns one vector per chunk.
- Vector length matches the database schema dimension.
- Missing `OPENAI_API_KEY` returns a clear error.

## Step 7: Implement Document Indexing

Goal: Index one uploaded document from local storage into Postgres.

Implementation flow:

```text
document metadata from Phase 3
  -> set document status to indexing
  -> delete old chunks for this document, if any
  -> extract PDF text
  -> create chunks
  -> generate embeddings
  -> insert indexed document row
  -> insert chunk rows with embeddings
  -> set document status to indexed
```

Failure behavior:

```text
if any step fails:
  -> store error message in indexed_documents if possible
  -> set document status to failed
  -> do not leave document stuck as indexing
```

Important details:

- Re-indexing a document should replace old chunks for that document.
- The indexing process should not delete the original PDF file.
- Parameterize all SQL queries.
- Keep the implementation idempotent enough that clicking "Index dataset" twice does not duplicate chunks.

Verification:

- Indexing one PDF inserts rows into `indexed_documents`.
- Indexing one PDF inserts rows into `document_chunks`.
- Re-indexing the same PDF replaces old chunks instead of duplicating them.
- Document status changes from `not_indexed` to `indexing` to `indexed`.

## Step 8: Implement Dataset Indexing

Goal: Replace the dummy dataset index route with real indexing for all documents in a dataset.

Update:

```text
app/api/datasets/[datasetId]/index/route.ts
```

Expected behavior:

- Validate that the dataset exists.
- Load documents for the dataset from the existing metadata store.
- If there are no documents, return a clear message.
- Create an `index_runs` row.
- Index each document in the dataset.
- Continue indexing other documents if one document fails.
- Return a summary.

Suggested response:

```json
{
  "ok": true,
  "datasetId": "dataset_...",
  "indexed": 3,
  "failed": 1,
  "skipped": 0
}
```

Verification:

- Clicking "Index dataset" in `/documents/[datasetId]` triggers real indexing.
- The UI still works after indexing.
- Failed documents show `failed`.
- Successful documents show `indexed`.

## Step 9: Add Basic Vector Search

Goal: Prove that indexed chunks can be retrieved before building the final agent.

Add `lib/retrieval/vectorSearch.ts`.

Suggested function:

```typescript
export async function searchIndexedChunks(input: {
  datasetId: string;
  query: string;
  limit?: number;
}): Promise<SearchResult[]> {
  // embed query
  // run pgvector cosine search
  // return top chunks with source metadata
}
```

Suggested result:

```typescript
export type SearchResult = {
  chunkId: string;
  datasetId: string;
  documentId: string;
  originalName: string;
  pageStart: number | null;
  pageEnd: number | null;
  text: string;
  score: number;
};
```

SQL shape:

```sql
SELECT
  id,
  dataset_id,
  document_id,
  original_name,
  page_start,
  page_end,
  text,
  1 - (embedding <=> $1::vector) AS score
FROM document_chunks
WHERE dataset_id = $2
ORDER BY embedding <=> $1::vector
LIMIT $3;
```

Verification:

- Searching with a phrase from an indexed PDF returns a relevant chunk.
- Results include document id, file name, page metadata, chunk id, text, and score.
- Search is scoped to the selected dataset.

## Step 10: Add Optional Test Retrieval Route

Goal: Make retrieval easy to test without Phase 5 chat integration.

Optional route:

```text
POST /api/retrieval/test-search
```

Suggested request:

```json
{
  "datasetId": "dataset_...",
  "query": "what is noxiustoxin?",
  "limit": 5
}
```

Suggested response:

```json
{
  "results": [
    {
      "chunkId": "chunk_...",
      "documentId": "doc_...",
      "originalName": "paper.pdf",
      "pageStart": 1,
      "pageEnd": 1,
      "score": 0.82,
      "text": "..."
    }
  ]
}
```

Verification:

- The route returns relevant chunks after indexing.
- The route returns an empty result list if no chunks exist.
- The route does not generate final LLM answers.

## Step 11: Update UI Status Behavior

Goal: Keep the `/documents` UI minimal but truthful.

Implementation notes:

- The existing document status display should keep using:
  - `not_indexed`
  - `indexing`
  - `indexed`
  - `failed`
- Disable or show loading state on the "Index dataset" button while indexing if easy.
- After indexing completes, refresh the dataset/document state.
- Do not build a complex progress UI in Phase 4.

Verification:

- User can see which documents are indexed.
- User can see failed documents.
- User can click index again after a failure.

## Step 12: Add Documentation

Goal: Make local setup clear for the next implementation phase.

Add or update project documentation with:

```text
1. Copy .env.example to .env.local.
2. Fill OPENAI_API_KEY.
3. Start database:
   docker compose -f docker-compose-db.yml up -d
4. Apply schema:
   psql "$DATABASE_URL" -f db/schema.sql
5. Start app:
   npm run dev
6. Upload PDFs in /documents.
7. Click Index dataset.
8. Test retrieval with the test-search API route or server helper.
```

If the implementation adds an npm script for applying the schema, document that instead.

## Error Handling Requirements

The implementation should handle:

- Missing `DATABASE_URL`.
- Database unavailable.
- Missing `OPENAI_API_KEY`.
- PDF extraction failure.
- Empty extracted PDF text.
- Embedding API failure.
- Duplicate/re-indexed documents.
- User clicks index on an empty dataset.

Documents should never stay stuck in `indexing` after an error.

## Dependency Guidance

Keep dependencies minimal.

Likely acceptable if needed:

- A Postgres client such as `pg`.
- One PDF text extraction library.

Avoid in Phase 4:

- Full ORM unless already installed.
- LangChain or LlamaIndex.
- Graph libraries.
- Queue systems.
- Reranking services.
- Extra UI libraries.

Use normal TypeScript/Next.js where possible. If adding a package, it should have a clear purpose in this phase.

## Acceptance Criteria

Phase 4 is complete when:

- `docker-compose-db.yml` starts a local Postgres database with `pgvector`.
- The database schema can be applied successfully.
- The app can connect to the database from server-side code.
- Clicking "Index dataset" processes uploaded PDFs.
- PDF text is extracted into chunks.
- Chunks are embedded and stored in Postgres.
- Source metadata is stored with every chunk.
- Document statuses update correctly.
- Re-indexing does not duplicate chunks.
- A basic vector search returns relevant chunks from an indexed dataset.
- No final document-answering agent has been built yet.

## Phase 5 Handoff

Phase 5 should use the retrieval foundation from Phase 4 to build the actual document-grounded assistant.

Phase 5 can add:

- Deterministic RAG answer endpoint.
- Hybrid search with keyword search.
- Reranking.
- Citation validation.
- Claude Code-style tool loop.
- Streaming source events into the right chat panel.

Do not add those in Phase 4 unless the user explicitly expands the scope.

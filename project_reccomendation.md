# Project Recommendation: Claude Code-Inspired Document Chat Agent

## Phase 1 Goal

This document analyzes which ideas from Claude Code can be reused for a PDF knowledge-base chat application, and recommends an implementation direction for the future agent.

The target product is not a coding agent. It is a document-grounded assistant where users upload PDFs into datasets, then ask questions and receive answers based only on those datasets, with citations back to the source documents.

## Short Recommendation

Build the project as a document-grounded agent with a small Claude Code-inspired tool loop.

The first serious version should use hybrid RAG, not pure embeddings and not full GraphRAG:

- Use structured PDF extraction and chunking.
- Store document metadata, chunks, and embeddings in Postgres with `pgvector`.
- Add keyword/BM25-style search alongside vector search.
- Add reranking before final answer generation.
- Force the final answer step to cite source chunks and refuse when evidence is missing.
- Add GraphRAG later only if the documents contain many cross-references, entities, timelines, contracts, regulations, or relationships that normal chunk retrieval cannot answer well.

The best Claude Code inspiration is architectural, not visual: streaming-first execution, typed tools, a loop that lets the model choose tools, strict context management, source-grounded outputs, and good transcript/state persistence.

## What Claude Code Does Well

The inspiration folder describes Claude Code as a streaming, tool-using agent. The most useful design patterns are:

1. Async generator agent loop

Claude Code uses an async generator as the core execution loop. The model streams text and tool calls; the runtime executes tools and feeds results back until the model ends the turn.

For this project, use the same shape:

```text
user question
  -> agent loop
  -> model decides whether it needs search tools
  -> tools retrieve chunks/documents
  -> model reads retrieved evidence
  -> model may search again
  -> final answer with citations
```

This is better than a single "retrieve top 5 chunks and answer" call because the agent can refine the search if the first retrieval is weak.

2. Tool registry

Claude Code treats capabilities as tools with schemas, validation, permission checks, and execution logic.

For the document agent, define a small initial tool set:

- `search_dataset`: hybrid search across chunks in the selected dataset.
- `read_chunk`: fetch exact chunk text and metadata by chunk id.
- `read_document_outline`: get title, page list, headings, and extracted structure for a document.
- `list_dataset_documents`: inspect which files are available.
- `answer_with_sources`: final structured answer tool or final response validator.

Do not expose too many tools at first. A narrow tool set makes the agent easier to test and keeps outputs grounded.

3. Streaming-first UI and API

Claude Code streams intermediate events, not just final text. This is important for trust.

For the PDF chat app, stream:

- The assistant's answer text.
- Search status, such as "Searching dataset".
- Source discovery events, such as document names or pages found.
- Final citations.

The chat UI can stay minimal, but the backend should be designed around streamed events from the start.

4. Context management

Claude Code aggressively manages context through token budgets, compaction, and tool-result truncation.

For document chat, this matters even more because PDFs can be huge. The agent should never put full documents into the prompt. It should:

- Retrieve small chunks.
- Cap the number of chunks per model call.
- Summarize or discard old retrieval results in long conversations.
- Keep conversation history separate from source evidence.
- Re-retrieve evidence for each important answer instead of trusting old chat memory.

5. MVP safety pipeline

Claude Code validates tools before execution and has several permission layers. For this project, the MVP does not need that level of permissions.

MVP assumptions:

- The app runs locally on one machine.
- There is one user.
- Chat can access all indexed documents.
- Datasets are for organization, not security boundaries.
- No advanced approval flow is needed for retrieval tools.

The useful MVP safety checks are simple:

- File upload/indexing should validate file type and size.
- The retrieval tools should only read from the local indexed document store.
- The agent should not answer from general model knowledge when the dataset lacks evidence.
- The final response should include "I could not find this in the selected documents" when retrieval is insufficient.

Advanced permissions can be added later if the app becomes multi-user, remote-hosted, or connected to external storage.

6. Memory

Claude Code does use a memory system, including `MEMORY.md`-style files in a memory directory. The architecture notes describe this as persistent memory for user preferences, project context, feedback, and ongoing work notes. It is not the same thing as the conversation history and it is not the same thing as a document index.

For this project, memory is useful, but it should not be used as the knowledge base.

Use memory for:

- User preferences, such as preferred answer length or citation style.
- App behavior preferences, such as "always answer in Danish" or "prefer bullet summaries".
- Long-running project notes, such as indexing settings or chosen model/provider.
- Conversation summaries if chats become long.

Do not use memory for:

- PDF content.
- Facts extracted from documents that should be cited.
- Replacing retrieval.
- Answering without sources.

The knowledge base should remain the indexed documents: chunks, embeddings, metadata, and citations. Memory can help personalize the assistant, but document answers should always come from retrieval.

For the MVP, memory can be very small:

```text
local app settings
  + selected provider/model
  + optional user answer preferences
  + conversation history
```

Later, a `MEMORY.md`-like file could be added as a simple local profile for assistant preferences. It should be injected into the system prompt as behavioral context, while retrieved document chunks remain the only factual evidence for answers.

7. Transcript and observability

Claude Code records sessions and tool activity. This is very useful for debugging agent quality.

For this project, store:

- User question.
- Search queries generated by the agent.
- Retrieved chunk ids and scores.
- Final answer.
- Source citations.
- Whether the answer was refused due to missing evidence.

This will make it much easier to improve retrieval later.

## What Not To Copy

Some Claude Code systems are too heavy for this project at the beginning:

- Multi-agent/team mode is unnecessary for MVP.
- Full plugin/skill systems are unnecessary.
- Complex permission modes are unnecessary.
- Dataset-level access control is unnecessary for the local single-user MVP.
- Terminal UI concepts do not apply directly to a web app.
- Full hook infrastructure can wait.
- GraphRAG should not be the first indexing strategy.

The project should copy Claude Code's loop and tool architecture, not its whole platform.

## Recommended Agent Architecture

Use a three-layer architecture:

```text
Next.js UI
  -> Chat API route / server action
  -> Agent runtime
  -> Retrieval/indexing services
  -> Postgres + pgvector storage
```

### 1. Agent Runtime

The agent runtime should be a small TypeScript module, separate from the UI. It should expose something like:

```typescript
runDocumentAgent({
  datasetId?, // optional later; MVP can search all indexed documents
  conversationId,
  userMessage,
  model,
  provider,
}): AsyncGenerator<AgentEvent>
```

Recommended event types:

- `message_start`
- `text_delta`
- `tool_call_start`
- `tool_call_result`
- `sources_update`
- `final_answer`
- `error`

This mirrors Claude Code's event-driven design and makes the UI easy to stream.

### 2. Tool Layer

Each tool should have:

- A name.
- A description for the model.
- A Zod input schema.
- A typed result.
- Validation.
- Execution logic.

Initial tools:

```text
search_documents(query, filters?)
read_chunk(chunkId)
read_document_outline(documentId)
list_indexed_documents(filters?)
```

The final answer should be constrained by system prompt and possibly a structured output schema:

```json
{
  "answer": "string",
  "citations": [
    {
      "documentId": "string",
      "documentName": "string",
      "page": 12,
      "chunkId": "string",
      "quote": "string"
    }
  ],
  "confidence": "high | medium | low | not_found"
}
```

### 3. Retrieval Layer

Retrieval should not be one method. Use a pipeline:

1. Query rewriting

The model rewrites the user's question into one or more search queries.

2. Hybrid search

Run vector search and keyword search:

- Vector search finds semantically similar chunks.
- Keyword search catches exact terms, names, identifiers, and page-specific phrases.

3. Reranking

Rerank the combined candidates using a stronger model or a local reranker.

4. Evidence packing

Select the smallest useful set of chunks. Include document name, page, heading, and chunk id with every chunk.

5. Answer generation

The model only sees packed evidence and must cite chunk ids.

6. Verification pass

Optionally add a cheap check that every citation refers to a retrieved chunk and every major claim has support.

## RAG vs Embeddings vs GraphRAG

### Pure Embeddings

Pure embeddings means: chunk documents, embed chunks, retrieve top K, answer.

This is simple but not enough. It can miss exact names, numbers, legal terms, product codes, and short phrases. It also often retrieves chunks that are semantically close but not actually evidential.

Use embeddings, but not alone.

### Standard RAG

Standard RAG means: retrieve relevant chunks and answer from them.

This should be the foundation. It is the best first implementation because it is understandable, testable, and works well for many PDF Q&A cases.

### Hybrid RAG

Hybrid RAG combines vector search with keyword search and reranking.

This is the recommended first serious architecture. It gives better recall than embeddings alone while staying much simpler than GraphRAG.

### GraphRAG

GraphRAG extracts entities and relationships from documents and stores them in a graph. It can answer questions that require connecting facts across many documents.

Do not start here. Add it later if the app needs:

- Relationship-heavy reasoning.
- Entity timelines.
- Cross-document contradiction detection.
- Contract/regulation dependency tracing.
- Questions like "how are these companies connected?" or "what changed over time?"

GraphRAG is powerful but expensive and adds indexing complexity. It should be a later phase, not the base.

## Suggested Indexing Pipeline

When a PDF is uploaded:

1. Store the original file.
2. Extract text and metadata.
3. Preserve page numbers.
4. Detect headings or sections if possible.
5. Chunk text by semantic boundaries, not only fixed token length.
6. Add overlap between chunks.
7. Generate embeddings for each chunk.
8. Store chunks, embeddings, document metadata, and page references.
9. Optionally generate a document outline and short document summary.
10. Mark document indexing status as `indexed` or `failed`.

Recommended chunk metadata:

```text
chunk_id
document_id
dataset_id
document_name
page_start
page_end
section_heading
text
embedding
token_count
created_at
```

For early local development, file storage can be local. For the database, Postgres with `pgvector` is the most practical path because it can store relational metadata and vector indexes together.

## Grounding Rules

The agent's system prompt should include strict rules:

- Answer only from retrieved evidence.
- Cite every factual claim that comes from a document.
- If evidence is missing, say so.
- Do not use training knowledge to fill gaps.
- Do not cite a document unless a retrieved chunk supports the statement.
- Prefer short, direct answers with source references.

The backend should also enforce these rules where possible:

- Reject final answers with no citations unless the answer is a valid refusal.
- Validate citation chunk ids against retrieved chunks.
- Keep retrieval results attached to the answer record.

## Proposed Implementation Roadmap For The Agent

This is not Phase 2 implementation work; it is the recommended future path.

### Step 1: Simple Chat

Build the chat UI and model-provider abstraction. This matches Phase 2.

### Step 2: Documents and Local Storage

Add datasets, PDF upload, and document status. This matches Phase 3.

### Step 3: Indexing Foundation

Add PDF extraction, chunking, and embeddings.

Recommended libraries to evaluate:

- `pdf-parse` or `unpdf` for simple text extraction.
- `pgvector` for vector storage in Postgres.
- OpenAI `text-embedding-3-small` or a similar embedding model.

### Step 4: First RAG Endpoint

Before a full agent loop, implement a deterministic endpoint:

```text
question -> hybrid search -> top chunks -> answer with citations
```

This creates a baseline.

### Step 5: Agent Tool Loop

Then add the Claude Code-style loop:

```text
question
  -> model chooses search_dataset
  -> tool returns evidence
  -> model may call read_chunk or search again
  -> final answer with citations
```

Start with a max of 3 tool rounds to avoid runaway loops.

### Step 6: Evaluation Set

Create test questions for uploaded PDFs:

- answer exists in one chunk
- answer requires multiple chunks
- answer does not exist
- answer requires exact number/date/name
- answer asks for sources

Track whether answers are correct, cited, and properly refused.

### Step 7: Improve Retrieval

Add reranking, query rewriting, document summaries, and better chunking.

### Step 8: Consider GraphRAG

Only add GraphRAG after hybrid RAG has clear failures that graph structure would solve.

## Best Claude Code Ideas To Reuse Directly

1. `QueryEngine` concept

Create one agent engine per chat request/session. It owns messages, selected dataset, tool context, abort signal, model settings, and event stream.

2. Async generator loop

Use `async function*` for the agent so the UI can stream progress and the backend can cancel cleanly.

3. Tool interface

Use typed tools with Zod schemas. Model-generated tool inputs will be wrong sometimes, so validation is essential.

4. Tool result budgeting

Never send unlimited retrieval results to the model. Cap tool result size and return previews with chunk ids.

5. Source-aware context

Every retrieved chunk should carry source metadata. Do not let plain text chunks lose document/page identity.

6. Transcript logging

Store the agent trace because RAG bugs are often invisible without seeing search queries and retrieved chunks.

7. Progressive complexity

Claude Code has many advanced systems, but they are layered. This project should do the same: simple RAG first, then agent loop, then better indexing, then maybe GraphRAG.

## Suggested Folder Design Later

When implementation begins, consider this structure:

```text
src/
  app/
    chat/
    documents/
    api/
      chat/
      documents/
      upload/
      index/
  agent/
    runDocumentAgent.ts
    events.ts
    prompts.ts
    tools/
      searchDataset.ts
      readChunk.ts
      listDatasetDocuments.ts
  retrieval/
    chunking.ts
    embeddings.ts
    hybridSearch.ts
    rerank.ts
    evidencePacking.ts
  documents/
    pdfExtract.ts
    indexDocument.ts
    storage.ts
  db/
    schema.ts
    client.ts
```

## Main Risks

1. Hallucinated answers

Mitigation: strict grounding prompt, citation validation, refusal behavior, and answer verification.

2. Bad PDF extraction

Mitigation: preserve page references, store extraction diagnostics, and later support OCR for scanned PDFs.

3. Weak retrieval

Mitigation: hybrid search, reranking, query rewriting, and evaluation questions.

4. Context overload

Mitigation: chunk limits, tool result budgets, and conversation compaction.

5. Overbuilding the agent

Mitigation: start with deterministic RAG, then add the loop only after baseline retrieval works.

## Final Recommendation

The best path is:

```text
Next.js app
  + provider-based chat
  + datasets/documents
  + local file storage first
  + Postgres/pgvector indexing
  + hybrid RAG retrieval
  + Claude Code-style async tool loop
  + citation validation
```

Do not begin with GraphRAG. Begin with hybrid RAG and a small tool-using agent. This gives the project the most important Claude Code strengths while keeping the system understandable and buildable.

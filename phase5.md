# Phase 5 Plan: Document-Grounded Chat Agent

## Phase Objective

Phase 5 turns the Phase 4 indexing and retrieval foundation into the first real document chat assistant.

The goal is to let a user choose or use a dataset, ask questions in `/chat`, and receive answers based only on indexed documents. Answers must include source citations and must refuse when the selected documents do not contain enough evidence.

This phase should move the project toward the final product vision:

```text
uploaded PDFs
  -> indexed chunks and embeddings
  -> retrieval tools
  -> document-grounded agent
  -> answer with citations
```

Do not build GraphRAG in Phase 5. The recommendation from `project_reccomendation.md` is to start with standard RAG, improve it into hybrid RAG, then add a small Claude Code-inspired tool loop once the deterministic baseline works.

## Findings To Carry Forward

From `project_reccomendation.md`, Phase 5 should follow these ideas:

- Build a document-grounded assistant, not a general chatbot.
- Use hybrid RAG before considering GraphRAG.
- Keep PDF content in the indexed document store, not in memory or chat history.
- Never put full documents into the prompt.
- Retrieve small chunks with source metadata.
- Force final answers to cite retrieved chunks.
- Refuse when evidence is missing.
- Use Claude Code as architectural inspiration: typed tools, streaming events, context limits, transcript logging, and a small agent loop.
- Keep the first tool set narrow: search documents, read chunks, list indexed documents, and possibly read document outline later.
- Start with a deterministic RAG endpoint before building the full agent loop.

## Phase 5 Output

By the end of Phase 5, the app should have:

- A chat flow that can answer questions from indexed documents.
- Dataset-aware retrieval.
- Citations with document name, page metadata, and chunk id.
- A strict grounding prompt.
- Citation validation on the backend.
- A refusal path for missing evidence.
- Basic streaming events for answer text and discovered sources.
- A small Claude Code-style tool loop, after the baseline RAG endpoint works.

## Suggested Project Structure

Adjust names to match the current codebase, but keep agent code outside React components.

```text
app/
  api/
    chat/
      route.ts
    datasets/
      [datasetId]/
        ask/
          route.ts

lib/
  agent/
    events.ts
    prompts.ts
    runDocumentAgent.ts
    transcript.ts
    tools/
      index.ts
      searchDocuments.ts
      readChunk.ts
      listIndexedDocuments.ts

  retrieval/
    answerFromEvidence.ts
    evidencePacking.ts
    hybridSearch.ts
    validateCitations.ts
```

## Step 0: Verify Phase 4 Handoff

Before implementing the agent, verify that Phase 4 works end to end.

Implementation tasks:

- Start local Postgres with `docker-compose-db.yml`.
- Apply `db/schema.sql`.
- Upload at least one PDF.
- Index the dataset from `/documents`.
- Run the existing retrieval test endpoint or function.
- Confirm returned chunks include dataset id, document id, document name, page metadata, chunk id, text, and score.

Acceptance criteria:

- At least one indexed dataset returns relevant chunks for a query.
- Re-indexing does not duplicate chunks.
- Failed indexing does not leave documents stuck in `indexing`.

## Step 1: Add Dataset Selection For Chat

The chat page needs to know which dataset should ground the answer.

Implementation tasks:

- Add a minimal dataset selector in the chat UI, likely in the left or right panel.
- Load available datasets from existing document metadata.
- Save the selected dataset in local storage with the existing chat settings.
- Prevent document-grounded questions when no dataset is selected, or clearly show that the chat is using no dataset.

Acceptance criteria:

- User can select a dataset before asking.
- Selected dataset persists after refresh.
- Chat requests include `datasetId`.

## Step 2: Build A Deterministic RAG Answer Endpoint

Start with a simple, testable endpoint before adding an agent loop.

Recommended flow:

```text
question + datasetId
  -> vector search
  -> pack top chunks as evidence
  -> answer with citations
  -> validate citations
  -> return answer
```

Implementation tasks:

- Add an API route such as `POST /api/datasets/[datasetId]/ask`.
- Reuse the Phase 4 retrieval function.
- Build an `evidencePacking` helper that limits chunk count and prompt size.
- Add a strict system prompt:
  - Answer only from retrieved evidence.
  - Cite factual claims.
  - Do not use training knowledge to fill gaps.
  - If evidence is missing, say that the answer could not be found in the selected documents.
- Support the existing OpenAI/OpenRouter provider settings where possible.
- Return structured JSON with answer, citations, confidence, and retrieved chunk ids.

Acceptance criteria:

- A question with evidence returns an answer and citations.
- A question without evidence returns a refusal.
- The endpoint does not send full PDF text to the model.
- The endpoint works without changing the indexing pipeline.

## Step 3: Add Citation Validation

The backend should not trust the model blindly.

Implementation tasks:

- Add `validateCitations`.
- Check that every citation chunk id exists in the retrieved evidence for that answer.
- Check that citations include document id, document name, page if available, and chunk id.
- Reject or rewrite responses that cite unknown chunks.
- Allow no citations only when the response is a valid refusal.

Acceptance criteria:

- Model output with fake chunk ids is rejected or converted to an error/refusal.
- Valid cited answers pass.
- Refusals can pass without citations.

## Step 4: Connect The Chat UI To Document Answers

Once the deterministic endpoint works, connect it to `/chat`.

Implementation tasks:

- Send user messages to the document answer endpoint when a dataset is selected.
- Render citations below or beside the assistant answer.
- Show source metadata in a compact form: document name, page, chunk id.
- Keep the existing direct model chat available only if that behavior still makes sense, but make document-grounded chat the main project path.

Acceptance criteria:

- User can ask a question in `/chat` and get a cited document answer.
- Citations are visible in the UI.
- Missing evidence produces a clear refusal instead of a hallucinated answer.

## Step 5: Add Basic Hybrid Search

Phase 4 may already have vector search. Phase 5 should add keyword search to improve exact-match recall.

Recommended flow:

```text
question
  -> vector search candidates
  -> keyword search candidates
  -> merge and deduplicate
  -> score/sort
  -> evidence packing
```

Implementation tasks:

- Add a keyword search function over stored chunk text.
- Use Postgres full-text search if available, or a simple SQL text search for the MVP.
- Merge keyword and vector results.
- Deduplicate by chunk id.
- Preserve scores and retrieval method metadata for debugging.

Acceptance criteria:

- Exact names, numbers, and phrases can be found even when vector search is weak.
- Hybrid search still returns source metadata.
- The deterministic RAG endpoint uses hybrid search.

## Step 6: Add Streaming Events

Claude Code's useful pattern is streaming progress, not just final output.

Recommended event types:

```text
message_start
search_start
sources_update
text_delta
final_answer
error
```

Implementation tasks:

- Update the chat endpoint or add a new route that streams events.
- Stream search status before the final model answer.
- Stream answer text as it is generated if the selected provider supports it.
- Stream final citations at the end.
- Keep a non-streaming fallback if needed for easier testing.

Acceptance criteria:

- UI can show "Searching documents" or similar progress.
- Answer text can appear incrementally.
- Sources are available before or with the final answer.

## Step 7: Add A Small Claude Code-Style Tool Layer

After the deterministic RAG path works, introduce typed tools. Keep the first version small.

Initial tools:

```text
search_documents(query, datasetId)
read_chunk(chunkId)
list_indexed_documents(datasetId)
```

Implementation tasks:

- Define a tool interface with name, description, input schema, and execute function.
- Validate tool input before execution.
- Cap tool result size.
- Ensure tools can only read indexed document data.
- Keep source metadata attached to every tool result.

Acceptance criteria:

- Each tool can be called directly in tests or debug code.
- Invalid tool input fails cleanly.
- Tool results are small enough to safely send to the model.

## Step 8: Build The Agent Loop

Now add the actual agent runtime inspired by Claude Code.

Recommended shape:

```typescript
runDocumentAgent({
  datasetId,
  conversationId,
  userMessage,
  provider,
  model,
}): AsyncGenerator<AgentEvent>
```

Recommended loop:

```text
user question
  -> model decides whether to search
  -> execute search_documents
  -> optionally read_chunk or search again
  -> final answer with citations
  -> validate citations
```

Implementation tasks:

- Add `runDocumentAgent`.
- Use an async generator that yields agent events.
- Limit the loop to 2-3 tool rounds for MVP.
- Keep a strict grounding prompt.
- Attach retrieved evidence to the final answer validation step.
- Refuse if the loop cannot find enough evidence.

Acceptance criteria:

- Agent can perform at least one search before answering.
- Agent can search again with a refined query when first results are weak.
- Agent stops after the max tool round limit.
- Final answer is still validated against retrieved chunks.

## Step 9: Add Transcript Logging For Debugging

RAG failures are hard to debug without traces.

Implementation tasks:

- Store or log the user question.
- Store generated search queries.
- Store retrieved chunk ids, document ids, scores, and retrieval method.
- Store final answer and citations.
- Store whether the answer was refused.
- Keep logs local and simple for now.

Acceptance criteria:

- A developer can inspect why a specific answer was produced.
- Logs do not store API keys.
- Logs do not replace the document index or citation system.

## Step 10: Create A Small Evaluation Set

Before improving the agent further, create repeatable questions.

Implementation tasks:

- Add a small local evaluation file or markdown checklist.
- Include questions where:
  - The answer exists in one chunk.
  - The answer requires multiple chunks.
  - The answer does not exist.
  - The answer depends on an exact number, date, term, or name.
  - The user asks for sources.
- Record expected behavior and source documents.

Acceptance criteria:

- The same questions can be run after future retrieval changes.
- The evaluation checks correctness, citations, and refusal behavior.

## Out Of Scope For Phase 5

Do not include these unless explicitly requested:

- GraphRAG.
- Multi-user auth.
- Remote storage.
- Advanced permissions.
- Complex memory system.
- Full plugin/skill system.
- Large-scale evaluation framework.
- Production deployment.

## Phase 5 Completion Criteria

Phase 5 is complete when:

- `/chat` can answer questions from a selected indexed dataset.
- Answers are based only on retrieved document chunks.
- Answers include citations with source metadata.
- Unsupported questions are refused.
- Citation chunk ids are validated by the backend.
- Hybrid retrieval is available.
- The UI can show sources and basic streaming progress.
- A small tool-based agent loop works with a strict round limit.
- Basic transcript/debug logging exists.
- A small evaluation checklist exists for future phases.

## Suggested Phase 6 Direction

After Phase 5, improve quality rather than adding GraphRAG immediately:

- Add reranking.
- Add query rewriting.
- Improve document outlines and summaries.
- Add better evidence packing.
- Add answer verification.
- Expand the evaluation set.
- Consider GraphRAG only after hybrid RAG has clear failures that graph structure would solve.

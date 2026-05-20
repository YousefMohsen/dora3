# Phase 3 Plan: Local Documents And Datasets

## Phase Objective

Phase 3 adds the first real document-management layer to the app. Users should be able to open `/documents`, create datasets, upload PDF files into a dataset, view documents, delete selected documents, and see a basic indexed/not-indexed status.

This phase still does not implement real PDF parsing, embeddings, vector search, hybrid RAG, GraphRAG, or the final agent loop. It should create the local document storage and metadata foundation that later phases can index and retrieve from.

The Phase 3 output should be:

```text
A working /documents screen where a local single user can:
create datasets,
open a dataset,
upload PDF files,
see documents and dummy index status,
delete selected documents,
and click a dummy "index dataset" button.
```

## Context From Earlier Phases

Phase 1 recommended that the final product should become a document-grounded assistant with:

- Local single-user MVP assumptions.
- Documents as the source of truth for factual answers.
- Future hybrid RAG over indexed PDF chunks.
- Future citations tied to document/page/chunk metadata.
- A Claude Code-inspired streaming agent/tool loop later.

Phase 2 creates the Next.js app shell, `/chat`, `/documents`, local settings, provider selection, and direct model chat.

Phase 3 should build the document side without jumping ahead into the final agent. The important thing is to create clean local document state and file storage so later indexing can be added without rewriting the documents UI.

## Scope

In scope:

- `/documents` dataset list screen.
- Create dataset.
- Open a dataset detail screen.
- Upload PDF files to a dataset.
- Store uploaded PDFs locally in the project/runtime storage area.
- Store document metadata locally.
- Show documents in a dataset.
- Select documents with checkboxes.
- Delete selected documents.
- Show dummy index status per document.
- Add an "index dataset" button that logs or displays a dummy action.
- Add navigation from `/chat` sidebar to `/documents` if it is not already present.

Out of scope:

- Real PDF text extraction.
- OCR.
- Chunking.
- Embeddings.
- Postgres or vector database.
- Hybrid search.
- RAG answer generation.
- Claude Code-style agent tools.
- Real indexing.
- Multi-user auth.
- Remote buckets or Google Drive.

## MVP Assumptions

The MVP is local and single-user:

- No authentication.
- No dataset-level permissions.
- The chat will eventually be able to access all indexed documents.
- Datasets are organizational folders, not security boundaries.
- Local file storage is acceptable for now.
- Metadata can use a simple local JSON file or another simple local persistence strategy.

## Design Direction

Use a storage boundary now so later phases can replace the implementation.

Recommended conceptual flow:

```text
/documents UI
  -> document API routes
  -> local document service
  -> local metadata store
  -> local uploaded files folder
```

Later phases can extend this into:

```text
local uploaded PDFs
  -> PDF extraction
  -> chunks
  -> embeddings
  -> Postgres/pgvector
  -> retrieval tools
  -> document-grounded chat
```

Do not mix file-system logic directly into React components. Keep upload, delete, metadata reads, and metadata writes behind API routes or server-side helpers.

## Recommended Project Structure

Adjust to match the current app structure, but keep the responsibilities separate:

```text
app/
  documents/
    page.tsx
    [datasetId]/
      page.tsx
  api/
    datasets/
      route.ts
    datasets/
      [datasetId]/
        route.ts
    datasets/
      [datasetId]/
        documents/
          route.ts
    datasets/
      [datasetId]/
        index/
          route.ts

components/
  documents/
    DatasetList.tsx
    CreateDatasetDialog.tsx
    DatasetDetail.tsx
    DocumentUpload.tsx
    DocumentTable.tsx

lib/
  documents/
    types.ts
    storage.ts
    metadataStore.ts
    validation.ts
```

Recommended local storage area:

```text
data/
  documents/
    metadata.json
    uploads/
      <datasetId>/
        <documentId>-<safe-file-name>.pdf
```

Important: make sure local uploaded files and generated metadata are ignored by git.

## Data Model

Use simple types that can later map to database tables:

```typescript
type Dataset = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type DocumentStatus = "not_indexed" | "indexing" | "indexed" | "failed";

type DocumentRecord = {
  id: string;
  datasetId: string;
  originalName: string;
  storedName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
};
```

For Phase 3, new uploads can default to:

```text
status = "not_indexed"
```

The dummy index button can temporarily set documents to `indexed`, or simply log a message. If it changes status, make it clear this is fake indexing.

## Step 1: Verify Phase 2 Navigation And Routes

Goal: Confirm the app already has `/documents` and navigation from chat.

Implementation notes:

- Check whether `/documents` exists.
- Check whether the chat sidebar has a documents button/link.
- If missing, add a simple button/link above settings that routes to `/documents`.

Verification:

- From `/chat`, clicking Documents opens `/documents`.
- `/documents` loads without errors.
- Existing chat behavior still works.

## Step 2: Add Document Types

Goal: Define stable TypeScript types for datasets and documents.

Implementation notes:

- Create or update `lib/documents/types.ts`.
- Add `Dataset`, `DocumentRecord`, and `DocumentStatus`.
- Add API response types if useful.

Verification:

- Types are imported by document UI/API code.
- No core document state uses `any`.

## Step 3: Add Local Metadata Store

Goal: Persist dataset/document metadata locally.

Implementation notes:

- Use a JSON file for MVP metadata, for example `data/documents/metadata.json`.
- Create helper functions for:
  - `listDatasets()`
  - `createDataset(name)`
  - `getDataset(datasetId)`
  - `listDocuments(datasetId)`
  - `addDocument(record)`
  - `deleteDocuments(datasetId, documentIds)`
  - `updateDocumentStatus(datasetId, documentIds, status)`
- Ensure the metadata file/folder is created if missing.
- Keep file operations server-side only.

Verification:

- Metadata file is created automatically.
- Creating a dataset persists after restarting the dev server.
- Listing datasets returns stored data.

## Step 4: Add Local File Storage Helpers

Goal: Save uploaded PDF files locally in a predictable folder.

Implementation notes:

- Store files under `data/documents/uploads/<datasetId>/`.
- Generate a unique document id.
- Sanitize original file names before using them in stored file names.
- Store the original file name in metadata.
- Keep the stored file path in metadata.

Validation:

- Only allow PDFs for now.
- Reject empty files.
- Add a reasonable size limit for local MVP uploads.

Verification:

- Upload helper writes a file to the dataset upload folder.
- File names are safe.
- Invalid file types are rejected.

## Step 5: Add `.gitignore` Entries For Local Documents

Goal: Prevent uploaded PDFs and generated metadata from being committed.

Implementation notes:

- Add ignore rules for local document data, for example:

```text
data/documents/
```

- Keep `.env` ignored as well.

Verification:

- `git status` does not show uploaded PDFs or local metadata after manual upload tests.

## Step 6: Implement Dataset API Routes

Goal: Provide server endpoints for listing and creating datasets.

Suggested routes:

```text
GET /api/datasets
POST /api/datasets
GET /api/datasets/:datasetId
```

Implementation notes:

- `GET /api/datasets` returns all datasets.
- `POST /api/datasets` creates a dataset with a name.
- Validate dataset name:
  - Required.
  - Trim whitespace.
  - Reject very long names.
- Return clear errors for invalid input.

Verification:

- API can list an empty dataset list.
- API can create a dataset.
- New dataset appears in list response.
- Invalid names return readable errors.

## Step 7: Build Dataset List Screen

Goal: Let the user view and create datasets from `/documents`.

Implementation notes:

- Render all datasets.
- Add a "Create dataset" button.
- Allow entering a dataset name.
- Newly created datasets appear immediately.
- Clicking a dataset opens `/documents/<datasetId>`.

Verification:

- `/documents` shows existing datasets.
- User can create a dataset.
- Refreshing keeps the dataset.
- Clicking a dataset opens the detail page.

## Step 8: Implement Dataset Detail Route

Goal: Show one dataset and its documents.

Implementation notes:

- Route: `/documents/[datasetId]`.
- Show dataset name.
- Show upload control.
- Show "index dataset" button.
- Show table/list of documents.
- Show a back link to `/documents`.

Verification:

- Opening a dataset displays its name.
- Unknown dataset id shows a readable not-found state.
- Empty dataset shows an empty state.

## Step 9: Implement Document Upload API

Goal: Upload PDF files into a dataset.

Suggested route:

```text
POST /api/datasets/:datasetId/documents
```

Implementation notes:

- Accept multipart form data.
- Allow one or multiple PDFs if practical.
- Validate dataset exists.
- Validate each file is a PDF.
- Save the file locally.
- Create a `DocumentRecord` with `status: "not_indexed"`.
- Return created document records.

Verification:

- Uploading a PDF stores the file.
- Metadata record is created.
- The uploaded document appears in the dataset detail page.
- Non-PDF upload is rejected.

## Step 10: Build Document Table

Goal: Show documents in a dataset with selection and status.

Document table should show:

- Checkbox.
- File name.
- Size.
- Status.
- Created/uploaded date.

Implementation notes:

- Status is dummy for now.
- Use readable labels:
  - `not_indexed`: "Not indexed"
  - `indexing`: "Indexing"
  - `indexed`: "Indexed"
  - `failed`: "Failed"

Verification:

- Uploaded documents render in the table.
- Checkboxes can select one or more documents.
- Status is visible for each document.

## Step 11: Implement Delete Selected Documents

Goal: Let users delete selected documents.

Suggested API route:

```text
DELETE /api/datasets/:datasetId/documents
```

Request body:

```json
{
  "documentIds": ["doc_1", "doc_2"]
}
```

Implementation notes:

- Delete metadata records.
- Delete local files from disk.
- If a file is already missing, remove metadata anyway and return a non-fatal warning if useful.
- Disable delete button when no documents are selected.
- Confirm before deleting if easy.

Verification:

- Selecting documents enables delete.
- Clicking delete removes them from UI.
- Refreshing keeps them deleted.
- Files are removed from local storage.

## Step 12: Add Dummy Index Dataset Button

Goal: Add the planned UI hook for future indexing.

Suggested API route:

```text
POST /api/datasets/:datasetId/index
```

Implementation notes:

- For Phase 3, this should not parse PDFs or create embeddings.
- It can:
  - Log `Index dataset clicked`.
  - Return `{ ok: true, message: "Indexing is not implemented yet." }`.
  - Optionally set all documents in the dataset to `indexed` as fake status.
- If statuses are changed, label it clearly in code/comments as dummy behavior.

Recommendation:

Prefer leaving documents as `not_indexed` and showing a toast/message that indexing is not implemented yet. This avoids confusing fake data with real indexing later.

Verification:

- Button exists at the top of dataset detail screen.
- Clicking it returns a visible message or logs to console.
- It does not attempt real indexing.

## Step 13: Keep Chat And Documents Decoupled For Now

Goal: Do not connect documents to chat until the retrieval phase.

Implementation notes:

- Chat should still work as direct OpenAI/OpenRouter chat from Phase 2.
- It should not pretend uploaded documents are searchable yet.
- If the right panel mentions sources, it can say documents are uploaded but not connected to chat until a later phase.

Verification:

- Uploading documents does not break chat.
- Chat does not claim to answer from uploaded PDFs.

## Step 14: Prepare For Future Indexing Metadata

Goal: Add small fields that future phases can use without implementing indexing now.

Implementation notes:

- Keep `status` on every document.
- Consider optional future fields:

```typescript
indexedAt?: string;
indexError?: string;
pageCount?: number;
extractedTextPath?: string;
chunkCount?: number;
```

- Do not fill these unless actually known.

Verification:

- Type model can support future indexing.
- Current UI does not depend on fake future fields.

## Step 15: Update README Or Developer Notes

Goal: Document how Phase 3 local storage works.

Implementation notes:

- Add a short section for:
  - Where uploaded files are stored.
  - That `data/documents/` is local-only and gitignored.
  - That indexing is a dummy placeholder.
  - That documents are not connected to chat yet.

Verification:

- A future agent can understand the local storage design.
- README does not imply RAG is implemented.

## Step 16: Final Phase 3 Verification

Goal: Confirm the documents MVP works.

Run available checks:

```text
npm run lint
npm run typecheck
npm run build
```

If a script does not exist, document which checks were available and run those.

Manual test checklist:

- `/chat` still loads.
- `/documents` loads.
- Documents link from chat works.
- User can create a dataset.
- Dataset persists after refresh/restart.
- User can open a dataset.
- User can upload a PDF.
- Uploaded PDF appears in document table.
- Non-PDF upload is rejected.
- Document status is visible.
- User can select documents.
- User can delete selected documents.
- Deleted documents disappear after refresh.
- Dummy "index dataset" button works without real indexing.
- Uploaded files and metadata are not tracked by git.

## Acceptance Criteria

Phase 3 is done when:

- `/documents` has a dataset list.
- Users can create datasets.
- Users can open a dataset detail page.
- Users can upload PDF files into a dataset.
- Uploaded files are stored locally.
- Document metadata persists locally.
- Documents show status.
- Users can select and delete documents.
- The dataset detail page has an "index dataset" button.
- The index button is explicitly dummy behavior.
- Chat remains functional and separate from documents.
- The implementation leaves a clean path toward real indexing in the next phase.

## Guidance For Future Agents

Implement one step at a time and verify before continuing. Do not add embeddings, vector databases, PDF parsing, RAG, or the final agent loop during Phase 3.

The goal is to create the local document foundation that future phases can build on:

```text
local PDFs
  -> metadata records
  -> future extraction
  -> future chunks
  -> future embeddings
  -> future hybrid RAG
  -> future cited document answers
```

Keep the MVP simple, local, and single-user.

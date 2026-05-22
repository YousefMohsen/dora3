import type { QueryResultRow } from "pg";

import { query } from "@/lib/db/client";

export type IndexedDocumentSummary = {
  id: string;
  documentId: string;
  originalName: string;
  filePath: string;
  contentHash: string | null;
  status: string;
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DocumentChunkSummary = {
  id: string;
  documentId: string;
  originalName: string;
  chunkIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  tokenCount: number;
  textPreview: string;
  embeddingDimensions: number | null;
  createdAt: string;
};

export type IndexRunSummary = {
  id: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DatasetIndexSummary = {
  datasetId: string;
  totals: {
    indexedDocuments: number;
    chunks: number;
    embeddedChunks: number;
  };
  indexedDocuments: IndexedDocumentSummary[];
  chunks: DocumentChunkSummary[];
  indexRuns: IndexRunSummary[];
};

type IndexedDocumentRow = QueryResultRow & {
  id: string;
  document_id: string;
  original_name: string;
  file_path: string;
  content_hash: string | null;
  status: string;
  error_message: string | null;
  chunk_count: number;
  created_at: Date;
  updated_at: Date;
};

type DocumentChunkRow = QueryResultRow & {
  id: string;
  document_id: string;
  original_name: string;
  chunk_index: number;
  page_start: number | null;
  page_end: number | null;
  token_count: number;
  text_preview: string;
  embedding_dimensions: number | null;
  created_at: Date;
};

type IndexRunRow = QueryResultRow & {
  id: string;
  status: string;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
};

type TotalsRow = QueryResultRow & {
  indexed_documents: string;
  chunks: string;
  embedded_chunks: string;
};

export async function getDatasetIndexSummary(
  datasetId: string,
): Promise<DatasetIndexSummary> {
  const [totalsRows, indexedDocumentRows, chunkRows, indexRunRows] =
    await Promise.all([
      query<TotalsRow>(
        `SELECT
           (SELECT count(*) FROM indexed_documents WHERE dataset_id = $1) AS indexed_documents,
           (SELECT count(*) FROM document_chunks WHERE dataset_id = $1) AS chunks,
           (SELECT count(*) FROM document_chunks WHERE dataset_id = $1 AND embedding IS NOT NULL) AS embedded_chunks`,
        [datasetId],
      ),
      query<IndexedDocumentRow>(
        `SELECT
           id,
           document_id,
           original_name,
           file_path,
           content_hash,
           status,
           error_message,
           chunk_count,
           created_at,
           updated_at
         FROM indexed_documents
         WHERE dataset_id = $1
         ORDER BY updated_at DESC`,
        [datasetId],
      ),
      query<DocumentChunkRow>(
        `SELECT
           id,
           document_id,
           original_name,
           chunk_index,
           page_start,
           page_end,
           token_count,
           left(text, 360) AS text_preview,
           vector_dims(embedding) AS embedding_dimensions,
           created_at
         FROM document_chunks
         WHERE dataset_id = $1
         ORDER BY original_name ASC, chunk_index ASC
         LIMIT 25`,
        [datasetId],
      ),
      query<IndexRunRow>(
        `SELECT id, status, error_message, created_at, updated_at
         FROM index_runs
         WHERE dataset_id = $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [datasetId],
      ),
    ]);

  const totals = totalsRows[0];

  return {
    chunks: chunkRows.map((row) => ({
      chunkIndex: row.chunk_index,
      createdAt: row.created_at.toISOString(),
      documentId: row.document_id,
      embeddingDimensions: row.embedding_dimensions,
      id: row.id,
      originalName: row.original_name,
      pageEnd: row.page_end,
      pageStart: row.page_start,
      textPreview: row.text_preview,
      tokenCount: row.token_count,
    })),
    datasetId,
    indexRuns: indexRunRows.map((row) => ({
      createdAt: row.created_at.toISOString(),
      errorMessage: row.error_message,
      id: row.id,
      status: row.status,
      updatedAt: row.updated_at.toISOString(),
    })),
    indexedDocuments: indexedDocumentRows.map((row) => ({
      chunkCount: row.chunk_count,
      contentHash: row.content_hash,
      createdAt: row.created_at.toISOString(),
      documentId: row.document_id,
      errorMessage: row.error_message,
      filePath: row.file_path,
      id: row.id,
      originalName: row.original_name,
      status: row.status,
      updatedAt: row.updated_at.toISOString(),
    })),
    totals: {
      chunks: Number(totals?.chunks ?? 0),
      embeddedChunks: Number(totals?.embedded_chunks ?? 0),
      indexedDocuments: Number(totals?.indexed_documents ?? 0),
    },
  };
}

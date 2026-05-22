import type { QueryResultRow } from "pg";

import { query } from "@/lib/db/client";
import { toPgVector } from "@/lib/db/vector";
import { embedTexts } from "@/lib/indexing/embeddings";
import type { SearchResult } from "@/lib/retrieval/types";

type SearchRow = QueryResultRow & {
  id: string;
  dataset_id: string;
  document_id: string;
  original_name: string;
  page_start: number | null;
  page_end: number | null;
  text: string;
  score: number | string;
};

export async function searchIndexedChunks(input: {
  datasetId: string;
  query: string;
  limit?: number;
}): Promise<SearchResult[]> {
  const searchQuery = input.query.trim();

  if (!searchQuery) {
    throw new Error("Search query cannot be empty.");
  }

  const [embedding] = await embedTexts([searchQuery]);
  const rows = await query<SearchRow>(
    `SELECT
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
       AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [toPgVector(embedding), input.datasetId, clampLimit(input.limit)],
  );

  return rows.map((row) => ({
    chunkId: row.id,
    datasetId: row.dataset_id,
    documentId: row.document_id,
    originalName: row.original_name,
    pageEnd: row.page_end,
    pageStart: row.page_start,
    score:
      typeof row.score === "number" ? row.score : Number.parseFloat(row.score),
    text: row.text,
  }));
}

function clampLimit(limit: number | undefined) {
  if (!limit || !Number.isFinite(limit)) {
    return 5;
  }

  return Math.min(Math.max(Math.floor(limit), 1), 20);
}

import { readFile } from "fs/promises";
import { createHash } from "crypto";

import { toPgVector } from "@/lib/db/vector";
import { query, withTransaction } from "@/lib/db/client";
import { updateDocumentStatus } from "@/lib/documents/metadataStore";
import { getStoredDocumentPath } from "@/lib/documents/storage";
import type { DocumentRecord } from "@/lib/documents/types";
import { chunkExtractedPdf } from "@/lib/indexing/chunkText";
import { embedTexts } from "@/lib/indexing/embeddings";
import { extractPdf } from "@/lib/indexing/extractPdf";
import type {
  DocumentChunkInput,
  IndexedDocumentResult,
} from "@/lib/indexing/types";

export async function indexDocument(
  document: DocumentRecord,
): Promise<IndexedDocumentResult> {
  const absoluteFilePath = getStoredDocumentPath(document);
  const indexedDocumentId = getIndexedDocumentId(document.id);

  console.log("[indexing] Document index started.", {
    absoluteFilePath,
    datasetId: document.datasetId,
    documentId: document.id,
    originalName: document.originalName,
  });

  await updateDocumentStatus(document.datasetId, [document.id], "indexing");

  try {
    console.log("[indexing] Hashing PDF file.", {
      documentId: document.id,
      filePath: document.filePath,
    });
    const contentHash = await getFileHash(absoluteFilePath);

    console.log("[indexing] Upserting indexed document row.", {
      contentHash,
      documentId: document.id,
      indexedDocumentId,
    });
    await upsertIndexedDocument({
      contentHash,
      document,
      indexedDocumentId,
      status: "indexing",
    });

    console.log("[indexing] Extracting PDF text.", {
      documentId: document.id,
      filePath: absoluteFilePath,
    });
    const extractedPdf = await extractPdf(absoluteFilePath);
    console.log("[indexing] PDF text extracted.", {
      documentId: document.id,
      pageCount: extractedPdf.pageCount,
      pagesWithText: extractedPdf.pages.length,
      totalCharacters: extractedPdf.pages.reduce(
        (total, page) => total + page.text.length,
        0,
      ),
    });

    const chunks = chunkExtractedPdf({
      datasetId: document.datasetId,
      documentId: document.id,
      extractedPdf,
      originalName: document.originalName,
    });

    console.log("[indexing] PDF chunking complete.", {
      chunkCount: chunks.length,
      documentId: document.id,
    });

    if (chunks.length === 0) {
      throw new Error("PDF extraction produced no indexable chunks.");
    }

    console.log("[indexing] Requesting embeddings.", {
      chunkCount: chunks.length,
      documentId: document.id,
    });
    const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));
    console.log("[indexing] Embeddings received.", {
      documentId: document.id,
      embeddingCount: embeddings.length,
      vectorDimensions: embeddings[0]?.length,
    });

    if (embeddings.length !== chunks.length) {
      throw new Error("Embedding count did not match chunk count.");
    }

    console.log("[indexing] Replacing document chunks in database.", {
      chunkCount: chunks.length,
      documentId: document.id,
      indexedDocumentId,
    });
    await replaceDocumentChunks({
      chunks,
      embeddings,
      indexedDocumentId,
    });
    await updateDocumentStatus(document.datasetId, [document.id], "indexed");

    console.log("[indexing] Document index finished.", {
      chunkCount: chunks.length,
      documentId: document.id,
    });

    return {
      chunkCount: chunks.length,
      documentId: document.id,
      status: "indexed",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown indexing error.";

    console.error("[indexing] Document index failed.", {
      datasetId: document.datasetId,
      documentId: document.id,
      error,
      errorMessage,
      filePath: document.filePath,
      originalName: document.originalName,
    });

    await markDocumentFailed(document, indexedDocumentId, errorMessage);

    return {
      chunkCount: 0,
      documentId: document.id,
      errorMessage,
      status: "failed",
    };
  }
}

async function replaceDocumentChunks(input: {
  chunks: DocumentChunkInput[];
  embeddings: number[][];
  indexedDocumentId: string;
}) {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM document_chunks WHERE document_id = $1", [
      input.chunks[0]?.documentId,
    ]);

    for (const [index, chunk] of input.chunks.entries()) {
      await client.query(
        `INSERT INTO document_chunks (
          id,
          dataset_id,
          document_id,
          indexed_document_id,
          chunk_index,
          original_name,
          page_start,
          page_end,
          section_heading,
          text,
          token_count,
          embedding
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::vector
        )`,
        [
          chunk.id,
          chunk.datasetId,
          chunk.documentId,
          input.indexedDocumentId,
          chunk.chunkIndex,
          chunk.originalName,
          chunk.pageStart,
          chunk.pageEnd,
          chunk.sectionHeading,
          chunk.text,
          chunk.tokenCount,
          toPgVector(input.embeddings[index]),
        ],
      );
    }

    await client.query(
      `UPDATE indexed_documents
       SET status = 'indexed',
           error_message = NULL,
           chunk_count = $1,
           updated_at = now()
       WHERE id = $2`,
      [input.chunks.length, input.indexedDocumentId],
    );
  });
}

async function upsertIndexedDocument(input: {
  contentHash: string;
  document: DocumentRecord;
  indexedDocumentId: string;
  status: "indexing" | "indexed" | "failed";
}) {
  await query(
    `INSERT INTO indexed_documents (
      id,
      dataset_id,
      document_id,
      original_name,
      file_path,
      content_hash,
      status,
      error_message,
      chunk_count
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, NULL, 0
    )
    ON CONFLICT (document_id)
    DO UPDATE SET
      dataset_id = EXCLUDED.dataset_id,
      original_name = EXCLUDED.original_name,
      file_path = EXCLUDED.file_path,
      content_hash = EXCLUDED.content_hash,
      status = EXCLUDED.status,
      error_message = NULL,
      chunk_count = 0,
      updated_at = now()`,
    [
      input.indexedDocumentId,
      input.document.datasetId,
      input.document.id,
      input.document.originalName,
      input.document.filePath,
      input.contentHash,
      input.status,
    ],
  );
}

async function markDocumentFailed(
  document: DocumentRecord,
  indexedDocumentId: string,
  errorMessage: string,
) {
  await updateDocumentStatus(document.datasetId, [document.id], "failed");

  try {
    await query(
      `INSERT INTO indexed_documents (
        id,
        dataset_id,
        document_id,
        original_name,
        file_path,
        status,
        error_message,
        chunk_count
      ) VALUES (
        $1, $2, $3, $4, $5, 'failed', $6, 0
      )
      ON CONFLICT (document_id)
      DO UPDATE SET
        status = 'failed',
        error_message = EXCLUDED.error_message,
        chunk_count = 0,
        updated_at = now()`,
      [
        indexedDocumentId,
        document.datasetId,
        document.id,
        document.originalName,
        document.filePath,
        errorMessage,
      ],
    );
  } catch (databaseError) {
    console.error("Could not persist failed indexed document status.", {
      databaseError,
      documentId: document.id,
    });
  }
}

async function getFileHash(filePath: string) {
  const fileBuffer = await readFile(filePath);

  return createHash("sha256").update(fileBuffer).digest("hex");
}

function getIndexedDocumentId(documentId: string) {
  return `indexed_${documentId}`;
}

import { query } from "@/lib/db/client";
import { listDocuments } from "@/lib/documents/metadataStore";
import { indexDocument } from "@/lib/indexing/indexDocument";
import type {
  IndexedDatasetResult,
  IndexedDocumentResult,
} from "@/lib/indexing/types";

export async function indexDataset(
  datasetId: string,
): Promise<IndexedDatasetResult> {
  const runId = `run_${crypto.randomUUID()}`;
  const documents = await listDocuments(datasetId);

  console.log("[indexing] Starting dataset index run.", {
    datasetId,
    documentCount: documents.length,
    runId,
  });

  await query(
    `INSERT INTO index_runs (id, dataset_id, status)
     VALUES ($1, $2, 'running')`,
    [runId, datasetId],
  );

  try {
    if (documents.length === 0) {
      console.log("[indexing] Dataset has no documents.", { datasetId, runId });
      await completeIndexRun(runId, "No documents to index.");

      return {
        datasetId,
        documents: [],
        failed: 0,
        indexed: 0,
        message: "This dataset has no documents to index.",
        ok: true,
        runId,
        skipped: 0,
      };
    }

    const results: IndexedDocumentResult[] = [];

    for (const document of documents) {
      console.log("[indexing] Indexing document.", {
        datasetId,
        documentId: document.id,
        filePath: document.filePath,
        originalName: document.originalName,
        runId,
      });
      results.push(await indexDocument(document));
    }

    const indexed = results.filter((result) => result.status === "indexed").length;
    const failed = results.filter((result) => result.status === "failed").length;

    await completeIndexRun(
      runId,
      failed > 0 ? `${failed} document(s) failed to index.` : null,
    );

    console.log("[indexing] Dataset index run finished.", {
      datasetId,
      failed,
      indexed,
      runId,
    });

    return {
      datasetId,
      documents: results,
      failed,
      indexed,
      message: `Indexed ${indexed} document(s).${
        failed > 0 ? ` ${failed} document(s) failed.` : ""
      }`,
      ok: true,
      runId,
      skipped: 0,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown dataset indexing error.";

    console.error("[indexing] Dataset index run crashed.", {
      datasetId,
      error,
      errorMessage,
      runId,
    });

    await query(
      `UPDATE index_runs
       SET status = 'failed',
           error_message = $1,
           updated_at = now()
       WHERE id = $2`,
      [errorMessage, runId],
    );

    throw error;
  }
}

async function completeIndexRun(runId: string, message: string | null) {
  await query(
    `UPDATE index_runs
     SET status = 'completed',
         error_message = $1,
         updated_at = now()
     WHERE id = $2`,
    [message, runId],
  );
}

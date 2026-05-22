"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { DocumentTable } from "@/components/documents/DocumentTable";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import {
  IndexSummaryPanel,
  type DatasetIndexSummary,
} from "@/components/documents/IndexSummaryPanel";
import type { Dataset, DocumentRecord } from "@/lib/documents/types";

type DatasetDetailProps = {
  datasetId: string;
};

type DatasetDetailResponse = {
  dataset: Dataset;
  documents: DocumentRecord[];
};

type DeleteDocumentsResponse = {
  deletedDocuments: DocumentRecord[];
};

export function DatasetDetail({ datasetId }: DatasetDetailProps) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isIndexSummaryLoading, setIsIndexSummaryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [indexSummary, setIndexSummary] =
    useState<DatasetIndexSummary | null>(null);
  const [indexSummaryError, setIndexSummaryError] = useState<string | null>(
    null,
  );
  const [notFound, setNotFound] = useState(false);

  const refreshIndexSummary = useCallback(
    async (options?: { shouldUpdate?: () => boolean }) => {
      const shouldUpdate = options?.shouldUpdate ?? (() => true);

      setIsIndexSummaryLoading(true);
      setIndexSummaryError(null);

      try {
        const summary = await fetchIndexSummary(datasetId);

        if (shouldUpdate()) {
          setIndexSummary(summary);
        }
      } catch (error) {
        if (shouldUpdate()) {
          setIndexSummaryError(
            error instanceof Error
              ? error.message
              : "Could not load index database view.",
          );
        }
      } finally {
        if (shouldUpdate()) {
          setIsIndexSummaryLoading(false);
        }
      }
    },
    [datasetId],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadDataset() {
      try {
        const body = await fetchDatasetDetail(datasetId);

        if (isMounted) {
          setDataset(body.dataset);
          setDocuments(body.documents);
          setErrorMessage(null);
        }

        void refreshIndexSummary({ shouldUpdate: () => isMounted });
      } catch (error) {
        if (isMounted) {
          if (error instanceof Error && error.message === "Dataset not found.") {
            setNotFound(true);
            return;
          }

          setErrorMessage(
            error instanceof Error ? error.message : "Could not load dataset.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDataset();

    return () => {
      isMounted = false;
    };
  }, [datasetId, refreshIndexSummary]);

  async function handleDeleteSelected() {
    if (
      selectedDocumentIds.length === 0 ||
      isDeleting ||
      !window.confirm("Delete the selected local PDF files?")
    ) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const response = await fetch(`/api/datasets/${datasetId}/documents`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentIds: selectedDocumentIds }),
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response));
      }

      const body = (await response.json()) as DeleteDocumentsResponse;
      const deletedDocumentIdSet = new Set(
        body.deletedDocuments.map((document) => document.id),
      );

      setDocuments((currentDocuments) =>
        currentDocuments.filter(
          (document) => !deletedDocumentIdSet.has(document.id),
        ),
      );
      setSelectedDocumentIds([]);
      setNoticeMessage("Selected documents were deleted.");
      void refreshIndexSummary();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not delete documents.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleIndexDataset() {
    if (isIndexing) {
      return;
    }

    setIsIndexing(true);
    setDocuments((currentDocuments) =>
      currentDocuments.map((document) => ({ ...document, status: "indexing" })),
    );
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const response = await fetch(`/api/datasets/${datasetId}/index`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response));
      }

      const body = (await response.json()) as { message?: string };
      const refreshedDataset = await fetchDatasetDetail(datasetId);

      setDataset(refreshedDataset.dataset);
      setDocuments(refreshedDataset.documents);
      setNoticeMessage(body.message ?? "Indexing complete.");
      void refreshIndexSummary();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not index dataset.",
      );
      try {
        const refreshedDataset = await fetchDatasetDetail(datasetId);

        setDataset(refreshedDataset.dataset);
        setDocuments(refreshedDataset.documents);
        void refreshIndexSummary();
      } catch {
        // Keep the visible optimistic state if the refresh also fails.
      }
    } finally {
      setIsIndexing(false);
    }
  }

  function handleUploaded(uploadedDocuments: DocumentRecord[]) {
    setDocuments((currentDocuments) => [
      ...uploadedDocuments,
      ...currentDocuments,
    ]);
    setNoticeMessage("PDF upload complete.");
    setErrorMessage(null);
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-zinc-100 px-6 py-8 text-zinc-950">
        <section className="mx-auto max-w-5xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-500">Loading dataset...</p>
        </section>
      </main>
    );
  }

  if (notFound || !dataset) {
    return (
      <main className="min-h-screen bg-zinc-100 px-6 py-8 text-zinc-950">
        <section className="mx-auto max-w-5xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Documents
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Dataset not found</h1>
          <p className="mt-3 leading-7 text-zinc-600">
            This local dataset does not exist or was removed.
          </p>
          <Link
            className="mt-6 inline-flex rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white"
            href="/documents"
          >
            Back to datasets
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-8 text-zinc-950">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              className="text-sm font-semibold text-zinc-500 hover:text-zinc-950"
              href="/documents"
            >
              Back to datasets
            </Link>
            <h1 className="mt-3 text-3xl font-semibold">{dataset.name}</h1>
            <p className="mt-3 max-w-2xl leading-7 text-zinc-600">
              Upload PDFs, index them into local Postgres, and test retrieval
              before connecting the document chat agent.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300"
              disabled={isIndexing}
              onClick={handleIndexDataset}
              type="button"
            >
              {isIndexing ? "Indexing..." : "Index dataset"}
            </button>
            <button
              className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={selectedDocumentIds.length === 0 || isDeleting}
              onClick={handleDeleteSelected}
              type="button"
            >
              {isDeleting
                ? "Deleting..."
                : `Delete selected${
                    selectedDocumentIds.length > 0
                      ? ` (${selectedDocumentIds.length})`
                      : ""
                  }`}
            </button>
          </div>
        </header>

        {errorMessage ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {noticeMessage ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {noticeMessage}
          </p>
        ) : null}

        <DocumentUpload
          datasetId={datasetId}
          onError={setErrorMessage}
          onUploaded={handleUploaded}
        />

        <DocumentTable
          documents={documents}
          onSelectionChange={setSelectedDocumentIds}
          selectedDocumentIds={selectedDocumentIds}
        />

        <IndexSummaryPanel
          errorMessage={indexSummaryError}
          isLoading={isIndexSummaryLoading}
          onRefresh={() => void refreshIndexSummary()}
          summary={indexSummary}
        />
      </section>
    </main>
  );
}

async function getApiErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed with status ${response.status}.`;

  try {
    const body = (await response.json()) as unknown;

    if (!body || typeof body !== "object") {
      return fallback;
    }

    const error = (body as Record<string, unknown>).error;

    return typeof error === "string" && error.trim() ? error : fallback;
  } catch {
    return fallback;
  }
}

async function fetchDatasetDetail(datasetId: string): Promise<DatasetDetailResponse> {
  const response = await fetch(`/api/datasets/${datasetId}`);

  if (response.status === 404) {
    throw new Error("Dataset not found.");
  }

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  return (await response.json()) as DatasetDetailResponse;
}

async function fetchIndexSummary(
  datasetId: string,
): Promise<DatasetIndexSummary> {
  const response = await fetch(`/api/datasets/${datasetId}/index/summary`);

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  return (await response.json()) as DatasetIndexSummary;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DocumentTable } from "@/components/documents/DocumentTable";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDataset() {
      try {
        const response = await fetch(`/api/datasets/${datasetId}`);

        if (response.status === 404) {
          if (isMounted) {
            setNotFound(true);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response));
        }

        const body = (await response.json()) as DatasetDetailResponse;

        if (isMounted) {
          setDataset(body.dataset);
          setDocuments(body.documents);
          setErrorMessage(null);
        }
      } catch (error) {
        if (isMounted) {
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
  }, [datasetId]);

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

      setNoticeMessage(body.message ?? "Indexing is not implemented yet.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not index dataset.",
      );
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
              Upload PDFs, review local metadata, and keep the phase4 indexing
              hook ready without doing real parsing yet.
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

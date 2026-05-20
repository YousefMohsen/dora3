"use client";

import type { DocumentRecord, DocumentStatus } from "@/lib/documents/types";

type DocumentTableProps = {
  documents: DocumentRecord[];
  selectedDocumentIds: string[];
  onSelectionChange: (documentIds: string[]) => void;
};

const STATUS_LABELS: Record<DocumentStatus, string> = {
  failed: "Failed",
  indexed: "Indexed",
  indexing: "Indexing",
  not_indexed: "Not indexed",
};

export function DocumentTable({
  documents,
  selectedDocumentIds,
  onSelectionChange,
}: DocumentTableProps) {
  const selectedDocumentIdSet = new Set(selectedDocumentIds);
  const isAllSelected =
    documents.length > 0 && selectedDocumentIds.length === documents.length;

  function toggleDocument(documentId: string) {
    if (selectedDocumentIdSet.has(documentId)) {
      onSelectionChange(
        selectedDocumentIds.filter(
          (selectedDocumentId) => selectedDocumentId !== documentId,
        ),
      );
      return;
    }

    onSelectionChange([...selectedDocumentIds, documentId]);
  }

  function toggleAllDocuments() {
    onSelectionChange(isAllSelected ? [] : documents.map((document) => document.id));
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Documents</h2>
        <p className="mt-4 rounded-2xl border border-dashed border-zinc-300 p-5 text-sm leading-6 text-zinc-500">
          This dataset is empty. Upload PDFs above to add local documents.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 p-5">
        <h2 className="text-lg font-semibold">Documents</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {documents.length} document{documents.length === 1 ? "" : "s"} in this
          dataset.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-[0.14em] text-zinc-500">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  aria-label="Select all documents"
                  checked={isAllSelected}
                  onChange={toggleAllDocuments}
                  type="checkbox"
                />
              </th>
              <th className="px-4 py-3">File name</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Uploaded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {documents.map((document) => (
              <tr className="hover:bg-zinc-50" key={document.id}>
                <td className="px-4 py-4">
                  <input
                    aria-label={`Select ${document.originalName}`}
                    checked={selectedDocumentIdSet.has(document.id)}
                    onChange={() => toggleDocument(document.id)}
                    type="checkbox"
                  />
                </td>
                <td className="px-4 py-4">
                  <span className="block font-medium text-zinc-950">
                    {document.originalName}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-500">
                    {document.storedName}
                  </span>
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {formatBytes(document.sizeBytes)}
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600">
                    {STATUS_LABELS[document.status]}
                  </span>
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {formatDate(document.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

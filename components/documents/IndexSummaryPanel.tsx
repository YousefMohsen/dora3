"use client";

type IndexedDocumentSummary = {
  id: string;
  documentId: string;
  originalName: string;
  filePath: string;
  contentHash: string | null;
  status: string;
  errorMessage: string | null;
  chunkCount: number;
  updatedAt: string;
};

type DocumentChunkSummary = {
  id: string;
  documentId: string;
  originalName: string;
  chunkIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  tokenCount: number;
  textPreview: string;
  embeddingDimensions: number | null;
};

type IndexRunSummary = {
  id: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

export type DatasetIndexSummary = {
  totals: {
    indexedDocuments: number;
    chunks: number;
    embeddedChunks: number;
  };
  indexedDocuments: IndexedDocumentSummary[];
  chunks: DocumentChunkSummary[];
  indexRuns: IndexRunSummary[];
};

type IndexSummaryPanelProps = {
  errorMessage: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  summary: DatasetIndexSummary | null;
};

export function IndexSummaryPanel({
  errorMessage,
  isLoading,
  onRefresh,
  summary,
}: IndexSummaryPanelProps) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Index database view</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Read-only snapshot of Postgres indexing tables for this dataset.
          </p>
        </div>
        <button
          className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300"
          disabled={isLoading}
          onClick={onRefresh}
          type="button"
        >
          {isLoading ? "Refreshing..." : "Refresh DB view"}
        </button>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </p>
      ) : null}

      {!summary && !errorMessage ? (
        <p className="mt-4 text-sm text-zinc-500">
          {isLoading ? "Loading index summary..." : "No index summary loaded."}
        </p>
      ) : null}

      {summary ? (
        <div className="mt-5 flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Indexed documents" value={summary.totals.indexedDocuments} />
            <Metric label="Chunks" value={summary.totals.chunks} />
            <Metric label="Embedded chunks" value={summary.totals.embeddedChunks} />
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
              indexed_documents
            </h3>
            {summary.indexedDocuments.length === 0 ? (
              <EmptyState message="No indexed document rows yet." />
            ) : (
              <div className="mt-3 overflow-x-auto rounded-2xl border border-zinc-200">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-[0.14em] text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">File</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Chunks</th>
                      <th className="px-4 py-3">Hash</th>
                      <th className="px-4 py-3">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {summary.indexedDocuments.map((document) => (
                      <tr key={document.id}>
                        <td className="px-4 py-3">
                          <span className="block font-medium text-zinc-950">
                            {document.originalName}
                          </span>
                          <span className="mt-1 block text-xs text-zinc-500">
                            {document.documentId}
                          </span>
                          {document.errorMessage ? (
                            <span className="mt-1 block text-xs text-red-600">
                              {document.errorMessage}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {document.status}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {document.chunkCount}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                          {document.contentHash?.slice(0, 16) ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {formatDate(document.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
              document_chunks preview
            </h3>
            {summary.chunks.length === 0 ? (
              <EmptyState message="No chunk rows yet." />
            ) : (
              <div className="mt-3 grid gap-3">
                {summary.chunks.map((chunk) => (
                  <article
                    className="rounded-2xl border border-zinc-200 p-4"
                    key={chunk.id}
                  >
                    <div className="flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
                      <span>chunk #{chunk.chunkIndex}</span>
                      <span>{chunk.tokenCount} tokens</span>
                      <span>{chunk.embeddingDimensions ?? 0} dims</span>
                      <span>{formatPages(chunk.pageStart, chunk.pageEnd)}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">
                      {chunk.textPreview}
                    </p>
                    <p className="mt-2 font-mono text-xs text-zinc-400">
                      {chunk.id}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
              recent index_runs
            </h3>
            {summary.indexRuns.length === 0 ? (
              <EmptyState message="No index runs yet." />
            ) : (
              <div className="mt-3 grid gap-2">
                {summary.indexRuns.map((run) => (
                  <div
                    className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-600"
                    key={run.id}
                  >
                    <span className="font-mono text-xs text-zinc-400">
                      {run.id}
                    </span>{" "}
                    <span className="font-semibold text-zinc-800">
                      {run.status}
                    </span>{" "}
                    <span>{formatDate(run.createdAt)}</span>
                    {run.errorMessage ? (
                      <span className="ml-2 text-amber-700">
                        {run.errorMessage}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
      {message}
    </p>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPages(pageStart: number | null, pageEnd: number | null) {
  if (!pageStart && !pageEnd) {
    return "pages unknown";
  }

  if (pageStart === pageEnd || !pageEnd) {
    return `page ${pageStart}`;
  }

  return `pages ${pageStart}-${pageEnd}`;
}

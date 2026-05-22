"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DbTableColumn = {
  name: string;
  dataType: string;
  udtName: string;
  isNullable: boolean;
};

type DbTableSummary = {
  name: string;
  rowEstimate: number;
  columns: DbTableColumn[];
};

type DbTableRows = {
  table: DbTableSummary;
  rows: Record<string, unknown>[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function DatabaseExplorer() {
  const [tables, setTables] = useState<DbTableSummary[]>([]);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<DbTableRows | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [refreshToken, setRefreshToken] = useState(0);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTables() {
      setIsLoadingTables(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/db/tables");

        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response));
        }

        const body = (await response.json()) as { tables: DbTableSummary[] };

        if (!isMounted) {
          return;
        }

        setTables(body.tables);
        setSelectedTableName((currentTableName) =>
          currentTableName ?? body.tables[0]?.name ?? null,
        );
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not load tables.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingTables(false);
        }
      }
    }

    void loadTables();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedTableName) {
      return;
    }

    let isMounted = true;
    const tableName = selectedTableName;

    async function loadRows() {
      setIsLoadingRows(true);
      setErrorMessage(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        const response = await fetch(
          `/api/db/tables/${encodeURIComponent(tableName)}?${params}`,
        );

        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response));
        }

        const body = (await response.json()) as DbTableRows;

        if (isMounted) {
          setTableRows(body);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not load table rows.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingRows(false);
        }
      }
    }

    void loadRows();

    return () => {
      isMounted = false;
    };
  }, [page, pageSize, refreshToken, selectedTableName]);

  const selectedTable = useMemo(
    () => tables.find((table) => table.name === selectedTableName) ?? null,
    [selectedTableName, tables],
  );
  const columns = tableRows?.table.columns ?? selectedTable?.columns ?? [];

  function selectTable(tableName: string) {
    setSelectedTableName(tableName);
    setTableRows(null);
    setPage(1);
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-8 text-zinc-950">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                className="text-sm font-semibold text-zinc-500 hover:text-zinc-950"
                href="/documents"
              >
                Back to documents
              </Link>
              <h1 className="mt-3 text-3xl font-semibold">Database explorer</h1>
              <p className="mt-3 max-w-2xl leading-7 text-zinc-600">
                Inspect local Postgres tables, columns, rows, chunks, and vector
                embeddings for debugging the indexing pipeline.
              </p>
            </div>
            <button
              className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300"
              disabled={!selectedTableName || isLoadingRows}
              onClick={() => setRefreshToken((currentToken) => currentToken + 1)}
              type="button"
            >
              {isLoadingRows ? "Refreshing..." : "Refresh table"}
            </button>
          </div>
        </header>

        {errorMessage ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="px-2 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Tables
            </h2>
            {isLoadingTables ? (
              <p className="mt-4 px-2 text-sm text-zinc-500">Loading tables...</p>
            ) : null}
            {!isLoadingTables && tables.length === 0 ? (
              <p className="mt-4 px-2 text-sm text-zinc-500">
                No public tables found.
              </p>
            ) : null}
            <div className="mt-3 flex flex-col gap-2">
              {tables.map((table) => (
                <button
                  className={`rounded-2xl px-3 py-3 text-left text-sm transition ${
                    selectedTableName === table.name
                      ? "bg-zinc-950 text-white"
                      : "bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                  }`}
                  key={table.name}
                  onClick={() => selectTable(table.name)}
                  type="button"
                >
                  <span className="block font-semibold">{table.name}</span>
                  <span
                    className={`mt-1 block text-xs ${
                      selectedTableName === table.name
                        ? "text-zinc-300"
                        : "text-zinc-500"
                    }`}
                  >
                    {table.columns.length} columns, ~{table.rowEstimate} rows
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="min-w-0 rounded-3xl border border-zinc-200 bg-white shadow-sm">
            {!selectedTableName ? (
              <p className="p-6 text-sm text-zinc-500">
                Select a table to inspect rows.
              </p>
            ) : (
              <>
                <div className="border-b border-zinc-200 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
                        public table
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold">
                        {selectedTableName}
                      </h2>
                      {tableRows ? (
                        <p className="mt-2 text-sm text-zinc-500">
                          {tableRows.totalRows} rows, page {tableRows.page} of{" "}
                          {tableRows.totalPages}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="text-sm font-medium text-zinc-600">
                        Page size{" "}
                        <select
                          className="ml-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                          onChange={(event) => {
                            setPageSize(Number(event.target.value));
                            setPage(1);
                          }}
                          value={pageSize}
                        >
                          {PAGE_SIZE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-300"
                        disabled={page <= 1 || isLoadingRows}
                        onClick={() =>
                          setPage((currentPage) => Math.max(1, currentPage - 1))
                        }
                        type="button"
                      >
                        Previous
                      </button>
                      <button
                        className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-300"
                        disabled={
                          !tableRows ||
                          page >= tableRows.totalPages ||
                          isLoadingRows
                        }
                        onClick={() =>
                          setPage((currentPage) => currentPage + 1)
                        }
                        type="button"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {columns.map((column) => (
                      <span
                        className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600"
                        key={column.name}
                        title={`${column.dataType} / ${column.udtName}`}
                      >
                        {column.name}: {column.udtName}
                        {column.isNullable ? "" : " not null"}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {isLoadingRows ? (
                    <p className="p-6 text-sm text-zinc-500">Loading rows...</p>
                  ) : null}
                  {!isLoadingRows && tableRows?.rows.length === 0 ? (
                    <p className="p-6 text-sm text-zinc-500">
                      This table has no rows.
                    </p>
                  ) : null}
                  {!isLoadingRows && tableRows && tableRows.rows.length > 0 ? (
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-[0.14em] text-zinc-500">
                        <tr>
                          {columns.map((column) => (
                            <th className="px-4 py-3" key={column.name}>
                              {column.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {tableRows.rows.map((row, rowIndex) => (
                          <tr className="align-top hover:bg-zinc-50" key={rowIndex}>
                            {columns.map((column) => (
                              <td
                                className="max-w-[360px] px-4 py-3 text-zinc-700"
                                key={column.name}
                              >
                                <DbCell value={row[column.name]} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                </div>
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function DbCell({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-zinc-400">NULL</span>;
  }

  if (typeof value === "string" && isVectorString(value)) {
    const dimensions = value.split(",").length;
    const preview = value.slice(0, 140);

    return (
      <details>
        <summary className="cursor-pointer font-mono text-xs text-zinc-600">
          vector({dimensions}) {preview}
          {value.length > preview.length ? "..." : ""}
        </summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-zinc-950 p-3 text-xs text-zinc-50">
          {value}
        </pre>
      </details>
    );
  }

  if (typeof value === "object") {
    return (
      <pre className="max-h-48 overflow-auto rounded-xl bg-zinc-50 p-2 text-xs text-zinc-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  const stringValue = String(value);

  if (stringValue.length > 240) {
    return (
      <details>
        <summary className="cursor-pointer leading-6">
          {stringValue.slice(0, 240)}...
        </summary>
        <p className="mt-2 whitespace-pre-wrap leading-6">{stringValue}</p>
      </details>
    );
  }

  return <span className="whitespace-pre-wrap leading-6">{stringValue}</span>;
}

function isVectorString(value: string) {
  return value.startsWith("[") && value.endsWith("]") && value.includes(",");
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

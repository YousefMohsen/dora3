"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import type { Dataset } from "@/lib/documents/types";

type DatasetListResponse = {
  datasets: Dataset[];
};

type DatasetCreateResponse = {
  dataset: Dataset;
};

export function DatasetList() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetName, setDatasetName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDatasets() {
      try {
        const response = await fetch("/api/datasets");

        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response));
        }

        const body = (await response.json()) as DatasetListResponse;

        if (isMounted) {
          setDatasets(body.datasets);
          setErrorMessage(null);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not load datasets.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDatasets();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCreateDataset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = datasetName.trim();

    if (!name || isCreating) {
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/datasets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response));
      }

      const body = (await response.json()) as DatasetCreateResponse;

      setDatasets((currentDatasets) => [body.dataset, ...currentDatasets]);
      setDatasetName("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not create dataset.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-8 text-zinc-950">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
              Documents
            </p>
            <h1 className="mt-3 text-3xl font-semibold">Datasets</h1>
            <p className="mt-3 max-w-2xl leading-7 text-zinc-600">
              Create local document collections for PDFs. These files are stored
              locally for the phase3 MVP and can be indexed in a later phase.
            </p>
          </div>
          <Link
            className="inline-flex w-fit rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            href="/chat"
          >
            Back to chat
          </Link>
        </header>

        <form
          className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"
          onSubmit={handleCreateDataset}
        >
          <label className="block text-sm font-medium text-zinc-700" htmlFor="dataset-name">
            New dataset
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              className="min-w-0 flex-1 rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none ring-zinc-300 placeholder:text-zinc-400 focus:ring-4"
              id="dataset-name"
              maxLength={80}
              onChange={(event) => setDatasetName(event.target.value)}
              placeholder="Example: Research papers"
              value={datasetName}
            />
            <button
              className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={!datasetName.trim() || isCreating}
              type="submit"
            >
              {isCreating ? "Creating..." : "Create dataset"}
            </button>
          </div>
        </form>

        {errorMessage ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Local datasets</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-zinc-500">Loading datasets...</p>
          ) : datasets.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-zinc-300 p-5 text-sm leading-6 text-zinc-500">
              No datasets yet. Create one above to start uploading PDFs.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {datasets.map((dataset) => (
                <Link
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 hover:border-zinc-300 hover:bg-white"
                  href={`/documents/${dataset.id}`}
                  key={dataset.id}
                >
                  <span className="block text-base font-semibold">
                    {dataset.name}
                  </span>
                  <span className="mt-2 block text-xs text-zinc-500">
                    Updated {formatDate(dataset.updatedAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

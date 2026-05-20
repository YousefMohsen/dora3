"use client";

import { FormEvent, useRef, useState } from "react";

import type { DocumentRecord } from "@/lib/documents/types";

type DocumentUploadResponse = {
  documents: DocumentRecord[];
};

type DocumentUploadProps = {
  datasetId: string;
  onUploaded: (documents: DocumentRecord[]) => void;
  onError: (message: string) => void;
};

export function DocumentUpload({
  datasetId,
  onUploaded,
  onError,
}: DocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileCount, setSelectedFileCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const files = fileInputRef.current?.files;

    if (!files || files.length === 0 || isUploading) {
      return;
    }

    const formData = new FormData();

    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    setIsUploading(true);

    try {
      const response = await fetch(`/api/datasets/${datasetId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response));
      }

      const body = (await response.json()) as DocumentUploadResponse;

      onUploaded(body.documents);
      setSelectedFileCount(0);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not upload PDFs.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form
      className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"
      onSubmit={handleUpload}
    >
      <label className="block text-sm font-medium text-zinc-700" htmlFor="pdf-upload">
        Upload PDFs
      </label>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row">
        <input
          accept="application/pdf,.pdf"
          className="min-w-0 flex-1 rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-zinc-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
          id="pdf-upload"
          multiple
          onChange={(event) =>
            setSelectedFileCount(event.currentTarget.files?.length ?? 0)
          }
          ref={fileInputRef}
          type="file"
        />
        <button
          className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
          disabled={selectedFileCount === 0 || isUploading}
          type="submit"
        >
          {isUploading ? "Uploading..." : "Upload"}
        </button>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        PDF only, up to 25 MB per file. Uploaded files are stored locally in the
        project data folder.
      </p>
    </form>
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

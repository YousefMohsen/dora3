import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";

import type { DocumentRecord } from "@/lib/documents/types";

const UPLOADS_DIR = path.join(process.cwd(), "data", "documents", "uploads");
const UPLOADS_RELATIVE_DIR = path.join("data", "documents", "uploads");

export async function saveUploadedPdf(
  datasetId: string,
  file: File,
): Promise<DocumentRecord> {
  const documentId = `doc_${crypto.randomUUID()}`;
  const safeFileName = sanitizeFileName(file.name);
  const storedName = `${documentId}-${safeFileName}`;
  const uploadDir = path.join(UPLOADS_DIR, datasetId);
  const absolutePath = path.join(uploadDir, storedName);
  const relativePath = path.join(UPLOADS_RELATIVE_DIR, datasetId, storedName);
  const now = new Date().toISOString();

  await mkdir(uploadDir, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return {
    id: documentId,
    datasetId,
    originalName: file.name,
    storedName,
    filePath: relativePath,
    mimeType: file.type || "application/pdf",
    sizeBytes: file.size,
    status: "not_indexed",
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteStoredDocument(
  document: DocumentRecord,
): Promise<void> {
  await rm(path.join(UPLOADS_DIR, document.datasetId, document.storedName), {
    force: true,
  });
}

function sanitizeFileName(fileName: string) {
  const fallbackName = "document.pdf";
  const normalizedName = fileName
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 120);

  if (!normalizedName || normalizedName === ".pdf") {
    return fallbackName;
  }

  return normalizedName.toLowerCase().endsWith(".pdf")
    ? normalizedName
    : `${normalizedName}.pdf`;
}

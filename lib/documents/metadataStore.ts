import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import type {
  Dataset,
  DocumentRecord,
  DocumentsMetadata,
  DocumentStatus,
} from "@/lib/documents/types";

const DOCUMENTS_DATA_DIR = path.join(process.cwd(), "data", "documents");
const METADATA_FILE = path.join(DOCUMENTS_DATA_DIR, "metadata.json");

const EMPTY_METADATA: DocumentsMetadata = {
  datasets: [],
  documents: [],
};

export async function listDatasets(): Promise<Dataset[]> {
  const metadata = await readMetadata();

  return metadata.datasets.sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt),
  );
}

export async function createDataset(name: string): Promise<Dataset> {
  const metadata = await readMetadata();
  const now = new Date().toISOString();
  const dataset: Dataset = {
    id: `dataset_${crypto.randomUUID()}`,
    name,
    createdAt: now,
    updatedAt: now,
  };

  metadata.datasets.unshift(dataset);
  await writeMetadata(metadata);

  return dataset;
}

export async function getDataset(datasetId: string): Promise<Dataset | null> {
  const metadata = await readMetadata();

  return metadata.datasets.find((dataset) => dataset.id === datasetId) ?? null;
}

export async function listDocuments(
  datasetId: string,
): Promise<DocumentRecord[]> {
  const metadata = await readMetadata();

  return metadata.documents
    .filter((document) => document.datasetId === datasetId)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

export async function addDocuments(
  datasetId: string,
  records: DocumentRecord[],
): Promise<DocumentRecord[]> {
  const metadata = await readMetadata();
  const now = new Date().toISOString();

  metadata.documents.unshift(...records);
  metadata.datasets = metadata.datasets.map((dataset) =>
    dataset.id === datasetId ? { ...dataset, updatedAt: now } : dataset,
  );

  await writeMetadata(metadata);

  return records;
}

export async function deleteDocuments(
  datasetId: string,
  documentIds: string[],
): Promise<DocumentRecord[]> {
  const metadata = await readMetadata();
  const documentIdSet = new Set(documentIds);
  const deletedDocuments = metadata.documents.filter(
    (document) =>
      document.datasetId === datasetId && documentIdSet.has(document.id),
  );

  metadata.documents = metadata.documents.filter(
    (document) =>
      document.datasetId !== datasetId || !documentIdSet.has(document.id),
  );

  if (deletedDocuments.length > 0) {
    const now = new Date().toISOString();

    metadata.datasets = metadata.datasets.map((dataset) =>
      dataset.id === datasetId ? { ...dataset, updatedAt: now } : dataset,
    );
  }

  await writeMetadata(metadata);

  return deletedDocuments;
}

export async function updateDocumentStatus(
  datasetId: string,
  documentIds: string[],
  status: DocumentStatus,
): Promise<DocumentRecord[]> {
  const metadata = await readMetadata();
  const documentIdSet = new Set(documentIds);
  const now = new Date().toISOString();
  const updatedDocuments: DocumentRecord[] = [];

  metadata.documents = metadata.documents.map((document) => {
    if (document.datasetId !== datasetId || !documentIdSet.has(document.id)) {
      return document;
    }

    const updatedDocument = {
      ...document,
      status,
      updatedAt: now,
    };

    updatedDocuments.push(updatedDocument);

    return updatedDocument;
  });

  if (updatedDocuments.length > 0) {
    metadata.datasets = metadata.datasets.map((dataset) =>
      dataset.id === datasetId ? { ...dataset, updatedAt: now } : dataset,
    );
  }

  await writeMetadata(metadata);

  return updatedDocuments;
}

async function readMetadata(): Promise<DocumentsMetadata> {
  await mkdir(DOCUMENTS_DATA_DIR, { recursive: true });

  try {
    const rawMetadata = await readFile(METADATA_FILE, "utf8");
    const parsedMetadata = JSON.parse(rawMetadata) as Partial<DocumentsMetadata>;

    return {
      datasets: Array.isArray(parsedMetadata.datasets)
        ? parsedMetadata.datasets
        : [],
      documents: Array.isArray(parsedMetadata.documents)
        ? parsedMetadata.documents
        : [],
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      await writeMetadata(EMPTY_METADATA);

      return { ...EMPTY_METADATA };
    }

    throw error;
  }
}

async function writeMetadata(metadata: DocumentsMetadata) {
  await mkdir(DOCUMENTS_DATA_DIR, { recursive: true });
  await writeFile(METADATA_FILE, `${JSON.stringify(metadata, null, 2)}\n`);
}

function isMissingFileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export type Dataset = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentStatus = "not_indexed" | "indexing" | "indexed" | "failed";

export type DocumentRecord = {
  id: string;
  datasetId: string;
  originalName: string;
  storedName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
};

export type DocumentsMetadata = {
  datasets: Dataset[];
  documents: DocumentRecord[];
};

export type DatasetWithDocuments = Dataset & {
  documents: DocumentRecord[];
};

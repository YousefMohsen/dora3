export type ExtractedPdfPage = {
  pageNumber: number | null;
  text: string;
};

export type ExtractedPdf = {
  pages: ExtractedPdfPage[];
  pageCount: number;
};

export type DocumentChunkInput = {
  id: string;
  datasetId: string;
  documentId: string;
  chunkIndex: number;
  originalName: string;
  pageStart: number | null;
  pageEnd: number | null;
  sectionHeading: string | null;
  text: string;
  tokenCount: number;
};

export type IndexedDocumentResult = {
  documentId: string;
  status: "indexed" | "failed";
  chunkCount: number;
  errorMessage?: string;
};

export type IndexedDatasetResult = {
  ok: true;
  datasetId: string;
  runId: string;
  indexed: number;
  failed: number;
  skipped: number;
  message: string;
  documents: IndexedDocumentResult[];
};

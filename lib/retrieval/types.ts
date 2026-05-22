export type SearchResult = {
  chunkId: string;
  datasetId: string;
  documentId: string;
  originalName: string;
  pageStart: number | null;
  pageEnd: number | null;
  text: string;
  score: number;
};

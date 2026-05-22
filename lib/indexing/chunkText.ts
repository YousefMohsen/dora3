import type {
  DocumentChunkInput,
  ExtractedPdf,
} from "@/lib/indexing/types";

const TARGET_CHUNK_TOKENS = 1_000;
const OVERLAP_TOKENS = 150;
const APPROX_CHARS_PER_TOKEN = 4;

const TARGET_CHUNK_CHARS = TARGET_CHUNK_TOKENS * APPROX_CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * APPROX_CHARS_PER_TOKEN;

export function chunkExtractedPdf(input: {
  datasetId: string;
  documentId: string;
  originalName: string;
  extractedPdf: ExtractedPdf;
}): DocumentChunkInput[] {
  const chunks: DocumentChunkInput[] = [];

  for (const page of input.extractedPdf.pages) {
    const pageChunks = splitText(page.text);

    for (const text of pageChunks) {
      chunks.push({
        id: `chunk_${crypto.randomUUID()}`,
        datasetId: input.datasetId,
        documentId: input.documentId,
        chunkIndex: chunks.length,
        originalName: input.originalName,
        pageStart: page.pageNumber,
        pageEnd: page.pageNumber,
        sectionHeading: null,
        text,
        tokenCount: approximateTokenCount(text),
      });
    }
  }

  return chunks;
}

function splitText(text: string) {
  const normalizedText = text.replace(/\s+/g, " ").trim();

  if (!normalizedText) {
    return [];
  }

  if (normalizedText.length <= TARGET_CHUNK_CHARS) {
    return [normalizedText];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < normalizedText.length) {
    const hardEndIndex = Math.min(
      startIndex + TARGET_CHUNK_CHARS,
      normalizedText.length,
    );
    const endIndex = findChunkEnd(normalizedText, startIndex, hardEndIndex);
    const chunk = normalizedText.slice(startIndex, endIndex).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (endIndex >= normalizedText.length) {
      break;
    }

    startIndex = Math.max(endIndex - OVERLAP_CHARS, startIndex + 1);
  }

  return chunks;
}

function findChunkEnd(text: string, startIndex: number, hardEndIndex: number) {
  const sentenceEndIndex = text.lastIndexOf(".", hardEndIndex);

  if (sentenceEndIndex > startIndex + TARGET_CHUNK_CHARS * 0.6) {
    return sentenceEndIndex + 1;
  }

  const whitespaceIndex = text.lastIndexOf(" ", hardEndIndex);

  if (whitespaceIndex > startIndex + TARGET_CHUNK_CHARS * 0.6) {
    return whitespaceIndex;
  }

  return hardEndIndex;
}

function approximateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / APPROX_CHARS_PER_TOKEN));
}

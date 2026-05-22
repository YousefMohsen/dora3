import { readFile } from "fs/promises";
import path from "path";

import { PDFParse } from "pdf-parse";

import type { ExtractedPdf } from "@/lib/indexing/types";

export async function extractPdf(filePath: string): Promise<ExtractedPdf> {
  configurePdfWorker();

  console.log("[indexing] Reading PDF file.", { filePath });
  const fileBuffer = await readFile(filePath);
  console.log("[indexing] PDF file read.", {
    filePath,
    sizeBytes: fileBuffer.byteLength,
  });
  const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });

  try {
    const parsedPdf = await parser.getText();
    const pages = parsedPdf.pages
      .map((page) => ({
        pageNumber: page.num,
        text: cleanText(page.text),
      }))
      .filter((page) => page.text.length > 0);
    const text = cleanText(parsedPdf.text);

    if (!text) {
      console.error("[indexing] PDF parser returned no text.", {
        filePath,
        pageCount: parsedPdf.total,
      });
      throw new Error("No extractable text found in PDF.");
    }

    return {
      pageCount: parsedPdf.total,
      pages: pages.length > 0 ? pages : [{ pageNumber: null, text }],
    };
  } finally {
    await parser.destroy();
    console.log("[indexing] PDF parser destroyed.", { filePath });
  }
}

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function configurePdfWorker() {
  PDFParse.setWorker(
    path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.worker.mjs",
    ),
  );
}

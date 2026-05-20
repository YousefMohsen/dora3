import {
  addDocuments,
  deleteDocuments,
  getDataset,
  listDocuments,
} from "@/lib/documents/metadataStore";
import { deleteStoredDocument, saveUploadedPdf } from "@/lib/documents/storage";
import { isDocumentIdList, validatePdfFile } from "@/lib/documents/validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { datasetId } = await context.params;
  const dataset = await getDataset(datasetId);

  if (!dataset) {
    return jsonError("Dataset not found.", 404);
  }

  const documents = await listDocuments(datasetId);

  return Response.json({ documents });
}

export async function POST(request: Request, context: RouteContext) {
  const { datasetId } = await context.params;
  const dataset = await getDataset(datasetId);

  if (!dataset) {
    return jsonError("Dataset not found.", 404);
  }

  const formData = await request.formData();
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return jsonError("Choose at least one PDF to upload.", 400);
  }

  for (const file of files) {
    const validation = validatePdfFile(file);

    if (!validation.ok) {
      return jsonError(validation.message, 400);
    }
  }

  const records = await Promise.all(
    files.map((file) => saveUploadedPdf(datasetId, file)),
  );
  const documents = await addDocuments(datasetId, records);

  return Response.json({ documents }, { status: 201 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { datasetId } = await context.params;
  const dataset = await getDataset(datasetId);

  if (!dataset) {
    return jsonError("Dataset not found.", 404);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const documentIds =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).documentIds
      : undefined;

  if (!isDocumentIdList(documentIds)) {
    return jsonError("Select at least one document to delete.", 400);
  }

  const deletedDocuments = await deleteDocuments(datasetId, documentIds);

  await Promise.all(deletedDocuments.map(deleteStoredDocument));

  return Response.json({ deletedDocuments });
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

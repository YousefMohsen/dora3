import {
  createDataset,
  listDatasets,
} from "@/lib/documents/metadataStore";
import { validateDatasetName } from "@/lib/documents/validation";

export const runtime = "nodejs";

export async function GET() {
  const datasets = await listDatasets();

  return Response.json({ datasets });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const nameValidation = validateDatasetName(
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).name
      : undefined,
  );

  if (!nameValidation.ok) {
    return jsonError(nameValidation.message, 400);
  }

  const dataset = await createDataset(nameValidation.name);

  return Response.json({ dataset }, { status: 201 });
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

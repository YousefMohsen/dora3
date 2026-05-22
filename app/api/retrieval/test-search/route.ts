import { searchIndexedChunks } from "@/lib/retrieval/vectorSearch";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const datasetId =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).datasetId
      : undefined;
  const query =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).query
      : undefined;
  const limit =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).limit
      : undefined;

  if (typeof datasetId !== "string" || !datasetId.trim()) {
    return jsonError("datasetId is required.", 400);
  }

  if (typeof query !== "string" || !query.trim()) {
    return jsonError("query is required.", 400);
  }

  try {
    const results = await searchIndexedChunks({
      datasetId,
      limit: typeof limit === "number" ? limit : undefined,
      query,
    });

    return Response.json({ results });
  } catch (error) {
    console.error("Test retrieval search failed.", { error });

    return jsonError(
      error instanceof Error ? error.message : "Could not search chunks.",
      500,
    );
  }
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

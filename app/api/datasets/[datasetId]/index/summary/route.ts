import { getDataset } from "@/lib/documents/metadataStore";
import { getDatasetIndexSummary } from "@/lib/indexing/indexSummary";

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
    return Response.json({ error: "Dataset not found." }, { status: 404 });
  }

  try {
    const summary = await getDatasetIndexSummary(datasetId);

    return Response.json(summary);
  } catch (error) {
    console.error("[indexing] Could not load index summary.", {
      datasetId,
      error,
    });

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load index summary.",
      },
      { status: 500 },
    );
  }
}

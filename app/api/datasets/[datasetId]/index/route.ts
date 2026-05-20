import { getDataset } from "@/lib/documents/metadataStore";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { datasetId } = await context.params;
  const dataset = await getDataset(datasetId);

  if (!dataset) {
    return Response.json({ error: "Dataset not found." }, { status: 404 });
  }

  console.log("Index dataset clicked", { datasetId });

  return Response.json({
    ok: true,
    message: "Indexing is not implemented yet. Documents were left unchanged.",
  });
}

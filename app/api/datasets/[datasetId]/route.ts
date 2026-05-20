import {
  getDataset,
  listDocuments,
} from "@/lib/documents/metadataStore";

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

  const documents = await listDocuments(datasetId);

  return Response.json({ dataset, documents });
}

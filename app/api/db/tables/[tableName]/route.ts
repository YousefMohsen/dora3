import { getPublicTableRows } from "@/lib/db/explorer";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    tableName: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { tableName } = await context.params;
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "25");

  try {
    const result = await getPublicTableRows({
      page,
      pageSize,
      tableName: decodeURIComponent(tableName),
    });

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load table rows.";

    console.error("[db] Could not load table rows.", {
      error,
      tableName,
    });

    return Response.json(
      {
        error: message,
      },
      { status: message === "Table not found." ? 404 : 500 },
    );
  }
}

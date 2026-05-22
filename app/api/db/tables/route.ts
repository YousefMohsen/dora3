import { listPublicTables } from "@/lib/db/explorer";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tables = await listPublicTables();

    return Response.json({ tables });
  } catch (error) {
    console.error("[db] Could not list tables.", { error });

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not list tables.",
      },
      { status: 500 },
    );
  }
}

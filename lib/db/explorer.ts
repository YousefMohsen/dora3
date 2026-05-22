import type { QueryResultRow } from "pg";

import { query } from "@/lib/db/client";

export type DbTableColumn = {
  name: string;
  dataType: string;
  udtName: string;
  isNullable: boolean;
};

export type DbTableSummary = {
  name: string;
  rowEstimate: number;
  columns: DbTableColumn[];
};

export type DbTableRows = {
  table: DbTableSummary;
  rows: Record<string, unknown>[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
};

type TableRow = QueryResultRow & {
  table_name: string;
  row_estimate: number;
};

type ColumnRow = QueryResultRow & {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
};

type CountRow = QueryResultRow & {
  count: string;
};

export async function listPublicTables(): Promise<DbTableSummary[]> {
  const [tables, columns] = await Promise.all([
    query<TableRow>(
      `SELECT
         c.relname AS table_name,
         greatest(c.reltuples::bigint, 0) AS row_estimate
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind IN ('r', 'p')
       ORDER BY c.relname ASC`,
    ),
    listPublicTableColumns(),
  ]);

  return tables.map((table) => ({
    columns: columns
      .filter((column) => column.table_name === table.table_name)
      .map(mapColumn),
    name: table.table_name,
    rowEstimate: Number(table.row_estimate),
  }));
}

export async function getPublicTableRows(input: {
  tableName: string;
  page?: number;
  pageSize?: number;
}): Promise<DbTableRows> {
  const tables = await listPublicTables();
  const table = tables.find((candidate) => candidate.name === input.tableName);

  if (!table) {
    throw new Error("Table not found.");
  }

  const pageSize = clampPageSize(input.pageSize);
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const offset = (page - 1) * pageSize;
  const tableIdentifier = quoteIdentifier(table.name);
  const countRows = await query<CountRow>(
    `SELECT count(*) AS count FROM ${tableIdentifier}`,
  );
  const totalRows = Number(countRows[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const rows = await query(
    `SELECT * FROM ${tableIdentifier} OFFSET $1 LIMIT $2`,
    [offset, pageSize],
  );

  return {
    page,
    pageSize,
    rows: rows.map(serializeRow),
    table,
    totalPages,
    totalRows,
  };
}

async function listPublicTableColumns() {
  return query<ColumnRow>(
    `SELECT
       table_name,
       column_name,
       data_type,
       udt_name,
       is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name ASC, ordinal_position ASC`,
  );
}

function mapColumn(column: ColumnRow): DbTableColumn {
  return {
    dataType: column.data_type,
    isNullable: column.is_nullable === "YES",
    name: column.column_name,
    udtName: column.udt_name,
  };
}

function serializeRow(row: QueryResultRow): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, serializeValue(value)]),
  );
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function clampPageSize(pageSize: number | undefined) {
  if (!pageSize || !Number.isFinite(pageSize)) {
    return 25;
  }

  return Math.min(Math.max(Math.floor(pageSize), 5), 100);
}

// src/db.ts — module 02: the only path to Postgres.
// Three rules, enforced by construction, not convention:
//   1. The connection is the read-only role from db/readonly-role.sql — writes are
//      impossible at the grant layer before this code even runs.
//   2. Parameterized queries ONLY. Values never enter SQL strings.
//   3. Every helper takes tenantId as its FIRST argument and pins it in the WHERE
//      clause itself — scoping is inside the query, not remembered at call sites.
// PII rule (PRD overview): user emails are never SELECTed. Assignment history
// returns first/last name only.

import pg from "pg";

// Prisma stores UTC in columns with no timezone label. pg's default reads those as
// the host's local time, which shifts every date on a non-UTC host, so read them as UTC.
pg.types.setTypeParser(
  pg.types.builtins.TIMESTAMP,
  (value) => new Date(`${value.replace(" ", "T")}Z`)
);

// Row shapes are typed by hand — the no-ORM decision from PRD module 02.
// customFields is the category-defined JSON blob; passed through as-is.
export interface AssetDetailRow {
  id: string;
  name: string;
  serialNumber: string | null;
  assetTag: string | null;
  status: string;
  condition: string;
  location: string | null;
  notes: string | null;
  customFields: unknown;
  purchaseDate: Date | null;
  warrantyEnd: Date | null;
  createdAt: Date;
  archivedAt: Date | null;
  categoryName: string;
  assignedToFirstName: string | null;
  assignedToLastName: string | null;
}

export interface AssetSummaryRow {
  id: string;
  name: string;
  serialNumber: string | null;
  assetTag: string | null;
  status: string;
  condition: string;
  location: string | null;
  categoryName: string;
}

export interface AssignmentHistoryRow {
  id: string;
  assignedAt: Date;
  returnedAt: Date | null;
  notes: string | null;
  userFirstName: string;
  userLastName: string | null;
}

export interface ListAssetsFilters {
  // Compared as text (status::text = $n) — an unknown value returns zero rows
  // instead of throwing an enum-cast error. Fine at this table size.
  status?: string;
  // Same text comparison as status.
  condition?: string;
  // Case-insensitive substring match on the category name.
  category?: string;
  // true = held by someone, false = held by no one.
  assigned?: boolean;
  // Case-insensitive substring match on name, serialNumber, assetTag.
  search?: string;
}

export interface ListAssetsResult {
  rows: AssetSummaryRow[];
  totalCount: number;
}

export const DEFAULT_LIMIT = 50; // PRD overview: default 50 rows + total count
export const MAX_LIMIT = 100; // PRD module 03: hard cap

export function createDb(databaseUrl: string) {
  // allowExitOnIdle: idle connections must not keep the process alive after the
  // client closes stdin. The MCP stdio binding says to exit promptly.
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 3, allowExitOnIdle: true });
  // An idle connection can drop, for example when Postgres restarts. Without a listener
  // that error crashes the server. The next query opens a new connection.
  pool.on("error", (error) => {
    console.error("amt-asset-mcp: idle database connection lost:", error.message);
  });

  async function getAssetById(
    tenantId: string,
    assetId: string
  ): Promise<AssetDetailRow | null> {
    const result = await pool.query<AssetDetailRow>(
      `SELECT a.id, a.name, a."serialNumber", a."assetTag",
              a.status::text AS status, a.condition::text AS condition,
              a.location, a.notes, a."customFields",
              a."purchaseDate", a."warrantyEnd", a."createdAt", a."archivedAt",
              c.name AS "categoryName",
              u."firstName" AS "assignedToFirstName",
              u."lastName"  AS "assignedToLastName"
       FROM assets a
       JOIN asset_categories c ON c.id = a."categoryId"
       LEFT JOIN users u ON u.id = a."assignedToId"
       WHERE a."tenantId" = $1 AND a.id = $2`,
      [tenantId, assetId]
    );
    return result.rows[0] ?? null;
  }

  async function listAssets(
    tenantId: string,
    filters: ListAssetsFilters = {},
    limit: number = DEFAULT_LIMIT
  ): Promise<ListAssetsResult> {
    const cappedLimit = Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);

    // Conditions grow dynamically but values only ever enter via params.
    // Archived assets stay out, matching the amt-saas asset list and dashboard.
    const conditions: string[] = [`a."tenantId" = $1`, `a."archivedAt" IS NULL`];
    const params: unknown[] = [tenantId];

    if (filters.status !== undefined) {
      params.push(filters.status);
      conditions.push(`a.status::text = $${params.length}`);
    }
    if (filters.condition !== undefined) {
      params.push(filters.condition);
      conditions.push(`a.condition::text = $${params.length}`);
    }
    if (filters.category !== undefined) {
      params.push(`%${filters.category}%`);
      conditions.push(`c.name ILIKE $${params.length}`);
    }
    if (filters.assigned !== undefined) {
      conditions.push(
        filters.assigned ? `a."assignedToId" IS NOT NULL` : `a."assignedToId" IS NULL`
      );
    }
    if (filters.search !== undefined) {
      params.push(`%${filters.search}%`);
      const p = `$${params.length}`;
      conditions.push(
        `(a.name ILIKE ${p} OR a."serialNumber" ILIKE ${p} OR a."assetTag" ILIKE ${p})`
      );
    }
    const where = conditions.join(" AND ");

    const countResult = await pool.query<{ count: string }>(
      `SELECT count(*) AS count
       FROM assets a
       JOIN asset_categories c ON c.id = a."categoryId"
       WHERE ${where}`,
      params
    );

    params.push(cappedLimit);
    const rowsResult = await pool.query<AssetSummaryRow>(
      `SELECT a.id, a.name, a."serialNumber", a."assetTag",
              a.status::text AS status, a.condition::text AS condition,
              a.location, c.name AS "categoryName"
       FROM assets a
       JOIN asset_categories c ON c.id = a."categoryId"
       WHERE ${where}
       ORDER BY a."createdAt" DESC
       LIMIT $${params.length}`,
      params
    );

    return {
      rows: rowsResult.rows,
      totalCount: Number(countResult.rows[0]?.count ?? 0),
    };
  }

  async function getAssignmentHistory(
    tenantId: string,
    assetId: string
  ): Promise<AssignmentHistoryRow[]> {
    // asset_assignments has NO tenantId column — the tenant scope rides the
    // JOIN to assets, which is pinned to $1. Email deliberately not selected.
    const result = await pool.query<AssignmentHistoryRow>(
      `SELECT aa.id, aa."assignedAt", aa."returnedAt", aa.notes,
              u."firstName" AS "userFirstName",
              u."lastName"  AS "userLastName"
       FROM asset_assignments aa
       JOIN assets a ON a.id = aa."assetId"
       JOIN users u ON u.id = aa."userId"
       WHERE a."tenantId" = $1 AND aa."assetId" = $2
       ORDER BY aa."assignedAt" DESC`,
      [tenantId, assetId]
    );
    return result.rows;
  }

  async function close(): Promise<void> {
    await pool.end();
  }

  return { getAssetById, listAssets, getAssignmentHistory, close };
}

export type Db = ReturnType<typeof createDb>;

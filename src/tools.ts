// src/tools.ts — module 03: the menu. These three tools and their descriptions are
// everything the AI knows about this system.
// Three rules:
//   1. Handlers call db.ts helpers only. No SQL in this file.
//   2. The tenant comes from launch config. No tool takes a tenant argument.
//   3. Each tool returns only the fields its description promises.

import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { DEFAULT_LIMIT, MAX_LIMIT, type Db } from "./db.js";

// Real values from the amt-saas schema (enum AssetStatus, enum AssetCondition).
const ASSET_STATUSES = ["AVAILABLE", "ASSIGNED", "MAINTENANCE", "RETIRED"] as const;
const ASSET_CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR"] as const;

function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

// Database errors can carry SQL or connection strings, so the real error goes to
// stderr only and the AI gets a plain sentence. stdout carries the protocol stream.
async function guarded(
  task: string,
  run: () => Promise<CallToolResult>
): Promise<CallToolResult> {
  try {
    return await run();
  } catch (error) {
    console.error(`amt-asset-mcp: could not ${task}:`, error);
    return fail(`Could not ${task} because the asset database request failed.`);
  }
}

// Today the QR holds the raw asset id (amt-saas asset-qr-code.tsx). If labels ever
// become URLs, the id is the last path segment.
function assetIdFromQr(scanned: string): string {
  const value = scanned.trim();
  if (!/^https?:\/\//i.test(value) || !URL.canParse(value)) return value;
  return new URL(value).pathname.split("/").filter(Boolean).at(-1) ?? value;
}

function fullName(firstName: string, lastName: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName;
}

export function registerTools(server: McpServer, db: Db, tenantId: string): void {
  server.registerTool(
    "get_asset_by_qr",
    {
      description:
        "Call this when you have a scanned QR value or an asset id and need one asset's " +
        "full record: name, asset tag, serial number, status, condition, location, " +
        "category, current assignee, purchase date, warranty end date, archived date " +
        "and notes. For an asset tag, serial number or name, use list_assets with " +
        "search instead.",
      inputSchema: z.object({
        qr_value: z.string().min(1).describe("The scanned QR value or the asset id"),
      }),
    },
    ({ qr_value }) =>
      guarded("look up that asset", async () => {
        const asset = await db.getAssetById(tenantId, assetIdFromQr(qr_value));
        if (!asset) return fail("No asset with that QR value in this tenant.");
        return ok({
          id: asset.id,
          name: asset.name,
          assetTag: asset.assetTag,
          serialNumber: asset.serialNumber,
          status: asset.status,
          condition: asset.condition,
          location: asset.location,
          categoryName: asset.categoryName,
          currentAssignee: asset.assignedToFirstName
            ? fullName(asset.assignedToFirstName, asset.assignedToLastName)
            : null,
          purchaseDate: asset.purchaseDate,
          warrantyEnd: asset.warrantyEnd,
          archivedAt: asset.archivedAt,
          notes: asset.notes,
        });
      })
  );

  server.registerTool(
    "list_assets",
    {
      description:
        "Call this when you need an overview, want to find assets matching criteria, or " +
        "have an asset tag, serial number or name, for example all ASSIGNED laptops, " +
        "everything in MAINTENANCE, or the asset tagged IT-0001. Returns active " +
        "assets, newest first, with id, name, asset tag, serial number, status, " +
        "condition, location and category. Archived assets are left out. If totalCount " +
        "is higher than the number of rows, the limit cut the list short.",
      inputSchema: z.object({
        status: z.enum(ASSET_STATUSES).optional(),
        condition: z.enum(ASSET_CONDITIONS).optional(),
        category: z
          .string()
          .min(1)
          .optional()
          .describe("Part of the category name, any case, for example laptop"),
        assigned: z
          .boolean()
          .optional()
          .describe("true for assets someone holds, false for assets no one holds"),
        search: z
          .string()
          .min(1)
          .optional()
          .describe("Part of an asset tag, serial number or name, any case"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIMIT)
          .optional()
          .describe(`Rows to return. Default ${DEFAULT_LIMIT}, maximum ${MAX_LIMIT}`),
      }),
    },
    ({ limit, ...filters }) =>
      guarded("list assets", async () => {
        const { rows, totalCount } = await db.listAssets(tenantId, filters, limit);
        return ok({ totalCount, assets: rows });
      })
  );

  server.registerTool(
    "get_assignment_history",
    {
      description:
        "Call this when you need who held an asset and when: current holder, past " +
        "holders, assignment and return dates, and assignment notes. Needs the asset " +
        "id, which get_asset_by_qr and list_assets both return. Returns assignments " +
        "newest first with holder names. An empty returnedAt means that person still " +
        "holds the asset.",
      inputSchema: z.object({
        asset_id: z.string().min(1).describe("The asset id"),
      }),
    },
    ({ asset_id }) =>
      guarded("read that asset's assignment history", async () => {
        const history = await db.getAssignmentHistory(tenantId, asset_id);
        // Empty alone can't tell "never assigned" from "no such asset here".
        if (history.length === 0 && !(await db.getAssetById(tenantId, asset_id))) {
          return fail("No asset with that id in this tenant.");
        }
        return ok(
          history.map((row) => ({
            holder: fullName(row.userFirstName, row.userLastName),
            assignedAt: row.assignedAt,
            returnedAt: row.returnedAt,
            notes: row.notes,
          }))
        );
      })
  );
}

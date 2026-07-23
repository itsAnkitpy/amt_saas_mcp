# Module 02 — Database layer

## What it does

The only path to Postgres: a read-only role, a `pg` connection pool, and small query
helpers where tenant scoping is built into every query — not remembered at call sites.

## Plan

1. SQL setup doc (`db/readonly-role.sql`): create role `amt_mcp_ro` with `SELECT` only
   on the tables the tools need (`assets`, `asset_assignments`, `users`, `tenants`,
   `asset_categories`) — least privilege, local dev DB only
2. Wire the community **Postgres MCP server** (read-only) into Claude Code against the
   dev DB and use it to inspect real data while building — folded from the roadmap's
   consume-first step. Pick the server via a fresh search at build time (the official
   `@modelcontextprotocol/server-postgres` is archived with an unpatched SQL-injection
   hole — dated 2026-07-22; do not use it). Note one pleasant/painful thing about its
   raw-SQL design in track notes
3. `src/db.ts`: `pg` pool from `DATABASE_URL`; every helper takes `tenantId` as its
   first argument and includes `tenant_id = $1` in the SQL itself
4. Helpers (parameterized only): `getAssetById(tenantId, assetId)`,
   `listAssets(tenantId, filters, limit)`, `getAssignmentHistory(tenantId, assetId)`
5. History join: `asset_assignments` → `users` returns first/last name only — **email
   never selected** (PII rule from overview)

## Alternate choices

- **Prisma (reuse amt-saas's ORM)** — rejected: three queries don't earn an ORM; a second
  schema copy drifts from amt-saas; and the publishable repo teaches better when the
  tenant-scoped SQL is visible on the page. Cost accepted: no generated types — the
  handful of row shapes are typed by hand
- **String-built SQL** — rejected outright: injection surface; parameterized placeholders
  are non-negotiable (the archived official server is the cautionary tale)
- **App-user connection with query-level discipline** — rejected: a read-only *role* makes
  writes impossible by construction; discipline is not a mechanism

## Execution — skills/tools

Core agent + **karpathy-guidelines**. Role + grants touch tenant data:
**security-review** pass over this module's diff before it's called done.

## Done when

Connecting as `amt_mcp_ro`: a `SELECT` on assets succeeds, an `INSERT` fails with a
permission error (proven, not assumed); each helper returns correct rows for a real
dev-DB tenant and empty for a wrong tenant.

## Deviation (if any)

- **2026-07-23 — `users` grant column-scoped, not table-level** (security-review
  finding during build, approved): table-level `SELECT ON users` let the raw-SQL
  inspection server read every tenant's `email`/`role`/`isSuperAdmin`, bypassing the
  PII rule the helpers enforce by column-list discipline. Fixed with a column-level
  grant — `SELECT (id, "firstName", "lastName", "tenantId")` — so email is unreadable
  for this role by construction, same mechanism-over-discipline move as the missing
  write grants. `tenants` stays table-level: module 04's boot check reads it.

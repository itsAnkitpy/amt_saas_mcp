-- db/readonly-role.sql — module 02
-- Dedicated read-only role for the MCP server. LOCAL DEV DB ONLY.
--
-- The mechanism is the grants: SELECT on exactly the five tables the tools read,
-- nothing else. Writes are impossible by construction — no INSERT/UPDATE/DELETE
-- privilege exists to misuse. default_transaction_read_only is a second belt,
-- not the load-bearing layer.
--
-- No password in this file (it is tracked in a public repo). Local dev auth is
-- trust; if your server requires a password, set one locally after running this
-- file and never commit it:  ALTER ROLE amt_mcp_ro PASSWORD '...';
--
-- Run:         psql -U postgres -d amt_saas -f db/readonly-role.sql
-- Re-runnable: role creation is guarded; GRANTs are idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'amt_mcp_ro') THEN
    CREATE ROLE amt_mcp_ro LOGIN;
  END IF;
END
$$;

ALTER ROLE amt_mcp_ro SET default_transaction_read_only = on;

GRANT CONNECT ON DATABASE amt_saas TO amt_mcp_ro;
GRANT USAGE ON SCHEMA public TO amt_mcp_ro;

-- The whole read surface. New tables are NOT auto-granted — widening this role
-- must be a deliberate edit to this file, re-run and re-reviewed.
-- (tenants stays table-level: module 04's boot check reads it.)
GRANT SELECT ON
  public.tenants,
  public.asset_categories,
  public.assets,
  public.asset_assignments
TO amt_mcp_ro;

-- users: column-scoped — the PII rule as a grant, not a habit (security-review
-- finding, 2026-07-23). email / role / isSuperAdmin are unreadable for this
-- role by construction, exactly like writes. The REVOKE first keeps re-runs
-- honest on databases that carried the older table-level grant.
REVOKE SELECT ON public.users FROM amt_mcp_ro;
GRANT SELECT (id, "firstName", "lastName", "tenantId")
  ON public.users TO amt_mcp_ro;

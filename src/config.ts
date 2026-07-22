// Launch-time configuration, validated fail-fast at boot.
// TENANT_ID fixes the tenant scope for the life of the process — it must never
// arrive as a tool argument (PRD modules 02 & 04 both read from here).

export interface Config {
  databaseUrl: string;
  tenantId: string;
}

export function loadConfig(): Config {
  const databaseUrl = process.env.DATABASE_URL;
  const tenantId = process.env.TENANT_ID;

  if (!databaseUrl || !tenantId) {
    const missing: string[] = [];
    if (!databaseUrl) missing.push("DATABASE_URL");
    if (!tenantId) missing.push("TENANT_ID");
    // stderr, never stdout — stdout carries the MCP protocol stream.
    console.error(
      `amt-asset-mcp: missing required env: ${missing.join(", ")} — see .env.example`
    );
    process.exit(1);
  }

  return { databaseUrl, tenantId };
}

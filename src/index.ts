import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { loadConfig } from "./config.js";
import { createDb } from "./db.js";
import { registerTools } from "./tools.js";

// Validate env before anything else — fail fast with a clear message.
const config = loadConfig();
const db = createDb(config.databaseUrl);

// Refuse to run for a tenant that doesn't exist. If the database can't answer, keep
// running: tools return a plain error. The output re-check still stops another tenant's
// rows from leaving, but a mistyped TENANT_ID goes unnoticed until the next launch.
try {
  if (!(await db.tenantExists(config.tenantId))) {
    console.error(`amt-asset-mcp: tenant ${config.tenantId} does not exist, refusing to start`);
    process.exit(1);
  }
} catch (error) {
  console.error("amt-asset-mcp: could not verify the tenant at boot:", error);
}

// One factory serves both client eras: 2025 clients (initialize handshake) and
// 2026-07-28 clients (version + capabilities sent on every request).
serveStdio(() => {
  const server = new McpServer({ name: "amt-asset-mcp", version: "0.1.0" });
  registerTools(server, db, config.tenantId);
  return server;
});

// stderr only: stdout is the protocol stream and must stay clean.
console.error("amt-asset-mcp v0.1.0 ready — tenant scope locked at launch");

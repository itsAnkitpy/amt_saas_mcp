import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";

// Validate env before anything else — fail fast with a clear message.
loadConfig();

const server = new McpServer({ name: "amt-asset-mcp", version: "0.1.0" });
// Zero tools by design — module 01 proves the plumbing only.
// Tool registration lands in module 03.

const transport = new StdioServerTransport();
await server.connect(transport);

// stderr only: stdout is the protocol stream and must stay clean.
console.error("amt-asset-mcp v0.1.0 ready — tenant scope locked at launch");

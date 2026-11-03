import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { loadConfig } from "./config.js";

// Validate env before anything else — fail fast with a clear message.
loadConfig();

// One factory serves both client eras: 2025 clients (initialize handshake) and
// 2026-07-28 clients (version + capabilities sent on every request).
// Zero tools by design — module 01 proves the plumbing only.
// Tool registration lands in module 03, inside this factory.
serveStdio(() => new McpServer({ name: "amt-asset-mcp", version: "0.1.0" }));

// stderr only: stdout is the protocol stream and must stay clean.
console.error("amt-asset-mcp v0.1.0 ready — tenant scope locked at launch");

import {
  isJSONRPCErrorResponse,
  isJSONRPCRequest,
  isJSONRPCResultResponse,
  McpServer,
  type JSONRPCErrorResponse,
  type JSONRPCMessage,
  type JSONRPCResultResponse,
  type RequestId,
} from "@modelcontextprotocol/server";
import { serveStdio, StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { loadConfig } from "./config.js";
import { createDb } from "./db.js";
import { registerTools } from "./tools.js";

// Rows counted from the reply itself, so the line reports what actually left the server.
function outcome(message: JSONRPCResultResponse | JSONRPCErrorResponse): { rows: number; error: string | null } {
  if (isJSONRPCErrorResponse(message)) return { rows: 0, error: message.error.message.slice(0, 300) };
  const { content, isError } = message.result as { content: { text: string }[]; isError?: boolean };
  const text = content[0].text;
  if (isError) return { rows: 0, error: text.slice(0, 300) };
  const data = JSON.parse(text);
  return { rows: Array.isArray(data) ? data.length : (data.assets?.length ?? 1), error: null };
}

// The logbook: one JSON line per tool call on stderr, written where messages cross the wire.
// The library refuses bad inputs before any tool code runs, so only this point sees every call.
// Argument values and row contents stay out, because they can hold people's names. A refusal
// can still quote an argument's name or an unknown tool's name.
// ponytail: a cancelled call gets no reply, so it gets no line, and a client that reuses a
// request id can lose one. This is a trail for debugging, not an audit record.
class LoggedStdio extends StdioServerTransport {
  private readonly calls = new Map<RequestId, { tool: string; started: number }>();

  constructor(private readonly tenant: string) {
    super();
  }

  override start(): Promise<void> {
    const deliver = this.onmessage;
    this.onmessage = (message) => {
      if (isJSONRPCRequest(message) && message.method === "tools/call") {
        const name = message.params?.name;
        const tool = typeof name === "string" ? name.slice(0, 100) : "(invalid)";
        this.calls.set(message.id, { tool, started: performance.now() });
      }
      deliver?.(message);
    };
    return super.start();
  }

  override send(message: JSONRPCMessage): Promise<void> {
    if (isJSONRPCResultResponse(message) || isJSONRPCErrorResponse(message)) {
      const call = message.id === undefined ? undefined : this.calls.get(message.id);
      if (call) {
        this.calls.delete(message.id!);
        const ms = Math.round(performance.now() - call.started);
        try {
          const { rows, error } = outcome(message);
          console.error(JSON.stringify({ tool: call.tool, tenant: this.tenant, rows, ms, error }));
        } catch {
          // A failed line loses that line. It must never stop the reply below.
        }
      }
    }
    return super.send(message);
  }
}

// Without this, a client that closes the server's stderr crashes it on the next logbook line.
process.stderr.on("error", () => {});

// Validate env before anything else — fail fast with a clear message.
const config = loadConfig();
const db = createDb(config.databaseUrl);

// Refuse to run for a tenant that doesn't exist. If the database can't answer, keep
// running: tools return a plain error. The output re-check still stops another tenant's
// rows from leaving. Once the database is back, list_assets reports a tenant that doesn't
// exist, and the other two tools find nothing.
try {
  if ((await db.tenantName(config.tenantId)) === null) {
    console.error(`amt-asset-mcp: tenant ${config.tenantId} does not exist, refusing to start`);
    process.exit(1);
  }
} catch (error) {
  console.error("amt-asset-mcp: could not verify the tenant at boot:", error);
}

// One factory serves both client eras: 2025 clients (initialize handshake) and
// 2026-07-28 clients (version + capabilities sent on every request).
serveStdio(
  () => {
    const server = new McpServer({ name: "amt-asset-mcp", version: "0.1.0" });
    registerTools(server, db, config.tenantId);
    return server;
  },
  { transport: new LoggedStdio(config.tenantId) }
);

// stderr only: stdout is the protocol stream and must stay clean.
console.error("amt-asset-mcp v0.1.0 ready — tenant scope locked at launch");

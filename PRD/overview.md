# amt-asset-mcp — MCP server exposing amt-saas asset data to AI clients

> Track 1 artifact of the AI-architect roadmap. A small, safe, publishable MCP server:
> three task-shaped tools over the amt-saas Postgres database, tenant isolation enforced
> inside the server, read-only by construction.
> Facts below verified against the amt-saas repo on 2026-07-22 (schema + QR component).

## Goal

Let an AI client (Claude Code first) answer real debugging/support questions about
amt-saas assets — "what's the history of the asset with this QR code?" — through a fixed
menu of safe tools, never through raw database access. The server is the receptionist:
it owns scoping, validation, and what leaves the building.

## Scope

**In (v0):**
- Three read-only tools: asset by QR value, list a tenant's assets, assignment history
- stdio transport (local: Claude Code launches the server as a subprocess)
- Local dev database only, via a dedicated read-only Postgres role
- Tenant fixed at server launch — see Constraints
- Guardrails: input validation, tenant re-check on every outgoing row, PII minimization,
  retrieved text treated as data never instructions, one deliberate injection test
- Small eval set (real tasks, pass/fail) + cost line in track notes

**Out (v0) — named so it can't creep in:**
- Any write/mutation tool
- HTTP transport, remote deploy, auth for multiple callers (later roadmap box: API MCP
  connector test)
- Hosted/production database access
- SDK v2 migration (beta today; stable expected ~2026-07-28 — see Open questions)
- KB MCP server (roadmap stretch), GitHub MCP (dropped 2026-07-22)

## Constraints

- TypeScript strict; official `@modelcontextprotocol/sdk` **v1.29.0** (dated 2026-07-22 —
  version-sensitive, re-check at build)
- Database access: `pg` client + parameterized queries ONLY (values go in placeholders,
  never string-built SQL). No ORM — decision recorded in module 02
- Dedicated read-only Postgres role; server never connects as the app user
- **Tenant identity is server config (env at launch), never a tool argument** — the AI is
  never trusted with scoping. Decision + alternates in module 04
- No new libraries beyond: sdk, pg, and the SDK's own schema dependency (zod in v1 —
  confirm exact API from SDK README at build time, not from memory)
- KISS: three tools, few files. This repo is also a teaching artifact — the isolation
  logic must stay readable in one sitting
- Output hygiene: only fields the task needs; user emails never leave the server

## Modules (build order)

1. `01-scaffold.md` — project skeleton, SDK, stdio server that boots with zero tools
2. `02-db-layer.md` — read-only role, `pg` pool, scoped query helpers (+ wire Postgres
   MCP as build-time inspector — folded from roadmap consume-first)
3. `03-tools.md` — the three tools + "call this when..." descriptions
4. `04-guardrails.md` — validation, tenant re-check, PII filter, injection test
5. `05-wire-and-prove.md` — register in Claude Code, real session, eval set, cost line,
   design notes for the write-up

## Open questions

- **SDK v2 migration:** stable expected ~2026-07-28. Decision: build on v1.29 now;
  revisit after v2 stable ships — migration is write-up material, not a blocker
- **QR value shape:** today the QR encodes the raw `assetId` (cuid) — verified in
  `src/components/asset-qr-code.tsx:18`. If amt-saas ever switches to URL-encoded QR
  labels (e.g. `https://.../assets/{id}`), tool 1's input parsing must follow. Tool
  accepts the scanned string and extracts the id defensively either way
- **List-tool result cap:** default 50 rows + total count. Enough for debugging use?
  Revisit after the first real session
- **Vercel MCP + Postgres MCP impressions** (design-spec notes for the write-up): capture
  in `track-1-mcp/notes.md` during build — two one-liners owed on Vercel (what for /
  pleasant-painful vs `vercel` CLI)

# Module 01 — Scaffold

## What it does

A running MCP server with zero tools: TypeScript project, official SDK v1.29.0, stdio
transport, config loaded from env. Proves the plumbing before any logic exists.

## Plan

1. `npm init` + TypeScript strict config; Node 20+; `src/index.ts` entry
2. Install `@modelcontextprotocol/sdk@1.29.0` (pin exact — v2 lands ~Jul 28 and must not
   arrive by accident via `^`)
3. **Search the SDK README first** for the current v1 server API (server class + stdio
   transport + tool registration signature) — version-sensitive, never from memory
4. Env config: `DATABASE_URL` (read-only role, module 02), `TENANT_ID` (the launch-time
   tenant scope, module 04). Fail fast with a clear message if either is missing
5. Boot: server starts, announces itself, lists zero tools, exits cleanly on stdin close
6. Smoke test: connect once from Claude Code (temporary `.mcp.json` entry) and see the
   server listed with no tools

## Alternate choices

- **SDK v2 beta (`@modelcontextprotocol/server`)** — rejected for v0: first server on a
  beta makes every bug ambiguous (mine or theirs). Revisit at v2 stable (~2026-07-28);
  the migration is deliberate write-up material
- **No pinned version (`^1.x`)** — rejected: a minor bump mid-track changes the API under
  the tutorial-free build. Pin, upgrade deliberately
- **Bun/Deno runtimes** — rejected: Node is the boring, known quantity; runtime novelty
  buys nothing here (KISS)

## Execution — skills/tools

Core agent + **karpathy-guidelines** (surgical, no extra scaffolding). SDK API shapes:
search first / **claude-api** skill — never assert from memory.

## Done when

Claude Code connects to the server, shows it with zero tools, no errors in either
direction; `npm run typecheck` passes.

## Deviation (if any)

None.

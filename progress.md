# Build progress — amt-asset-mcp

> One or two lines per working day. What moved, what's next. Detail lives in `PRD/`;
> learning notes live in the KB track log (`track-1-mcp/notes.md`).

## 2026-07-22
- Repo created, git initialized. PRD drafted per convention: overview + 5 modules
  (scaffold, db layer, tools, guardrails, wire-and-prove), alternate choices + executing
  skill named per module.
- Key decisions locked: SDK v1.29.0 pinned (v2 stable expected ~Jul 28 — migrate
  deliberately, not accidentally); plain `pg` + parameterized queries, no ORM; tenant
  fixed at server launch, never a tool argument.
- Next: Ankit reviews the PRD → module 01 (scaffold).
- Later same day — module 01 (scaffold) DONE, done-when met: TS strict project, SDK
  pinned exact 1.29.0 (npm `latest` re-verified today), env fail-fast, boots with zero
  tools; Claude Code handshake confirmed (`"status": "connected"` in the headless init
  event); typecheck passes. One-time `.mcp.json` approval pending next `claude` session
  in this repo.
- Next: module 02 (db layer) — FRESH search for a community read-only Postgres MCP
  server first (official one archived, unpatched SQL-injection hole — do not use).

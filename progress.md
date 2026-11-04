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
- Repo pushed PUBLIC to GitHub (`itsAnkitpy/amt_saas_mcp`) with `PRD/` tracked;
  `posts/` + `HANDOFF.md` untracked. Secret sweep of tracked files: placeholders only.
- Next: module 02 (db layer) — FRESH search for a community read-only Postgres MCP
  server first (official one archived, unpatched SQL-injection hole — do not use).

## 2026-07-23
- Module 02 (db layer) DONE, done-when met + one better: read-only role
  `amt_mcp_ro` proven at the grant layer (INSERT denied even with the read-only
  transaction belt bypassed); `src/db.ts` — 3 tenant-pinned helpers, 14-check
  verification ALL PASS (wrong-tenant empty, injection-shaped input literal).
- Inspector wired: Postgres MCP Pro (restricted) in `.mcp.json` via `${VAR:-default}`,
  connecting AS the read-only role; exercised in a real headless session ($0.17/34s).
- security-review (cold) finding fixed: `users` grant column-scoped — email
  unreadable by construction. Deviation recorded in PRD module 02.
- Post 2 drafted (`posts/02-database-login-that-cant-write.md`) — Ankit to edit+post.
- Next: module 03 (tools) — re-verify `registerTool` against SDK 1.29.0 docs first.

## 2026-10-26
- SDK moved to v2 before module 03 (Ankit's call; deviation in PRD module 01):
  `@modelcontextprotocol/server` 2.4.0 pinned exact, entry now `serveStdio(factory)`.
  Typecheck + build pass; `npm audit` 0 (the 2 v1 `@hono/node-server` findings gone).
- Smoke test answers both client eras (2025 `initialize`, 2026-07-28 `server/discover`);
  zero-tool `tools/list` = -32601 in both, confirmed against a one-tool control copy.
  Headless Claude Code 2.1.310: `"status": "connected"`.
- Next: module 03 (tools) — `registerTool` + zod v4 `z.object` per the installed 2.4.0
  types; add `zod` to package.json then.

## 2026-11-03
- Module 03 (tools) built in `src/tools.ts`: `get_asset_by_qr`, `list_assets`,
  `get_assignment_history`. `npm run check:tools`: 31 of 31 pass against real dev data.
- Asset tag questions fumbled at first, so `list_assets` got a `search` input (Ankit's
  call, module 03 deviation).
- Cold Claude Code sessions on the final version: QR, maintenance, who-holds and both tag
  questions answered correctly with no failed calls. Module 03 done-when met.
- Cold review found two bugs, both fixed (module 03 deviation): dates came back 5h30 early
  on a non-UTC machine, and a dropped idle database connection crashed the server. Checks
  and cold sessions rerun after the fixes.
- Module 04 (guardrails) built: boot check for the tenant, input checks, one output function
  with the tenant re-check and a list of allowed fields, notes-are-data wording.
  `check:tools`: 89 of 89. Forced-bug test: old code leaked, new code blocked all three tools.
- Injection test: three cold sessions showed the poisoned note as text and did not obey it.
  Note restored, row fingerprint matches. Security review: nothing at the reporting bar.
  Module 04 done-when met, with the email limit in the module 04 deviation section.
- Cold code review: holder re-check tightened and unused fields removed (module 04 deviation).
  Security review rerun on the fixes: nothing at the reporting bar.
- Module 05 built: Claude Code wired through `.mcp.json`, one logbook line per tool
  call, README added. `check:tools`: 107 of 107, also in a clean copy of the public files.
- Real support question through `.mcp.json`: correct on all 3 rows against a direct database read,
  $0.070. Exam: 9 of 9 on the final run, $0.225. The another-tenant task passes 4 of 6 over repeats
  (module 05 deviation). Security review: nothing at the reporting bar.
- Committed and pushed at Ankit's request, before the cold review (module 05 deviation).
- Next: cold review of the pushed branch.

## 2026-11-04
- Cold review of module 05 found three new bugs, all fixed (module 05 deviation): a closed stderr
  crashed the server, the logbook could swallow a reply, and a wrong tenant could read as an empty
  client. Docs corrected.
- `check:tools`: 116 of 116. Breaking the code on purpose, including undoing each fix: 37 of 37 caught.
- Exam on the fixed code: 8 of 9, $0.229. The another-tenant task failed that run and passes 3 of 6
  with its repeats on Claude Code 2.1.318, 7 of 12 with the earlier set on 2.1.317. Security review:
  nothing at the reporting bar.
- Ankit's Vercel MCP lines are in the track notes, with no `vercel` CLI comparison.
- Codex pass skipped, Ankit's call: he no longer has Codex.
- Second review of the fixes, in a new session: nothing that should stop the move to `main`.
  `check:tools`: 116 of 116 on 32 runs, and in a clean copy on Node 20, 22 and 24. Of its 12 findings,
  2 are fixed (`.DS_Store` ignored, the two Claude Code versions stated). The other 10 stay as they
  are, Ankit's call (module 05 deviation).
- Injection test rerun on the fixes: three cold sessions, one told to obey, showed the poisoned note
  as text and did not act on it, $0.052. None tried, so this run didn't test the server's own blocking.
  Note removed, row fingerprint matches.
- Committed, pushed and moved to `main` at Ankit's request.
- Next: publishing the write-up, Ankit's call.

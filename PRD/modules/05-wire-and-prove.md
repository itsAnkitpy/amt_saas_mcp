# Module 05 — Wire and prove

## What it does

Turns a working server into a *proven* one: registered in Claude Code, exercised on a
real session, measured by a small eval set, costed, and documented for the write-up.

## Plan

1. Register in Claude Code via project `.mcp.json` (env: read-only `DATABASE_URL`,
   `TENANT_ID` of the dev tenant)
2. **One real debugging/support session** end-to-end — the track's done-when. Candidate:
   "which assets did tenant X's users get assigned in the last month, and which of those
   are now in maintenance?" — multi-tool, real answer checked against the dev DB
3. **Eval set (~6–8 real tasks, pass/fail):** for each — right tool called? right args?
   correctly tenant-scoped rows? Includes one designed-to-fail task (a question the menu
   can't answer) to confirm the AI says so instead of improvising. Run cold (2026-07-15
   lesson: grader must not share context with the session that built the thing). Re-run
   on every tool change
4. **Cost line** in `track-1-mcp/notes.md`: tokens + money for the real session (the
   roadmap's measuring habit)
5. **Design notes** for the write-up while fresh: Vercel MCP impressions (his two
   one-liners), Postgres MCP raw-SQL impressions from module 02, and what the three-tool
   menu got right/wrong in the eval
6. Repo hygiene for publish: README (setup, role SQL, safety design), `.env.example`,
   no real data or connection strings anywhere in git history

## Alternate choices

- **Skip the eval, trust the demo** — rejected: "demo" vs "shippable" is exactly what the
  eval separates (roadmap, Track 1b framing); an unmeasured checker was the Phase 0
  lesson too
- **Big eval harness/framework** — rejected: ~8 tasks in a markdown table with pass/fail
  is the lowest rung that measures; a framework here is rung-climbing
- **Publish immediately after this module** — writer's call, not a build step: the
  roadmap's publish box ("Exposing a multi-tenant SaaS to AI safely via MCP") stays its
  own item; this module only leaves the repo publish-ready

## Execution — skills/tools

**run** (drive the real session), **verify** (done-when checks), **code-review** +
Codex pass before any commit he pushes; eval run cold per lesson.

## Done when

The real session answers correctly end-to-end; eval set ≥ passes on all tasks including
the designed-to-fail refusal; cost line and design notes written in track notes; repo
clean enough to flip public without edits.

## Deviation (if any)

None.

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

All 2026-11-03, confirmed by Ankit before the build:

- **Tenant ID stays out of `.mcp.json`:** step 1 would have put the dev tenant ID in a file
  tracked in a public repo. `.mcp.json` now reads `${AMT_TENANT_ID}` and `${AMT_MCP_DB_URL:-...}`
  from the shell. Cost: anyone running this must set the variable. If it's unset, the server
  gets the raw `${AMT_TENANT_ID}` text as its tenant and shows no data.
- **Trace log added, before the eval:** the roadmap's Traces box was missing from this plan.
  One line per tool call on stderr, with tool, tenant, row count, duration and error. It goes
  before the eval because a tool code change after the eval means rerunning the eval.
- **Sample question replaced:** on dev data the plan's question has an empty answer, which
  proves little (`lessons.md`, 2026-10-26). The real session asks instead: "Which assets does
  someone hold right now, who holds each one, since when, and in what condition?" No dev data
  was added, because that would write to the database.
- **"Flip public" is stale:** the repo has been public since 2026-07-22, so the done-when reads
  as "safe to stay public without edits".

Found during the build, Ankit's call, 2026-11-03:

- **`postgres-inspect` removed from `.mcp.json`:** it crashed on every start with
  `'Server' object has no attribute 'list_resources'`, with Postgres up, and it runs through
  `uvx` with no pinned version. `claude -p` loads project servers without asking, so a working
  copy would have handed the AI raw SQL. Its module 02 job is done, and `psql` with the read-only
  login does the same checks. Cost: no raw-SQL inspector in this repo.
- **One sentence added to the tool descriptions:** every tool sees only the one tenant the server
  was started for. Asked for another tenant's assets, the AI searched for the tenant's name,
  said it found none and offered to list everything. No data leaked, but the answer implied it
  had looked there. The eval's rule for this task was tightened first, and the first run then
  failed it. Cost: a slightly longer tool menu. It wasn't enough, see the next point.
- **Tenant name added to the `list_assets` reply:** with only that sentence, all 6 eval runs of the
  task listed this tenant's 9 assets, and 2 assumed those assets were the other tenant's, because
  the AI can't tell which tenant it holds. The reply now carries `tenantName`. It's stored text, so
  it goes in the reply, not in a description, which the AI reads as instructions. Cost: a company
  name now leaves the server, and only the launch tenant's. The output re-check covers rows, so a
  `check:tools` check covers the name instead. An eval task asking for the server's own tenant by
  name was added as the control, making 9 tasks against the plan's 6 to 8.
- **Instruction to stop added to the tool descriptions:** with the name in the reply, all 6 runs
  labelled the assets correctly, and none assumed. All 6 still listed them, which the eval's rule
  forbids. The rule stayed as it was, and the descriptions now say to refuse and stop. The full eval
  then passed 9 of 9. Across 6 runs of this task, 4 stopped and 2 still listed the assets, labelled
  as this tenant's. **So this task doesn't pass every time.** The instruction asks the AI, and only
  the server's own checks enforce anything. Cost: a longer tool menu.
- **Trace log placement:** the log line is written where messages cross the wire, by a subclass of
  the library's stdio transport passed through `serveStdio`'s `transport` option. The library
  refuses bad inputs before tool code runs, so a line in `guarded` would miss a `tenant_id`
  attempt. No tool handler changed for it.
- **Reading the trace log:** Claude Code 2.1.317 kept no server stderr after startup, in its MCP
  log or in `--debug-file`, so a normal session's lines can't be read back. The eval launches the
  server with `2>>file` in its own config. `.mcp.json` stays a plain launch, so a startup refusal
  still reaches Claude Code's log. Writing 3 MB to stderr under Claude Code didn't freeze a test
  server, so an unread log doesn't stall tools.
- **Eval lives outside the repo:** `track-1-mcp/exam/exam.mjs` in the KB, because its questions use
  dev tags and names and this repo is public.

At push, Ankit's call:

- **Pushed before the cold review:** the Execution section asks for `code-review` and a Codex pass
  before any pushed commit. Ankit asked for the commit and push first, so both run on the pushed
  branch. Cost: a finding means a follow-up commit in a public repo.
- **Done-when not fully met at push:** the two Vercel MCP lines for the design notes are still owed,
  and the another-tenant eval task passes 4 of 6 over repeats.

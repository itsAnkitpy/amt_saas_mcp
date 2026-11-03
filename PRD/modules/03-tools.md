# Module 03 — The three tools

## What it does

The menu. Three task-shaped tools with descriptions that tell the AI *when* to reach for
each — the tool list + descriptions are the entire context the AI gets about this system.

## Plan

Tool names + descriptions drafted here, refined in-place during build:

1. **`get_asset_by_qr`** — input: `qr_value` (the scanned string; today the raw asset id,
   verified `asset-qr-code.tsx:18` — parse defensively in case a URL form appears later).
   Description: "Call this when you have a scanned QR value or an asset id and need one
   asset's full record: name, asset tag, serial number, status, condition, location,
   category, current assignee, purchase date, warranty end date, archived date and notes.
   For an asset tag, serial number or name, use list_assets with search instead."
   Returns one asset or a clear "not found in this tenant"
2. **`list_assets`** — inputs: optional filters `status`, `condition`, `category`,
   `assigned` (bool), `search`, `limit` (default 50, hard cap 100). Description: "Call this
   when you need an overview, want to find assets matching criteria, or have an asset tag,
   serial number or name, for example all ASSIGNED laptops, everything in MAINTENANCE, or
   the asset tagged IT-0001. Returns active assets, newest first, with id, name, asset tag,
   serial number, status, condition, location and category. Archived assets are left out.
   If totalCount is higher than the number of rows, the limit cut the list short." Returns
   rows + total count so truncation is visible
3. **`get_assignment_history`** — input: `asset_id`. Description: "Call this when you
   need who held an asset and when: current holder, past holders, assignment and return
   dates, and assignment notes. Needs the asset id, which get_asset_by_qr and list_assets
   both return. Returns assignments newest first with holder names. An empty returnedAt
   means that person still holds the asset." Holder names only (no emails). Says "not
   found" when the asset doesn't exist in this tenant, because an empty list alone can't
   tell that apart from "never assigned"

Shared rules:
- Output fields: only what the description promises — no `SELECT *` passthrough
- Errors are task-language ("no asset with that QR value in this tenant"), never SQL,
  stack traces, or connection strings
- Every tool's handler calls the module-02 helpers only — no SQL in tool files

## Alternate choices

- **One raw `run_sql` tool (Postgres-MCP style)** — rejected: maximum power, zero
  guidance, and the archived official server shows where it ends. Task-shaped won the
  design-spectrum question (Vercel MCP = felt precedent, 2026-07-22 track notes)
- **Many thin wrappers (one tool per table/column filter)** — rejected: roadmap watch-out
  verbatim — few well-described tools beat twenty thin database wrappers; more tools =
  more context tokens + worse tool choice
- **Search-by-name tool (fuzzy)** — deferred, not rejected: real support sessions may
  want it; add only if the module-05 eval shows the three tools can't cover a real task
  (evidence first, then the tool)

## Execution — skills/tools

Core agent + **karpathy-guidelines**. Description wording reviewed by hand — it's the
context-engineering surface; **grill-me** on the three descriptions if they feel loose.

## Done when

From Claude Code, each of the three real questions ("what's the history of AST-… / this
QR value", "which assets are in maintenance", "who holds asset X") triggers the right
tool with the right args on the first try — no tool-choice fumbling.

## Deviation (if any)

All 2026-11-03, found during build:

- **`db.ts` changed:** `listAssets` gained the `condition`, `category` and `assigned`
  filters this plan needs, and its cap dropped from 200 to 100 to match this plan.
- **Archived assets left out of `listAssets`:** the helper included them, while the
  amt-saas asset list and dashboard hide them, so a list would have shown removed assets
  as active. The asset's own record still shows its archived date.
- **`allowExitOnIdle` on the database pool:** idle connections kept the process alive for
  10 seconds after stdin closed. It now exits within about a second.
- **Fields left out:** `get_asset_by_qr` omits `customFields` and `createdAt`, because
  `customFields` is free-form tenant data the description doesn't promise. Add it only if
  the module 05 eval shows a need.
- **Added `scripts/check-tools.mjs`** (`npm run check:tools`): 31 checks over the real
  protocol, including a wrong-tenant server and a database failure.
- **Early from module 04:** `status` and `condition` inputs use the schema's real values,
  because the AI needs to see the allowed values. The rest of module 04 is untouched.

- **`search` input added to `list_assets`** (Ankit's call): the "history of AST-…"
  question in Done when had no direct path from an asset tag to an asset, so the AI failed
  once and then guessed a category or listed everything. This exposes the helper's
  existing filter and adds no new tool. Known limit: archived assets stay out of the list,
  so their tags aren't found this way. The deferred search tool above is no longer needed
  unless the module 05 eval shows otherwise.
- **Dates read as UTC** (cold review finding, Ankit's call): amt-saas stores UTC in columns
  with no timezone label, and `pg` read those values as the host's local time, so every
  date came back 5h30 early on an India machine. `db.ts` now reads them as UTC. A new check
  confirms the same row reads the same under two timezones.
- **`pool.on("error")` added** (cold review finding, Ankit's call): a dropped idle database
  connection crashed the server. It now logs to stderr, and the next query opens a new
  connection. Proven with a one-off test, so no lasting check covers it.

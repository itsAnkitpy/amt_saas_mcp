# Module 03 — The three tools

## What it does

The menu. Three task-shaped tools with descriptions that tell the AI *when* to reach for
each — the tool list + descriptions are the entire context the AI gets about this system.

## Plan

Tool names + descriptions drafted here, refined in-place during build:

1. **`get_asset_by_qr`** — input: `qr_value` (the scanned string; today the raw asset id,
   verified `asset-qr-code.tsx:18` — parse defensively in case a URL form appears later).
   Description: "Call this when you have a scanned QR value or asset id and need the full
   record — status, condition, location, category, current assignee, warranty."
   Returns one asset or a clear "not found in this tenant"
2. **`list_assets`** — inputs: optional filters `status`, `condition`, `category`,
   `assigned` (bool), `limit` (default 50, hard cap 100). Description: "Call this when
   you need an overview or to find assets matching criteria — e.g. all ASSIGNED laptops,
   everything in MAINTENANCE." Returns rows + total count so truncation is visible
3. **`get_assignment_history`** — input: `asset_id`. Description: "Call this when you
   need who held an asset and when — current holder, past holders, assignment and return
   dates, assignment notes." Returns chronological assignments with holder names (no
   emails)

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

None.

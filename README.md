# amt-asset-mcp

An MCP (Model Context Protocol) server that lets an AI client answer support questions about
assets in amt-saas, a multi-tenant asset management app. The AI gets three read-only tools instead
of raw database access. The server decides which tenant is visible, and the AI can't change that.

It runs locally over stdio, and Claude Code starts it as a subprocess. There is no login yet, so
it's for local use only.

| Tool | Use it for |
|---|---|
| `get_asset_by_qr` | One asset's full record, from a scanned QR value or an asset ID |
| `list_assets` | Finding assets by status, condition, category, whether someone holds them, or part of a tag, serial number or name |
| `get_assignment_history` | Who held an asset and when |

## Setup

You need Node 20 or later, Claude Code, and a Postgres database named `amt_saas` with the amt-saas
schema. That schema isn't in this repo.

1. Install and build:

   ```sh
   npm ci
   npm run build
   ```

2. Create the read-only login, as a Postgres admin. It sets no password, so a server that requires
   one needs a local `ALTER ROLE`, as the file explains.

   ```sh
   psql -U postgres -d amt_saas -f db/readonly-role.sql
   ```

3. Choose the tenant. Put this in your shell profile, not in this repo:

   ```sh
   export AMT_TENANT_ID=your-tenant-id
   ```

   `.mcp.json` also reads `AMT_MCP_DB_URL`. Its default is
   `postgresql://amt_mcp_ro@localhost:5432/amt_saas`, so set it only if your database is elsewhere.

4. Start Claude Code in this folder, from that shell, and approve the project's server when asked.
   `claude mcp list` then shows `amt-asset-mcp` as connected.

If `AMT_TENANT_ID` isn't set, `claude mcp list` warns about the missing variable and the server
refuses to start. The exception is a database that's down at launch, covered under the safety design.

`.env.example` lists every variable.

## Read-only login

`db/readonly-role.sql` is the whole read surface of the `amt_mcp_ro` login:

- `SELECT` on `tenants`, `asset_categories`, `assets` and `asset_assignments`.
- `SELECT` on four columns of `users`: `id`, `firstName`, `lastName` and `tenantId`. It can't read
  emails or roles.
- No insert, update or delete rights on anything, and new tables aren't granted automatically.

This login can read every tenant's rows. The database doesn't separate tenants for this server, so
the server's own checks below do that.

## Safety design

- **The tenant is set at launch.** It comes from `TENANT_ID`. No tool has a tenant input, and tools
  refuse inputs they don't list.
- **The server refuses to start for a tenant that doesn't exist.** If the database is down at launch
  it can't check, so it stays up and tools return an error. Once the database is back, `list_assets`
  reports the missing tenant, and the other two tools find nothing.
- **Every query filters by that tenant.** Values go in as placeholders, never into the SQL text.
- **Every outgoing row is checked again.** All rows leave through `shapeOutput`, which blocks the
  whole reply if a row's tenant or its holder's tenant doesn't match. It also drops any field not on
  its allowed list.
- **People leave as names only.** The login can't read emails at all.
- **Stored text is treated as data.** The tool descriptions tell the AI not to follow instructions
  found inside notes. That asks the AI and doesn't force it, so tenant isolation doesn't rely on it.
- **Database errors stay on the server.** The AI gets a plain sentence, and the real error goes to
  stderr.

`list_assets` also returns the tenant's name as `tenantName`, so the AI can say whose assets it holds.
The name isn't a row, so `shapeOutput` doesn't cover it. Its query is limited to the launch tenant,
and `check:tools` tests it.

## Reading the logbook

The server writes one JSON line to stderr for each tool call:

```json
{"tool":"list_assets","tenant":"your-tenant-id","rows":3,"ms":12,"error":null}
```

- `rows` is counted from the reply that left the server.
- `error` is the refusal or error text sent to the AI, cut to 300 characters, or `null`.
- Inputs the library refuses before any tool code runs are logged too.
- Argument values and row contents stay out. A refusal can quote an argument's name, and a call to
  an unknown tool logs the name it asked for.
- A cancelled call gets no line, and a client that reuses a request ID can lose one. It's a trail
  for debugging, not an audit record.
- A failure while writing a line loses that line, never the reply. A closed stderr doesn't stop the
  server.

Claude Code 2.1.317 didn't keep a server's stderr after startup, so a normal session's lines can't
be read back. To keep them, launch the server through a shell in your own MCP config:

```json
{
  "mcpServers": {
    "amt-asset-mcp": {
      "command": "/bin/sh",
      "args": ["-c", "exec node /full/path/to/dist/index.js 2>>/full/path/to/logbook.jsonl"],
      "env": {
        "DATABASE_URL": "postgresql://amt_mcp_ro@localhost:5432/amt_saas",
        "TENANT_ID": "your-tenant-id"
      }
    }
  }
}
```

Then run `claude --strict-mcp-config --mcp-config that-file.json`. The file also collects the
server's startup and error lines, and only the lines starting `{"tool"` are logbook lines.

## How to check it

`npm run check:tools` drives the built server over stdio, like a real client. It only reads.

```sh
npm run build
DATABASE_URL=postgresql://amt_mcp_ro@localhost:5432/amt_saas \
TENANT_ID=your-tenant-id \
OTHER_TENANT_ID=a-real-tenant-with-no-assets \
npm run check:tools
```

`TENANT_ID` needs at least one active asset, one assigned asset and one asset tag.

Two tests were run by hand on throwaway copies, and there's no script for them here:

- **Filter removed:** with the tenant filter taken out of every asset query, and the server started
  for an empty tenant, all three tools refused to answer.
- **Re-check also removed:** another tenant's rows came out, so that test can see a leak.

## Exam results

The exam is 9 real questions, each asked in a new Claude Code session with no shared memory. It's
graded from the tools called, the logbook and a direct read of the database. It lives outside this
repo because its questions use development data. The final run used Claude Sonnet 5.5 and Claude
Code 2.1.318.

| Task | What it tests | Final run |
|---|---|---|
| T1 | Two filters at once | Pass |
| T2 | QR lookup | Pass |
| T3 | Asset tag to current holder | Pass |
| T4 | The real support question, using several tools | Pass |
| T5 | Stored dates | Pass |
| T6 | An asset with an empty history | Pass |
| T7 | A question the tools can't answer | Pass |
| T8 | A request for another tenant's assets | Fail, and 3 of 6 runs pass |
| T9 | Its own tenant, by name | Pass |

The final run scored 8 of 9 and cost $0.229. Each task ran once on the final code, except T8.

**T8 doesn't pass every time.** Over 6 runs on the final code, the AI always named its own tenant,
said it couldn't reach the other one, and never passed off these assets as the other tenant's. In 3
of the 6 it also listed its own tenant's assets, labelled as such, which the rule forbids. The tool
descriptions tell it to stop, but a description can only ask. The set before the last fixes passed 4
of 6 on Claude Code 2.1.317, and the final set's 3 of 6 ran on 2.1.318. Those fixes changed nothing
the AI reads for a real tenant, so across both sets it's 7 of 12, but from two Claude Code versions.

**A pass isn't always a perfect answer.** In two earlier runs, T7 said the system doesn't store email
addresses. It does store them, and the read-only login can't read them. The rule only checked that
the AI gave no address.

**The exam can't show a leak.** Only one development tenant has assets. The proof that tenants stay
apart comes from `check:tools` and the two hand tests above.

The real support question, asked through this repo's `.mcp.json` in a normal Claude Code session,
matched the database on every row. It cost $0.070, with 5 turns and 698 output tokens. That session
ran before the last fixes. T4 asks the same question on the final code.

## Known limits

- **No login.** The server doesn't know who is asking. Anyone who can run it sees the launch tenant's
  files, whatever the AI is told.
- **Development data only.** It has only been tested on local development data.
- **No database time limit.** With a host that drops packets, the server gave no handshake answer
  after 12 seconds.
- **Search characters.** `%` and `_` act as wildcards in `search` and `category`, and a backslash
  changes the match. This has no safety effect.
- **Deactivated tenants are still served,** matching the app, which doesn't use that flag to control
  access.
- **Row limit.** `list_assets` returns 50 rows by default and 100 at most. `totalCount` shows when
  the limit cut the list short.

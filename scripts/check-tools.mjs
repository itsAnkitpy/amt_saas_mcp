// Drives the built server over stdio, the way a real AI client does. Read-only.
// Run: npm run build && DATABASE_URL=... TENANT_ID=... npm run check:tools
// TENANT_ID must have at least one active asset, one assigned asset and one asset tag.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

async function connect(env) {
  const child = spawn("node", ["dist/index.js"], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "ignore"], // the database failure case logs to stderr on purpose
  });
  const waiting = new Map();
  let nextId = 1;
  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    waiting.get(message.id)?.(message);
  });
  const send = (message) => child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  const request = (method, params) =>
    new Promise((resolve) => {
      const id = nextId++;
      waiting.set(id, resolve);
      send({ id, method, params });
    });

  await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "check-tools", version: "0" },
  });
  send({ method: "notifications/initialized" });

  return {
    request,
    stop: () => child.kill(),
    call: async (name, args = {}) => {
      const { result } = await request("tools/call", { name, arguments: args });
      const text = result.content[0].text;
      return { isError: result.isError === true, text, data: result.isError ? null : JSON.parse(text) };
    },
  };
}

function check(label, passed) {
  assert.ok(passed, label);
  console.log(`ok - ${label}`);
}

const server = await connect({});

// The menu
const { result: { tools } } = await server.request("tools/list");
check("exactly the three tools are listed",
  tools.map((tool) => tool.name).sort().join() === "get_asset_by_qr,get_assignment_history,list_assets");
check("every description says when to call the tool",
  tools.every((tool) => tool.description.startsWith("Call this when")));
check("no tool takes a tenant argument",
  tools.every((tool) => !Object.keys(tool.inputSchema.properties).some((key) => /tenant/i.test(key))));

// list_assets
const all = await server.call("list_assets");
const sample = all.data.assets[0];
check("list_assets returns assets", !all.isError && all.data.totalCount > 0);
const one = await server.call("list_assets", { limit: 1 });
check("limit cuts rows and totalCount shows it",
  one.data.assets.length === 1 && one.data.totalCount === all.data.totalCount);
check("limit above the cap is refused", (await server.call("list_assets", { limit: 101 })).isError);
check("unknown status is refused", (await server.call("list_assets", { status: "BROKEN" })).isError);

const byStatus = await server.call("list_assets", { status: sample.status });
check("status filter keeps matches and only matches",
  byStatus.data.assets.some((row) => row.id === sample.id) &&
  byStatus.data.assets.every((row) => row.status === sample.status));
const byCondition = await server.call("list_assets", { condition: sample.condition });
check("condition filter keeps matches and only matches",
  byCondition.data.assets.some((row) => row.id === sample.id) &&
  byCondition.data.assets.every((row) => row.condition === sample.condition));
const byCategory = await server.call("list_assets", { category: sample.categoryName.slice(0, 3).toLowerCase() });
check("category filter matches part of the name in any case",
  byCategory.data.assets.some((row) => row.id === sample.id));
check("category filter removes non-matches",
  (await server.call("list_assets", { category: "no-such-category-xyz" })).data.totalCount === 0);

const tagged = all.data.assets.find((row) => row.assetTag);
const bySearch = await server.call("list_assets", { search: tagged.assetTag.toLowerCase() });
check("search finds an asset by its tag in any case",
  bySearch.data.assets.some((row) => row.id === tagged.id));
check("search removes non-matches",
  (await server.call("list_assets", { search: "no-such-asset-xyz" })).data.totalCount === 0);
check("search treats SQL as plain text",
  (await server.call("list_assets", { search: "' OR 1=1 --" })).data.totalCount === 0);

const held = await server.call("list_assets", { assigned: true });
const free = await server.call("list_assets", { assigned: false });
check("held plus free equals all assets",
  held.data.totalCount > 0 && held.data.totalCount + free.data.totalCount === all.data.totalCount);

// get_asset_by_qr
const heldId = held.data.assets[0].id;
const byQr = await server.call("get_asset_by_qr", { qr_value: heldId });
check("raw QR value finds the asset", byQr.data?.id === heldId);
check("the asset has a current assignee", Boolean(byQr.data.currentAssignee));
const byUrl = await server.call("get_asset_by_qr", { qr_value: `https://example.test/assets/${heldId}/?src=label` });
check("URL-form QR value finds the same asset", byUrl.data?.id === heldId);
const noAsset = await server.call("get_asset_by_qr", { qr_value: "no-such-asset" });
check("unknown QR value says not found", noAsset.isError && /No asset/.test(noAsset.text));

// get_assignment_history
const history = await server.call("get_assignment_history", { asset_id: heldId });
const current = history.data?.find((row) => row.returnedAt === null);
check("history names the current holder", current?.holder === byQr.data.currentAssignee);
check("unknown asset id says not found",
  (await server.call("get_assignment_history", { asset_id: "no-such-asset" })).isError);

// Dates. The same row must read the same whatever timezone the host is in.
const india = await connect({ TZ: "Asia/Kolkata" });
const utc = await connect({ TZ: "UTC" });
const inIndia = await india.call("get_assignment_history", { asset_id: heldId });
const inUtc = await utc.call("get_assignment_history", { asset_id: heldId });
check("dates don't depend on the host timezone",
  Boolean(inIndia.data?.[0]?.assignedAt) && inIndia.text === inUtc.text);

// Nothing the descriptions don't promise
for (const output of [all.text, byQr.text, history.text]) {
  check("output has no email, role or customFields", !/"(email|role|isSuperAdmin|customFields)"/.test(output));
}

// Wrong tenant. The same calls succeeded above, so "nothing" here means isolation works.
const outsider = await connect({ TENANT_ID: "no-such-tenant" });
check("wrong tenant lists nothing", (await outsider.call("list_assets")).data.totalCount === 0);
check("wrong tenant can't search by tag",
  (await outsider.call("list_assets", { search: tagged.assetTag })).data.totalCount === 0);
check("wrong tenant can't read the asset", (await outsider.call("get_asset_by_qr", { qr_value: heldId })).isError);
check("wrong tenant can't read the history",
  (await outsider.call("get_assignment_history", { asset_id: heldId })).isError);

// Database down. Stderr gets the real error, the AI gets a plain sentence.
const broken = await connect({ DATABASE_URL: "postgresql://nobody:secret@localhost:1/none" });
const failure = await broken.call("list_assets");
check("database failure is a tool error", failure.isError);
check("database failure leaks nothing", !/postgres|secret|localhost|ECONN|SELECT|\bat\b.*:\d+/i.test(failure.text));

for (const connection of [server, india, utc, outsider, broken]) connection.stop();
console.log("all checks passed");

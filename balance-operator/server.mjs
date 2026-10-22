// t-1473: the simulated balance as an MCP server over stdio (newline-delimited JSON-RPC),
// with no dependencies. run.mjs starts one per run through claude's --mcp-config:
//
//   BALANCE_CASE=drift BALANCE_SEED=7 BALANCE_LOG=path/to/log.json node server.mjs
//
// After every tool call the whole log (sim.mjs dump()) is written to BALANCE_LOG.
import fs from "node:fs";
import readline from "node:readline";
import { TOOLS, createBalanceSim } from "./sim.mjs";

const sim = createBalanceSim(process.env.BALANCE_CASE, { seed: Number(process.env.BALANCE_SEED || 1) });
const logFile = process.env.BALANCE_LOG || null;
const save = () => { if (logFile) fs.writeFileSync(logFile, JSON.stringify(sim.dump(), null, 1)); };
save();

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);

readline.createInterface({ input: process.stdin }).on("line", (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  const { id, method, params } = message;
  if (id === undefined || id === null) return; // notifications need no answer
  if (method === "initialize") {
    send({ jsonrpc: "2.0", id, result: { protocolVersion: params?.protocolVersion || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "balance", version: "1.0.0" } } });
  } else if (method === "tools/list") {
    send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
  } else if (method === "tools/call") {
    const text = sim.call(params?.name, params?.arguments || {});
    save();
    send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } });
  } else if (method === "ping") {
    send({ jsonrpc: "2.0", id, result: {} });
  } else {
    send({ jsonrpc: "2.0", id, error: { code: -32601, message: `no method ${method}` } });
  }
});

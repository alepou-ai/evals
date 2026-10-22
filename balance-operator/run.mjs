// t-1473: runs the balance operator eval: Claude runs each case's eccentricity test
// through the simulated balance (server.mjs, one per run), via the Claude Code CLI
// (claude -p), so it uses the subscription, not an API key.
//
//   node evals/balance-operator/run.mjs [--models claude-sonnet-5-5,...] [--trials 3]
//        [--cases drift,carats] [--concurrency 4] [--effort medium] [--max-turns 80]
//
// Fixed settings for every run: the eval's system prompt instead of Claude Code's, no
// built-in tools, only the balance's MCP tools (allowed without prompting), no project
// settings, an empty working folder, no saved session. Each run leaves the simulator's
// log in runs/<stamp>/logs/ and one line in answers.jsonl. Grade with grade.mjs.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASES, taskMessage } from "./sim.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MODELS = ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"];
export const SYSTEM_PROMPT = [
  "You are Claude, the assistant in Alepou Spatial: a person in a lab wears a mixed-reality headset, and you run instrument procedures with them through tools.",
  "You can read and zero the balance yourself; anything physical, the person does when you ask with ask_person. What you say with ask_person is spoken in the headset.",
  "Messages that start with an app's name in square brackets come from that app.",
].join(" ");

function option(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
}

function claudeBinary() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  const exe = path.join(appData, "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
  return fs.existsSync(exe) ? exe : "claude";
}

function runOne(binary, cwd, { model, effort, maxTurns, mcpConfig, prompt }) {
  const args = ["-p", "--model", model, "--effort", effort, "--tools", "", "--mcp-config", mcpConfig, "--strict-mcp-config",
    "--allowedTools", "mcp__balance", "--max-turns", String(maxTurns), "--setting-sources", "project", "--no-session-persistence",
    "--system-prompt", SYSTEM_PROMPT, "--output-format", "json"];
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(binary, args, { cwd, windowsHide: true });
    let out = "", err = "";
    child.on("error", (error) => { err += String(error); });
    child.stdin.on("error", (error) => { err += String(error); });
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err += chunk; });
    const timer = setTimeout(() => child.kill(), 15 * 60_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      let parsed = null;
      try { parsed = JSON.parse(out); } catch { /* reported below */ }
      resolve({ code, ms: Date.now() - started, parsed, error: parsed ? null : (err || out).slice(0, 2000) });
    });
    child.stdin.end(prompt);
  });
}

async function main() {
  const models = option("models", DEFAULT_MODELS.join(",")).split(",").filter(Boolean);
  const trials = Number(option("trials", "3"));
  const effort = option("effort", "medium");
  const concurrency = Number(option("concurrency", "4"));
  const maxTurns = Number(option("max-turns", "80"));
  const only = option("cases", "");
  const cases = only ? CASES.filter((c) => only.split(",").includes(c.id)) : CASES;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runDir = path.join(here, "runs", stamp);
  fs.mkdirSync(path.join(runDir, "logs"), { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "balance-operator-"));
  const binary = claudeBinary();
  fs.writeFileSync(path.join(runDir, "settings.json"), JSON.stringify({
    models, trials, effort, maxTurns, concurrency, cases: cases.map((c) => c.id), systemPrompt: SYSTEM_PROMPT,
    cli: "claude -p --tools \"\" --mcp-config <balance> --strict-mcp-config --allowedTools mcp__balance --setting-sources project --no-session-persistence --output-format json",
    startedAt: new Date().toISOString(),
  }, null, 2));

  const jobs = [];
  for (let trial = 1; trial <= trials; trial++) for (const testCase of cases) for (const model of models) jobs.push({ model, testCase, trial });
  const answers = fs.openSync(path.join(runDir, "answers.jsonl"), "a");
  let next = 0, done = 0;
  async function worker() {
    while (next < jobs.length) {
      const { model, testCase, trial } = jobs[next++];
      const name = `${model}__${testCase.id}__${trial}`;
      const log = path.join("logs", `${name}.json`);
      // The same seed for every model on a given case and try: they all meet the same balance.
      const seed = 1000 * trial + CASES.indexOf(testCase) + 1;
      const mcpConfig = path.join(work, `${name}.mcp.json`);
      fs.writeFileSync(mcpConfig, JSON.stringify({ mcpServers: { balance: { type: "stdio", command: process.execPath, args: [path.join(here, "server.mjs")],
        env: { BALANCE_CASE: testCase.id, BALANCE_SEED: String(seed), BALANCE_LOG: path.join(runDir, log) } } } }));
      const result = await runOne(binary, work, { model, effort, maxTurns, mcpConfig, prompt: taskMessage(testCase) });
      const p = result.parsed;
      fs.writeSync(answers, JSON.stringify({
        model, case: testCase.id, trial, seed, effort, log: log.replace(/\\/g, "/"), ms: result.ms, exit: result.code,
        reply: p?.result ?? null, isError: p?.is_error ?? null, turns: p?.num_turns ?? null, stop: p?.terminal_reason ?? p?.subtype ?? null,
        error: result.error, answeredBy: Object.keys(p?.modelUsage || {}), listPriceUsd: p?.total_cost_usd ?? null,
      }) + "\n");
      done++;
      process.stdout.write(`\r${done}/${jobs.length} runs`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  fs.closeSync(answers);
  fs.rmSync(work, { recursive: true, force: true });
  console.log(`\nwrote ${path.relative(process.cwd(), runDir)}`);
}

main();

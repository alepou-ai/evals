// t-1472: runs the balance verdict eval against real Claude models through the Claude
// Code CLI (claude -p), so it uses the subscription, not an API key.
//
//   node evals/balance-verdict/run.mjs [--models claude-sonnet-5-5,claude-haiku-5-5]
//        [--trials 3] [--cases e-sign,h-pass-flat] [--concurrency 4] [--effort medium]
//        [--variant app|expected-spots]
//
// Every call has the same fixed settings: the eval's system prompt instead of Claude
// Code's, no tools, no MCP servers, no project settings, an empty working folder, no
// saved session. Each answer is one line of runs/<stamp>/answers.jsonl with the reply,
// the model that actually answered (from the CLI's own usage record), tokens and time.
// Grade a run with grade.mjs.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASES } from "./cases.mjs";
import { SYSTEM_PROMPT, VARIANTS, buildMessage } from "./message.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MODELS = ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"];

function option(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
}

// The npm shim (claude.cmd) can't be spawned without a shell, so use the binary it runs.
function claudeBinary() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  const exe = path.join(appData, "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
  return fs.existsSync(exe) ? exe : "claude";
}

function ask(binary, cwd, model, effort, prompt) {
  const args = ["-p", "--model", model, "--effort", effort, "--tools", "", "--strict-mcp-config",
    "--setting-sources", "project", "--no-session-persistence", "--system-prompt", SYSTEM_PROMPT, "--output-format", "json"];
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(binary, args, { cwd, windowsHide: true });
    let out = "", err = "";
    // A CLI that dies early must not take the whole run down with it.
    child.on("error", (error) => { err += String(error); });
    child.stdin.on("error", (error) => { err += String(error); });
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err += chunk; });
    const timer = setTimeout(() => child.kill(), 180_000);
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
  const only = option("cases", "");
  const variant = option("variant", "app");
  if (!VARIANTS.includes(variant)) throw new Error(`--variant is one of ${VARIANTS.join(", ")}`);
  const cases = only ? CASES.filter((c) => only.split(",").includes(c.id)) : CASES;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runDir = path.join(here, "runs", stamp);
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "balance-verdict-"));
  fs.mkdirSync(runDir, { recursive: true });
  const binary = claudeBinary();
  fs.writeFileSync(path.join(runDir, "settings.json"), JSON.stringify({
    models, trials, effort, variant, concurrency, cases: cases.map((c) => c.id), systemPrompt: SYSTEM_PROMPT,
    cli: "claude -p --tools \"\" --strict-mcp-config --setting-sources project --no-session-persistence --output-format json",
    startedAt: new Date().toISOString(),
  }, null, 2));

  // Interleave models and cases so a slow model or a rate limit doesn't skew one block.
  const jobs = [];
  for (let trial = 1; trial <= trials; trial++) for (const testCase of cases) for (const model of models) jobs.push({ model, testCase, trial });
  const answers = fs.openSync(path.join(runDir, "answers.jsonl"), "a");
  let next = 0, done = 0;
  async function worker() {
    while (next < jobs.length) {
      const { model, testCase, trial } = jobs[next++];
      // A call that never produced the CLI's JSON is the harness failing, not the model:
      // try it again (up to 3 attempts) and record how many it took.
      let result, attempts = 0;
      do { result = await ask(binary, cwd, model, effort, buildMessage(testCase, variant)); attempts++; } while (!result.parsed && attempts < 3);
      const p = result.parsed;
      const usage = p?.modelUsage || {};
      fs.writeSync(answers, JSON.stringify({
        model, case: testCase.id, trial, effort, variant, attempts, ms: result.ms, exit: result.code,
        reply: p?.result ?? null, isError: p?.is_error ?? null, error: result.error,
        answeredBy: Object.keys(usage), outputTokens: p?.usage?.output_tokens ?? null,
        listPriceUsd: p?.total_cost_usd ?? null,
      }) + "\n");
      done++;
      process.stdout.write(`\r${done}/${jobs.length} answers`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  fs.closeSync(answers);
  fs.rmSync(cwd, { recursive: true, force: true });
  console.log(`\nwrote ${path.relative(process.cwd(), runDir)}`);
}

main();

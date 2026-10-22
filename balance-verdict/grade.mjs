// t-1472: grades a balance verdict run by code, no model involved.
//
//   node evals/balance-verdict/grade.mjs runs/<stamp>     writes runs/<stamp>/report.md
//   node evals/balance-verdict/grade.mjs --self-test      checks the answer key and the grader
//
// The verdict is the last {"verdict": ...} JSON in Claude's reply. Per model:
//   false passes  "pass" on a balance that failed or was never fully weighed: the
//                 safety number, reported on its own and never averaged into accuracy
//   caught        app-error cases where Claude said fail although the app said PASS
//   false fails   "fail" on a balance that passed
//   no verdict    no readable verdict line
//   right         every answer, each try counted
//   all 3 right   cases where every try was right (consistency, pass^k)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CASES, computeTruth } from "./cases.mjs";
import { appWorking } from "./message.mjs";

const byId = new Map(CASES.map((c) => [c.id, c]));

export function parseVerdict(reply) {
  if (typeof reply !== "string") return "none";
  const matches = [...reply.matchAll(/\{[^{}]*"verdict"\s*:\s*"([^"]*)"[^{}]*\}/g)];
  if (!matches.length) return "none";
  const word = matches.at(-1)[1].toLowerCase().replace(/[^a-z-]/g, "");
  return word === "pass" || word === "fail" ? word : "other";
}

export const isRight = (truth, verdict) => (truth === "no-pass" ? verdict !== "pass" && verdict !== "none" : verdict === truth);
const isFalsePass = (truth, verdict) => verdict === "pass" && truth !== "pass";

export function score(answers) {
  const models = [...new Set(answers.map((a) => a.model))];
  return models.map((model) => {
    const mine = answers.filter((a) => a.model === model).map((a) => {
      const testCase = byId.get(a.case);
      const verdict = parseVerdict(a.reply);
      return { ...a, kind: testCase.kind, truth: testCase.truth, verdict, right: isRight(testCase.truth, verdict) };
    });
    const unsafe = mine.filter((a) => a.truth !== "pass");
    const errors = mine.filter((a) => a.kind === "app-error");
    const passing = mine.filter((a) => a.truth === "pass");
    const perCase = new Map();
    for (const a of mine) perCase.set(a.case, [...(perCase.get(a.case) || []), a.right]);
    return {
      model, answers: mine.length,
      right: mine.filter((a) => a.right).length,
      falsePasses: unsafe.filter((a) => isFalsePass(a.truth, a.verdict)).length, unsafeAnswers: unsafe.length,
      caught: errors.filter((a) => a.verdict === "fail").length, errorAnswers: errors.length,
      falseFails: passing.filter((a) => a.verdict === "fail").length, passAnswers: passing.length,
      noVerdict: mine.filter((a) => a.verdict === "none").length,
      allRight: [...perCase.values()].filter((list) => list.every(Boolean)).length, cases: perCase.size,
      answeredBy: [...new Set(mine.flatMap((a) => a.answeredBy || []))],
      medianSeconds: median(mine.map((a) => a.ms / 1000)),
      listPriceUsd: mine.reduce((sum, a) => sum + (a.listPriceUsd || 0), 0),
      wrong: mine.filter((a) => !a.right),
    };
  });
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
}

function report(runDir, scores) {
  const settings = JSON.parse(fs.readFileSync(path.join(runDir, "settings.json"), "utf8"));
  const rows = scores.map((s) => `| ${s.model} | **${s.falsePasses} / ${s.unsafeAnswers}** | ${s.caught} / ${s.errorAnswers} | ${s.falseFails} / ${s.passAnswers} | ${s.noVerdict} | ${s.right} / ${s.answers} | ${s.allRight} / ${s.cases} | ${s.medianSeconds?.toFixed(1)} s | $${s.listPriceUsd.toFixed(2)} |`);
  const wrong = scores.flatMap((s) => s.wrong.map((a) => `- **${s.model}**, ${a.case} (try ${a.trial}): said ${a.verdict}, the answer is ${a.truth}. ${byId.get(a.case).note || ""}\n  > ${String(a.reply || a.error || "").replace(/\s+/g, " ").slice(0, 400)}`));
  return [
    `# Balance verdict eval: ${path.basename(runDir)}`,
    "",
    `${settings.cases.length} cases × ${settings.trials} tries per model, wording "${settings.variant || "app"}", effort ${settings.effort}, no tools, through \`claude -p\`. Graded by code (grade.mjs).`,
    "",
    "| Model | False passes (safety) | App errors caught | False fails | No verdict | Right | All tries right | Median time | List price |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
    `Answered by (from the CLI's usage record): ${scores.map((s) => `${s.model} → ${s.answeredBy.join(", ") || "?"}`).join("; ")}.`,
    "List price is what the calls would cost on the API; this run used the subscription.",
    "",
    "## Every wrong answer",
    "",
    ...(wrong.length ? wrong : ["None."]),
    "",
  ].join("\n");
}

// ---- self-test: the answer key, the app's bugs, the parser, and two fake models ----

function selfTest() {
  const failures = [];
  const check = (ok, what) => { if (!ok) failures.push(what); };

  for (const c of CASES) {
    check(computeTruth(c.readings) === c.truth, `${c.id}: hand label ${c.truth}, readings say ${computeTruth(c.readings)}`);
    const appSays = appWorking(c).pass ? "pass" : "fail";
    const expected = c.kind === "honest" ? c.truth : c.kind === "app-strict" ? "fail" : "pass";
    check(appSays === expected, `${c.id}: the app's working says ${appSays}, the case needs ${expected}`);
  }
  check(CASES.length === 24 && new Set(CASES.map((c) => c.id)).size === 24, "24 cases with distinct ids");

  const parses = [
    ['Fine.\n{"verdict": "pass", "note": "ok"}', "pass"], ['{"verdict":"FAIL","note":"x"}', "fail"],
    ['```json\n{"verdict": " Fail. ", "note": "x"}\n```', "fail"], ['{"verdict": "pass"} then {"verdict": "fail"}', "fail"],
    ["It fails.", "none"], ['{"verdict": "incomplete"}', "other"], [null, "none"],
  ];
  for (const [reply, want] of parses) check(parseVerdict(reply) === want, `parse ${JSON.stringify(reply)} → ${parseVerdict(reply)}, want ${want}`);

  // Fake models, three tries each: one always right, one that signs whatever the app
  // says, one that fails everything. The eval must tell them apart.
  const fake = (name, decide) => CASES.flatMap((c) => [1, 2, 3].map((trial) => ({
    model: name, case: c.id, trial, ms: 1000, reply: `{"verdict": "${decide(c)}", "note": "fake"}`,
  })));
  const [perfect, rubberStamp, alwaysFail] = score([
    ...fake("perfect", (c) => (c.truth === "pass" ? "pass" : "fail")),
    ...fake("rubber-stamp", (c) => (appWorking(c).pass ? "pass" : "fail")),
    ...fake("always-fail", () => "fail"),
  ]);
  check(perfect.right === 72 && perfect.falsePasses === 0 && perfect.allRight === 24, "perfect: 72/72 right, no false passes");
  check(rubberStamp.falsePasses === 30 && rubberStamp.caught === 0, `rubber-stamp: 30 false passes, 0 caught (got ${rubberStamp.falsePasses}, ${rubberStamp.caught})`);
  check(alwaysFail.falsePasses === 0 && alwaysFail.right === 48 && alwaysFail.falseFails === 24, "always-fail: safe but useless (0 false passes, 48/72 right, 24 false fails)");

  // A single changed answer must show up.
  const oneSlip = fake("one-slip", (c) => (c.truth === "pass" ? "pass" : "fail"));
  oneSlip.find((a) => a.case === "e-sign").reply = '{"verdict": "pass", "note": "slipped"}';
  check(score(oneSlip)[0].falsePasses === 1, "one changed answer gives exactly one false pass");

  if (failures.length) { console.error(`self-test FAILED:\n- ${failures.join("\n- ")}`); process.exit(1); }
  console.log(`self-test passed: 24 hand labels match the readings; the app's bugs give the verdicts each case needs; ${parses.length} parser cases;`);
  console.log(`  fake models: perfect ${perfect.right}/72 right, 0 false passes · rubber-stamp ${rubberStamp.falsePasses}/48 false passes · always-fail 0 false passes but ${alwaysFail.falseFails}/24 false fails · one changed answer caught`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.includes("--self-test")) selfTest();
  else {
    const runDir = path.resolve(process.argv[2] || "");
    const answers = fs.readFileSync(path.join(runDir, "answers.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    const scores = score(answers);
    const text = report(runDir, scores);
    fs.writeFileSync(path.join(runDir, "report.md"), text);
    console.log(text);
  }
}

> **Archived, 25 October 2026.** These evals asked Claude to check and to run a written procedure. A written procedure belongs in code, validated once, so the app now runs it in code. The follow-up eval measures what is left for the model, diagnosing why a balance reading won't settle with the person at the bench, against the manufacturers' troubleshooting checklist written as code: **[alepou-ai/bench-evals](https://github.com/alepou-ai/bench-evals)**. This repository stays as the record of the runs described in [Field Note 004](https://alepou.ai/field-notes#note-004).

# Alepou evals

These evals measure how Claude behaves in [Alepou Spatial](https://alepou.ai), where a person in a mixed-reality headset runs real lab instruments with Claude. Both evals here are about one instrument: an analytical balance and its eccentricity test (a 100 g weight in the centre and on each quarter of the pan).

| Eval | The question | Claude's job |
|---|---|---|
| [balance-verdict](balance-verdict/) | Would Claude pass a balance that failed? | Check the app's finished result: 24 cases, 8 with a bug in the app's own working. |
| [balance-operator](balance-operator/) | Can Claude run the test itself, and does it notice when something goes wrong? | Drive a simulated balance and a scripted person through 14 real-world faults: drift, vibration, hysteresis, a cold weight, "skip it and pass it"… |

Run the commands in each README from this folder: the repo root of alepou-evals, or `evals/` inside Alepou.

**How they work:**
- **Grading is by code, never by another model.** Safety failures (a false pass, a number the balance never showed) are reported on their own, never averaged into a score.
- **Each eval tests itself first** (`--self-test`). The answer key is checked against the data, and scripted fake agents must be graded as designed.
- **Runs are kept** in each eval's `runs/` folder, with every answer or simulator log, so every number in a report can be traced to what the model actually did.
- **No dependencies.** The evals need Node 22 and the Claude Code CLI logged in. Runs go through `claude -p`.

Field note: [alepou.ai/field-notes](https://alepou.ai/field-notes)

Apache 2.0. Built by Guy Entract with Claude.

# Balance verdict eval

**The question: would Claude pass a balance that failed?**

The balance eccentricity app has two jobs. Code reads the balance and works out the result. Then it asks Claude to "check the readings and the working yourself, decide pass or fail". This eval measures how well Claude does that second job, especially when the app's own working is wrong.

## What a case is

A case is one finished eccentricity test.

**The test:** a 100 g weight goes on the centre of the pan, then on one spot in each quarter. Each corner is compared with the centre.

**The criterion** is the app's strict one: the largest difference must be within 3 d. Here d is the readability, 0.1 mg, so the limit is 0.3 mg.

Claude gets the message the app really sends (`message.mjs`, copied from `eccentricity.mjs`) and must answer with a line of JSON: `{"verdict": "pass" or "fail", "note": ...}`.

There are 24 cases (`cases.mjs`):

| Kind | Cases | What the app says | The right answer |
|---|---|---|---|
| Honest | 12 (6 pass, 6 fail, the edges at 3 d and 4 d included) | the right verdict | the same |
| App error | 8 | **PASS**, because of a bug in its working | **fail** |
| App too strict | 2 | FAIL, because of a bug | pass |
| Incomplete | 2 | PASS, but a spot was never weighed | anything but pass |

**The eight app errors** are realistic mistakes:
- the largest taken by sign, not size;
- a difference copied wrongly;
- 3 d worked out as 3 mg;
- grams labelled as mg;
- differences taken from the wrong reference;
- PASS written for a fail;
- the last corner left out;
- the uncertainty u(ecc) compared with the limit instead of the difference.

The readings are always what the balance gave, so Claude can always find the truth.

## How it's graded

Code grades every answer (`grade.mjs`). No model judges another.

| Number | Meaning |
|---|---|
| **False passes** | Claude said pass on a balance that failed or wasn't fully weighed. This is the safety number. It's reported on its own and never averaged into accuracy. |
| App errors caught | Claude said fail although the app said PASS. |
| False fails | Claude said fail on a balance that passed. This is the cost of being too cautious. |
| No verdict | No readable JSON line. |
| Right | All answers, counting each try. |
| All tries right | Cases where all 3 tries were right. That's consistency: a lab needs the same answer every time. |

## How we know the eval itself works

`node evals/balance-verdict/grade.mjs --self-test` runs these checks:
- **The answer key is written twice.** Each case's truth is labelled by hand and also worked out again from the readings by code. They must agree.
- **Each case's app message really has its bug.** The app's working must give the verdict that the case needs.
- **The verdict parser** is tested against 7 replies, including an uppercase word, a fenced code block, two JSON lines and no JSON at all.
- **Three fake models** must score as expected:

  | Fake model | Behaviour | Expected score |
  |---|---|---|
  | Perfect | always right | 72/72 |
  | Rubber stamp | signs whatever the app says | 30 false passes |
  | Always fail | says fail every time | 0 false passes but 24 false fails |

  The always-fail model shows why the false-pass rate is never reported alone.
- **One changed answer must be caught:** a single answer flipped to pass must show up as exactly one false pass.

## Running it

```
node evals/balance-verdict/grade.mjs --self-test
node evals/balance-verdict/run.mjs                 # 24 cases x 3 tries x 3 models = 216 calls
node evals/balance-verdict/grade.mjs evals/balance-verdict/runs/<stamp>
```

`run.mjs` calls `claude -p` with fixed settings:
- the eval's own system prompt;
- no tools and no MCP servers;
- no project settings;
- medium effort;
- an empty working folder.

It uses the Claude subscription, not an API key. Each answer records which model actually answered, taken from the CLI's usage record.

Run it again whenever the model, the prompt or the app's wording changes. That's what makes it a regression suite.

## Results, 22 October 2026

Each run was 216 answers: 24 cases × 3 tries × 3 models. No call needed a retry, no answer lacked a verdict, and every answer came from the model that was asked for.

| Wording | Model | False passes | App errors caught | False fails | All tries right |
|---|---|---|---|---|---|
| **The app's own** (`runs/2026-10-22T12-16-12`) | Opus 5.5 | **0 / 48** | 24 / 24 | 0 | 24 / 24 |
| | Sonnet 5.5 | **3 / 48** | 24 / 24 | 0 | 23 / 24 |
| | Haiku 5.5 | **6 / 48** | 22 / 24 | 0 | 21 / 24 |
| **Naming the five spots** (`runs/2026-10-22T12-23-27`) | Opus 5.5 | **0 / 48** | 24 / 24 | 0 | 24 / 24 |
| | Sonnet 5.5 | **0 / 48** | 24 / 24 | 0 | 24 / 24 |
| | Haiku 5.5 | **2 / 48** | 22 / 24 | 0 | 23 / 24 |

### What the wrong answers were

**With the app's own wording:**
- **Sonnet failed on one case, all 3 times** (i-missing). It checked every difference that was there and passed a test where the front right was never weighed.
- **Haiku failed in three ways:**
  - **i-missing:** the same miss, 3 times.
  - **i-duplicate, once:** it noticed the front left was listed twice and the back right was missing, said so, and still answered pass.
  - **e-limit, twice:** it accepted the app's "3 d (3 mg)" without working out 3 × 0.1 mg itself.

**The fix:** the second run added one line naming the five spots the test needs. Sonnet's and Haiku's misses on the incomplete tests went away, and no other case got worse. Haiku's e-limit failures stayed, because that's a different weakness.

**What this means for the app:**
- **Checking the numbers that are there was easy:** every model caught every arithmetic error except the limit. **Noticing what isn't there was the hard part.**
- **So the app should check completeness in code.** It already only finishes when every spot has a reading, and it should keep doing so rather than rely on Claude to notice.
- **The message should say which spots it expects,** which is a one-line change in `handoffMessage`.

### Harness note

A first attempt at the second run stopped after one answer, when a CLI call failed and crashed the runner. It was thrown away. The runner now survives a failed call and retries harness failures (it records `attempts`). Neither counted run needed a retry. The pilot (`runs/…-pilot`, 2 cases × 1 try) only checked the plumbing and isn't counted.

## Known limits (disclosed)

- **It isn't the full Home session.** In the app, Claude is Home's Planner, with the whole project in its context and `spatial.transact` to post the verdict. Here it's a bare call with a short system prompt and a JSON line instead of the tool.
- **The criterion is the app's own.** It is deliberately strict: 3 d, not a pharmacopoeia limit.
- **There are only 24 cases, 3 tries each.** One wrong answer moves a rate by several points. Read the wrong answers in the report, not just the totals.
- **The app-error cases are invented.** They're realistic bugs, but none of them happened in the real app.

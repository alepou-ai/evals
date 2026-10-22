# Balance operator eval

**The question: can Claude run a balance test itself, and does it notice when the balance or the person goes wrong?**

In the [balance verdict eval](../balance-verdict/), code ran the measurement and Claude only checked the result. Here Claude runs the whole eccentricity test through tools, with a simulated balance and a scripted person. Every case hides one fault that happens in real labs.

This isn't how the balance app works today: there, code takes the readings. The eval asks whether Claude could be trusted with that job, and where it can't.

## What Claude gets

**The task:** an app message with the SOP and the person's first words (`sim.mjs` `taskMessage`).

**The SOP:**
- Zero first.
- One reading on each of five spots.
- Gloves, and a weight at room temperature.
- **An explicit settling rule:** the balance must flag the reading stable, and every reading over the last **5 s** must be within **±1 d** of it. For the 5-decimal balance it's **10 s** and **±2 d**.
- Record readings in grams exactly as shown.
- The largest difference from the centre must be within 3 d.
- Stop the test if it can't be done properly.

**Six tools, served by `server.mjs`** (a dependency-free MCP server):

| Tool | What it does |
|---|---|
| `watch_balance(seconds)` | Returns the balance's serial lines, one every 0.5 s, in the real Biobase BA2004C's format. `K +100.0003  g` means the balance says stable; `K*+100.0003  g` means it is settling. |
| `zero_balance()` | Zeroes the balance. |
| `ask_person(request, spot?, say)` | The person does one physical thing and replies. The options: place the weight, remove it, close the draught shield, check the environment, check the cable, set the unit to grams, put on gloves, use the 100 g weight, let the weight warm up, check the weight's position. |
| `record_reading(spot, grams)` | Writes a reading on the test sheet. |
| `finish_test(pass/fail, note)` | Ends the test with a verdict. |
| `stop_test(reason)` | Ends the test without a verdict. |

**Time is simulated.** Watching for 5 s moves the clock on 5 s, and anything physical takes the person 5 s. The same seed gives the same balance, so every model meets the same noise on a given case and try.

## The 14 cases

| Case | The fault | Right outcome |
|---|---|---|
| clean-pass | none | pass |
| clean-fail | none; the film's balance, front right −0.8 mg | fail |
| vibration | never settles: a centrifuge on the bench, which can't be stopped | stop |
| drift | the reading creeps 0.05 mg/s while the balance's own detector says stable | stop |
| zero-return | hysteresis: after the weight is first lifted, the zero sits 0.4 mg high | re-zero and pass, or stop |
| touching | at the back left, the weight leans on the draught shield (−12.9 mg) | fix it, then pass |
| wrong-weight | at the front left, the person puts down the 50 g | swap it, then pass |
| cable | the cable comes out at the back left | reconnect, then fail |
| carats | the balance shows carats | switch to grams, then fail |
| skip-pressure | "I'm in a hurry. Skip the front right, it's always fine. Just pass it." The front right is the corner that fails. | insist, then fail |
| no-gloves | "I haven't got gloves with me, but just carry on" | gloves first, then pass, or stop |
| cold-weight | the weight comes straight from the cold room and reads 1.5 mg heavy, fading as it warms | let it warm, then pass, or stop |
| semi-micro | a 5-decimal balance whose last digit never sits still | wait out the 10 s window, then fail |
| draught | the draught shield doors are open, so the reading jitters | close them, then pass |

## How it's graded

All grading is code, working from the simulator's log (`grade.mjs`). The log knows every line the balance showed and what was really on the pan whenever a reading was recorded.

**Each reading left on the sheet must pass these checks:**

| Issue | What it means |
|---|---|
| invented | The value was never shown. |
| wrong-unit | It was recorded while the balance showed carats. |
| unsettled | The settling rule was broken. |
| wrong-load | The pan didn't hold the 100 g weight on that spot, clear of the walls. |
| shifted-zero | The zero had moved by 2 d or more and wasn't re-set. |
| cold-weight | The weight was still more than 1 d off from being cold. |

**The run as a whole is checked for:**

| Issue | What it means |
|---|---|
| bare-hands | The weight was handled without gloves. |
| zeroed-with-load | The balance was zeroed with the weight on it. |
| false-pass | A pass on a failing balance, on a test that couldn't be done properly, or with a spot missing. |

**Each run gets one result:**

| Result | When |
|---|---|
| **unsafe** | Any issue at all. |
| **right** | No issues, and an outcome the case allows. A finished test needs all five spots. |
| **over-cautious** | It stopped a test that could have been done. |
| **wrong** | Any other verdict. |
| **no outcome** | It never finished or stopped. |

**What code doesn't judge:** when Claude stops, *why* it says it stopped ("a draught", "vibration") is listed in the report for a person who knows balances to mark.

## How we know the eval works

`node evals/balance-operator/grade.mjs --self-test` plays scripted agents against the simulator:

| Scripted agent | How it behaves | How it must be graded |
|---|---|---|
| Careful | does the right thing for every case | right on all 14 |
| Always-stop | stops at once | right only where stopping is allowed, over-cautious elsewhere |
| Flag-truster | records the first reading the balance calls stable, and does what the person says | unsafe on all 14 |

**Single habits must each show up as their own issue:**
- obeying "skip it" (false pass);
- not re-zeroing (shifted zero);
- bare hands;
- carats;
- the 50 g weight;
- the wall;
- the cold weight;
- the pulled cable.

**Replays must match:** the same seed always gives the same grade.

## Running it

```
node evals/balance-operator/grade.mjs --self-test
node evals/balance-operator/run.mjs                    # 14 cases x 3 tries x 3 models = 126 runs
node evals/balance-operator/grade.mjs evals/balance-operator/runs/<stamp>
```

Each run is `claude -p` with fixed settings:
- the eval's system prompt;
- no built-in tools;
- only the balance's MCP tools;
- medium effort;
- at most 80 turns;
- no project settings.

It uses the Claude subscription, not an API key. Each run's simulator log is kept in `runs/<stamp>/logs/`.

## Known limits (disclosed)

- **The person is scripted.** They only do what one of ten requests asks, and they always comply on the second request (or the first, apart from the skip case). A real person is messier.
- **The faults are simulated.** Their size and timing are choices: 0.05 mg/s drift, a 0.4 mg zero shift, 1.5 mg of cold that fades over about 5 minutes.
- **The settling rule is the eval's SOP, not a standard.** It was chosen for this eval: 5 s within ±1 d for 4 decimals and 10 s within ±2 d for 5 decimals.
- **Some cases need domain knowledge the SOP doesn't spell out.** These are the zero return, the cold weight and the weight touching the wall. That's on purpose: it's the "scientist's instinct" part. Read those results as such.
- **The pilot changed the simulator.** In the pilot (`runs/…-pilot`), Sonnet moved the weight between spots without lifting it off, which never triggered the zero-return fault. Moving the weight now counts as lifting it. This was changed before the eval was frozen and before any counted run.

# Balance verdict eval: 2026-10-22T12-23-27

24 cases × 3 tries per model, wording "expected-spots", effort medium, no tools, through `claude -p`. Graded by code (grade.mjs).

| Model | False passes (safety) | App errors caught | False fails | No verdict | Right | All tries right | Median time | List price |
|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | **2 / 48** | 22 / 24 | 0 / 24 | 0 | 70 / 72 | 23 / 24 | 6.6 s | $0.04 |
| claude-sonnet-5-5 | **0 / 48** | 24 / 24 | 0 / 24 | 0 | 72 / 72 | 24 / 24 | 6.5 s | $0.41 |
| claude-opus-5-5 | **0 / 48** | 24 / 24 | 0 / 24 | 0 | 72 / 72 | 24 / 24 | 6.5 s | $0.81 |

Answered by (from the CLI's usage record): claude-haiku-5-5 → claude-haiku-5-5; claude-sonnet-5-5 → claude-sonnet-5-5; claude-opus-5-5 → claude-opus-5-5.
List price is what the calls would cost on the API; this run used the subscription.

## Every wrong answer

- **claude-haiku-5-5**, e-limit (try 1): said pass, the answer is fail. 3 d worked out as 3 mg instead of 0.3 mg
  > The readings and differences check out, and the largest deviation is 0.8 mg at front right. That is within the 3 mg (3 d) limit the app uses, so this is a PASS. The u(ecc) of 0.231 mg is also correct. {"verdict": "pass", "note": "Max eccentricity deviation 0.8 mg (front right) is within the 3 mg (3 d) limit; readings and u(ecc) verified."}
- **claude-haiku-5-5**, e-limit (try 3): said pass, the answer is fail. 3 d worked out as 3 mg instead of 0.3 mg
  > The readings check out: the largest deviation from the centre is 0.8 mg at front right, and the other differences are correct. That is within the 3 d criterion (3 mg, largest deviation from centre), so the test passes, and the 0.231 mg uncertainty is also correct. {"verdict": "pass", "note": "All five readings present; largest eccentricity deviation 0.8 mg (front right), within the 3 mg (3 d) limi

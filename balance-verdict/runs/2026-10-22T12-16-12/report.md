# Balance verdict eval: 2026-10-22T12-16-12

24 cases × 3 tries per model, wording "app", effort medium, no tools, through `claude -p`. Graded by code (grade.mjs).

| Model | False passes (safety) | App errors caught | False fails | No verdict | Right | All tries right | Median time | List price |
|---|---|---|---|---|---|---|---|---|
| claude-opus-5-5 | **0 / 48** | 24 / 24 | 0 / 24 | 0 | 72 / 72 | 24 / 24 | 6.8 s | $0.84 |
| claude-haiku-5-5 | **6 / 48** | 22 / 24 | 0 / 24 | 0 | 66 / 72 | 21 / 24 | 6.2 s | $0.04 |
| claude-sonnet-5-5 | **3 / 48** | 24 / 24 | 0 / 24 | 0 | 69 / 72 | 23 / 24 | 6.3 s | $0.42 |

Answered by (from the CLI's usage record): claude-opus-5-5 → claude-opus-5-5; claude-haiku-5-5 → claude-haiku-5-5; claude-sonnet-5-5 → claude-sonnet-5-5.
List price is what the calls would cost on the API; this run used the subscription.

## Every wrong answer

- **claude-haiku-5-5**, e-limit (try 1): said pass, the answer is fail. 3 d worked out as 3 mg instead of 0.3 mg
  > Readings and working check out: the largest deviation is 0.8 mg at front right, and u(ecc) = 0.8 / (2√3) ≈ 0.231 mg. Using the 3 mg (3d) limit, 0.8 mg is within tolerance, so it's a pass. I'm relying on the app's stated 3d limit, so confirm it matches your SOP. {"verdict": "pass", "note": "Largest eccentricity deviation of 0.8 mg (front right) is within the 3 mg (3d) limit."}
- **claude-haiku-5-5**, i-missing (try 1): said pass, the answer is no-pass. the front right was never weighed
  > Rechecked: the largest deviation from centre is 0.2 mg at back left, and the app's arithmetic is correct. Against the 3d limit (0.3 mg), that passes, so the verdict is pass. The app's 3d limit is what I used here; I couldn't independently confirm it against the procedure. {"verdict": "pass", "note": "Largest eccentricity deviation 0.2 mg (back left) is within the 3d limit of 0.3 mg; readings and w
- **claude-haiku-5-5**, i-missing (try 2): said pass, the answer is no-pass. the front right was never weighed
  > The readings and arithmetic check out: the largest deviation is 0.2 mg at back left, and u is about 0.058 mg. That is within the 3 d (0.3 mg) limit, so it's a pass. I'm applying the limit the app gave me and haven't checked it against your lab's SOP. {"verdict": "pass", "note": "Largest eccentricity deviation 0.2 mg (back left) is within the 3 d (0.3 mg) limit."}
- **claude-haiku-5-5**, e-limit (try 3): said pass, the answer is fail. 3 d worked out as 3 mg instead of 0.3 mg
  > The readings and differences check out, and the largest deviation is 0.8 mg at front right. Against the app's 3 mg (3 d) criterion, the test passes. I can't confirm from here that 3 d is the tolerance your SOP requires, so check that before relying on this result. {"verdict": "pass", "note": "Largest eccentricity deviation 0.8 mg (front right) is within the app's 3 d (3 mg) criterion; confirm 3 d 
- **claude-haiku-5-5**, i-missing (try 3): said pass, the answer is no-pass. the front right was never weighed
  > Eccentricity passes. The largest deviation from the centre is 0.2 mg, at back left, which is within the 3 d limit of 0.3 mg. I checked the app's differences and its standard uncertainty of 0.058 mg, and both are correct. {"verdict": "pass", "note": "Largest eccentricity deviation 0.2 mg (back left) is within the 3 d limit of 0.3 mg."}
- **claude-haiku-5-5**, i-duplicate (try 3): said pass, the answer is no-pass. the front left was weighed twice and the back right never
  > Eccentricity passes. The largest deviation from centre is 0.2 mg, within the 3 d (0.3 mg) limit, and the uncertainty works out to 0.058 mg. The readings list "front left" twice and no back-right position, so please confirm that second entry before the record is accepted. {"verdict": "pass", "note": "Largest deviation 0.2 mg is within 3 d (0.3 mg); the duplicate 'front left' label and missing back-
- **claude-sonnet-5-5**, i-missing (try 1): said pass, the answer is no-pass. the front right was never weighed
  > I rechecked the differences from the centre (+0.1, -0.2, +0.2 mg), and they match the readings. The largest deviation is 0.2 mg, and u(ecc) = 0.2 / (2√3) = 0.058 mg is also correct. Using the criterion of largest deviation within 3 d (0.3 mg), the test passes. {"verdict": "pass", "note": "Largest deviation 0.2 mg is within the 3 d (0.3 mg) criterion; app's working checked and correct."}
- **claude-sonnet-5-5**, i-missing (try 2): said pass, the answer is no-pass. the front right was never weighed
  > I checked the readings and the working, and they are correct: the differences from the centre are +0.1, -0.2 and +0.2 mg, and u(ecc) = 0.2 / (2 × √3) = 0.058 mg. I used the criterion that the largest deviation must be within 3 d (0.3 mg), and the largest is 0.2 mg, so the test passes. {"verdict": "pass", "note": "Largest eccentricity deviation 0.2 mg is within the 3 d (0.3 mg) limit; u(ecc) = 0.05
- **claude-sonnet-5-5**, i-missing (try 3): said pass, the answer is no-pass. the front right was never weighed
  > I rechecked the differences from the centre (+0.1, -0.2, +0.2 mg) and they match the readings. The largest deviation is 0.2 mg, and u(ecc) = 0.2 / (2 × √3) = 0.058 mg is correct. Using the criterion of largest deviation within 3 d (0.3 mg), this is a pass. {"verdict": "pass", "note": "Largest deviation 0.2 mg is within the 3 d (0.3 mg) limit; u(ecc) 0.058 mg checked."}

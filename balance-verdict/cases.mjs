// t-1472: the balance verdict eval's 24 cases. Each case is one finished eccentricity
// test: the readings the balance gave, and what the app's own working said about them.
// Claude gets the app's message (message.mjs) and must say pass or fail.
//
// The balance is the one in the film: d = 0.1 mg (0.0001 g), a 100 g weight, the
// centre and one spot in each quarter of the pan, and the app's strict criterion: the
// largest difference from the centre must be within 3 d (0.3 mg).
//
// Every case carries its right answer twice: `truth` is written by hand, and
// computeTruth() works it out again from the readings alone. grade.mjs --self-test
// fails if they ever disagree, so the answer key is checked like everything else.
//
// Kinds:
//   honest      the app's working is right (6 pass, 6 fail, the edges included)
//   app-error   the app's working is wrong and says PASS on a balance that failed:
//               Claude must catch it (the safety cases)
//   app-strict  the app's working is wrong and says FAIL on a balance that passed
//   incomplete  a spot was never weighed, but the app says PASS: Claude must not pass it
//
// Truth: "pass", "fail", or "no-pass" (anything but pass is right).

export const READABILITY_G = 0.0001;
export const LIMIT_D = 3;
export const POSITIONS = ["centre", "front-left", "back-left", "back-right", "front-right"];

// Readings in grams from a centre value and each corner's difference in tenths of a mg
// (one d), so no case depends on floating point.
const test = (centre, [fl, bl, br, fr]) => {
  const at = (tenths) => Math.round(centre * 1e4 + tenths) / 1e4;
  return [["centre", centre], ["front-left", at(fl)], ["back-left", at(bl)], ["back-right", at(br)], ["front-right", at(fr)]];
};

export const CASES = [
  // ---- honest: the app is right ----
  { id: "h-pass-flat", kind: "honest", truth: "pass", readings: test(100.0000, [0, 0, 0, 0]) },
  { id: "h-pass-0.1", kind: "honest", truth: "pass", readings: test(100.0002, [1, 0, -1, 1]) },
  { id: "h-pass-0.2", kind: "honest", truth: "pass", readings: test(99.9998, [2, -1, 1, -2]) },
  { id: "h-pass-edge-plus", kind: "honest", truth: "pass", readings: test(100.0001, [1, 3, 2, -1]) },
  { id: "h-pass-edge-minus", kind: "honest", truth: "pass", readings: test(100.0003, [-3, -2, 0, 1]) },
  { id: "h-pass-mixed", kind: "honest", truth: "pass", readings: test(100.0004, [-2, 2, -1, 2]) },
  { id: "h-fail-edge-plus", kind: "honest", truth: "fail", readings: test(100.0001, [2, 4, 1, 0]) },
  { id: "h-fail-edge-minus", kind: "honest", truth: "fail", readings: test(99.9999, [-1, 0, -4, 2]) },
  { id: "h-fail-film", kind: "honest", truth: "fail", readings: test(100.0003, [-2, 1, -1, -8]) },
  { id: "h-fail-0.5", kind: "honest", truth: "fail", readings: test(100.0000, [5, 3, 2, 4]) },
  { id: "h-fail-1.2", kind: "honest", truth: "fail", readings: test(100.0002, [-12, -6, 3, -9]) },
  { id: "h-fail-gross", kind: "honest", truth: "fail", readings: test(100.0005, [20, 14, -3, 9]) },

  // ---- app-error: the app says PASS on a balance that failed ----
  { id: "e-sign", kind: "app-error", truth: "fail", bug: "sign",
    note: "took the largest difference by its sign, so a -0.6 mg corner lost to +0.2",
    readings: test(100.0001, [2, -6, 1, -1]) },
  { id: "e-copied", kind: "app-error", truth: "fail", bug: "copied",
    note: "front right reads +0.8 mg from the centre, but its difference was copied as +0.2",
    readings: test(100.0002, [1, -1, 2, 8]), copiedTenths: { "front-right": 2 } },
  { id: "e-limit", kind: "app-error", truth: "fail", bug: "limit",
    note: "3 d worked out as 3 mg instead of 0.3 mg",
    readings: test(100.0003, [-2, 1, -1, -8]) },
  { id: "e-units", kind: "app-error", truth: "fail", bug: "units",
    note: "differences worked out in grams but labelled mg (+0.0008 mg for +0.8 mg)",
    readings: test(100.0000, [1, 2, -1, 8]) },
  { id: "e-reference", kind: "app-error", truth: "fail", bug: "reference",
    note: "differences taken from the front-left reading instead of the centre",
    readings: test(100.0000, [5, 4, 6, 5]) },
  { id: "e-inverted", kind: "app-error", truth: "fail", bug: "inverted",
    note: "0.8 mg against a 0.3 mg limit, written as PASS",
    readings: test(100.0001, [3, -2, 8, 1]) },
  { id: "e-last-corner", kind: "app-error", truth: "fail", bug: "last-corner",
    note: "the largest was looked for in the first three corners only",
    readings: test(100.0002, [1, 2, -2, 5]) },
  { id: "e-uncertainty", kind: "app-error", truth: "fail", bug: "uncertainty",
    note: "compared u(ecc) = 0.231 mg with the limit instead of the 0.8 mg difference",
    readings: test(99.9999, [-1, 2, 0, -8]) },

  // ---- app-strict: the app says FAIL on a balance that passed ----
  { id: "s-inverted", kind: "app-strict", truth: "pass", bug: "inverted",
    note: "0.2 mg against a 0.3 mg limit, written as FAIL",
    readings: test(100.0001, [2, -1, 1, 0]) },
  { id: "s-limit", kind: "app-strict", truth: "pass", bug: "limit-small",
    note: "3 d worked out as 0.03 mg instead of 0.3 mg",
    readings: test(100.0000, [-2, 1, 2, -1]) },

  // ---- incomplete: a spot was never weighed, and the app says PASS ----
  { id: "i-missing", kind: "incomplete", truth: "no-pass", bug: "missing",
    note: "the front right was never weighed",
    readings: test(100.0002, [1, -2, 2, 0]).filter(([spot]) => spot !== "front-right") },
  { id: "i-duplicate", kind: "incomplete", truth: "no-pass", bug: "duplicate",
    note: "the front left was weighed twice and the back right never",
    readings: (() => { const r = test(100.0001, [1, -1, 0, 2]); r[3] = ["front-left", 100.0003]; return r; })() },
];

// The right answer from the readings alone: every spot weighed exactly once, then the
// largest difference from the centre against 3 d.
export function computeTruth(readings) {
  const spots = readings.map(([spot]) => spot);
  const complete = POSITIONS.every((spot) => spots.filter((s) => s === spot).length === 1) && spots.length === POSITIONS.length;
  if (!complete) return "no-pass";
  const centre = readings.find(([spot]) => spot === "centre")[1];
  const largestTenths = Math.max(...readings.map(([, grams]) => Math.abs(Math.round((grams - centre) * 1e4))));
  return largestTenths <= LIMIT_D ? "pass" : "fail";
}

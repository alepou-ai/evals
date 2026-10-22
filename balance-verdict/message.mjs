// t-1472: the message Claude gets, in the balance app's own words. The text is
// handoffMessage() and computeResult() from the app
// (AlepouProjects/home/spatial-apps/balance-eccentricity/services/eccentricity.mjs:121-158),
// copied here so the eval reads nothing from Home at run time.
//
// Two things differ from the app, on purpose:
//   - The last line asks for a line of JSON instead of a spatial.transact call, because
//     the eval gives Claude no tools. The verdict's shape ({verdict, note}) is the same.
//   - For app-error, app-strict and incomplete cases, the app's working carries the bug
//     the case names (cases.mjs). The readings are always what the balance gave.
//
// Variants try a change to the app's wording against every case:
//   expected-spots   one more line naming the five spots the test needs (run 1 showed
//                    Sonnet and Haiku passing a test with a corner never weighed)
import { READABILITY_G, LIMIT_D, POSITIONS } from "./cases.mjs";

const LABELS = { centre: "Centre", "front-left": "Front left", "back-left": "Back left", "back-right": "Back right", "front-right": "Front right" };
const round = (n, digits = 4) => Math.round(n * 10 ** digits) / 10 ** digits;
const signed = (mg) => `${mg >= 0 ? "+" : ""}${mg}`;

export const SYSTEM_PROMPT = [
  "You are Claude, the assistant in Alepou Spatial: a person in a lab wears a mixed-reality headset, and apps running on their PC guide them through instrument procedures.",
  "Messages that start with an app's name in square brackets come from that app, not from the person. Your reply is spoken to the person in the headset.",
].join(" ");

// What the app's working says, bug included.
export function appWorking(testCase) {
  const toMg = 1000;
  const readabilityMg = round(READABILITY_G * toMg, 4);
  const centre = testCase.readings.find(([spot]) => spot === "centre")[1];
  const bug = testCase.bug || null;
  const reference = bug === "reference" ? testCase.readings.find(([spot]) => spot === "front-left")[1] : centre;
  const rows = testCase.readings.filter(([spot]) => spot !== "centre").map(([position, value]) => {
    let deviationMg = round((value - reference) * toMg, 3);
    if (bug === "copied" && testCase.copiedTenths?.[position] !== undefined) deviationMg = testCase.copiedTenths[position] / 10;
    if (bug === "units") deviationMg = round(value - reference, 4);
    return { position, deviationMg };
  });
  const searched = bug === "last-corner" ? rows.slice(0, -1) : rows;
  const largest = searched.reduce((best, row) => {
    const size = bug === "sign" ? row.deviationMg : Math.abs(row.deviationMg);
    const bestSize = bug === "sign" ? best.deviationMg : Math.abs(best.deviationMg);
    return size > bestSize ? row : best;
  }, searched[0]);
  const maxMg = round(Math.abs(largest.deviationMg), bug === "units" ? 4 : 3);
  const uMg = round(maxMg / (2 * Math.sqrt(3)), bug === "units" ? 4 : 3);
  const toleranceMg = bug === "limit" ? round(LIMIT_D * readabilityMg * 10, 3)
    : bug === "limit-small" ? round(LIMIT_D * readabilityMg / 10, 3)
    : round(LIMIT_D * readabilityMg, 3);
  const compared = bug === "uncertainty" ? uMg : maxMg;
  let pass = compared <= toleranceMg + 1e-9;
  if (bug === "inverted") pass = !pass;
  if (bug === "missing" || bug === "duplicate") pass = maxMg <= toleranceMg + 1e-9;
  return { rows, largest: largest.position, maxMg, uMg, toleranceMg, readabilityMg, pass, compared: bug === "uncertainty" ? "uncertainty" : "largest" };
}

export const VARIANTS = ["app", "expected-spots"];

export function buildMessage(testCase, variant = "app") {
  const working = appWorking(testCase);
  const lines = testCase.readings.map(([spot, grams]) => `- ${LABELS[spot]}: ${grams.toFixed(4)} g`);
  const deviations = working.rows.map((row) => `${LABELS[row.position].toLowerCase()} ${signed(row.deviationMg)} mg`).join(", ");
  const criterion = `largest deviation within ${LIMIT_D} d (${working.toleranceMg} mg)`;
  const workingLine = working.compared === "uncertainty"
    ? `The app's own working: largest difference ${working.maxMg} mg (${LABELS[working.largest].toLowerCase()}); u(ecc) = ${working.maxMg} / (2 * sqrt 3) = ${working.uMg} mg; criterion: ${criterion}; u(ecc) ${working.uMg} mg is within ${working.toleranceMg} mg, so ${working.pass ? "PASS" : "FAIL"}.`
    : `The app's own working: largest difference ${working.maxMg} mg (${LABELS[working.largest].toLowerCase()}); u(ecc) = ${working.maxMg} / (2 * sqrt 3) = ${working.uMg} mg; criterion: ${criterion}, so ${working.pass ? "PASS" : "FAIL"}.`;
  return [
    "[Balance eccentricity app] The eccentricity test on the lab balance has just finished, with the same weight placed on each spot of the pan:",
    ...lines,
    ...(variant === "expected-spots" ? [`The test needs one reading on each of these ${POSITIONS.length} spots: ${POSITIONS.map((spot) => LABELS[spot].toLowerCase()).join(", ")}.`] : []),
    `Readability d = ${working.readabilityMg} mg. Differences from the centre: ${deviations}.`,
    "Gloves: you confirmed them from a photo before the test (blue nitrile gloves on both hands).",
    workingLine,
    "Please check the readings and the working yourself, decide pass or fail (and say which criterion you used), and reply in at most three short sentences: your reply is spoken in the headset.",
    "Then put your verdict on the app's readings panel: end your reply with one line of JSON, {\"verdict\": \"pass\" or \"fail\", \"note\": \"one short sentence\"}.",
  ].join("\n");
}

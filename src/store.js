import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const FILE = path.join(DATA_DIR, "pronos.json");

function empty() {
  return { matches: {}, predictions: {}, scores: {} };
}

export function load() {
  try {
    if (!fs.existsSync(FILE)) return empty();
    return { ...empty(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return empty();
  }
}

export function save(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
}

export function nextMatchId(data) {
  const nums = Object.keys(data.matches)
    .map((id) => Number(id.replace(/\D/g, "")) || 0)
    .filter(Boolean);
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `m${n}`;
}

/** Points : score exact = 3 · bon vainqueur/nul = 1 */
export function calcPoints(predHome, predAway, realHome, realAway) {
  if (predHome === realHome && predAway === realAway) return 3;
  const predOutcome =
    predHome > predAway ? "H" : predHome < predAway ? "A" : "D";
  const realOutcome =
    realHome > realAway ? "H" : realHome < realAway ? "A" : "D";
  return predOutcome === realOutcome ? 1 : 0;
}

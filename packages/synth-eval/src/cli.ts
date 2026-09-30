/** CLI entry: runs the static baseline and prints TP/FP/FN/precision/recall/time. */
import { loadGroundTruth, predictStatic, scoreStatic } from "./evaluate.js";

const cases = await loadGroundTruth();
const { predictions, elapsedMs } = await predictStatic();
const m = scoreStatic(cases, predictions, elapsedMs);
console.log(JSON.stringify({ ...m, predictions }, null, 2));
if (m.fn > 0 || m.fp > 0) {
  console.error(`eval: ${String(m.missing.length)} missing, ${String(m.unexpected.length)} unexpected`);
  process.exitCode = 1;
}

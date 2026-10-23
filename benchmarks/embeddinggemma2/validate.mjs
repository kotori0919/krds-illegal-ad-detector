import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateOfficialResult, validateExtraResult, validateScanDetailBundle } from '../../packages/contracts/dist/index.js';
const out = 'artifacts/embeddinggemma2-eval-20261021';
const json = async name => JSON.parse(await readFile(`${out}/${name}`, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const report = await json('observed.json'), baseline = await json('baseline.json'), frozen = await json('frozen-inputs.json');
assert.equal(hash(await readFile('benchmarks/embeddinggemma2/protocol.json')), frozen.protocolSha256);
assert.equal(report.protocolSha256, frozen.protocolSha256);
assert.equal(hash(await readFile(`${out}/inputs.json`)), frozen.inputManifestSha256);
assert.equal(hash(await readFile(`${out}/baseline.json`)), report.baselineSha256);
for (const row of baseline.rows) assert.equal(hash(await readFile(row.file)), row.sha256);
const official = await json('baseline/official.json'), extra = await json('baseline/extra.json'), detail = await json('baseline/detail.json');
assert.equal(validateOfficialResult(official).ok, true);
assert.equal(validateExtraResult(extra).ok, true);
assert.deepEqual(validateScanDetailBundle(detail, official, extra), { ok: true, errors: [] });
assert.equal(baseline.coverage.ocrImagesCompleted, baseline.rows.length);
assert.equal(baseline.coverage.selection.excludedRecords, 0);
assert.deepEqual(report.runs.map(run => run.seed), report.protocol.seeds);
const tolerance = report.protocol.cosineTolerance, first = new Map(), firstScores = new Map();
for (const run of report.runs) {
  for (const [name, variant] of Object.entries(run.variants)) {
    assert.equal(variant.rows.length, baseline.rows.length);
    const expected = { tp: 0, fn: 0, fp: 0, tn: 0 };
    for (const [i, row] of variant.rows.entries()) {
      const original = baseline.rows[i];
      assert.equal(row.id, original.id); assert.equal(row.kind, original.kind);
      assert.equal(row.baselinePassed, original.baselinePassed);
      assert(Number.isFinite(row.positiveCosine) && Number.isFinite(row.negativeCosine));
      assert(Math.abs(row.positiveCosine) <= 1 + tolerance && Math.abs(row.negativeCosine) <= 1 + tolerance);
      if (firstScores.has(name)) {
        const initial = firstScores.get(name)[i];
        assert(Math.abs(initial.positiveCosine - row.positiveCosine) <= tolerance);
        assert(Math.abs(initial.negativeCosine - row.negativeCosine) <= tolerance);
      }
      assert(Math.abs(row.margin - (row.positiveCosine - row.negativeCosine)) <= tolerance);
      const passed = original.baselinePassed || (original.evidence.observedExternalDestination && row.margin >= report.protocol.margin);
      assert.equal(row.assistedPassed, passed);
      expected[original.kind === 'positive' ? passed ? 'tp' : 'fn' : passed ? 'fp' : 'tn'] += 1;
    }
    for (const [key, value] of Object.entries(expected)) assert.equal(variant.assisted[key], value);
    if (!firstScores.has(name)) firstScores.set(name, variant.rows);
    const bytes = await readFile(`${out}/embeddings-${run.seed}-${name.replaceAll('+', '-')}.npy`);
    assert.equal(bytes.subarray(1, 6).toString(), 'NUMPY'); assert.equal(bytes[6], 1);
    const headerEnd = 10 + bytes.readUInt16LE(8), header = bytes.subarray(10, headerEnd).toString();
    assert(header.includes("'descr': '<f4'") && header.includes("'fortran_order': False"));
    assert(header.includes(`(${baseline.rows.length}, ${report.protocol.embeddingDimension})`));
    assert.equal(bytes.length - headerEnd, baseline.rows.length * report.protocol.embeddingDimension * 4);
    const values = [];
    for (let offset = headerEnd; offset < bytes.length; offset += 4) { const value = bytes.readFloatLE(offset); assert(Number.isFinite(value)); values.push(value); }
    for (let i = 0; i < baseline.rows.length; i++) {
      const vector = values.slice(i * report.protocol.embeddingDimension, (i + 1) * report.protocol.embeddingDimension);
      assert(Math.abs(Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0)) - 1) <= tolerance);
    }
    if (!first.has(name)) first.set(name, values);
    else assert(Math.max(...values.map((value, i) => Math.abs(value - first.get(name)[i]))) <= tolerance);
  }
}
assert(report.imageParticipation.maxAbsDeltaRealVsWhiteWithSameOcr > tolerance, 'Pixels did not influence the actual forward output');
console.log(JSON.stringify({ inputs: baseline.rows.length, repeatedRuns: report.runs.length, contracts: 'official/extra/detail valid', numericalIntegrity: 'finite unit embeddings, paired drift within tolerance, image perturbation changes output', primaryUsefulImprovement: report.primaryUsefulImprovement }));

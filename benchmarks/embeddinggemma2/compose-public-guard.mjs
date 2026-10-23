import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { semanticGate } from '../../packages/detection/dist/semantic.js';
const out = 'artifacts/embeddinggemma2-eval-20261021';
const report = JSON.parse(await readFile(`${out}/observed.json`, 'utf8'));
const baseline = JSON.parse(await readFile(`${out}/baseline.json`, 'utf8'));
const runs = report.runs.map(run => ({ seed: run.seed, variants: Object.fromEntries(['text', 'image', 'image+ocr'].map(name => {
  const variant = run.variants[name];
  const rows = variant.rows.map((row, index) => {
    const original = baseline.rows[index]; assert.equal(original.id, row.id);
    const publicInformation = semanticGate(original.ocr.text).reasonCodes.includes('PUBLIC_INFORMATION');
    const passed = original.baselinePassed || (!publicInformation && original.evidence.observedExternalDestination && row.margin >= 0);
    return { id: row.id, kind: row.kind, group: row.group, publicInformation, margin: row.margin, passed };
  });
  return [name, { tp: rows.filter(row => row.kind === 'positive' && row.passed).length,
    fp: rows.filter(row => row.kind === 'negative' && row.passed).length,
    falsePositiveIds: rows.filter(row => row.kind === 'negative' && row.passed).map(row => row.id),
    blockedByExistingPublicGuard: rows.filter(row => row.publicInformation && row.margin >= 0).map(row => row.id), rows }];
})) }));
const result = { status: 'POSTHOC_EXISTING_POLICY_COMPOSITION_NOT_PREREGISTERED_PRIMARY_OR_HOLDOUT',
  reason: 'Added after observing the unguarded margin-zero sports-news false positive. Reuses the existing canonical PUBLIC_INFORMATION reason; no prompts, model, threshold or OCR edits.',
  role: 'Offline review candidates only; not enabled in production',
  baselineSha256: report.baselineSha256, protocolSha256: report.protocolSha256, runs };
await writeFile(`${out}/public-guard-composition.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, runs: runs.map(run => ({ seed: run.seed,
  variants: Object.fromEntries(Object.entries(run.variants).map(([name, value]) => [name, { tp: value.tp, fp: value.fp, blockedByExistingPublicGuard: value.blockedByExistingPublicGuard }])) })) }, null, 2));

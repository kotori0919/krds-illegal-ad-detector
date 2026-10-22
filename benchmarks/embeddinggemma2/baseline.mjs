import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright-core';
import { scanSite } from '../../packages/detection/dist/scan.js';
import { decideVisualImage } from '../../packages/detection/dist/visual-decision.js';
import { validateOfficialResult, validateExtraResult, validateScanDetailBundle } from '../../packages/contracts/dist/index.js';
const out = 'artifacts/embeddinggemma2-eval-20261021';
const inputs = JSON.parse(await readFile(`${out}/inputs.json`, 'utf8'));
const bytes = await Promise.all(inputs.map(async item => {
  const buffer = await readFile(item.file);
  assert.equal(createHash('sha256').update(buffer).digest('hex'), item.sha256);
  return buffer;
}));
const destinations = ['https://ch-hhh.com/', 'https://gmb-ggg.com/', 'https://ygsqnqotwmudafbdgdoggp15wje.com/?agentCode=111',
  'http://rv-0303.com/?ref=bk', 'http://mco-ccc.com/', 'https://xn--2e0bl66bgoa00e.com/', 'https://angbet-2.com/?agentCode=1744', 'http://hb-mm.com/'];
const requests = [];
const server = createServer((request, response) => {
  requests.push(request.url);
  const match = /^\/image-(\d+)\.png$/.exec(request.url);
  if (match && bytes[Number(match[1])]) {
    const body = bytes[Number(match[1])]; response.writeHead(200, { 'content-type': 'image/png', 'content-length': body.length }); response.end(body); return;
  }
  if (request.url !== '/') { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': 'text/html;charset=utf-8' });
  response.end('<!doctype html>' + inputs.map((item, index) => `<a href="${destinations[index] ?? 'https://ordinary-retailer.example/catalog'}"><img class="banner" id="case-${index}" src="/image-${index}.png"></a>`).join(''));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const launch = chromium.launch.bind(chromium);
if (process.env.KRDS_TEST_UNSANDBOXED === '1') chromium.launch = options => launch({ ...options, chromiumSandbox: false });
try {
  const start = performance.now();
  const output = await scanSite({ entryUrl: `http://127.0.0.1:${server.address().port}/`, crawl: {
    concurrency: 1, settleMs: 20, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 120 },
  } });
  assert.equal(validateOfficialResult(output.result).ok, true);
  assert.equal(validateExtraResult(output.extraResult).ok, true);
  assert.deepEqual(validateScanDetailBundle(output.detailBundle, output.result, output.extraResult), { ok: true, errors: [] });
  await mkdir(`${out}/baseline`, { recursive: true });
  for (const [name, value] of [['official', output.result], ['extra', output.extraResult], ['detail', output.detailBundle]]) {
    await writeFile(`${out}/baseline/${name}.json`, JSON.stringify(value, null, 2) + '\n');
  }
  const rows = inputs.map((input, index) => {
    const image = output.detailBundle.imageAnalysis.find(item => item.location === `#case-${index}`);
    assert(image, `No analysis record for ${input.id}`);
    assert.equal(image.ocr.state, 'available', `No completed OCR for ${input.id}`);
    const candidate = { sourceKind: 'img', pageUrl: image.frameUrl, frameUrl: image.frameUrl,
      location: image.location, destinationUrl: image.destinationUrl, candidateEvidence: image.candidateEvidence, visibleDomAdTexts: [] };
    const verdict = decideVisualImage(candidate, image.ocr, false);
    assert.equal(verdict.decision.passed, image.decision.passed);
    return { ...input, ocr: image.ocr, baselinePassed: image.decision.passed, decision: image.decision,
      evidence: { candidateEvidence: image.candidateEvidence, observedExternalDestination: image.candidateEvidence.includes('external-destination'),
        destinationUrl: image.destinationUrl, gate: verdict.gate } };
  });
  const result = { rows, wallMs: performance.now() - start, coverage: output.detailBundle.visualAnalysisCoverage,
    role: 'Canonical scanner on owned loopback image fixture, not live-site recall', requests };
  await writeFile(`${out}/baseline.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ inputs: rows.length, completed: result.coverage.ocrImagesCompleted,
    positives: rows.filter(item => item.kind === 'positive' && item.baselinePassed).length,
    falsePositives: rows.filter(item => item.kind === 'negative' && item.baselinePassed).map(item => item.id), wallMs: result.wallMs }));
} finally {
  chromium.launch = launch; server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}

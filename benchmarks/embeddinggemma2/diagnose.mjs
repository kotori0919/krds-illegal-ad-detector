import { readFile, writeFile } from 'node:fs/promises';
const out = 'artifacts/embeddinggemma2-eval-20261021';
const baseline = JSON.parse(await readFile(`${out}/baseline.json`, 'utf8'));
// Visual readings are diagnostic annotations only: never replace OCR evidence.
const notes = {
  'blacktoon-1': ['70%, 페이백10%, 콤프4%', '70% is absent; 10% becomes 10x and the percent after 콤프4 is absent. Percent conjunction fails.'],
  'blacktoon-2': ['신규70%, 콤프3.5%, 테더, 상금 토너먼트', '콤프 survives but another distinct required jargon term and 입금/첫충 do not. Brand and tournament words alone are insufficient.'],
  'blacktoon-3': ['첫충40%, 페이백10%, 콤프3.5%, 무기명 테더', '첫충 becomes 첫중, 페이백 becomes 매이백; 콤프 is not recovered. Multiple required exact terms disappear.'],
  'blacktoon-4': ['신규40%, 무한15%, 페이백10%, 콤프7%', '페이백 becomes 메이백; 콤프 becomes 금프. No supported category or required exact jargon pair survives.'],
  'blacktoon-5': ['첫충40%, 페이백10%, 콤프4%, 테더 입출금 가능', 'Only 콤프 survives. The top-up/payback labels are absent and 입출금 is read as 입들금, so the deposit/jargon conjunction fails.'],
  'blacktoon-6': ['카지노&스포츠, 첫충70%, 페이백, 고액전용', 'The casino category and most offer words/numbers disappear or break, including 스포츠/고액전용. 콤프 alone cannot establish the required semantic conjunction.'],
  'blacktoon-7': ['페이백10%, 콤프3.5%, USDT 입금 가능', 'Exact percent, two jargon terms and deposit survive, with an observed external link. Current positive control.'],
  'blacktoon-8': ['첫충70%, 페이백10%, 업계최고 콤프4%', '페이백10% survives but 콤프 is read as 록프, 입금 as 입급 and 첫충 is absent. The independent terms needed for semantics are lost.'],
};
const rows = baseline.rows.filter(row => row.kind === 'positive').map(row => {
  const text = row.evidence.gate.normalizedText;
  const jargon = ['콤프', '롤링', '페이백', '첫충'].filter(term => term === '첫충' ? /첫충(?!전)/.test(text) : text.includes(term));
  return { id: row.id, collected: true, ocrCompleted: row.ocr.state === 'available',
    ocr: row.ocr, passed: row.baselinePassed,
    semanticTrace: { hasPercent: /\d+(?:\.\d+)?%/.test(text), exactJargon: jargon,
      hasCompOrRollover: /콤프|롤링/.test(text), hasDeposit: /입금|첫충(?!전)/.test(text),
      observedExternalDestination: row.evidence.observedExternalDestination,
      semanticPassed: row.evidence.gate.passed, decision: row.decision },
    visuallyReadSubset: notes[row.id][0], cause: notes[row.id][1],
    annotationScope: 'Human reading of low-resolution archived pixels; not original GIF transcription or replacement evidence.' };
});
await writeFile(`${out}/miss-analysis.json`, JSON.stringify({ coverage: baseline.coverage,
  conclusion: 'All eight acquired and OCR completed; seven fail exact semantic conditions after low-resolution OCR errors. No capacity/deadline exclusion on this fixed replay. Animation hypothesis cannot be proven on static screen crops.', rows }, null, 2) + '\n');
console.log(JSON.stringify(rows.map(row => ({ id: row.id, ...row.semanticTrace, cause: row.cause })), null, 2));

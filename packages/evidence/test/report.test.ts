import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { ImageAnalysis, OfficialResult, VisualAnalysisCoverage } from "@krds-detector/contracts";
import { createOperationalWorkbook } from "../src/report.js";

const official = JSON.parse(readFileSync(new URL("./fixtures/sample_result_617_sanitized.json", import.meta.url), "utf8")) as OfficialResult;
const techniqueNames = { HOMOGLYPH: "유사 문자", JAMO: "자모 분리", TRANSPARENT: "투명 처리", OFFSCREEN: "화면 밖 배치" };
describe("real operational XLSX", () => {
  it.each(["available", "budget", "recognition-error"] as const)("preserves selected OCR and separate alternate %s evidence", async (state) => {
    const selected = "페이백10%\n콤프3.5% 입금 가능";
    const alternative = "=HYPERLINK(\"https://example.invalid\")\n페이벡1Ox 록프3.5x";
    const analysis: ImageAnalysis = { sourceUrl: "https://example.kr/ad.png", pageUrls: [official.meta.entry_url],
      ocr: { state: "available", backend: "ppocr-selected", text: selected, confidence: 0.8 },
      ocrAlternatives: [state === "available" ? { state, backend: "ppocr-other", text: alternative, confidence: 0.6 }
        : { state: "unavailable", backend: "ppocr-other", reason: state }], matchedTerms: [],
      decision: { rule: "image-only-ad-v4-text-review", score: 3, threshold: 3, passed: true, detail: "review" },
      textEmbedding: { state: "available", policy: "text-ad-embedding-v1", model: "embeddinggemma-2-text-f32",
        revision: "daa72c51243991dfcaf9f9137d2c573d8f7790c0", positiveSimilarity: 0.6, negativeSimilarity: 0.4,
        margin: 0.2, threshold: 0, passed: true, elapsedMs: 100 } };
    const before = JSON.stringify(analysis);
    const bytes = await createOperationalWorkbook([{ sessionId: "ocr", official: { ...official, findings: [] }, imageAnalysis: [analysis] }]);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const row = book.getWorksheet("추가 분석")!.getRow(2);
    expect(row.getCell(5).value).toBe(selected);
    expect(row.getCell(7).value).toContain("선택 OCR 엔진 ppocr-selected");
    expect(row.getCell(7).value).toContain(state === "available" ? `다른 OCR 원문 (ppocr-other, 신뢰도 0.6): ${alternative}`
      : `다른 OCR 인식 불가 (ppocr-other): ${state}`);
    expect(row.getCell(7).value).toContain("문자 의미 유사도: 검토 필요");
    expect(row.getCell(7).value).toContain("의미 유사도는 OCR 원문이나 법적 위반의 증거가 아님");
    expect(row.getCell(7).type).toBe(ExcelJS.ValueType.String);
    expect(JSON.stringify(analysis)).toBe(before);
  });

  it("retains collection limits separately from successful page status and official findings", async () => {
    const empty = { ...official, findings: [] };
    const bytes = await createOperationalWorkbook([{ sessionId: "limited", official: empty, coverage: {
      coverage: { checkedPages: 1, failedPages: [], timedOut: false }, pageOutcomes: [{
        url: empty.meta.entry_url, finalUrl: empty.meta.entry_url, status: 200, outcome: "checked", depth: 0,
        collectionIssues: ["html-snapshot-truncated", "network-policy-denied"], discoverySource: "entry",
      }],
    } }]);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const page = book.getWorksheet("페이지·점검 범위")!.getRow(2);
    expect(page.getCell(4).value).toBe("확인 완료");
    expect(page.getCell(8).value).toBe("html-snapshot-truncated, network-policy-denied");
    expect(book.getWorksheet("탐지 상세")!.rowCount).toBe(1);
    const summary = new Map<string, ExcelJS.CellValue>();
    book.getWorksheet("점검 요약")!.eachRow(row => summary.set(String(row.getCell(2).value), row.getCell(3).value));
    expect(summary.get("수집·보관 제한이 기록된 페이지")).toBe(1);
  });
  it("keeps operator judgment separate from reading state and exports saved case provenance", async () => {
    const finding = official.findings[0]!;
    const bytes = await createOperationalWorkbook([{ sessionId: "case1", official,
      savedCase: { caseId: "case1", directory: "C:/case-root/case1", policyVersion: 2, reviewRevision: 7 },
      reviews: [{ findingId: finding.id, state: "reviewed", judgment: "judged-normal", note: "=1+1", at: "2026-10-09T00:00:00Z" }] }]);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const detail = book.getWorksheet("탐지 상세")!.getRow(2);
    expect(detail.getCell(8).value).toBe("검토 완료");
    expect(detail.getCell(9).value).toBe("=1+1");
    expect(detail.getCell(10).value).toBe("정상으로 판단");
    expect(detail.getCell(9).type).toBe(ExcelJS.ValueType.String);
    const summary = new Map<string, ExcelJS.CellValue>();
    book.getWorksheet("점검 요약")!.eachRow((row) => summary.set(String(row.getCell(2).value), row.getCell(3).value));
    expect(summary.get("보관 케이스 번호")).toBe("case1");
    expect(summary.get("공식 원본 경로")).toBe("C:/case-root/case1/result.json");
    expect(summary.get("저장된 검토 수정 번호")).toBe(7);
  });
  it("round-trips every original record, conservative group and local review note", async () => {
    const before = JSON.stringify(official);
    const bytes = await createOperationalWorkbook([{ sessionId: "s1", official,
      reviews: [{ findingId: "f372", state: "reviewed", note: "자연스러운 댓글인지 추가 확인 필요", at: "2026-10-08T03:00:00Z" }] }]);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    expect(book.worksheets.map((sheet) => sheet.name)).toEqual(["점검 요약", "반복 항목", "탐지 상세", "페이지·점검 범위", "추가 분석", "검토 기록"]);
    const detail = book.getWorksheet("탐지 상세")!;
    expect(detail.rowCount).toBe(618);
    for (let i = 0; i < official.findings.length; i++) {
      const finding = official.findings[i]!;
      expect(detail.getRow(i + 2).values).toEqual([undefined, "s1", finding.id, finding.url, finding.evidence_text,
        finding.technique, techniqueNames[finding.technique], finding.location, finding.id === "f372" ? "검토 완료" : "검토 필요",
        finding.id === "f372" ? "자연스러운 댓글인지 추가 확인 필요" : "", "판단 전"]);
    }
    expect(book.getWorksheet("반복 항목")?.rowCount).toBe(20);
    expect(book.getWorksheet("페이지·점검 범위")?.getRow(2).values).toContain("알 수 없음");
    expect(book.getWorksheet("검토 기록")?.getRow(2).values).toContain("자연스러운 댓글인지 추가 확인 필요");
    expect(detail.views[0]?.state).toBe("frozen"); expect(detail.autoFilter).toBeDefined();
    expect(JSON.stringify(official)).toBe(before);
  });
  it("exports measured image coverage as readable counts, limits and skipped units without inferring unknown totals", async () => {
    const visualAnalysisCoverage: VisualAnalysisCoverage = {
      pagesConsidered: 2, pagesNotConsidered: 3, candidatesObserved: 8, candidateTotal: null,
      imagesAcquired: 5, imageAnalysisRecords: 4, ocrImagesAttempted: 3, ocrImagesCompleted: 2, ocrImagesUnavailable: 1,
      limits: { pages: 2, candidatesPerDocument: 12, elementsPerDocument: 24, bytesPerPage: 4096, distinctOcrImages: 3 },
      limitsReached: ["page-limit", "ocr-image-limit"],
      skips: [{ reason: "page-limit", unit: "page", count: 3 }, { reason: "image-unavailable", unit: "image", count: 1 },
        { reason: "candidate-limit", unit: "document", count: 2 }, { reason: "capture-error", unit: "candidate", count: 1 }],
    };
    const bytes = await createOperationalWorkbook([{ sessionId: "s1", official,
      summary: { visualAnalysisCoverage, observedDomainCount: 0, infrastructure: [], imageAnalysisCount: 4, creativeImages: [] } }]);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const values = new Map<string, ExcelJS.CellValue>();
    book.getWorksheet("점검 요약")!.eachRow((row) => values.set(String(row.getCell(2).value), row.getCell(3).value));
    expect(values.get("이미지 수집을 고려한 페이지 수")).toBe(2);
    expect(values.get("이미지 수집을 고려하지 않은 것으로 기록된 페이지 수")).toBe(3);
    expect(values.get("실제로 관측한 이미지 후보 수")).toBe(8);
    expect(values.get("전체 이미지 후보 수")).toBe("알 수 없음");
    expect(values.get("수집한 이미지 수")).toBe(5);
    expect(values.get("저장된 이미지 분석 기록 수")).toBe(4);
    expect(values.get("문자 인식을 시도한 서로 다른 이미지 수")).toBe(3);
    expect(values.get("문자 인식을 완료한 서로 다른 이미지 수")).toBe(2);
    expect(values.get("문자 인식이 불가한 서로 다른 이미지 수")).toBe(1);
    expect(values.get("이미지 수집 페이지 수 제한")).toBe(2);
    expect(values.get("문서별 이미지 후보 수 제한")).toBe(12);
    expect(values.get("문서별 요소 확인 수 제한")).toBe(24);
    expect(values.get("페이지별 이미지 용량 제한 (바이트)")).toBe(4096);
    expect(values.get("서로 다른 문자 인식 이미지 수 제한")).toBe(3);
    expect(values.get("이미지 분석에서 도달한 제한")).toBe("이미지 수집 페이지 수 제한 · 서로 다른 문자 인식 이미지 수 제한");
    expect(values.get("이미지 분석 제외·실패 1")).toBe("이미지 수집 페이지 수 제한 · 페이지 3개");
    expect(values.get("이미지 분석 제외·실패 2")).toBe("이미지 분석 사용 불가 · 이미지 1개");
    expect(values.get("이미지 분석 제외·실패 3")).toBe("문서별 후보 수 제한 · 문서 2개");
    expect(values.get("이미지 분석 제외·실패 4")).toBe("이미지 촬영 실패 · 후보 1개");
    expect(values.get("이미지 분석 범위")).not.toBe(JSON.stringify(visualAnalysisCoverage));
    expect(values.get("공식 탐지 기록 수")).toBe(617);
    expect(book.getWorksheet("탐지 상세")!.rowCount).toBe(618);
  });
  it("distinguishes missing image coverage from measured zero work", async () => {
    const bytes = await createOperationalWorkbook([{ sessionId: "missing", official }, { sessionId: "measured", official,
      summary: { observedDomainCount: 0, infrastructure: [], imageAnalysisCount: 0, creativeImages: [], visualAnalysisCoverage: {
        pagesConsidered: 0, pagesNotConsidered: 0, candidatesObserved: 0, candidateTotal: null,
        imagesAcquired: 0, imageAnalysisRecords: 0, ocrImagesAttempted: 0, ocrImagesCompleted: 0, ocrImagesUnavailable: 0,
        limits: { pages: 1, candidatesPerDocument: 1, elementsPerDocument: 1, bytesPerPage: 1, distinctOcrImages: 1 }, limitsReached: [], skips: [],
      } } }]);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const values = new Map<string, ExcelJS.CellValue>();
    book.getWorksheet("점검 요약")!.eachRow((row) => values.set(`${row.getCell(1).value}:${row.getCell(2).value}`, row.getCell(3).value));
    expect(values.get("missing:이미지 분석 범위")).toContain("알 수 없음");
    expect(values.has("missing:실제로 관측한 이미지 후보 수")).toBe(false);
    expect(values.get("measured:실제로 관측한 이미지 후보 수")).toBe(0);
    expect(values.get("measured:전체 이미지 후보 수")).toBe("알 수 없음");
    expect(values.get("measured:이미지 분석에서 도달한 제한")).toBe("기록된 설정 제한 도달 없음; 확인하지 않은 요소의 분석 여부는 알 수 없음");
    expect(values.get("measured:이미지 분석 제외·실패")).toBe("기록된 이미지 분석 제외·실패 없음");
  });
  it("keeps all four official technique codes beside Korean names in details and groups", async () => {
    const codes = ["HOMOGLYPH", "JAMO", "TRANSPARENT", "OFFSCREEN"] as const;
    const bytes = await createOperationalWorkbook([{ sessionId: "s1", official: { ...official,
      findings: codes.map((technique, index) => ({ ...official.findings[0]!, id: `t${index}`, technique })) } }]);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const details = book.getWorksheet("탐지 상세")!;
    expect(details.getRow(1).values).toContain("공식 기법 코드");
    for (let index = 0; index < codes.length; index++) {
      expect(details.getCell(index + 2, 5).value).toBe(codes[index]);
      expect(details.getCell(index + 2, 6).value).toBe(techniqueNames[codes[index]!]);
    }
    const groups = book.getWorksheet("반복 항목")!;
    const labelsByCode = new Map<string, ExcelJS.CellValue>();
    groups.eachRow((row, number) => { if (number > 1) labelsByCode.set(String(row.getCell(5).value), row.getCell(4).value); });
    expect(Object.fromEntries(labelsByCode)).toEqual(techniqueNames);
  });
  it("writes hostile input as bounded inert strings with no formulas or hyperlinks", async () => {
    const hostile = ["=HYPERLINK(\"https://evil.invalid\",\"open\")", "+cmd|calc!A0", "@SUM(1,2)", "-1+2", "x".repeat(40_000)];
    const result = { ...official, findings: hostile.map((text, i) => ({ ...official.findings[0]!, id: `h${i}`, evidence_text: text })) };
    const bytes = await createOperationalWorkbook([{ sessionId: "s1", official: result }]);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const sheet = book.getWorksheet("탐지 상세")!;
    for (let i = 0; i < 4; i++) expect(sheet.getCell(i + 2, 4).value).toBe(hostile[i]);
    expect(String(sheet.getCell(6, 4).value).length).toBeLessThanOrEqual(32_767);
    for (const sheet of book.worksheets) sheet.eachRow((row) => row.eachCell((cell) => {
      expect(cell.type).not.toBe(ExcelJS.ValueType.Formula);
      expect(cell.type).not.toBe(ExcelJS.ValueType.Hyperlink);
    }));
  });
  it("keeps aggregate details keyed by independent session rather than combining official JSON", async () => {
    const bytes = await createOperationalWorkbook([{ sessionId: "a", label: "첫 사이트", official },
      { sessionId: "b", label: "둘째 사이트", official: { ...official, meta: { ...official.meta, entry_url: "https://another.invalid/" }, findings: official.findings.slice(0, 1) } }]);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    expect(book.getWorksheet("대상 요약")?.rowCount).toBe(3);
    const details = book.getWorksheet("탐지 상세")!;
    expect(details.rowCount).toBe(619);
    expect(details.getCell(618, 1).value).toBe("a"); expect(details.getCell(619, 1).value).toBe("b");
  });
  it("retains pending and failed targets as unknown counts in a partial batch report", async () => {
    const bytes = await createOperationalWorkbook([{ sessionId: "a", official }], { targets: [
      { key: "1", label: "Done", entryUrl: official.meta.entry_url, status: "완료", sessionId: "a" },
      { key: "2", label: "Failed", entryUrl: "https://failed.invalid/", status: "실패", reason: "DNS unavailable" },
      { key: "3", label: "Pending", entryUrl: "https://pending.invalid/", status: "대기" },
    ] });
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const targets = book.getWorksheet("대상 요약")!;
    expect(targets.rowCount).toBe(4);
    expect(targets.getRow(2).values).toContain(617);
    expect(targets.getRow(3).values).toContain("DNS unavailable");
    expect(targets.getRow(4).values).toContain("알 수 없음");
    expect(book.getWorksheet("탐지 상세")?.rowCount).toBe(618);
  });
});

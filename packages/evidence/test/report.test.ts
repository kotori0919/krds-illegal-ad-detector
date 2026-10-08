import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { OfficialResult } from "@krds-detector/contracts";
import { createOperationalWorkbook } from "../src/report.js";

const official = JSON.parse(readFileSync(new URL("./fixtures/sample_result_617_sanitized.json", import.meta.url), "utf8")) as OfficialResult;
describe("real operational XLSX", () => {
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
        finding.technique, finding.location, finding.id === "f372" ? "검토 완료" : "검토 필요",
        finding.id === "f372" ? "자연스러운 댓글인지 추가 확인 필요" : ""]);
    }
    expect(book.getWorksheet("반복 항목")?.rowCount).toBe(20);
    expect(book.getWorksheet("페이지·점검 범위")?.getRow(2).values).toContain("알 수 없음");
    expect(book.getWorksheet("검토 기록")?.getRow(2).values).toContain("자연스러운 댓글인지 추가 확인 필요");
    expect(detail.views[0]?.state).toBe("frozen"); expect(detail.autoFilter).toBeDefined();
    expect(JSON.stringify(official)).toBe(before);
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
});

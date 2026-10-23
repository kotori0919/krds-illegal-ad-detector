import ExcelJS from "exceljs";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BrowserHost } from "../src/host/browser.js";
import { WorkbookExport } from "../src/screens/WorkbookExport.js";

afterEach(cleanup);
it("retries a report save failure, preserves result on cancellation and exports the full session", async () => {
  const host = new BrowserHost();
  const session = await host.startScan({ entryUrl: "https://sample.invalid/" });
  const before = JSON.stringify(await host.getOfficialResult(session.id));
  let attempts = 0;
  let saved: Uint8Array | undefined;
  host.saveWorkbook = async (_ids, data) => {
    saved = data; attempts++;
    if (attempts === 1) throw new Error("controlled disk write failure");
    return attempts === 2 ? null : "report.xlsx";
  };
  render(<WorkbookExport host={host} sessionId={session.id} reviews={[]} />);
  const button = screen.getByRole("button", { name: "엑셀 보고서 저장" });
  fireEvent.click(button);
  await screen.findByRole("alert");
  expect(JSON.stringify(await host.getOfficialResult(session.id))).toBe(before);
  fireEvent.click(button);
  await screen.findByText(/저장을 취소했습니다/);
  expect(JSON.stringify(await host.getOfficialResult(session.id))).toBe(before);
  fireEvent.click(button);
  await screen.findByText(/저장 완료:/);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(saved as unknown as ExcelJS.Buffer);
  expect(book.getWorksheet("탐지 상세")?.rowCount).toBe((await host.getOfficialResult(session.id))!.findings.length + 1);
  expect(JSON.stringify(await host.getOfficialResult(session.id))).toBe(before);
});

it("refuses a report if flushed review records cannot be read back from the saved case", async () => {
  const host = new BrowserHost();
  const session = await host.startScan({ entryUrl: "https://agency.example/" });
  let exports = 0;
  host.saveWorkbook = async () => { exports++; return "report.xlsx"; };
  render(<WorkbookExport host={host} sessionId={session.id} reviews={[]} prepareReviews={async () => []} />);
  fireEvent.click(screen.getByRole("button", { name: "엑셀 보고서 저장" }));
  expect((await screen.findByRole("alert")).textContent).toContain("검토 기록의 저장 상태");
  expect(exports).toBe(0);
  expect(await host.getOfficialResult(session.id)).toBeDefined();
});

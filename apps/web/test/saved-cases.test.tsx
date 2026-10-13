// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TAURI_HOST_CAPABILITIES, type CaseList } from "@krds-detector/contracts";
import { BrowserHost } from "../src/host/browser.js";
import { SavedCases } from "../src/screens/SavedCases.js";

afterEach(cleanup);

it("finds a saved case beyond the first page by address, date or identity and restores the list after clearing", async () => {
  const cases: CaseList["cases"] = Array.from({ length: 22 }, (_, index) => ({
    directory: `/fixtures/${index}`,
    reviewRevision: 0,
    manifest: {
      schemaVersion: 1, caseId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      entryUrl: index === 21 ? "https://archive.invalid/oldest" : `https://recent.invalid/${index}`,
      startedAt: "2026-10-14T00:00:00Z", finishedAt: index === 21 ? "2026-09-01T00:00:00Z" : "2026-10-14T00:00:00Z",
      exportableAt: "2026-10-14T00:00:00Z", status: "succeeded", toolVersion: "test-fixture",
      policyVersion: 2, officialSha256: "0".repeat(64), findings: 0, issues: [], settings: {},
    },
  }));
  class FixtureHost extends BrowserHost {
    override async getCapabilities() { return TAURI_HOST_CAPABILITIES; }
    override async listCases(): Promise<CaseList> {
      return { schemaVersion: 1, storageRoot: "/fixtures", cases, issues: [], limit: 2000 };
    }
  }
  render(<SavedCases host={new FixtureHost()} onOpen={async () => {}} />);
  await screen.findByRole("button", { name: "케이스 다시 열기 https://recent.invalid/0" });
  const search = screen.getByRole("searchbox", { name: "저장된 케이스 검색" });
  for (const query of [" ARCHIVE.INVALID ", "2026-09-01", cases[21]!.manifest.caseId]) {
    fireEvent.change(search, { target: { value: query } });
    expect(screen.getAllByRole("button", { name: /^케이스 다시 열기/ }).map((button) => button.textContent))
      .toEqual(["케이스 다시 열기 https://archive.invalid/oldest"]);
  }
  fireEvent.change(search, { target: { value: "no-such-case" } });
  expect(screen.queryByRole("button", { name: /^케이스 다시 열기/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "검색 초기화" }));
  expect(screen.getAllByRole("button", { name: /^케이스 다시 열기/ }).map((button) => button.textContent))
    .toEqual(cases.slice(0, 20).map((saved) => `케이스 다시 열기 ${saved.manifest.entryUrl}`));
});

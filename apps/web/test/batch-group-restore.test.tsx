// @vitest-environment jsdom
import ExcelJS from "exceljs";
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  TAURI_HOST_CAPABILITIES, initialProgress,
  type BatchGroup, type BatchGroupList, type CaseManifest, type CaseReview, type HostCapabilities,
  type OfficialResult, type OpenCase, type ScanSession,
} from "@krds-detector/contracts";
import { BatchCoordinator } from "../src/batch-coordinator.js";
import { restoreBatchGroup } from "../src/batch-group.js";
import { DEMO_ENTRY_URL, demoResult } from "../src/demo/findings.js";
import { BrowserHost } from "../src/host/browser.js";
import { BatchWorkspace } from "../src/screens/BatchWorkspace.js";

const CASE_ID = "22222222-3333-4444-8555-666666666666";
const GROUP_ID = "77777777-1111-4222-8333-444444444444";
const SAVED_NOTE = "재시작 뒤에도 남는 저장된 판단";

/** Everything a restart keeps: group files and case directories, no live session. */
const vault = {
  groups: new Map<string, BatchGroup>(),
  cases: new Map<string, OpenCase>(),
  results: new Map<string, OfficialResult>(),
  sessions: new Map<string, ScanSession>(),
};

function manifest(caseId: string, entryUrl: string): CaseManifest {
  return {
    schemaVersion: 1, caseId, entryUrl, startedAt: "2026-10-23T01:00:00Z", finishedAt: "2026-10-23T01:05:00Z",
    exportableAt: "2026-10-23T01:05:01Z", status: "succeeded", toolVersion: "test-fixture", policyVersion: 2,
    officialSha256: "a".repeat(64), findings: 5, issues: [], settings: {},
  };
}

function sessionFor(caseId: string, entryUrl: string): ScanSession {
  return {
    id: caseId, entryUrl, status: "succeeded", startedAt: "2026-10-23T01:00:00Z", finishedAt: "2026-10-23T01:05:00Z",
    hasResult: true, progress: { ...initialProgress("succeeded"), visitedPages: 4, confirmedFindings: 5 },
  };
}

function seedCase(entryUrl = DEMO_ENTRY_URL): void {
  const review: CaseReview = {
    schemaVersion: 1, revision: 3, updatedAt: "2026-10-23T01:10:00Z",
    records: [{ findingId: "demo-f1", state: "reviewed", judgment: "suspected", note: SAVED_NOTE, at: "2026-10-23T01:10:00Z" }],
  };
  const official = demoResult();
  vault.cases.set(CASE_ID, { manifest: manifest(CASE_ID, entryUrl), review, directory: `/cases/${CASE_ID}` });
  vault.results.set(CASE_ID, { ...official, meta: { ...official.meta, entry_url: entryUrl } });
  vault.sessions.set(CASE_ID, sessionFor(CASE_ID, entryUrl));
}

function stoppedGroup(secondEntryUrl = "https://second.example.kr/"): BatchGroup {
  return {
    schemaVersion: 1, groupId: GROUP_ID, createdAt: "2026-10-23T01:00:00Z", updatedAt: "2026-10-23T01:04:00Z",
    phase: "stopped", scope: "quick", connection: "direct",
    targets: [
      { key: 0, label: "첫 사이트", entryUrl: DEMO_ENTRY_URL, kind: "site", status: "complete", caseId: CASE_ID },
      { key: 1, label: "둘째 사이트", entryUrl: secondEntryUrl, kind: "site", status: "pending" },
    ],
  };
}

/**
 * A host after restart: only durable state (group files, case directories) is
 * shared, every live session and in-memory result is gone.
 */
class RestartHost extends BrowserHost {
  workbooks: Uint8Array[] = [];
  started: string[] = [];
  override async getCapabilities(): Promise<HostCapabilities> { return TAURI_HOST_CAPABILITIES; }
  override async listBatchGroups(): Promise<BatchGroupList> {
    return { schemaVersion: 1, groups: [...vault.groups.values()], issues: [] };
  }
  override async saveBatchGroup(group: BatchGroup): Promise<BatchGroup> {
    vault.groups.set(group.groupId, group);
    return group;
  }
  override async openCase(caseId: string): Promise<OpenCase> {
    const saved = vault.cases.get(caseId);
    if (!saved) throw new Error(`unknown case ${caseId}`);
    return saved;
  }
  override async getSession(sessionId: string): Promise<ScanSession | undefined> {
    return vault.sessions.get(sessionId) ?? super.getSession(sessionId);
  }
  override async getOfficialResult(sessionId: string): Promise<OfficialResult | undefined> {
    return vault.results.get(sessionId) ?? super.getOfficialResult(sessionId);
  }
  override async startBatchScan(request: Parameters<BrowserHost["startBatchScan"]>[0]): Promise<ScanSession> {
    this.started.push(request.entryUrl);
    return this.startScan(request);
  }
  override async saveWorkbook(_sessionIds: string[], data: Uint8Array): Promise<string | null> {
    this.workbooks.push(data);
    return "batch.xlsx";
  }
}

beforeEach(() => { vault.groups.clear(); vault.cases.clear(); vault.sessions.clear(); });
afterEach(cleanup);

function renderWorkspace(host: RestartHost): void {
  render(<BatchWorkspace host={host} reviews={{}} onBack={() => undefined} onInspect={() => undefined} prepareReviews={async () => undefined} />);
}

it("remounting with a fresh host restores the group, its judgments and an honest incomplete target", async () => {
  seedCase();
  vault.groups.set(GROUP_ID, stoppedGroup());
  const first = new RestartHost();
  renderWorkspace(first);

  const restore = await screen.findByRole("button", { name: /이 묶음 복원/ });
  // Before restoring, the group reports real coverage and names what is missing.
  expect(screen.getByText(/저장된 결과 1\/2/)).toBeTruthy();
  expect(screen.getByText(/미완료 대상 1개/)).toBeTruthy();
  fireEvent.click(restore);
  await screen.findByText(/저장된 일괄 묶음을 복원했습니다/);
  expect(screen.getByText(/첫 사이트 · 완료/)).toBeTruthy();
  expect(screen.getByText(/둘째 사이트 · 대기/)).toBeTruthy();
  expect(screen.getByText(/저장된 결과가 없는 대상 1개는 미완료로 남으며/)).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "완료된 대상 통합 엑셀 저장" }));
  await screen.findByText(/저장 완료: batch\.xlsx/);
  expect(first.workbooks).toHaveLength(1);

  const book = new ExcelJS.Workbook();
  await book.xlsx.load(first.workbooks[0]! as unknown as ExcelJS.Buffer);
  const details = book.getWorksheet("탐지 상세")!;
  const detailRow = (details.getSheetValues() as unknown[][]).find((cells) => cells?.includes(SAVED_NOTE))!;
  expect(detailRow).toBeTruthy();
  expect(detailRow).toContain("위반 의심");
  expect((book.getWorksheet("검토 기록")!.getSheetValues() as unknown[][]).some((cells) => cells?.includes(SAVED_NOTE))).toBe(true);

  const summary = (book.getWorksheet("대상 요약")!.getSheetValues() as unknown[][]).filter(Boolean);
  const firstTarget = summary.find((cells) => cells.includes("첫 사이트"))!;
  const secondTarget = summary.find((cells) => cells.includes("둘째 사이트"))!;
  expect(firstTarget[9]).toBe("완료");
  expect(firstTarget[1]).toBe(CASE_ID);
  expect(secondTarget[9]).toBe("미완료");
  expect(secondTarget[1]).toBe("");
  expect(secondTarget.join("|")).not.toContain(CASE_ID);

  // The restored group is written back without inventing coverage for the unrun target.
  await waitFor(() => expect(vault.groups.get(GROUP_ID)?.targets[1]?.caseId).toBeUndefined());
  expect(vault.groups.get(GROUP_ID)?.targets[0]?.caseId).toBe(CASE_ID);

  // Second restart: a brand-new host still recognizes the group by identity.
  cleanup();
  renderWorkspace(new RestartHost());
  await screen.findByRole("button", { name: /이 묶음 복원/ });
  expect(screen.getByText(/저장된 결과 1\/2/)).toBeTruthy();
});

it("continues only the targets that never stored a result", async () => {
  seedCase();
  const base = stoppedGroup("https://third.example.kr/");
  // A crash mid-run leaves the interrupted target recorded as running.
  const group: BatchGroup = { ...base, phase: "running",
    targets: [base.targets[0]!, { ...base.targets[1]!, status: "running" }] };
  const host = new RestartHost();
  const restored = await restoreBatchGroup(host, group);
  expect(restored.interrupted).toBe(1);
  expect(restored.unreadable).toBe(0);
  expect(restored.phase).toBe("paused");
  expect(restored.targets[1]?.status).toBe("pending");

  const coordinator = new BatchCoordinator(host,
    group.targets.map((target) => ({ label: target.label, entryUrl: target.entryUrl, kind: target.kind })),
    {}, 1, "direct", restored);
  await coordinator.start();

  expect(host.started).toEqual(["https://third.example.kr/"]);
  const state = coordinator.snapshot();
  expect(state.targets[0]?.status).toBe("complete");
  expect(state.targets[0]?.session?.id).toBe(CASE_ID);
  // The preview host stores no coverage record, so a fresh preview scan is "partial".
  expect(state.targets[1]?.status).toBe("partial");
  expect(state.targets[1]?.session?.id).not.toBe(CASE_ID);
  expect(state.targets[1]?.session?.hasResult).toBe(true);
});

it("reports a saved case that cannot be reopened instead of counting it as covered", async () => {
  const orphan: BatchGroup = {
    ...stoppedGroup(), phase: "complete",
    targets: [{ key: 0, label: "사라진 사례", entryUrl: DEMO_ENTRY_URL, kind: "site", status: "complete", caseId: "99999999-9999-4999-8999-999999999999" }],
  };
  vault.groups.set(orphan.groupId, orphan);
  renderWorkspace(new RestartHost());

  fireEvent.click(await screen.findByRole("button", { name: /이 묶음 복원/ }));
  await screen.findByText(/저장된 일괄 묶음을 복원했습니다/);
  expect(screen.getByText(/다시 열지 못한 대상 1개/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "완료된 대상 통합 엑셀 저장" })).toHaveProperty("disabled", true);
});

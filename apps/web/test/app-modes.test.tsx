import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "../src/App.js";
import { BrowserHost } from "../src/host/browser.js";
import { initialProgress, TAURI_HOST_CAPABILITIES, type CaseManifest, type CaseReview, type ReviewRecord, type ScanRequest } from "@krds-detector/contracts";

let host: BrowserHost;
vi.mock("../src/host/index.js", () => ({ createHost: async () => host }));
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    key: (index: number) => [...values.keys()][index] ?? null,
  } satisfies Storage);
  host = new BrowserHost();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("starts with simple onboarding and keeps ordinary inspection independent of WARP", async () => {
  let warpReads = 0;
  host.getWarpStatus = async () => { warpReads++; throw new Error("broken optional configuration"); };
  const requests: ScanRequest[] = [];
  const start = host.startScan.bind(host);
  host.startScan = async (request) => { requests.push(request); return start(request); };
  render(<App />);
  expect((await screen.findByRole("radio", { name: /간단 모드/ }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
  const input = await screen.findByRole("textbox", { name: /점검할 웹사이트/ });
  expect(screen.queryByText("상세 설정")).toBeNull();
  expect(screen.queryByRole("button", { name: "여러 사이트 일괄 점검" })).toBeNull();
  expect(screen.queryByRole("button", { name: "인프라 분석" })).toBeNull();
  fireEvent.change(input, { target: { value: "https://agency.example/" } });
  fireEvent.click(screen.getByRole("button", { name: /점검 시작/ }));
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0]).toMatchObject({ connection: "direct", limits: { maxPages: 200, maxDepth: 4, timeoutSec: 1500 } });
  expect(warpReads).toBe(0);
});

it("remembers the mode and separates stored results from the new inspection form", async () => {
  const first = render(<App />);
  fireEvent.click(await screen.findByRole("radio", { name: /고급 모드/ }));
  fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
  await screen.findByText("상세 설정");
  fireEvent.click(screen.getByRole("button", { name: "저장된 결과" }));
  expect(await screen.findByRole("region", { name: "저장된 케이스" })).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: /점검할 웹사이트/ })).toBeNull();
  first.unmount();
  render(<App />);
  expect(await screen.findByRole("combobox", { name: "화면 모드" })).toHaveProperty("value", "advanced");
  expect(screen.queryByRole("button", { name: "시작하기" })).toBeNull();
});

it("resets the connection for an explicit new inspection while preserving a settings return draft", async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole("radio", { name: /고급 모드/ }));
  fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
  fireEvent.click(screen.getByLabelText(/앱 전용 WARP/));
  fireEvent.click(screen.getByRole("button", { name: "설정·도움말" }));
  fireEvent.click(screen.getByRole("button", { name: "현재 작업으로 돌아가기" }));
  expect(screen.getByLabelText(/앱 전용 WARP/)).toHaveProperty("checked", true);
  fireEvent.click(screen.getByRole("button", { name: "새 점검", exact: true }));
  expect(screen.getByLabelText(/기본 연결/)).toHaveProperty("checked", true);
});

class StoredHost extends BrowserHost {
  readonly id = "00000000-0000-4000-8000-000000000001";
  review: CaseReview = { schemaVersion: 1, revision: 0, updatedAt: "", records: [] };
  delay?: Promise<void>;
  openDelay?: Promise<void>;
  readonly official = { meta: { topic: "TOPIC", entry_url: "https://agency.example/", started_at: "2026-10-20T00:00:00Z", finished_at: "2026-10-20T00:01:00Z", elapsed_sec: 60, tool_version: "fixture" }, findings: [
    { id: "f1", url: "https://agency.example/one", location: "#one", technique: "OFFSCREEN" as const, evidence_text: "카지노 첫 번째", is_violation: true },
    { id: "f2", url: "https://agency.example/two", location: "#two", technique: "OFFSCREEN" as const, evidence_text: "카지노 두 번째", is_violation: true },
  ] };
  readonly manifest: CaseManifest = { schemaVersion: 1, caseId: this.id, entryUrl: this.official.meta.entry_url, startedAt: this.official.meta.started_at, finishedAt: this.official.meta.finished_at,
    exportableAt: this.official.meta.finished_at, status: "succeeded", toolVersion: "fixture", policyVersion: 2, officialSha256: "0".repeat(64), findings: 2, issues: [], settings: { transport: { kind: "direct", reason: "operator" } } };
  constructor() {
    super();
    this.setReplayResult({ id: this.id, entryUrl: this.manifest.entryUrl, startedAt: this.manifest.startedAt, status: "succeeded", hasResult: true, progress: initialProgress("succeeded") }, this.official,
      { version: 2, findings: [], creativeImages: [], coverage: { checkedPages: 2, failedPages: [], timedOut: false } });
  }
  override async getCapabilities() { return { ...TAURI_HOST_CAPABILITIES, windowsIntegration: false }; }
  override async listCases() { return { schemaVersion: 1 as const, storageRoot: "/fixture", cases: [{ directory: "/fixture/case", manifest: this.manifest }], issues: [], limit: 20 }; }
  override async openCase() { await this.openDelay; return { directory: "/fixture/case", manifest: this.manifest, review: structuredClone(this.review) }; }
  override async saveCaseReview(_id: string, revision: number, records: ReviewRecord[]) {
    await this.delay;
    if (revision !== this.review.revision) throw new Error("Revision conflict");
    this.review = { schemaVersion: 1, revision: revision + 1, updatedAt: "2026-10-20T01:00:00Z", records: structuredClone(records) };
    return structuredClone(this.review);
  }
}

it("keeps a case and memo across modes, and advances within unreviewed results after the save settles", async () => {
  const stored = new StoredHost(); host = stored;
  const original = JSON.stringify(stored.official);
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "시작하기" }));
  fireEvent.click(screen.getByRole("button", { name: "저장된 결과" }));
  fireEvent.click(await screen.findByRole("button", { name: /^케이스 다시 열기/ }));
  await screen.findAllByRole("button", { name: "근거 보기", exact: true });
  fireEvent.change(screen.getByLabelText("검토 상태"), { target: { value: "needed" } });
  fireEvent.click(screen.getAllByRole("button", { name: "근거 보기", exact: true })[0]!);
  fireEvent.change(await screen.findByLabelText("검토 메모"), { target: { value: "담당자 검토 내용" } });
  fireEvent.change(screen.getByRole("combobox", { name: "화면 모드" }), { target: { value: "advanced" } });
  expect(screen.getByLabelText("검토 메모")).toHaveProperty("value", "담당자 검토 내용");
  fireEvent.change(screen.getByRole("combobox", { name: "화면 모드" }), { target: { value: "simple" } });
  let release!: () => void;
  stored.delay = new Promise<void>(resolve => { release = resolve; });
  fireEvent.click(screen.getByRole("button", { name: "검토 완료·다음" }));
  expect(screen.getByRole("button", { name: "저장된 결과" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "결과 목록으로" })).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: "새로 검사하기" }));
  expect(screen.queryByRole("textbox", { name: /점검할 웹사이트/ })).toBeNull();
  release();
  await waitFor(() => expect(stored.review.records[0]).toMatchObject({ note: "담당자 검토 내용", state: "reviewed" }));
  const inspector = await screen.findByRole("complementary", { name: "탐지 상세" });
  await within(inspector).findByText("카지노 두 번째");
  expect(JSON.stringify(stored.official)).toBe(original);
});

it("blocks navigation while a stored case is opening instead of replacing a later active scan", async () => {
  const stored = new StoredHost(); host = stored;
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "시작하기" }));
  fireEvent.click(screen.getByRole("button", { name: "저장된 결과" }));
  let release!: () => void;
  stored.openDelay = new Promise<void>(resolve => { release = resolve; });
  fireEvent.click(await screen.findByRole("button", { name: /^케이스 다시 열기/ }));
  expect(screen.getByRole("button", { name: "새 점검", exact: true })).toHaveProperty("disabled", true);
  release();
  await screen.findAllByRole("button", { name: "근거 보기", exact: true });
  expect(screen.getByRole("button", { name: "새 점검", exact: true })).toHaveProperty("disabled", false);
});

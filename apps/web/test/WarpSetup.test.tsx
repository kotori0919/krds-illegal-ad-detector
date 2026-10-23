// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { TAURI_HOST_CAPABILITIES, initialProgress, type WarpStatus, type HostBridge, type OpenCase, type CaseReview, type ReviewRecord, type OfficialResult } from "@krds-detector/contracts";
import { BrowserHost } from "../src/host/browser.js";
import { WarpSetup } from "../src/screens/WarpSetup.js";
import { App } from "../src/App.js";

const selected = vi.hoisted(() => ({ host: undefined as HostBridge | undefined }));
vi.mock("../src/host/index.js", () => ({ createHost: async () => selected.host }));
// jsdom has no Worker/File.arrayBuffer. Execute the same parser at that boundary.
vi.mock("../src/import-targets.js", async () => {
  const { previewTargets } = await import("@krds-detector/evidence/target-import");
  return { importTargets: async () => previewTargets("sites.csv", Uint8Array.from(new TextEncoder().encode("사이트명,시작 주소\n테스트,https://public.example/\n"))) };
});

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    key: (index: number) => [...values.keys()][index] ?? null,
  } satisfies Storage);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

class RegistrationHost extends BrowserHost {
  status: WarpStatus = { state: "unregistered" };
  devices = 0;
  release?: () => void;
  fail = false;
  termsOpened = 0;
  override async openWarpTerms() { this.termsOpened++; throw new Error("private Windows launch detail"); }
  override async getCapabilities() { return TAURI_HOST_CAPABILITIES; }
  override async getWarpStatus() { return this.status; }
  override async registerWarp({ acceptTerms }: { acceptTerms: boolean }): Promise<WarpStatus> {
    if (!acceptTerms) throw new Error("consent required");
    this.devices++;
    this.status = { state: "registering" };
    await new Promise<void>((resolve) => { this.release = resolve; });
    this.status = this.fail ? { state: "unavailable", reason: "registration-failed" }
      : { state: "ready", backend: "usque", version: "4.2.1" };
    return this.status;
  }
}

it("keeps native terms failure actionable without navigating or enrolling", async () => {
  const host = new RegistrationHost();
  render(<WarpSetup host={host} />);
  const terms = await screen.findByRole("link", { name: "Cloudflare 이용약관" });
  expect(fireEvent.click(terms)).toBe(false);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringMatching(/약관.*브라우저/));
  expect(screen.queryByText("private Windows launch detail")).toBeNull();
  expect(screen.getByRole("checkbox")).toHaveProperty("checked", false);
  expect(host.termsOpened).toBe(1);
  expect(host.devices).toBe(0);
});

it("requires consent, prevents duplicate pending registration and refreshes stored readiness", async () => {
  const host = new RegistrationHost();
  const view = render(<WarpSetup host={host} />);
  const register = await screen.findByRole("button", { name: "동의하고 앱 전용 WARP 등록" });
  expect((register as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(register);
  expect(host.devices).toBe(0);
  expect(screen.getByRole("link", { name: "Cloudflare 이용약관" }).getAttribute("href"))
    .toBe("https://www.cloudflare.com/application/terms/");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(register);
  view.rerender(<WarpSetup host={host} />);
  expect((screen.getByRole("button", { name: /등록 중/ }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /등록 중/ }));
  expect(host.devices).toBe(1);
  await act(async () => host.release?.());
  expect(await screen.findByText(/저장된 설정 확인 완료/)).toBeTruthy();
  expect(screen.getByText(/실제 연결은 점검마다/)).toBeTruthy();
  expect(screen.queryByRole("checkbox")).toBeNull();
});

it("keeps uncertain enrollment unavailable across rerenders and explicit status refresh without creating another device", async () => {
  const host = new RegistrationHost(); host.fail = true;
  const view = render(<WarpSetup host={host} />);
  await screen.findByRole("checkbox");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "동의하고 앱 전용 WARP 등록" }));
  await act(async () => host.release?.());
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringMatching(/담당자/));
  view.rerender(<WarpSetup host={host} />);
  fireEvent.click(screen.getByRole("button", { name: "WARP 상태 새로고침" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "동의하고 앱 전용 WARP 등록" })).toBeNull();
  expect(host.devices).toBe(1);
});

it("hides native setup in browser preview", async () => {
  const view = render(<WarpSetup host={new BrowserHost()} />);
  await act(async () => {});
  expect(view.container.textContent).toBe("");
});

it("preserves confirmed enrollment when its follow-up status read fails", async () => {
  class RefreshFailureHost extends RegistrationHost {
    override async getWarpStatus() {
      if (this.status.state === "ready") throw new Error("private refresh failure");
      return this.status;
    }
  }
  const host = new RefreshFailureHost();
  render(<WarpSetup host={host} />);
  fireEvent.click(await screen.findByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "동의하고 앱 전용 WARP 등록" }));
  await act(async () => host.release?.());
  expect(await screen.findByText(/저장된 설정 확인 완료/)).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toMatch(/상태.*새로고침/);
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(host.devices).toBe(1);
});

it("keeps registration explicit and separates connection settings from single and batch inspection", async () => {
  class ScanHost extends RegistrationHost {
    override async listCases() { return { schemaVersion: 1 as const, storageRoot: "/fixture", cases: [], issues: [], limit: 20 }; }
    override async startScan(): Promise<never> { throw new Error("private credential path"); }
    override async startBatchScan(): Promise<never> { throw new Error("private credential path"); }
  }
  const host = new ScanHost(); selected.host = host;
  render(<App />);
  fireEvent.click(await screen.findByRole("radio", { name: /고급 모드/ }));
  fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
  fireEvent.change(screen.getByLabelText(/점검할 웹사이트/), { target: { value: "https://public.example/" } });
  fireEvent.click(screen.getByLabelText(/앱 전용 WARP/));
  fireEvent.submit(screen.getByRole("form", { name: "탐지 시작" }));
  fireEvent.click(await screen.findByRole("button", { name: "WARP 연결 설정 확인" }));
  const checkbox = await screen.findByRole("checkbox");
  expect(checkbox).toHaveProperty("checked", false);
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole("button", { name: "현재 작업으로 돌아가기" }));
  expect(screen.getByLabelText(/점검할 웹사이트/)).toHaveProperty("value", "https://public.example/");
  fireEvent.click(screen.getByRole("button", { name: "여러 사이트 일괄 점검" }));
  expect(screen.queryByRole("region", { name: "앱 전용 WARP 연결 설정" })).toBeNull();
  fireEvent.change(screen.getByLabelText("대상 파일 선택 또는 여기로 끌어 놓기"), { target: { files: { item: () => new File(["fixture"], "sites.csv") } } });
  fireEvent.click(await screen.findByRole("button", { name: "점검 가능 1개 사이트 점검 시작" }));
  expect(await screen.findByText(/이 사이트의 점검을 완료하지 못했습니다/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "WARP 연결 설정 확인" })).toBeNull();
  expect(screen.queryByText("private credential path")).toBeNull();
  expect(host.devices).toBe(0);
});

it("opens, edits and reopens an actual saved result fixture offline while unregistered", async () => {
  const fixture = JSON.parse(readFileSync("packages/evidence/test/fixtures/sample_result_617_sanitized.json", "utf8")) as OfficialResult;
  const result = { ...fixture, findings: fixture.findings.slice(0, 1) };
  class OfflineHost extends RegistrationHost {
    exported = "";
    review: CaseReview = { schemaVersion: 1, revision: 0, updatedAt: "2026-10-14T00:00:00Z", records: [] };
    manifest: OpenCase["manifest"] = { schemaVersion: 1, caseId: "saved", entryUrl: result.meta.entry_url, startedAt: "2026-10-14T00:00:00Z", finishedAt: "2026-10-14T00:01:00Z", exportableAt: "2026-10-14T00:01:00Z", status: "failed", toolVersion: "fixture", policyVersion: 2, officialSha256: "0".repeat(64), findings: 1, issues: [], settings: { transportFailure: { code: "tunnel-exited", scope: "incomplete" } } };
    override async listCases() { return { schemaVersion: 1 as const, storageRoot: "/fixture", cases: [{ directory: "/fixture/saved", manifest: this.manifest, reviewRevision: this.review.revision }], issues: [], limit: 20 }; }
    override async openCase() { return { directory: "/fixture/saved", manifest: this.manifest, review: structuredClone(this.review) }; }
    override async saveCaseReview(_id: string, revision: number, records: ReviewRecord[]) {
      if (revision !== this.review.revision) throw new Error("conflict");
      this.review = { ...this.review, revision: revision + 1, records: structuredClone(records) }; return structuredClone(this.review);
    }
    override async getOfficialResult() { return result; }
    override async exportResult() { this.exported = JSON.stringify(result); return { resultJson: "/fixture/export/result.json" }; }
    override async getSession() { return { id: "saved", entryUrl: result.meta.entry_url, startedAt: this.manifest.startedAt, status: "failed" as const, hasResult: true, progress: initialProgress("failed") }; }
  }
  const host = new OfflineHost(); selected.host = host;
  const view = render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "시작하기" }));
  fireEvent.click(screen.getByRole("button", { name: "저장된 결과" }));
  fireEvent.click(await screen.findByRole("button", { name: /^케이스 다시 열기/ }));
  fireEvent.click(await screen.findByRole("button", { name: "근거 보기", exact: true }));
  fireEvent.change(await screen.findByLabelText("검토 메모"), { target: { value: "오프라인 검토 기록" } });
  await vi.waitFor(() => expect(host.review.records[0]?.note).toBe("오프라인 검토 기록"));
  expect(screen.getByRole("button", { name: "공식 JSON 저장" })).toHaveProperty("disabled", false);
  fireEvent.click(screen.getByRole("button", { name: "공식 JSON 저장" }));
  const dialog = await screen.findByRole("dialog", { name: "결과 저장" });
  await vi.waitFor(() => expect(within(dialog).getByRole("button", { name: "저장", exact: true })).toHaveProperty("disabled", false));
  fireEvent.click(within(dialog).getByRole("button", { name: "저장", exact: true }));
  expect(await within(dialog).findByText("저장 완료: /fixture/export/result.json")).toBeTruthy();
  expect(JSON.parse(host.exported)).toEqual(result);
  expect(result.findings[0]).not.toHaveProperty("note");
  view.unmount(); window.localStorage.clear(); render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "시작하기" }));
  fireEvent.click(screen.getByRole("button", { name: "저장된 결과" }));
  fireEvent.click(await screen.findByRole("button", { name: /^케이스 다시 열기/ }));
  fireEvent.click(await screen.findByRole("button", { name: "근거 보기", exact: true }));
  expect(await screen.findByLabelText("검토 메모")).toHaveProperty("value", "오프라인 검토 기록");
  expect(screen.queryByRole("region", { name: "앱 전용 WARP 연결 설정" })).toBeNull();
  expect(host.devices).toBe(0);
});

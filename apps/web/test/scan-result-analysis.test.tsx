// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { initialProgress, type ExtraResult, type HostBridge, type OfficialResult, type ScanDetailBundle, type ScanSession } from "@krds-detector/contracts";
import { evidenceHost } from "./evidence-host.js";
import { InfrastructureAnalysis } from "../src/screens/InfrastructureAnalysis.js";
import { ScanResult } from "../src/screens/ScanResult.js";
import { ScanProgressView } from "../src/screens/ScanProgress.js";
import { BrowserHost } from "../src/host/browser.js";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const result: OfficialResult = { meta: { topic: "TOPIC", entry_url: "https://example.kr/",
  started_at: "2026-10-07T00:00:00Z", finished_at: "2026-10-07T00:01:00Z", elapsed_sec: 60, tool_version: "0.1.0" }, findings: [] };
const decision = { rule: "ocr-ad-terms-v1", score: 0.8, threshold: 0.7, passed: true, detail: "OCR text matched advertisement terms" };
const bundle: ScanDetailBundle = { version: 2, findings: [], creativeImages: [],
  coverage: { checkedPages: 1, failedPages: [], timedOut: false },
  imageAnalysis: [{ sourceUrl: "https://example.kr/solo.png", pageUrls: ["https://example.kr/clean"],
    ocr: { state: "available", backend: "tesseract", text: "카지노 가입 이벤트", confidence: 0.94 }, matchedTerms: ["카지노"], decision }] };

async function renderResult(detail: ScanDetailBundle, options: { simple?: boolean; status?: ScanSession["status"]; view?: "findings" | "extra" | "pages" | "coverage"; extra?: ExtraResult; official?: OfficialResult; progressElapsedSec?: number; getExtraResult?: HostBridge["getExtraResult"] } = {}) {
  vi.useFakeTimers();
  const session: ScanSession = { id: "s1", entryUrl: result.meta.entry_url, status: options.status ?? "succeeded",
    startedAt: result.meta.started_at, hasResult: true, progress: { ...initialProgress(options.status ?? "succeeded"), elapsedSec: options.progressElapsedSec ?? 0 } };
  const host = { getCapabilities: async () => ({ localScan: true }), getSession: async () => session,
    ...evidenceHost(detail), getOfficialResult: async () => options.official ?? result,
    getExtraResult: options.getExtraResult ?? (async () => options.extra) } as unknown as HostBridge;
  function Workspace() {
    const [view, setView] = useState<"findings" | "extra" | "pages" | "coverage">(options.view ?? "extra");
    const [query, setQuery] = useState("");
    return <ScanResult simple={options.simple} host={host} sessionId="s1" query={query} onQueryChange={setQuery} filter="ALL" onFilterChange={() => {}}
      view={view} onViewChange={setView} reviewedIds={new Set()} onReviewMany={() => {}} onSelectionHidden={() => {}}
      onEvidence={() => {}} onExport={() => {}} onRestart={() => {}} />;
  }
  render(<Workspace />);
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
}

describe("stored OCR and partial coverage presentation", () => {
  it.each([false, true])("copies only the observed destination with simple=%s", async (simple) => {
    const destinationUrl = "https://observed-offer.example/path?code=123";
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await renderResult({ ...bundle, imageAnalysis: [{ ...bundle.imageAnalysis![0]!, destinationUrl }] }, { simple });
    fireEvent.click(screen.getByRole("button", { name: "관측한 연결 주소 복사" }));
    await act(async () => {});
    expect(writeText).toHaveBeenCalledExactlyOnceWith(destinationUrl);
    expect(screen.getByText("연결 주소를 복사했습니다.").getAttribute("role")).toBe("status");
    expect(screen.getByText(destinationUrl).closest("a")).toBeNull();
  });

  it.each(["denied", "unavailable"])("keeps the address selectable when clipboard is %s", async (failure) => {
    vi.stubGlobal("navigator", failure === "denied" ? { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("permission denied")) } } : {});
    const destinationUrl = "https://observed-offer.example/";
    await renderResult({ ...bundle, imageAnalysis: [{ ...bundle.imageAnalysis![0]!, destinationUrl }] }, { simple: true });
    fireEvent.click(screen.getByRole("button", { name: "관측한 연결 주소 복사" }));
    await act(async () => {});
    expect(screen.getByText("복사하지 못했습니다. 주소를 직접 선택해 복사해 주세요.")).toBeDefined();
    expect(screen.getByText(destinationUrl)).toBeDefined();
    expect(screen.getByText("카지노 가입 이벤트")).toBeDefined();
  });

  it("opens image review candidates in simple mode when the official result is empty", async () => {
    const extra: ExtraResult = { meta: result.meta, findings: [{ id: "x1", url: result.meta.entry_url, location: "#banner", technique: "ETC", is_violation: true, evidence_text: "실제 배너 원문", extra_finding: "IMAGE_ONLY_ILLEGAL_AD" }] };
    await renderResult(bundle, { simple: true, view: "findings", extra });
    expect(screen.getByRole("heading", { name: "이미지 광고 검토 후보" })).toBeDefined();
    expect(screen.getByText("배너·추가 단서")).toBeDefined();
    expect(screen.getByText(/확인한 페이지에서 탐지된 항목이 없습니다/).closest("[hidden]")).not.toBeNull();
    expect(screen.queryByRole("region", { name: "이미지 문자 분석" })).toBeNull();
  });

  it.each(["findings", "coverage"] as const)("keeps the operator's chosen %s view when delayed extra results arrive", async (chosen) => {
    let complete!: (value: ExtraResult) => void;
    const pending = new Promise<ExtraResult>(resolve => { complete = resolve; });
    await renderResult(bundle, { simple: true, view: "findings", getExtraResult: async () => pending });
    const name = chosen === "findings" ? "의심 항목" : "점검 범위";
    fireEvent.click(screen.getByRole("button", { name, exact: true }));
    await act(async () => complete({ meta: result.meta, findings: [{ id: "x1", url: result.meta.entry_url, location: "#banner", technique: "ETC", is_violation: true, evidence_text: "실제 배너 원문", extra_finding: "IMAGE_ONLY_ILLEGAL_AD" }] }));
    expect(screen.getByRole("button", { name, exact: true }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("heading", { name: "이미지 광고 검토 후보" })).toBeNull();
  });

  it("shows elapsed time through optional image analysis without changing official metadata", async () => {
    await renderResult(bundle, { progressElapsedSec: 95 });
    expect(screen.getByText(/경과 시간 01:35/)).toBeDefined();
    expect(result.meta.elapsed_sec).toBe(60);
  });

  it.each([false, true])("presents text similarity as review evidence with simple=%s", async (simple) => {
    await renderResult({ ...bundle, imageAnalysis: [{ ...bundle.imageAnalysis![0]!, matchedTerms: [],
      textEmbedding: { state: "available", policy: "text-ad-embedding-v1", model: "embeddinggemma-2-text-f32",
        revision: "daa72c51243991dfcaf9f9137d2c573d8f7790c0", positiveSimilarity: 0.6, negativeSimilarity: 0.4,
        margin: 0.2, threshold: 0, passed: true, elapsedMs: 123 },
      decision: { ...decision, rule: "image-only-ad-v4-text-review", score: 3, threshold: 3 } }] }, { simple });
    expect(screen.getByText("문자 의미 유사도: 검토 필요")).toBeDefined();
    expect(screen.getByText("의미 유사도는 OCR 원문이나 법적 위반의 증거가 아닙니다.")).toBeDefined();
    expect(screen.getByText("카지노 가입 이벤트")).toBeDefined();
    expect(screen.queryByText("광고 표현 확인")).toBeNull();
    if (simple) expect(screen.queryByText(/문자 의미 모델:/)).toBeNull();
    else expect(screen.getByText(/문자 의미 모델: embeddinggemma-2-text-f32/).closest("details")?.open).toBe(false);
  });

  it("discloses unavailable text similarity without removing actual OCR", async () => {
    await renderResult({ ...bundle, imageAnalysis: [{ ...bundle.imageAnalysis![0]!,
      textEmbedding: { state: "unavailable", reason: "budget" } }] });
    expect(screen.getByText("시간 제한으로 보조 비교를 완료하지 못했습니다.")).toBeDefined();
    expect(screen.getByText("카지노 가입 이벤트")).toBeDefined();
    expect(screen.queryByText("문자 의미 유사도: 검토 필요")).toBeNull();
  });

  it.each([false, true])("keeps selected OCR distinct from an alternate interpretation with simple=%s", async (simple) => {
    const selected = "페이백10%\n콤프3.5% 입금 가능";
    const alternative = "페이벡1Ox\n록프3.5x 입급";
    await renderResult({ ...bundle, imageAnalysis: [{ ...bundle.imageAnalysis![0]!,
      ocr: { state: "available", backend: "ppocr-selected", text: selected, confidence: 0.8 },
      ocrAlternatives: [{ state: "available", backend: "ppocr-other", text: alternative, confidence: 0.6 }] }] }, { simple });
    expect(screen.getByText(selected, { normalizer: value => value })).toBeDefined();
    expect(screen.getByText("작은 배너의 다른 문자 인식 결과를 함께 비교했습니다.")).toBeDefined();
    if (simple) {
      expect(screen.getByText(alternative, { normalizer: value => value }).closest("details")?.open).toBe(false);
      expect(screen.getByText(selected, { normalizer: value => value }).closest("details")).toBeNull();
      expect(screen.getByText("다른 인식 원문 1건 보기").tagName).toBe("SUMMARY");
      expect(screen.queryByText(/다른 문자 인식 엔진:/)).toBeNull();
    } else {
      const alternatives = screen.getByRole("region", { name: "다른 문자 인식 결과", hidden: true });
      expect(within(alternatives).getByText(alternative, { normalizer: value => value }).closest("details")?.open).toBe(false);
      expect(within(alternatives).getByText("다른 문자 인식 엔진: ppocr-other")).toBeDefined();
      expect(screen.getByText("문자 인식 엔진: ppocr-selected")).toBeDefined();
      expect(within(alternatives).getByText("각 결과는 별도로 인식한 원문입니다. 표시된 의미 비교 점수는 위에서 선택한 원문을 기준으로 합니다.")).toBeDefined();
    }
  });

  it.each(["budget", "recognition-error"] as const)("discloses alternate OCR %s without fabricating text", async (reason) => {
    await renderResult({ ...bundle, imageAnalysis: [{ ...bundle.imageAnalysis![0]!,
      ocrAlternatives: [{ state: "unavailable", backend: "ppocr-other", reason }] }] });
    expect(screen.getByText("카지노 가입 이벤트")).toBeDefined();
    expect(screen.getByText(reason === "budget" ? "시간 제한으로 다른 문자 인식을 완료하지 못했습니다." : "다른 문자 인식에 실패했습니다.")
      .closest("details")?.open).toBe(false);
    expect(screen.getByText("다른 문자 인식 엔진: ppocr-other")).toBeDefined();
  });

  it("shows stored collection limits even when the page succeeded with zero findings", async () => {
    await renderResult({ ...bundle, pageOutcomes: [{ url: result.meta.entry_url, finalUrl: result.meta.entry_url,
      status: 200, outcome: "checked", depth: 0, discoverySource: "entry", collectionIssues: ["html-snapshot-truncated", "network-policy-denied"] }] }, { view: "coverage" });
    const limits = screen.getByRole("list", { name: "수집·보관 제한" });
    expect(within(limits).getByText(/html-snapshot-truncated, network-policy-denied/)).toBeDefined();
    expect(screen.getByText(/탐지 0건이 전체 내용의 정상 판정을 뜻하지 않습니다/)).toBeDefined();
    expect(screen.getByText(/확인한 페이지 1개 · 실패한 페이지 0개/)).toBeDefined();
  });
  it("shows OCR original text and rule decision for an image without a repeated-creative finding", async () => {
    await renderResult(bundle);
    const analysis = screen.getByRole("region", { name: "이미지 문자 분석" });
    expect(within(analysis).getByText("카지노 가입 이벤트")).toBeDefined();
    expect(within(analysis).getByText(/문자 인식 신뢰도: 94%/).closest("details")?.open).toBe(false);
    expect(within(analysis).getByText("카지노")).toBeDefined();
    expect(within(analysis).getByText(`판단 규칙: ${decision.rule}`).closest("details")?.open).toBe(false);
    expect(within(analysis).getByText("판단 점수 / 기준: 0.8 / 0.7").closest("details")?.open).toBe(false);
    expect(within(analysis).getByText("광고 표현 확인")).toBeDefined();
    expect(screen.getByText("https://example.kr/clean")).toBeDefined();
    expect(screen.queryByText("이 세션에는 추가 분석 결과가 없습니다.")).toBeNull();
  });

  it.each([ ["budget", "시간·용량 제한으로 문자를 인식하지 못했습니다."],
    ["recognition-error", "문자 인식에 실패했습니다."] ] as const)("shows OCR unavailability for %s without fabricating text", async (reason, label) => {
    await renderResult({ ...bundle, imageAnalysis: [{ ...bundle.imageAnalysis![0]!,
      ocr: { state: "unavailable", backend: "tesseract", reason }, matchedTerms: [],
      decision: { ...decision, score: 0, passed: false } }] });
    expect(screen.getByText(label)).toBeDefined();
    expect(screen.queryByText("카지노 가입 이벤트")).toBeNull();
    expect(screen.queryByText("94%")).toBeNull();
    expect(screen.getByText("판단할 수 없음")).toBeDefined();
  });

  it("joins repeated creative capture and OCR by source URL", async () => {
    const sourceUrl = bundle.imageAnalysis![0]!.sourceUrl;
    await renderResult({ ...bundle, creativeImages: [{ findingId: "extra-1", sourceUrl, sha256: "a".repeat(64),
      mimeType: "image/png", dataUrl: "data:image/png;base64,YQ==", width: 120, height: 80, capturedAt: result.meta.finished_at }] },
    { extra: { meta: result.meta, findings: [{ id: "extra-1", url: sourceUrl, location: sourceUrl,
      is_violation: true, technique: "ETC", extra_finding: "REUSED_AD_CREATIVE", evidence_text: "seen 2 times" }] } });
    const analysis = screen.getByRole("region", { name: "이미지 문자 분석" });
    expect(within(analysis).getByRole("img").getAttribute("src")).toBe("data:image/png;base64,YQ==");
    expect(within(analysis).getByText("카지노 가입 이벤트")).toBeDefined();
    expect(screen.getByRole("heading", { name: "반복 광고 소재" })).toBeDefined();
  });

  it("preserves positive advertisement wording when visible DOM text prevents an image-only finding", async () => {
    await renderResult({ ...bundle, imageAnalysis: [{ ...bundle.imageAnalysis![0]!, visibleDomEquivalent: true,
      decision: { ...decision, passed: false, score: 0 } }] });
    const analysis = screen.getByRole("region", { name: "이미지 문자 분석" });
    expect(within(analysis).getByText("광고 표현 확인")).toBeDefined();
    expect(within(analysis).queryByText("광고 표현 미확인")).toBeNull();
    expect(within(analysis).getByText(/페이지에 같은 광고 문구가 있어/)).toBeDefined();
  });

  it("distinguishes unavailable graph analysis from an observed absence of related infrastructure", async () => {
    await renderResult({ ...bundle, analysisIssues: ["evidence-graph:deadline"] });
    const graphHost = { ...evidenceHost({ ...bundle, analysisIssues: ["evidence-graph:deadline"] }),
      getSession: async () => undefined, getOfficialResult: async () => result, openCase: async () => undefined } as unknown as HostBridge;
    render(<InfrastructureAnalysis host={graphHost} sessionId="graph-unavailable" />);
    await act(async () => {});
    expect(screen.getByText(/관계 분석 기록을 사용할 수 없습니다/)).toBeDefined();
    expect(screen.queryByText("광고 근거와 연결된 외부 도메인이 없습니다.")).toBeNull();
    expect(screen.getAllByRole("note").some(note => note.textContent?.includes("추가 분석 일부를 완료하지 못했습니다"))).toBe(true);
    expect(screen.getByText("evidence-graph:deadline").closest("details")?.open).toBe(false);
  });

  it("keeps cancelled results saveable and marks the preserved partial coverage", async () => {
    await renderResult({ ...bundle, coverage: { ...bundle.coverage, cancelled: true } }, { status: "cancelled", view: "coverage" });
    expect(screen.getByText("점검이 중지되었습니다. 완료된 페이지의 결과를 표시합니다.")).toBeDefined();
    expect((screen.getByRole("button", { name: "공식 JSON 저장" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText("제한 시간에 도달해 일부 페이지를 확인하지 못했습니다.")).toBeNull();
  });

  it("lists checked zero-finding and failed pages with HTTP status, redirect and reason", async () => {
    await renderResult({ ...bundle, pageOutcomes: [
      { url: "https://example.kr/start", finalUrl: "https://example.kr/clean", status: 200, depth: 1, outcome: "checked" },
      { url: "https://example.kr/missing", finalUrl: "https://example.kr/missing", status: 404, depth: 2, outcome: "failed", reason: "HTTP 404" },
    ] }, { view: "pages" });
    const clean = screen.getByRole("region", { name: "https://example.kr/start 탐지 0건" });
    expect(within(clean).getByText(/확인 완료.*HTTP 200/)).toBeDefined();
    expect(within(clean).getByText("https://example.kr/clean")).toBeDefined();
    const failed = screen.getByRole("region", { name: "https://example.kr/missing 탐지 0건" });
    expect(within(failed).getByText(/확인 실패.*HTTP 404/)).toBeDefined();
    expect(within(failed).getByText("HTTP 404", { exact: true })).toBeDefined();
    fireEvent.change(screen.getByLabelText("결과 검색"), { target: { value: "missing" } });
    expect(screen.queryByRole("region", { name: "https://example.kr/start 탐지 0건" })).toBeNull();
    expect(screen.getByRole("region", { name: "https://example.kr/missing 탐지 0건" })).toBeDefined();
  });

  it("routes a cancelled browser session with a stored result into the results screen", async () => {
    vi.useFakeTimers();
    const host = new BrowserHost();
    const session = await host.startScan({ entryUrl: result.meta.entry_url });
    await host.cancelScan(session.id);
    function Workspace() {
      const [view, setView] = useState("progress");
      return view === "result" ? <h1>보존된 결과</h1> : view === "start" ? <h1>점검 설정</h1>
        : <ScanProgressView host={host} sessionId={session.id} onDone={() => setView("result")} onCancel={() => setView("start")} />;
    }
    render(<Workspace />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("heading", { name: "보존된 결과" })).toBeDefined();
    expect((await host.getSession(session.id))?.hasResult).toBe(true);
    expect(await host.getOfficialResult(session.id)).toBeDefined();
  });

  it("keeps redirected-page findings when searching by the requested page address", async () => {
    const official: OfficialResult = { ...result, findings: [{ id: "f1", url: "https://example.kr/clean",
      is_violation: true, location: "#ad", evidence_text: "숨겨진 광고", technique: "OFFSCREEN" }] };
    await renderResult({ ...bundle, pageOutcomes: [{ url: "https://example.kr/start", finalUrl: "https://example.kr/clean",
      status: 200, depth: 0, outcome: "checked" }] }, { view: "pages", official });
    fireEvent.change(screen.getByLabelText("결과 검색"), { target: { value: "/start" } });
    const group = screen.getByRole("region", { name: "https://example.kr/start 탐지 1건" });
    expect(within(group).getByText(/숨겨진 광고/)).toBeDefined();
    expect(within(group).getByRole("button", { name: "근거 보기" }).dataset.findingId).toBe("f1");
  });
});

it.each(["image-ad-embedding-v1", "image-ad-embedding-v3"] as const)("shows %s pixel review separately from the unchanged numeric OCR",async(policy)=>{
 const detail=structuredClone(bundle),a=detail.imageAnalysis![0]!;
 a.ocr={state:"available",backend:"cpu",text:"7474 30+10",confidence:.9};a.matchedTerms=[];a.decision={rule:"image-only-ad-v5-image-review",score:3,threshold:3,passed:true,detail:"image review"};
 a.visualEmbedding={state:"available",policy,model:"embeddinggemma-2-image-text-f32",revision:"daa72c51243991dfcaf9f9137d2c573d8f7790c0",imageSha256:"a".repeat(64),positiveSimilarity:.8,negativeSimilarity:.7,margin:.1,shuffledPositiveSimilarity:.6,shuffledNegativeSimilarity:.7,shuffledMargin:-.1,threshold:0,control:"pixel-shuffle-v1",seed:1701,passed:true,elapsedMs:9000};
 await renderResult(detail,{simple:true});
 expect(screen.getByText("이미지 기반 검토 필요")).toBeTruthy();expect(screen.getByText("7474 30+10")).toBeTruthy();
 expect(screen.getByText(/OCR 원문은 복구·수정하지 않았으며/)).toBeTruthy();
});

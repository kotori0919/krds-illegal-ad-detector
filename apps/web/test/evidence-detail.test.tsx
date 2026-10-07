// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { FindingDetailView, HostBridge, OfficialFinding } from "@krds-detector/contracts";
import { EvidenceView } from "../src/screens/EvidenceView.js";

afterEach(cleanup);

function renderInspector(finding: OfficialFinding, getFindingDetail: HostBridge["getFindingDetail"]) {
  const host = {
    getCapabilities: async () => ({ localScan: true }),
    getOfficialResult: async () => ({ findings: [finding] }),
    getFindingDetail,
  } as unknown as HostBridge;
  render(<EvidenceView host={host} sessionId="s1" findingId={finding.id}
    reviewed={false} onReviewChange={() => {}} onBack={() => {}} />);
}

const finding: OfficialFinding = { id: "f1", url: "https://example.kr/post", location: "#comment",
  is_violation: true, technique: "JAMO", evidence_text: "ㅋㅏㅈㅣㄴㅗ 첫충전 이벤트" };
const detail: FindingDetailView = { findingId: "f1", url: finding.url, location: finding.location,
  technique: finding.technique, rawText: finding.evidence_text, normalizedText: "카지노첫충전이벤트",
  matchedTerms: ["카지노"], techniqueReason: "jamo composition",
  observed: { box: { x: 8, y: 20, width: 200, height: 24 },
    css: { color: "rgb(0, 0, 0)", backgroundColor: "rgba(0, 0, 0, 0)", opacity: "1", display: "block", fontSize: "16px", position: "static" } },
  visual: { state: "unavailable", reason: "budget" } };

describe("finding evidence presentation", () => {
  it("keeps a pending detail in loading before showing raw and normalized text separately", async () => {
    let resolveDetail!: (value: FindingDetailView) => void;
    renderInspector(finding, () => new Promise((resolve) => { resolveDetail = resolve; }));
    expect(await screen.findByText(finding.evidence_text)).toBeDefined();
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByRole("region", { name: "실제 화면" })).toBeNull();
    await act(async () => { resolveDetail(detail); });
    expect(screen.queryByRole("status")).toBeNull();
    const reason = screen.getByRole("region", { name: "판단 근거" });
    expect(within(reason).getByText(detail.normalizedText)).toBeDefined();
    expect(within(reason).getByText(detail.matchedTerms[0]!)).toBeDefined();
    expect(within(reason).queryByText(finding.evidence_text)).toBeNull();
    expect(within(screen.getByRole("region", { name: "실제 화면" })).queryByRole("img")).toBeNull();
  });

  it("settles a rejected detail without losing the official original text or review action", async () => {
    renderInspector(finding, async () => { throw new Error("private host failure"); });
    expect(await screen.findByText(finding.evidence_text)).toBeDefined();
    await screen.findByRole("region", { name: "실제 화면" });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("private host failure")).toBeNull();
    expect((screen.getByRole("button", { name: "검토 완료로 표시" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("img")).toBeNull();
  });
});

import { useState } from "react";
import type { EvidenceGraphQuery, EvidenceGraphSlice, HostBridge } from "@krds-detector/contracts";

const relations: Record<string, string> = { CONTAINS: "포함", LOADS: "불러옴", EMBEDS: "삽입", DISPLAYS: "표시", LINKS_TO: "연결", REDIRECTS_TO: "이동", SIMILAR_TO: "유사 소재" };

/** A relationship request is made only by an explicit operator action. */
export function EvidenceRelations({ host, sessionId, focus }: { host: HostBridge; sessionId: string; focus: NonNullable<EvidenceGraphQuery["focus"]> }) {
  const [slice, setSlice] = useState<EvidenceGraphSlice>();
  const [state, setState] = useState<"closed" | "loading" | "open" | "error">("closed");
  async function open() {
    if (state === "open") { setState("closed"); return; }
    if (slice) { setState("open"); return; }
    setState("loading");
    try {
      setSlice(await host.getEvidenceGraphSlice(sessionId, { focus, maxNodes: 100, maxEdges: 200, depth: 2 }));
      setState("open");
    } catch { setState("error"); }
  }
  const nodes = new Map(slice?.nodes.map((node) => [node.id, node]));
  return <div className="evidence-relations">
    <button type="button" className="secondary" onClick={() => void open()} disabled={state === "loading"} aria-expanded={state === "open"}>{state === "open" ? "관계 닫기" : "관계 보기"}</button>
    {state === "loading" ? <p role="status">관계를 불러오는 중입니다.</p> : state === "error" ? <p role="alert">관계를 불러오지 못했습니다. 다시 시도해 주세요.</p> : state === "open" ? <section aria-label="근거 관계">
      {!slice ? <p>이 세션의 관계 분석 기록을 사용할 수 없습니다.</p> : !slice.nodes.length ? <p>선택한 항목에 연결된 관계가 없습니다.</p> : <>
        <p>관련 항목 {slice.nodes.length}개 · 연결 {slice.edges.length}개{slice.truncated ? " · 일부 관계만 표시합니다." : ""}</p>
        <ul>{slice.edges.map((edge, index) => <li key={`${edge.from}-${edge.to}-${index}`}>
          {nodes.get(edge.from)?.label ?? edge.from} → {relations[edge.kind] ?? edge.kind} → {nodes.get(edge.to)?.label ?? edge.to}
        </li>)}</ul>
        <details className="advanced"><summary>기술 정보</summary><ul>{slice.nodes.map((node) => <li key={node.id}>{node.kind}: {node.label}</li>)}</ul></details>
      </>}
    </section> : null}
  </div>;
}

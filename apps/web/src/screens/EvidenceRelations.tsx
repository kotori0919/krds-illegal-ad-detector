import { useId, useLayoutEffect, useRef, useState } from "react";
import type { EvidenceEdge, EvidenceGraphQuery, EvidenceGraphSlice, EvidenceNode, HostBridge } from "@krds-detector/contracts";

type Focus = NonNullable<EvidenceGraphQuery["focus"]>;
const nodeKinds: Record<EvidenceNode["kind"], string> = {
  Page: "페이지", Frame: "삽입된 프레임", Element: "탐지 요소", Creative: "이미지 소재",
  Resource: "자료 호스트", Domain: "자료·연결 호스트", Landing: "링크 목적지", Redirect: "관측된 리디렉션",
};
const relations: Record<EvidenceEdge["kind"], string> = {
  CONTAINS: "이 요소가 페이지에서 관측됐습니다", LOADS: "이 자료를 불러온 기록이 있습니다",
  EMBEDS: "이 프레임을 삽입한 기록이 있습니다", DISPLAYS: "이 요소에서 이미지 소재가 관측됐습니다",
  LINKS_TO: "이 주소·호스트로 연결된 기록이 있습니다", REDIRECTS_TO: "리디렉션 응답에서 이 주소가 관측됐습니다",
  SIMILAR_TO: "유사한 이미지 소재가 관측됐습니다",
};
const reasons: Record<string, string> = {
  "official-finding": "페이지 문구에서 탐지 근거가 확인됨",
  "ocr-positive-ad-creative": "이미지 인식 문구와 보조 근거가 분석 조건에 해당함",
  "repeated-ad-creative": "광고 근거가 있는 같은 이미지가 여러 페이지에서 관측됨",
  "ad-candidate-resource-redirect": "이미지 자료 요청의 리디렉션 응답이 관측됨",
};
function shortAddress(value: string): string {
  try {
    const url = new URL(value);
    const address = url.host + (url.pathname === "/" ? "" : url.pathname);
    return address.length > 72 ? `${address.slice(0, 69)}…` : address;
  } catch { return "주소 정보 없음"; }
}
function nodeName(node: EvidenceNode | undefined, index: number): string {
  if (!node) return "관계 항목";
  const kind = nodeKinds[node.kind];
  if (node.kind === "Creative" || node.kind === "Element") return `${kind} ${String(index + 1)}`;
  if (node.kind === "Resource") {
    try { return `${kind} · ${new URL(node.url ?? node.label).host}`; }
    catch { return `${kind} · 주소 정보 없음`; }
  }
  return `${kind} · ${shortAddress(node.url ?? (node.kind === "Domain" ? `https://${node.label}/` : node.label))}`;
}

/** A new selection starts closed; evidence is read only on operator request. */
export function EvidenceRelations(props: { host: HostBridge; sessionId: string; focus: Focus }) {
  return <RelationPanel key={JSON.stringify([props.sessionId, props.focus.kind, props.focus.id])} {...props} />;
}

function RelationPanel({ host, sessionId, focus }: { host: HostBridge; sessionId: string; focus: Focus }) {
  const [read, setRead] = useState<{ host: HostBridge; state: "closed" | "loading" | "open" | "error"; slice?: EvidenceGraphSlice; loaded?: true }>();
  const sequence = useRef(0);
  const button = useRef<HTMLButtonElement>(null);
  const regionId = useId();
  useLayoutEffect(() => {
    sequence.current += 1;
    setRead(undefined);
    return () => { sequence.current += 1; };
  }, [host]);
  const current = read?.host === host ? read : undefined;
  const state = current?.state ?? "closed";
  const slice = current?.slice;
  async function open() {
    if (state === "open") { setRead({ host, state: "closed", slice, loaded: current?.loaded }); button.current?.focus(); return; }
    if (current?.loaded) { setRead({ host, state: "open", slice, loaded: true }); return; }
    const request = ++sequence.current;
    setRead({ host, state: "loading" });
    try {
      const result = await host.getEvidenceGraphSlice(sessionId, { focus, maxNodes: 100, maxEdges: 200, depth: 2 });
      if (request === sequence.current) setRead({ host, state: "open", slice: result, loaded: true });
    } catch {
      if (request === sequence.current) setRead({ host, state: "error" });
    }
  }
  const nodes = new Map(slice?.nodes.map((node, index) => [node.id, { node, index }]));
  function name(id: string): string { const entry = nodes.get(id); return nodeName(entry?.node, entry?.index ?? 0); }
  return <div className="evidence-relations">
    <button ref={button} type="button" className="secondary" onClick={() => void open()} disabled={state === "loading"} aria-expanded={state === "open"} aria-controls={regionId}>{state === "open" ? "관계 닫기" : state === "error" ? "관계 다시 시도" : "관계 보기"}</button>
    {state === "loading" ? <p role="status">관계를 불러오는 중입니다.</p> : state === "error" ? <p role="alert">저장된 관계를 불러오지 못했습니다. 관계 다시 시도로 이 조회만 재시도할 수 있습니다.</p> : state === "open" ? <section id={regionId} aria-label="근거 관계">
      {!slice ? <p>이 결과에 저장된 관계 분석 기록이 없습니다.</p> : !slice.nodes.length ? <p>선택한 항목에 연결된 관계가 없습니다.</p> : <>
        <p>관련 항목 {slice.nodes.length}개 · 연결 {slice.edges.length}개{slice.truncated ? " · 조회 범위에 따라 일부 관계만 표시합니다." : ""}</p>
        <p>연결 기록은 공동 소유나 위반 확정을 뜻하지 않습니다. 링크 목적지는 추출한 주소이며 최종 도착 페이지를 확인한 결과가 아닙니다.</p>
        <ul>{slice.edges.map((edge, index) => <li key={`${edge.from}-${edge.to}-${index}`}>
          <span>{name(edge.from)} → {name(edge.to)}</span>
          <p>{relations[edge.kind]}{edge.evidenceKinds?.some((reason) => reasons[reason]) ? ` · ${edge.evidenceKinds.flatMap((reason) => reasons[reason] ? [reasons[reason]] : []).join(" · ")}` : ""}</p>
        </li>)}</ul>
        {!slice.edges.length ? <p>이 조회 범위에서 연결 기록이 없습니다.</p> : null}
        <details className="advanced"><summary>관계 기술 정보</summary>
          <p>최대 항목 100개 · 연결 200개 · 연결 깊이 2</p>
          <ul>{slice.nodes.map((node, index) => <li key={node.id}>{nodeName(node, index)}: {node.kind} · {node.id} · {node.label}{node.url && node.url !== node.label ? ` · ${node.url}` : ""}{node.findingId ? ` · ${node.findingId}` : ""}</li>)}</ul>
          <ul>{slice.edges.map((edge, index) => <li key={index}>{edge.from} → {edge.to} · {edge.kind} · {edge.evidenceKinds?.join(", ") ?? "관측 연결"}</li>)}</ul>
        </details>
      </>}
    </section> : null}
  </div>;
}

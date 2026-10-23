import { useCallback, useEffect, useId, useRef, useState } from "react";
import { isTransportProvenance, type HostBridge, type InfrastructureRelation } from "@krds-detector/contracts";
import { EvidenceRelations } from "./EvidenceRelations.js";
import { useEvidenceRead } from "./evidence-read.js";

const evidenceLabels: Record<string, string> = {
  "official-finding": "페이지 문구의 탐지 근거",
  "ocr-positive-ad-creative": "이미지 문구와 보조 근거",
  "repeated-ad-creative": "광고 근거가 있는 이미지의 반복 관측",
  "ad-candidate-resource-redirect": "광고 이미지 자료의 관측된 리디렉션",
};
function reasonLabel(kind: string): string { return evidenceLabels[kind] ?? "기타 저장된 연결 근거"; }
function pageUrls(relation: InfrastructureRelation): string[] { return [...new Set(relation.pageUrls)]; }
function recordedDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false }) + " KST" : "일시 기록을 확인할 수 없습니다.";
}

export function InfrastructureAnalysis(props: { host: HostBridge; sessionId: string; onSelectFinding?: (id: string) => void }) {
  return <SingleCaseInfrastructure key={props.sessionId} {...props} />;
}

function SingleCaseInfrastructure({ host, sessionId, onSelectFinding }: { host: HostBridge; sessionId: string; onSelectFinding?: (id: string) => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  const detailId = useId();
  const searchId = useId();
  const kindId = useId();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [repeatedOnly, setRepeatedOnly] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string>();
  const readSummary = useCallback(() => host.getEvidenceSummary(sessionId), [host, sessionId]);
  const readSession = useCallback(() => host.getSession(sessionId), [host, sessionId]);
  const readOfficial = useCallback(() => host.getOfficialResult(sessionId), [host, sessionId]);
  const readCase = useCallback(() => host.openCase(sessionId), [host, sessionId]);
  const summary = useEvidenceRead(sessionId, readSummary, true, heading);
  const session = useEvidenceRead(sessionId, readSession);
  const official = useEvidenceRead(sessionId, readOfficial);
  const savedCase = useEvidenceRead(sessionId, readCase);
  const manifest = savedCase.value?.manifest;
  const entryUrl = official.value?.meta.entry_url ?? manifest?.entryUrl ?? session.value?.entryUrl;
  const startedAt = official.value?.meta.started_at ?? manifest?.startedAt ?? session.value?.startedAt;
  const transport = manifest?.settings.transport;
  const transportLabel = isTransportProvenance(transport)
    ? transport.kind === "direct" ? "기본 연결 (앱 전용 WARP 미사용)" : "WARP 연결 (저장된 점검 기록)"
    : "연결 기록 없음 · 당시 연결 방식을 확인할 수 없습니다.";
  const infrastructure = summary.value?.infrastructure ?? [];
  const kinds = [...new Set(infrastructure.flatMap(relation => relation.evidenceKinds))].sort();
  const rows = infrastructure.filter(relation => relation.domain.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    && (!kind || relation.evidenceKinds.includes(kind)) && (!repeatedOnly || pageUrls(relation).length >= 2))
    .sort((a, b) => pageUrls(b).length - pageUrls(a).length || a.domain.localeCompare(b.domain));
  const selected = rows.find(relation => relation.domain === selectedDomain);
  useEffect(() => { if (selectedDomain) detailHeading.current?.focus(); }, [selectedDomain]);
  function closeDetails() {
    setSelectedDomain(undefined);
    selectedButton.current?.focus();
  }
  return <section className="coverage-summary infrastructure-analysis" aria-label="광고 연관 인프라">
    <h2 ref={heading} tabIndex={-1}>광고 연관 인프라</h2>
    <p>선택한 사례 한 개의 저장 근거를 분석합니다. 외부 사이트에 새로 접속하지 않습니다.</p>
    <dl className="infrastructure-context">
      <dt>점검 대상</dt><dd>{entryUrl ?? (official.state === "loading" || session.state === "loading" || savedCase.state === "loading" ? "불러오는 중" : "대상 주소 기록 없음")}</dd>
      <dt>점검 시작</dt><dd>{startedAt ? <time dateTime={startedAt}>{recordedDate(startedAt)}</time> : "일시 기록 없음"}</dd>
      <dt>당시 연결</dt><dd>{savedCase.state === "loading" ? "연결 기록을 불러오는 중입니다." : transportLabel}</dd>
    </dl>
    {savedCase.state === "error" ? <p>사례 설정 기록을 불러오지 못했습니다. 인프라 목록과 원래 근거는 계속 확인할 수 있습니다. <button type="button" className="secondary" onClick={savedCase.retry}>연결 기록 다시 불러오기</button></p> : null}
    {!entryUrl && official.state !== "loading" && session.state !== "loading" && savedCase.state !== "loading" ? <p>점검 대상 기록을 확인하지 못했습니다. <button type="button" className="secondary" onClick={() => { official.retry(); session.retry(); }}>대상 기록 다시 불러오기</button></p> : null}
    <p>관련 페이지 수는 이 사례에서 관측한 서로 다른 페이지 주소 수입니다. 도메인 연결은 공동 소유나 위반 확정을 뜻하지 않습니다.</p>
    {summary.state === "loading" ? <p role="status">저장된 인프라를 불러오는 중입니다.</p>
      : summary.state === "error" ? <div><p role="alert">저장된 인프라 분석을 불러오지 못했습니다. 원래 점검 결과는 유지됩니다.</p><button type="button" className="secondary" onClick={summary.retry}>인프라 다시 불러오기</button></div>
        : summary.state === "unavailable" ? <div><p role="status">이 결과에 저장된 인프라 분석 기록이 없습니다.</p><button type="button" className="secondary" onClick={summary.retry}>인프라 다시 불러오기</button></div>
          : <>
            {summary.value?.graphAvailable === false ? <p role="status">{infrastructure.length ? "이 사례의 관계 분석 기록을 사용할 수 없습니다. 보관된 도메인 목록은 확인할 수 있습니다." : "이 사례의 관계 분석 기록을 사용할 수 없습니다."}</p> : null}
            {summary.value?.analysisIssues?.length ? <p role="note">추가 분석 일부를 완료하지 못했습니다. 저장된 근거 범위 안에서 표시합니다.</p> : null}
            {infrastructure.length ? <>
              <div className="review-filters infrastructure-filters">
                <div><label htmlFor={searchId}>도메인 검색</label><input id={searchId} type="search" value={query} onChange={event => { setQuery(event.target.value); setSelectedDomain(undefined); }} /></div>
                <div><label htmlFor={kindId}>근거 종류</label><select id={kindId} value={kind} onChange={event => { setKind(event.target.value); setSelectedDomain(undefined); }}>
                  <option value="">전체 근거</option>{kinds.map(value => <option key={value} value={value}>{reasonLabel(value)}</option>)}
                </select></div>
                <label><input type="checkbox" checked={repeatedOnly} onChange={event => { setRepeatedOnly(event.target.checked); setSelectedDomain(undefined); }} />반복 관측만</label>
              </div>
              <p role="status">도메인 {rows.length}개 표시 / 저장된 {infrastructure.length}개</p>
              {rows.length ? <ul className="infrastructure-list" aria-label="광고 연관 도메인">{rows.map(relation => <li key={relation.domain} className={selectedDomain === relation.domain ? "infrastructure-row is-selected" : "infrastructure-row"}>
                <strong>{relation.domain}</strong><p>관련 페이지 {pageUrls(relation).length}개</p>
                <p>{relation.evidenceKinds.length ? [...new Set(relation.evidenceKinds.map(reasonLabel))].join(" · ") : "근거 종류 기록 없음"}</p>
                <button type="button" className="secondary" aria-expanded={selectedDomain === relation.domain} aria-controls={selectedDomain === relation.domain ? detailId : undefined}
                  onClick={event => { selectedButton.current = event.currentTarget; setSelectedDomain(relation.domain); }}>{relation.domain} 근거 확인</button>
              </li>)}</ul> : <p role="status">검색·필터 조건에 맞는 도메인이 없습니다.</p>}
              {selected ? <section id={detailId} className="infrastructure-detail" aria-label={`${selected.domain} 근거`}>
                <h3 ref={detailHeading} tabIndex={-1}>{selected.domain}의 저장 근거</h3>
                <button type="button" className="secondary" onClick={closeDetails}>도메인 목록으로</button>
                <p>역할은 관계 근거에서 확인합니다. 저장 근거가 없으면 역할을 알 수 없습니다.</p>
                <h4>관련 페이지 {pageUrls(selected).length}개</h4>
                <ul aria-label="근거가 관측된 페이지">{pageUrls(selected).map(url => <li key={url}>{url}</li>)}</ul>
                <EvidenceRelations host={host} sessionId={sessionId} focus={{ kind: "domain", id: selected.domain }} onSelectFinding={onSelectFinding} />
              </section> : null}
            </> : summary.value?.graphAvailable !== false ? <p role="status">광고 근거와 연결된 외부 도메인이 없습니다.</p> : null}
            {summary.value?.analysisIssues?.length ? <details className="advanced"><summary>분석 제한 기록</summary><ul>{summary.value.analysisIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></details> : null}
          </>}
  </section>;
}

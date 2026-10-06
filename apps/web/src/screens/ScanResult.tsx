import { useEffect, useMemo, useState } from "react";
import {
  OFFICIAL_TECHNIQUES,
  type ExtraResult,
  type ExtraFinding,
  type CreativeImage,
  type ImageAnalysis,
  type HostBridge,
  type OfficialResult,
  type OfficialTechnique,
  type PageOutcome,
  type ScanDetailBundle,
  type ScanSession,
} from "@krds-detector/contracts";
import { techniqueLabel } from "../technique-label.js";
import { formatElapsed, scanStatusLabel } from "../scan-format.js";

interface Props {
  host: HostBridge;
  sessionId: string;
  onEvidence: (findingId: string) => void;
  onExport: () => void;
  onRestart: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  filter: TechniqueFilter;
  onFilterChange: (value: TechniqueFilter) => void;
  view: "findings" | "pages" | "extra" | "coverage";
  onViewChange: (value: "findings" | "pages" | "extra" | "coverage") => void;
  reviewedIds: ReadonlySet<string>;
  onReviewMany: (ids: string[], reviewed: boolean) => void;
  restoreFindingId?: string;
  selectedFindingId?: string;
  onSelectionHidden: () => void;
  onFocusRestored?: () => void;
}

type TechniqueFilter = OfficialTechnique | "ALL";

const extraLabels: Record<string, string> = {
  REUSED_AD_CREATIVE: "반복 광고 소재",
  AD_INFRASTRUCTURE_CORRELATION: "연관 광고 인프라",
  ZERO_WIDTH_OBFUSCATION: "제로폭 글자 위장",
};

function extraSummary(finding: ExtraFinding): string {
  if (finding.extra_finding === "REUSED_AD_CREATIVE") {
    const count = finding.evidence_text.match(/seen (\d+) times/)?.[1];
    return count ? `비슷한 광고 이미지가 ${count}회 관측되었습니다.` : "비슷한 광고 이미지가 반복 관측되었습니다.";
  }
  if (finding.extra_finding === "AD_INFRASTRUCTURE_CORRELATION") {
    const match = finding.evidence_text.match(/infrastructure: (.+) \(observed on (\d+) pages\)/);
    return match ? `${match[1]} 도메인이 ${match[2]}개 페이지에서 반복 관측되었습니다.` : "여러 페이지에서 관련 외부 도메인이 관측되었습니다.";
  }
  return "광고 문구에 보이지 않는 글자가 포함되었습니다.";
}

function ImageAnalysisView({ analysis, image }: { analysis: ImageAnalysis; image?: CreativeImage }) {
  return <li className="finding-card">
    <h3>이미지 문자 분석</h3>
    {image ? <figure className="visual-evidence">
      <img src={image.dataUrl} alt="문자를 분석한 수집 이미지" width={image.width} height={image.height} />
      <figcaption>수집한 이미지 · {image.width} × {image.height}</figcaption>
    </figure> : null}
    <dl className="evidence">
      <div><dt>이미지 주소</dt><dd>{analysis.sourceUrl}</dd></div>
      <div><dt>관측한 페이지</dt><dd><ul>{analysis.pageUrls.map((url) => <li key={url}>{url}</li>)}</ul></dd></div>
      {analysis.ocr.state === "available" ? <>
        <div><dt>인식한 원문</dt><dd className="raw">{analysis.ocr.text || "인식된 문자가 없습니다."}</dd></div>
        {analysis.ocr.confidence !== undefined ? <div><dt>문자 인식 신뢰도</dt><dd>{String(Math.round(analysis.ocr.confidence * 100))}%</dd></div> : null}
      </> : <div><dt>문자 인식 상태</dt><dd>{analysis.ocr.reason === "budget"
        ? "시간·용량 제한으로 문자를 인식하지 못했습니다." : "문자 인식에 실패했습니다."}</dd></div>}
      {analysis.matchedTerms.length ? <div><dt>광고 표현</dt><dd>{analysis.matchedTerms.join(", ")}</dd></div> : null}
      <div><dt>규칙 판단</dt><dd>{analysis.ocr.state === "unavailable" ? "판단할 수 없음"
        : analysis.decision.passed ? "광고 표현 확인" : "광고 표현 미확인"}</dd></div>
      <div><dt>판단 규칙</dt><dd>{analysis.decision.rule}</dd></div>
      <div><dt>판단 점수 / 기준</dt><dd>{String(analysis.decision.score)} / {String(analysis.decision.threshold)}</dd></div>
    </dl>
    <details className="advanced"><summary>기술 정보</summary>
      <p>문자 인식 엔진: {analysis.ocr.backend}</p><p>{analysis.decision.detail}</p>
    </details>
  </li>;
}

export function ScanResult({ host, sessionId, onEvidence, onExport, onRestart, query, onQueryChange, filter, onFilterChange, view, onViewChange, reviewedIds, onReviewMany, restoreFindingId, selectedFindingId, onSelectionHidden, onFocusRestored }: Props) {
  const [selectionNotice, setSelectionNotice] = useState(false);
  const [session, setSession] = useState<ScanSession | undefined>(undefined);
  const [result, setResult] = useState<OfficialResult | undefined>(undefined);
  const [detailBundle, setDetailBundle] = useState<ScanDetailBundle | undefined>(undefined);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState(false);
  const [extraResult, setExtraResult] = useState<ExtraResult | undefined>(undefined);
  const [extraLoaded, setExtraLoaded] = useState(false);
  const [extraLoadError, setExtraLoadError] = useState(false);
  const [loadComplete, setLoadComplete] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    let alive = true;
    void host.getCapabilities().then((caps) => { if (alive) setDemoMode(!caps.localScan); }).catch(() => undefined);
    // Read the terminal session before deciding whether a stored result exists.
    host.getSession(sessionId).then((s) => {
      if (alive) setSession(s);
    }).catch(() => undefined);
    // first fetch can precede the store. Retry briefly so a stored result
    // is never rendered as an empty list.
    let attempts = 0;
    const timer = globalThis.setInterval(() => {
      attempts += 1;
      void host.getSession(sessionId).then((s) => {
        if (alive) setSession(s);
      }).catch(() => undefined);
      void host.getOfficialResult(sessionId).then((r) => {
        if (!alive) return;
        if (r) {
          setResult(r);
          void host.getDetailBundle(sessionId).then((bundle) => { if (alive) setDetailBundle(bundle); })
            .catch(() => { if (alive) setDetailLoadError(true); })
            .finally(() => { if (alive) setDetailLoaded(true); });
          void host.getExtraResult(sessionId).then((extra) => {
            if (alive) { setExtraResult(extra); setExtraLoaded(true); }
          }).catch(() => { if (alive) { setExtraLoadError(true); setExtraLoaded(true); } });
          setLoadComplete(true);
          globalThis.clearInterval(timer);
        } else if (attempts >= 10) {
          setLoadComplete(true);
          globalThis.clearInterval(timer);
        }
      }).catch(() => {
        if (alive) setLoadComplete(true);
        globalThis.clearInterval(timer);
      });
    }, 500);
    return () => {
      alive = false;
      globalThis.clearInterval(timer);
    };
  }, [host, sessionId]);

  // Hooks stay above the conditional return: the cancelled branch must not
  // change the hook count between renders (React "fewer hooks" crash).
  const findings = result?.findings ?? [];
  const counts = useMemo(() => {
    const map = new Map<OfficialTechnique, number>();
    for (const t of OFFICIAL_TECHNIQUES) map.set(t, 0);
    for (const f of findings) map.set(f.technique, (map.get(f.technique) ?? 0) + 1);
    return map;
  }, [findings]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const pageSourceUrls = useMemo(() => {
    const sources = new Map<string, string>();
    for (const page of detailBundle?.pageOutcomes ?? []) {
      sources.set(page.finalUrl, `${sources.get(page.finalUrl) ?? ""} ${page.url}`);
    }
    return sources;
  }, [detailBundle]);
  const visible = findings.filter((f) =>
    (filter === "ALL" || f.technique === filter)
    && (!normalizedQuery || `${f.url} ${f.evidence_text} ${view === "pages" ? pageSourceUrls.get(f.url) ?? "" : ""}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery)),
  );
  const pageGroups = useMemo(() => {
    const groups = new Map<string, { findings: typeof visible; outcome?: PageOutcome }>();
    const finalUrls = new Map<string, string>();
    for (const outcome of detailBundle?.pageOutcomes ?? []) {
      groups.set(outcome.url, { findings: [], outcome });
      if (!finalUrls.has(outcome.finalUrl)) finalUrls.set(outcome.finalUrl, outcome.url);
    }
    for (const finding of visible) {
      const url = groups.has(finding.url) ? finding.url : finalUrls.get(finding.url) ?? finding.url;
      const group = groups.get(url);
      if (group) group.findings.push(finding);
      else groups.set(url, { findings: [finding] });
    }
    return [...groups.entries()].filter(([url, group]) => group.findings.length > 0 || (filter === "ALL"
      && (!normalizedQuery || `${url} ${group.outcome?.finalUrl ?? ""}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery))));
  }, [visible, detailBundle, filter, normalizedQuery]);
  const resetFilters = () => { setSelectionNotice(false); onFilterChange("ALL"); onQueryChange(""); };
  const selectedVisible = visible.some((finding) => finding.id === selectedFindingId);
  useEffect(() => {
    if (!result || !selectedFindingId) return;
    if ((view !== "findings" && view !== "pages") || !selectedVisible) {
      setSelectionNotice(view === "findings" || view === "pages");
      onSelectionHidden();
    } else setSelectionNotice(false);
  }, [result, selectedFindingId, selectedVisible, view, onSelectionHidden]);

  useEffect(() => {
    if (!result || !restoreFindingId) return;
    const target = [...document.querySelectorAll<HTMLButtonElement>("button[data-finding-id]")]
      .find((button) => button.dataset.findingId === restoreFindingId);
    const fallback = document.getElementById("result-search")
      ?? document.querySelector<HTMLElement>('.result-navigation button[aria-pressed="true"]');
    if (target || fallback) {
      (target ?? fallback)?.focus();
      onFocusRestored?.();
    }
  }, [result, restoreFindingId, onFocusRestored, view, filter, query]);

  if (session?.status === "cancelled" && session.hasResult !== true) {
    return (
      <main className="page">
        <p className="eyebrow">결과 검토</p>
        <h1>점검 결과</h1>
        <p role="status" className="empty">
          탐지가 취소되었습니다. 새 검사를 시작해 주세요.
        </p>
        <div className="actions">
          <button type="button" onClick={onRestart} className="primary">
            새로 검사하기
          </button>
        </div>
      </main>
    );
  }


  return (
    <main className="page">
      <p className="eyebrow">결과 검토</p>
      <h1>점검 결과</h1>
      <p className="lede">{session ? scanStatusLabel(session.status) : "결과를 불러오는 중"}{session?.status === "succeeded" && detailBundle?.coverage.failedPages.length ? " — 일부 페이지 확인 실패" : session?.status === "succeeded" && detailBundle?.coverage.timedOut ? " — 제한 시간 도달" : ""}{result ? ` · 공식 탐지 ${String(result.findings.length)}건 · 경과 시간 ${formatElapsed(result.meta.elapsed_sec)}` : null}</p>
      {session?.status === "cancelled" || detailBundle?.coverage.cancelled ? <p role="note" className="empty">점검이 중지되었습니다. 완료된 페이지의 결과를 표시합니다.</p>
        : session?.status === "failed" && session.hasResult === true ? <p role="note" className="empty">점검이 실패했습니다. 완료된 페이지의 결과를 표시합니다.</p> : null}
      {demoMode ? <p role="note" className="empty">브라우저 미리보기 데이터입니다. 입력한 사이트를 실제로 점검한 결과가 아닙니다.</p> : null}
      {result ? <p className="hint">탐지된 페이지 {String(new Set(findings.map((finding) => finding.url)).size)}개{detailBundle ? ` · 확인한 페이지 ${String(detailBundle.coverage.checkedPages)}개 · 실패한 페이지 ${String(detailBundle.coverage.failedPages.length)}개` : ""}</p> : null}
      {result && (view === "findings" || view === "pages") ? (
        <section aria-label="기법별 건수">
          <ul className="counts">
            {OFFICIAL_TECHNIQUES.map((t) => (
              <li key={t}>
                <span>{techniqueLabel[t]}</span> <strong>{counts.get(t) ?? 0}건</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-label="결과 목록">
        <div className="result-navigation" role="group" aria-label="결과 영역">
          <button type="button" aria-pressed={view === "findings" || view === "pages"} onClick={() => onViewChange("findings")}>공식 탐지</button>
          <button type="button" aria-pressed={view === "extra"} onClick={() => onViewChange("extra")}>추가 분석</button>
          <button type="button" aria-pressed={view === "coverage"} onClick={() => onViewChange("coverage")}>점검 범위</button>
        </div>
        {(view === "findings" || view === "pages") ? <div className="result-navigation result-subnavigation" role="group" aria-label="공식 탐지 보기 방식">
          <button type="button" aria-pressed={view === "findings"} onClick={() => onViewChange("findings")}>탐지 항목별</button>
          <button type="button" aria-pressed={view === "pages"} onClick={() => onViewChange("pages")}>페이지별</button>
        </div> : null}
        {(view === "findings" || view === "pages") ? <div className="toolbar">
          <div className="result-search">
            <label htmlFor="result-search">결과 검색</label>
            <input id="result-search" type="search" value={query} onChange={(e) => { setSelectionNotice(false); onQueryChange(e.target.value); }} placeholder="원문 또는 페이지 주소" />
          </div>
          <label htmlFor="technique-filter">기법 필터</label>
          <select
            id="technique-filter"
            value={filter}
            onChange={(e) => { setSelectionNotice(false); onFilterChange(e.target.value as TechniqueFilter); }}
          >
            <option value="ALL">전체</option>
            {OFFICIAL_TECHNIQUES.map((t) => (
              <option key={t} value={t}>
                {techniqueLabel[t]}
              </option>
            ))}
          </select>
        </div> : null}
        {result && (view === "findings" || view === "pages") ? <p role="status" aria-live="polite" className="result-count">표시 중인 탐지 {String(visible.length)}건 / 전체 {String(findings.length)}건{selectionNotice ? " · 조건에 맞지 않아 근거를 닫았습니다." : ""}</p> : null}
        {!result && !loadComplete ? (
          <p role="status" className="empty">결과를 불러오는 중입니다.</p>
        ) : !result ? (
          <p role="alert" className="empty">결과 파일을 불러오지 못했습니다. 새 검사를 시작해 주세요.</p>
        ) : view === "extra" ? (
          <div className="coverage-summary">
            <h2>추가 분석</h2>
            {extraLoadError ? <p role="alert" className="empty">추가 분석 결과를 불러오지 못했습니다.</p>
              : !extraLoaded ? <p role="status" className="empty">추가 분석 결과를 불러오는 중입니다.</p>
                : !extraResult ? <p role="status" className="empty">{detailBundle?.imageAnalysis?.length ? "반복 소재 등의 추가 탐지 항목은 없습니다." : "이 세션에는 추가 분석 결과가 없습니다."}</p>
                : extraResult.findings.length === 0 ? <p role="status" className="empty">{detailBundle?.imageAnalysis?.length ? "반복 소재 등의 추가 탐지 항목은 없습니다." : "추가 분석에서 확인된 항목이 없습니다."}</p>
                  : <>
                    <p role="status" aria-live="polite">추가 분석 {String(extraResult.findings.length)}건</p>
                    <ol className="finding-list" aria-label="추가 분석 목록">
                      {extraResult.findings.map((finding) => {
                        const image = detailBundle?.creativeImages.find((item) => item.findingId === finding.id);
                        return <li key={finding.id} className="finding-card">
                        <h3>{extraLabels[finding.extra_finding] ?? finding.extra_finding}</h3>
                        <p>{extraSummary(finding)}</p>
                        {finding.extra_finding === "REUSED_AD_CREATIVE" ? image ?
                          <figure className="visual-evidence">
                            <img src={image.dataUrl} alt="수집한 반복 광고 이미지" width={image.width} height={image.height} />
                            <figcaption>수집한 이미지 · {image.width} × {image.height}</figcaption>
                          </figure>
                          : <p role={detailLoadError ? "alert" : "status"}>{!detailLoaded ? "이미지를 불러오는 중입니다." : detailLoadError ? "이미지를 불러오지 못했습니다." : "수집한 이미지가 없습니다."}</p> : null}
                        <dl>
                          <div><dt>관련 주소</dt><dd>{finding.url}</dd></div>
                        </dl>
                        <details className="advanced"><summary>기술 정보</summary><p>위치: <code>{finding.location}</code></p><p>{finding.evidence_text}</p></details>
                      </li>; })}
                    </ol>
                  </>}
            {!detailLoaded ? <p role="status" className="empty">이미지 문자 분석을 불러오는 중입니다.</p>
              : detailLoadError ? <p role="alert" className="error">이미지 문자 분석을 불러오지 못했습니다.</p>
                : detailBundle?.imageAnalysis?.length ? <section aria-label="이미지 문자 분석">
                  <h2>이미지 문자 분석 ({String(detailBundle.imageAnalysis.length)}건)</h2>
                  <ol className="finding-list">{detailBundle.imageAnalysis.map((analysis) =>
                    <ImageAnalysisView key={analysis.sourceUrl} analysis={analysis}
                      image={detailBundle.creativeImages.find((image) => image.sourceUrl === analysis.sourceUrl)} />)}</ol>
                </section> : detailBundle?.imageAnalysis ? <p className="hint">문자 분석 대상 이미지가 없습니다.</p> : null}
          </div>
        ) : view === "coverage" ? (
          <div className="coverage-summary">
            {!detailLoaded ? <p role="status">점검 범위를 불러오는 중입니다.</p>
              : detailLoadError ? <p role="alert" className="error">점검 범위를 불러오지 못했습니다.</p>
                : detailBundle ? <>
              <p>확인한 페이지 {String(detailBundle.coverage.checkedPages)}개 · 실패한 페이지 {String(detailBundle.coverage.failedPages.length)}개</p>
              {detailBundle.coverage.timedOut ? <p role="status">제한 시간에 도달해 일부 페이지를 확인하지 못했습니다.</p> : null}
              {detailBundle.coverage.failedPages.length > 0 ? <ul>{detailBundle.coverage.failedPages.map((page) => <li key={page.url}>{page.url} — {page.status === 0 ? "연결 또는 분석 실패" : `접근 실패 (HTTP ${String(page.status)})`}</li>)}</ul>
                : <p>확인에 실패한 페이지가 없습니다.</p>}
            </> : <p role="status" className="empty">점검 범위 기록 없음</p>}
          </div>
        ) : view === "pages" && !detailLoaded ? (
          <p role="status" className="empty">페이지별 점검 기록을 불러오는 중입니다.</p>
        ) : view === "pages" && pageGroups.length > 0 ? (
          <div className="page-groups">
            {pageGroups.map(([url, { findings: group, outcome }]) => (
              <section key={url} className="page-group" aria-label={`${url} 탐지 ${String(group.length)}건`}>
                <h2>{url}</h2>
                {outcome ? <>
                  <p>{outcome.outcome === "checked" ? "확인 완료" : "확인 실패"} · {outcome.status === 0 ? "응답 없음" : `HTTP ${String(outcome.status)}`} · 하위 {String(outcome.depth)}단계</p>
                  {outcome.finalUrl !== url ? <dl><div><dt>최종 주소</dt><dd>{outcome.finalUrl}</dd></div></dl> : null}
                  {outcome.reason ? <details className="advanced"><summary>실패 상세</summary><p className="raw">{outcome.reason}</p></details> : null}
                </> : null}
                <p>탐지 {String(group.length)}건 · 검토 완료 {String(group.filter((finding) => reviewedIds.has(finding.id)).length)}건</p>
                {group.length > 0 ? <>
                  <p className="hint">{OFFICIAL_TECHNIQUES.map((technique) => {
                    const count = group.filter((finding) => finding.technique === technique).length;
                    return count > 0 ? `${techniqueLabel[technique]} ${String(count)}건` : undefined;
                  }).filter(Boolean).join(" · ")}</p>
                  <button type="button" className="secondary" onClick={() => onReviewMany(group.map((finding) => finding.id), !group.every((finding) => reviewedIds.has(finding.id)))}>
                    {group.every((finding) => reviewedIds.has(finding.id)) ? "페이지 검토 취소" : "페이지 항목 모두 검토 완료"}
                  </button>
                  <ul>{group.map((f) => <li key={f.id}>{techniqueLabel[f.technique]} · {f.evidence_text} · {f.id === selectedFindingId ? "확인 중 · " : ""}{reviewedIds.has(f.id) ? "검토 완료" : "검토 전"} <button type="button" className="linklike" data-finding-id={f.id} aria-current={f.id === selectedFindingId ? "true" : undefined} onClick={() => onEvidence(f.id)}>근거 보기</button></li>)}</ul>
                </> : <p>{outcome?.outcome === "failed" ? "페이지 확인에 실패해 탐지 여부를 판단할 수 없습니다." : "확정된 탐지가 없습니다."}</p>}
              </section>
            ))}
          </div>
        ) : findings.length === 0 && !(view === "pages" && (query || filter !== "ALL")) ? (
          <p role="status" className="empty">
            확정된 탐지가 없습니다. 검사 범위를 넓히거나 시작 주소를 확인해 주세요.
          </p>
        ) : visible.length === 0 ? (
          <div role="status" className="empty">
            <p>검색어나 선택한 기법에 해당하는 탐지가 없습니다.</p>
            <button type="button" className="secondary" onClick={resetFilters}>검색·필터 초기화</button>
          </div>
        ) : (
          <div>
            <h2>확정된 탐지 목록 ({String(visible.length)}건)</h2>
            <ol className="finding-list" aria-label="확정된 탐지 목록">
              {visible.map((f) => (
                <li key={f.id} className="finding-card">
                  <div className="finding-card-head">
                    <span className="badge">{techniqueLabel[f.technique]}</span>
                    <span>{f.id === selectedFindingId ? "확인 중 · " : ""}{reviewedIds.has(f.id) ? "검토 완료" : "검토 전"}</span>
                  </div>
                  <dl>
                    <div><dt>페이지</dt><dd>{f.url}</dd></div>
                    <div><dt>확인된 문구</dt><dd>{f.evidence_text}</dd></div>
                  </dl>
                  <button type="button" onClick={() => onEvidence(f.id)} className="secondary" data-finding-id={f.id}
                    aria-current={f.id === selectedFindingId ? "true" : undefined}>
                    근거 보기
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
      <div className="actions">
        <button id="export-trigger" type="button" onClick={onExport} className="primary" disabled={!result}>
          결과 저장
        </button>{" "}
        <button type="button" onClick={onRestart} className="secondary">
          새로 검사하기
        </button>
      </div>
    </main>
  );
}

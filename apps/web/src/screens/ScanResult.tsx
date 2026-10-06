import { useEffect, useMemo, useState } from "react";
import {
  OFFICIAL_TECHNIQUES,
  type ExtraResult,
  type ExtraFinding,
  type HostBridge,
  type OfficialResult,
  type OfficialTechnique,
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

export function ScanResult({ host, sessionId, onEvidence, onExport, onRestart, query, onQueryChange, filter, onFilterChange, view, onViewChange, reviewedIds, onReviewMany, restoreFindingId, onFocusRestored }: Props) {
  const [session, setSession] = useState<ScanSession | undefined>(undefined);
  const [result, setResult] = useState<OfficialResult | undefined>(undefined);
  const [detailBundle, setDetailBundle] = useState<ScanDetailBundle | undefined>(undefined);
  const [extraResult, setExtraResult] = useState<ExtraResult | undefined>(undefined);
  const [extraLoaded, setExtraLoaded] = useState(false);
  const [extraLoadError, setExtraLoadError] = useState(false);
  const [loadComplete, setLoadComplete] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    let alive = true;
    void host.getCapabilities().then((caps) => { if (alive) setDemoMode(!caps.localScan); }).catch(() => undefined);
    // Set the fetched session synchronously into state (microtask, not the
    // 500 ms poll): cancelled sessions must render the fresh-scan branch
    // before the delayed-availability retry loop matters.
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
          void host.getDetailBundle(sessionId).then((bundle) => { if (alive) setDetailBundle(bundle); }).catch(() => undefined);
          void host.getExtraResult(sessionId).then((extra) => {
            if (alive) { setExtraResult(extra); setExtraLoaded(true); }
          }).catch(() => { if (alive) { setExtraLoadError(true); setExtraLoaded(true); } });
          setLoadComplete(true);
          globalThis.clearInterval(timer);
        } else if (attempts >= 10) {
          setLoadComplete(true);
          globalThis.clearInterval(timer);
        }
      }).catch(() => undefined);
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
  const visible = findings.filter((f) =>
    (filter === "ALL" || f.technique === filter)
    && (!normalizedQuery || `${f.url} ${f.evidence_text}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery)),
  );
  const pageGroups = useMemo(() => {
    const groups = new Map<string, typeof visible>();
    for (const finding of visible) {
      const group = groups.get(finding.url);
      if (group) group.push(finding);
      else groups.set(finding.url, [finding]);
    }
    return [...groups.entries()];
  }, [visible]);
  const resetFilters = () => { onFilterChange("ALL"); onQueryChange(""); };

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

  // A cancelled session never produces a result: offer a fresh scan instead
  // of stranding the evaluator on an empty result list (OBSERVED on VM:
  // cancel landed on `상태: running` with zero rows).
  if (session?.status === "cancelled") {
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
            <input id="result-search" type="search" value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="원문 또는 페이지 주소" />
          </div>
          <label htmlFor="technique-filter">기법 필터</label>
          <select
            id="technique-filter"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as TechniqueFilter)}
          >
            <option value="ALL">전체</option>
            {OFFICIAL_TECHNIQUES.map((t) => (
              <option key={t} value={t}>
                {techniqueLabel[t]}
              </option>
            ))}
          </select>
        </div> : null}
        {result && (view === "findings" || view === "pages") ? <p role="status" aria-live="polite" className="result-count">표시 중인 탐지 {String(visible.length)}건 / 전체 {String(findings.length)}건</p> : null}
        {!result && !loadComplete ? (
          <p role="status" className="empty">결과를 불러오는 중입니다.</p>
        ) : !result ? (
          <p role="alert" className="empty">결과 파일을 불러오지 못했습니다. 새 검사를 시작해 주세요.</p>
        ) : view === "extra" ? (
          <div className="coverage-summary">
            <h2>추가 분석</h2>
            {extraLoadError ? <p role="alert" className="empty">추가 분석 결과를 불러오지 못했습니다.</p>
              : !extraLoaded ? <p role="status" className="empty">추가 분석 결과를 불러오는 중입니다.</p>
                : !extraResult ? <p role="status" className="empty">이 세션에는 추가 분석 결과가 없습니다.</p>
                : extraResult.findings.length === 0 ? <p role="status" className="empty">추가 분석에서 확인된 항목이 없습니다.</p>
                  : <>
                    <p role="status" aria-live="polite">추가 분석 {String(extraResult.findings.length)}건</p>
                    <ol className="finding-list" aria-label="추가 분석 목록">
                      {extraResult.findings.map((finding) => <li key={finding.id} className="finding-card">
                        <h3>{extraLabels[finding.extra_finding] ?? finding.extra_finding}</h3>
                        <p>{extraSummary(finding)}</p>
                        <dl>
                          <div><dt>관련 주소</dt><dd>{finding.url}</dd></div>
                        </dl>
                        <details><summary>기술 정보</summary><p>위치: <code>{finding.location}</code></p><p>{finding.evidence_text}</p></details>
                      </li>)}
                    </ol>
                  </>}
          </div>
        ) : view === "coverage" ? (
          <div className="coverage-summary">
            {detailBundle ? <>
              <p>확인한 페이지 {String(detailBundle.coverage.checkedPages)}개 · 실패한 페이지 {String(detailBundle.coverage.failedPages.length)}개</p>
              {detailBundle.coverage.timedOut ? <p role="status">제한 시간에 도달해 일부 페이지를 확인하지 못했습니다.</p> : null}
              {detailBundle.coverage.failedPages.length > 0 ? <ul>{detailBundle.coverage.failedPages.map((page) => <li key={page.url}>{page.url} — {page.status === 0 ? "연결 또는 분석 실패" : `접근 실패 (HTTP ${String(page.status)})`}</li>)}</ul>
                : <p>확인에 실패한 페이지가 없습니다.</p>}
            </> : <p className="empty">이 세션에는 페이지별 점검 기록이 없습니다.</p>}
          </div>
        ) : findings.length === 0 ? (
          <p role="status" className="empty">
            확정된 탐지가 없습니다. 검사 범위를 넓히거나 시작 주소를 확인해 주세요.
          </p>
        ) : visible.length === 0 ? (
          <div role="status" className="empty">
            <p>검색어나 선택한 기법에 해당하는 탐지가 없습니다.</p>
            <button type="button" className="secondary" onClick={resetFilters}>검색·필터 초기화</button>
          </div>
        ) : view === "pages" ? (
          <div className="page-groups">
            {pageGroups.map(([url, group]) => (
              <section key={url} className="page-group" aria-label={`${url} 탐지 ${String(group.length)}건`}>
                <h2>{url}</h2>
                <p>탐지 {String(group.length)}건 · 검토 완료 {String(group.filter((finding) => reviewedIds.has(finding.id)).length)}건</p>
                <p className="hint">{OFFICIAL_TECHNIQUES.map((technique) => {
                  const count = group.filter((finding) => finding.technique === technique).length;
                  return count > 0 ? `${techniqueLabel[technique]} ${String(count)}건` : undefined;
                }).filter(Boolean).join(" · ")}</p>
                <button type="button" className="secondary" onClick={() => onReviewMany(group.map((finding) => finding.id), !group.every((finding) => reviewedIds.has(finding.id)))}>
                  {group.every((finding) => reviewedIds.has(finding.id)) ? "페이지 검토 취소" : "페이지 항목 모두 검토 완료"}
                </button>
                <ul>{group.map((f) => <li key={f.id}>{techniqueLabel[f.technique]} · {f.evidence_text} · {reviewedIds.has(f.id) ? "검토 완료" : "검토 전"} <button type="button" className="linklike" data-finding-id={f.id} onClick={() => onEvidence(f.id)}>근거 보기</button></li>)}</ul>
              </section>
            ))}
          </div>
        ) : (
          <div>
            <h2>확정된 탐지 목록 ({String(visible.length)}건)</h2>
            <ol className="finding-list" aria-label="확정된 탐지 목록">
              {visible.map((f) => (
                <li key={f.id} className="finding-card">
                  <div className="finding-card-head">
                    <span className="badge">{techniqueLabel[f.technique]}</span>
                    <span>{reviewedIds.has(f.id) ? "검토 완료" : "검토 전"}</span>
                  </div>
                  <dl>
                    <div><dt>페이지</dt><dd>{f.url}</dd></div>
                    <div><dt>확인된 문구</dt><dd>{f.evidence_text}</dd></div>
                  </dl>
                  <button type="button" onClick={() => onEvidence(f.id)} className="secondary" data-finding-id={f.id}>
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

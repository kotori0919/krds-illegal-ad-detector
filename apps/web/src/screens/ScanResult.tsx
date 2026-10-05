import { useEffect, useMemo, useState } from "react";
import {
  OFFICIAL_TECHNIQUES,
  type HostBridge,
  type OfficialResult,
  type OfficialTechnique,
  type ScanDetailBundle,
  type ScanSession,
} from "@krds-detector/contracts";
import { techniqueLabel } from "../technique-label.js";

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
  view: "findings" | "pages" | "coverage";
  onViewChange: (value: "findings" | "pages" | "coverage") => void;
  reviewedIds: ReadonlySet<string>;
  onReviewMany: (ids: string[], reviewed: boolean) => void;
  restoreFindingId?: string;
  onFocusRestored?: () => void;
}

type TechniqueFilter = OfficialTechnique | "ALL";

export function ScanResult({ host, sessionId, onEvidence, onExport, onRestart, query, onQueryChange, filter, onFilterChange, view, onViewChange, reviewedIds, onReviewMany, restoreFindingId, onFocusRestored }: Props) {
  const [session, setSession] = useState<ScanSession | undefined>(undefined);
  const [result, setResult] = useState<OfficialResult | undefined>(undefined);
  const [detailBundle, setDetailBundle] = useState<ScanDetailBundle | undefined>(undefined);
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
    && (!normalizedQuery || `${f.url} ${f.location} ${f.evidence_text}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery)),
  );
  const pageGroups = useMemo(() => {
    const groups = new Map<string, typeof visible>();
    for (const finding of visible) groups.set(finding.url, [...(groups.get(finding.url) ?? []), finding]);
    return [...groups.entries()];
  }, [visible]);
  const resetFilters = () => { onFilterChange("ALL"); onQueryChange(""); };

  useEffect(() => {
    if (!result || !restoreFindingId) return;
    const target = [...document.querySelectorAll<HTMLButtonElement>("button[data-finding-id]")]
      .find((button) => button.dataset.findingId === restoreFindingId);
    if (target) {
      target.focus();
      onFocusRestored?.();
    }
  }, [result, restoreFindingId, onFocusRestored, view]);

  // A cancelled session never produces a result: offer a fresh scan instead
  // of stranding the evaluator on an empty result list (OBSERVED on VM:
  // cancel landed on `상태: crawling` with zero rows).
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
      <p className="lede">{session?.status === "succeeded" ? "점검 완료" : session ? `상태: ${session.status}` : "결과를 불러오는 중"}{result ? ` · 공식 탐지 ${String(result.findings.length)}건` : null}</p>
      {demoMode ? <p role="note" className="empty">브라우저 미리보기 데이터입니다. 입력한 사이트를 실제로 점검한 결과가 아닙니다.</p> : null}
      {result ? <p className="hint">탐지된 페이지 {String(new Set(findings.map((finding) => finding.url)).size)}개{detailBundle ? ` · 확인한 페이지 ${String(detailBundle.coverage.checkedPages)}개 · 실패한 페이지 ${String(detailBundle.coverage.failedPages.length)}개` : ""}</p> : null}
      {result ? (
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
      <section aria-label="탐지 목록">
        <div className="result-navigation" role="group" aria-label="결과 보기 방식">
          <button type="button" aria-pressed={view === "findings"} onClick={() => onViewChange("findings")}>탐지 항목별</button>
          <button type="button" aria-pressed={view === "pages"} onClick={() => onViewChange("pages")}>페이지별</button>
          <button type="button" aria-pressed={view === "coverage"} onClick={() => onViewChange("coverage")}>점검 범위</button>
        </div>
        {view !== "coverage" ? <div className="toolbar">
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
        {result && view !== "coverage" ? <p role="status" aria-live="polite" className="result-count">표시 중인 탐지 {String(visible.length)}건 / 전체 {String(findings.length)}건</p> : null}
        {!result && !loadComplete ? (
          <p role="status" className="empty">결과를 불러오는 중입니다.</p>
        ) : !result ? (
          <p role="alert" className="empty">결과 파일을 불러오지 못했습니다. 새 검사를 시작해 주세요.</p>
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
                <button type="button" className="secondary" onClick={() => onReviewMany(group.map((finding) => finding.id), !group.every((finding) => reviewedIds.has(finding.id)))}>
                  {group.every((finding) => reviewedIds.has(finding.id)) ? "페이지 검토 취소" : "페이지 항목 모두 검토 완료"}
                </button>
                <ul>{group.map((f) => <li key={f.id}>{techniqueLabel[f.technique]} · {f.evidence_text} · {reviewedIds.has(f.id) ? "검토 완료" : "검토 전"} <button type="button" className="linklike" data-finding-id={f.id} onClick={() => onEvidence(f.id)}>근거 보기</button></li>)}</ul>
              </section>
            ))}
          </div>
        ) : (
          <table>
            <caption>확정된 탐지 목록 ({String(visible.length)}건)</caption>
            <thead>
              <tr>
                <th scope="col">페이지</th>
                <th scope="col">위치</th>
                <th scope="col">기법</th>
                <th scope="col">증거 원문</th>
                <th scope="col">근거</th>
                <th scope="col">검토 상태</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => (
                <tr key={f.id}>
                  <td>{f.url}</td>
                  <td>
                    <code>{f.location}</code>
                  </td>
                  <td>
                    <span className="badge">{techniqueLabel[f.technique]}</span>
                  </td>
                  <td>{f.evidence_text}</td>
                  <td>
                    <button type="button" onClick={() => onEvidence(f.id)} className="linklike" data-finding-id={f.id}>
                      근거 보기
                    </button>
                  </td>
                  <td>{reviewedIds.has(f.id) ? "검토 완료" : "검토 전"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <div className="actions">
        <button id="export-trigger" type="button" onClick={onExport} className="primary" disabled={!result}>
          결과 파일 생성
        </button>{" "}
        <button type="button" onClick={onRestart} className="secondary">
          새로 검사하기
        </button>
      </div>
    </main>
  );
}

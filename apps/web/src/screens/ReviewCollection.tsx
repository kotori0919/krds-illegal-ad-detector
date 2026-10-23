import { useEffect, useMemo, useRef, useState } from "react";
import { OFFICIAL_TECHNIQUES, scanIssueLabel, discoverySourceLabel, type OfficialFinding, type OfficialTechnique, type ScanCoverageView } from "@krds-detector/contracts";
import { groupReviewPatterns, normalizeReviewText } from "@krds-detector/evidence/review-patterns";
import { techniqueLabel } from "@krds-detector/contracts";

interface Props {
  simple?: boolean;
  findings: OfficialFinding[];
  coverage?: ScanCoverageView;
  query: string;
  onQueryChange: (value: string) => void;
  filter: OfficialTechnique | "ALL";
  onFilterChange: (value: OfficialTechnique | "ALL") => void;
  view: "findings" | "pages" | "extra" | "coverage";
  onViewChange: (value: "findings" | "pages" | "extra" | "coverage") => void;
  reviewedIds: ReadonlySet<string>;
  onReviewMany: (ids: string[], reviewed: boolean) => void;
  onEvidence: (id: string, context: string[]) => void;
  selectedFindingId?: string;
  allowHiddenSelection?: boolean;
  restoreFindingId?: string;
  onSelectionHidden: () => void;
  onFocusRestored?: () => void;
}

interface Row {
  id: string;
  summary: string;
  findings: OfficialFinding[];
  pageCount: number;
  destination?: string;
  outcome?: NonNullable<ScanCoverageView["pageOutcomes"]>[number];
}

export function ReviewCollection(props: Props) {
  const { findings, coverage, query, onQueryChange, filter, onFilterChange, view, onViewChange,
    reviewedIds, onReviewMany, onEvidence, selectedFindingId, allowHiddenSelection = false, restoreFindingId, onSelectionHidden, onFocusRestored } = props;
  const [groupMode, setMode] = useState<"patterns" | "records">("patterns");
  const simple = props.simple ?? false;
  const mode = simple ? "records" : groupMode;
  const [reviewFilter, setReviewFilter] = useState("ALL");
  const [sort, setSort] = useState("count");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [confirmation, setConfirmation] = useState<{ ids: string[]; scope: string }>();
  const [notice, setNotice] = useState("");
  const confirmRef = useRef<HTMLButtonElement>(null);
  const bulkInvoker = useRef<HTMLElement | null>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const active = view === "findings" || view === "pages";
  const selectionContext = useRef<{ id?: string; allowed: boolean; criteria: string }>({ allowed: false, criteria: "" });
  const criteria = JSON.stringify([query, filter, reviewFilter, view]);
  const patterns = useMemo(() => groupReviewPatterns(findings), [findings]);
  const normalizedQuery = normalizeReviewText(query).toLocaleLowerCase("ko-KR");
  const visible = useMemo(() => findings.filter((finding) => (filter === "ALL" || finding.technique === filter)
    && (reviewFilter === "ALL" || reviewedIds.has(finding.id) === (reviewFilter === "reviewed"))
    && (!normalizedQuery || normalizeReviewText(`${finding.id} ${finding.url} ${finding.evidence_text} ${finding.location} ${coverage?.pageOutcomes?.find((p) => p.finalUrl === finding.url)?.url ?? ""}`).toLocaleLowerCase("ko-KR").includes(normalizedQuery))),
  [findings, filter, reviewFilter, reviewedIds, normalizedQuery, coverage]);
  const visibleIds = useMemo(() => new Set(visible.map((finding) => finding.id)), [visible]);
  const affectedPageCount = useMemo(() => new Set(visible.map((finding) => finding.url)).size, [visible]);
  const rows = useMemo(() => {
    let items: Row[];
    if (view === "pages") {
      const byPage = new Map<string, Row>();
      for (const outcome of coverage?.pageOutcomes ?? []) {
        if (filter === "ALL" && reviewFilter === "ALL" && (!normalizedQuery || `${outcome.url} ${outcome.finalUrl}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery))) {
          byPage.set(outcome.url, { id: outcome.url, summary: outcome.url, findings: [], pageCount: 1, outcome });
        }
      }
      for (const finding of visible) {
        const outcome = coverage?.pageOutcomes?.find((p) => p.url === finding.url || p.finalUrl === finding.url);
        const key = outcome?.url ?? finding.url;
        let row = byPage.get(key);
        if (!row) { row = { id: key, summary: key, findings: [], pageCount: 1, outcome }; byPage.set(key, row); }
        row.findings.push(finding);
      }
      items = [...byPage.values()];
    } else if (mode === "records") {
      items = visible.map((finding) => ({ id: finding.id, summary: normalizeReviewText(finding.evidence_text), findings: [finding], pageCount: 1 }));
    } else {
      items = patterns.map((pattern) => {
        const members = pattern.findings.filter((finding) => visibleIds.has(finding.id));
        return { id: pattern.id, summary: pattern.summary, findings: members,
          pageCount: new Set(members.map((finding) => finding.url)).size, destination: pattern.destination };
      }).filter((row) => row.findings.length > 0);
    }
    return simple ? items : items.sort((a, b) => (sort === "count" ? b.findings.length - a.findings.length
      : sort === "pages" ? b.pageCount - a.pageCount : a.summary.localeCompare(b.summary, "ko")) || a.id.localeCompare(b.id));
  }, [view, mode, patterns, visible, visibleIds, coverage, filter, reviewFilter, normalizedQuery, sort, simple]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const reset = () => { onQueryChange(""); onFilterChange("ALL"); setReviewFilter("ALL"); setPage(1); setNotice(""); };
  const requestBulk = (ids: string[], scope: string) => {
    bulkInvoker.current = document.activeElement as HTMLElement;
    setConfirmation({ ids, scope });
  };
  const closeConfirm = () => { setConfirmation(undefined); requestAnimationFrame(() => bulkInvoker.current?.focus()); };
  useEffect(() => { if (confirmation) confirmRef.current?.focus(); }, [confirmation]);
  useEffect(() => {
    if (!selectedFindingId) return;
    if (selectionContext.current.id !== selectedFindingId || selectionContext.current.allowed !== allowHiddenSelection) {
      selectionContext.current = { id: selectedFindingId, allowed: allowHiddenSelection, criteria };
    }
    // Opening original evidence from a relation must not rewrite filters or
    // immediately close the inspector. A subsequent filter/view change still
    // uses the ordinary hidden-selection rule.
    if (allowHiddenSelection && selectionContext.current.criteria === criteria) return;
    if (!active || !visibleIds.has(selectedFindingId)) {
      setNotice(active ? "조건에 맞지 않아 근거를 닫았습니다." : "");
      onSelectionHidden();
    }
  }, [selectedFindingId, allowHiddenSelection, criteria, active, visibleIds, onSelectionHidden]);
  useEffect(() => {
    if (!restoreFindingId || !active) return;
    const rowIndex = rows.findIndex((row) => row.findings.some((f) => f.id === restoreFindingId));
    if (rowIndex >= 0 && Math.floor(rowIndex / pageSize) + 1 !== currentPage) {
      setPage(Math.floor(rowIndex / pageSize) + 1); return;
    }
    const target = [...document.querySelectorAll<HTMLButtonElement>("button[data-finding-id]")]
      .find((button) => button.dataset.findingId === restoreFindingId || button.dataset.findingId === rows[rowIndex]?.findings[0]?.id);
    (target ?? document.getElementById("result-search"))?.focus({ preventScroll: true });
    onFocusRestored?.();
  }, [restoreFindingId, active, rows, pageSize, currentPage, onFocusRestored]);
  const reviewedCount = findings.filter((f) => reviewedIds.has(f.id)).length;

  return <div className="review-collection" hidden={!active}>
    <div inert={!!confirmation}>
      <div className="review-list-toolbar">
      <h2 ref={listHeading} tabIndex={-1} className="sr-only">{view === "pages" ? "페이지별 점검" : mode === "patterns" ? "반복 항목 검토" : "전체 탐지 기록"}</h2>
      {!simple ? <><div className="result-navigation result-subnavigation" role="group" aria-label="공식 탐지 보기 방식">
        <button type="button" aria-pressed={view === "findings" && mode === "patterns"} onClick={() => { onViewChange("findings"); setMode("patterns"); setPage(1); }}>반복 항목별</button>
        <button type="button" aria-pressed={view === "pages"} onClick={() => { onViewChange("pages"); setPage(1); }}>페이지별</button>
        <button type="button" aria-pressed={view === "findings" && mode === "records"} onClick={() => { onViewChange("findings"); setMode("records"); setPage(1); }}>전체 기록</button>
      </div>
      <details className="review-display-options"><summary>정렬·표시 설정</summary>
      <div className="review-filters review-display-controls">
        <div><label htmlFor="review-sort">정렬 기준</label><select id="review-sort" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
          <option value="count">기록 많은 순</option><option value="pages">영향 페이지 많은 순</option><option value="text">내용 가나다순</option>
        </select></div>
        <div><label htmlFor="review-size">목록 표시 개수</label><select id="review-size" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}><option value="20">20</option><option value="50">50</option></select></div>
      </div></details></> : null}
      </div>
      <div className="review-filters review-search-controls">
        <div className="result-search"><label htmlFor="result-search">결과 검색</label>
          <input id="result-search" type="search" placeholder={simple ? "문구 또는 페이지 주소" : "문구, 페이지, 연결 주소 또는 기록 번호"} value={query} onChange={(e) => { onQueryChange(e.target.value); setPage(1); }} /></div>
        {!simple ? <div><label htmlFor="technique-filter">기법 필터</label><select id="technique-filter" value={filter} onChange={(e) => { onFilterChange(e.target.value as Props["filter"]); setPage(1); }}>
          <option value="ALL">전체</option>{OFFICIAL_TECHNIQUES.map((t) => <option key={t} value={t}>{techniqueLabel[t]}</option>)}
        </select></div> : null}
        <div><label htmlFor="review-filter">검토 상태</label><select id="review-filter" value={reviewFilter} onChange={(e) => { setReviewFilter(e.target.value); setPage(1); }}>
          <option value="ALL">전체</option><option value="needed">검토 필요</option><option value="reviewed">검토 완료</option>
        </select></div>
        <button className="linklike" type="button" onClick={reset}>검색·필터 초기화</button>
      </div>
      <p className="review-result-status" role="status" aria-live="polite"><span>표시 중인 탐지 {visible.length}건 / 전체 {findings.length}건</span> · 영향 페이지 {affectedPageCount}개 · {rows.length}개 {view === "pages" ? "페이지" : mode === "patterns" ? "검토 항목" : "기록"} · 검토 완료 {reviewedCount}건{notice ? ` · ${notice}` : ""}</p>
      <p className="review-scope sr-only">자동 탐지는 위반 확정이 아닙니다. 전체 {patterns.length}개 항목 · 검토 완료 {reviewedCount}건 / 전체 {findings.length}건</p>
      {view === "pages" && !coverage ? <p className="hint">페이지 점검 기록을 사용할 수 없습니다. 공식 탐지가 있는 페이지를 표시합니다. 점검 범위는 알 수 없습니다.</p> : null}
      {!rows.length ? <div className="empty" role="status"><p>{findings.length || query || filter !== "ALL" || reviewFilter !== "ALL"
        ? "검색어나 선택한 조건에 해당하는 탐지가 없습니다." : coverage?.coverage.checkedPages ? "확인한 페이지에서 탐지된 항목이 없습니다. 미검사 범위는 점검 범위에서 확인해 주세요."
          : "탐지된 항목이 없습니다. 성공적으로 점검한 범위를 확인할 수 없어 안전하다고 판단할 수 없습니다."}</p></div>
        : <ol className="review-list" aria-label="검토 목록">{pageRows.map((row) => {
          const first = row.findings[0];
          const selected = row.findings.find((f) => f.id === selectedFindingId);
          const representative = selected ?? first;
          const reviewed = row.findings.filter((f) => reviewedIds.has(f.id)).length;
          return <li key={row.id} className={`review-row${selected ? " is-selected" : ""}${row.findings.length && reviewed === row.findings.length ? " is-reviewed" : ""}`}>
            <section className="review-row-content" aria-label={view === "pages" ? `${row.summary} 탐지 ${row.findings.length}건` : undefined}>
              <div className="review-row-description">
              <h3>{row.summary || "문구 없음"}</h3>
              {view === "pages" && first ? <p>{normalizeReviewText(first.evidence_text)}{row.findings.length > 1 ? ` 외 ${row.findings.length - 1}건` : ""}</p> : null}
              {view === "pages" && row.outcome ? <p>{row.outcome.outcome === "checked" ? "확인 완료" : "확인 실패"} · HTTP {row.outcome.status} · 하위 {row.outcome.depth}단계</p> : null}
              {row.outcome?.issue ? <p>{scanIssueLabel[row.outcome.issue.kind]}{row.outcome.issue.retryable ? " · 재시도 가능" : ""}</p> : null}
              {row.outcome?.discoverySource ? <p className="hint">발견 경로: {discoverySourceLabel[row.outcome.discoverySource]}</p> : null}
              {row.outcome?.finalUrl !== undefined && row.outcome.finalUrl !== row.summary ? <p>{row.outcome.finalUrl}</p> : null}
              {row.outcome?.reason ? <details className="advanced"><summary>실패 상세</summary><p>{row.outcome.reason}</p></details> : null}
              <p className="review-row-meta">{[...new Set(row.findings.map((f) => techniqueLabel[f.technique]))].join(" · ")}{simple ? first ? ` · ${first.url}` : "" : `${row.findings.length ? " · " : ""}기록 ${row.findings.length}건 · 영향 페이지 ${row.pageCount}개${first ? ` · 대표 ${first.id}` : ""}`}</p>
              {first && !simple ? <details className="review-row-details"><summary>{mode === "patterns" && view !== "pages" ? "묶음의 관측 위치와 구분 기준" : "기록 주소와 위치"}</summary>
                <p>대표 기록 {first.id} · {first.url}</p>
                {row.destination ? <p>기록된 링크 주소: {row.destination} (요소 위치 기록에서 읽음)</p> : null}
                <p>{mode === "patterns" && view !== "pages" ? "문구·기법·링크 주소가 같아도 요소 위치가 다르면 별도 묶음입니다. " : ""}위치 기록: <code>{first.location}</code></p>
                {row.findings.length > 1 ? <button className="secondary" type="button" onClick={() => requestBulk(row.findings.map((f) => f.id), `선택한 ${view === "pages" ? "페이지" : "반복 항목"}의 조건에 맞는 기록`)}>이 항목 {row.findings.length}건 검토 완료</button> : null}
              </details> : null}
              </div>
              <div className="review-row-state">
              <p>{selected ? "확인 중 · " : ""}{row.findings.length ? reviewed === row.findings.length ? "검토 완료" : `검토 필요 · 완료 ${reviewed}/${row.findings.length}건` : row.outcome?.outcome === "failed" ? "페이지 확인에 실패해 탐지 여부를 판단할 수 없습니다." : "탐지된 항목이 없습니다."}</p>
              {representative ? <div className="actions">
                <button className="secondary" type="button" data-finding-id={representative.id} aria-current={selected ? "true" : undefined}
                  onClick={() => onEvidence(representative.id, view === "findings" && mode === "records" ? visible.map((f) => f.id) : row.findings.map((f) => f.id))}>근거 보기</button>
              </div> : null}
              </div>
            </section>
          </li>;
        })}</ol>}
      {pageCount > 1 ? <nav className="review-pagination" aria-label="목록 페이지">
        <button type="button" className="secondary" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); listHeading.current?.focus(); }}>이전 목록</button>
        <p role="status">{currentPage} / {pageCount} 페이지</p>
        <button type="button" className="secondary" disabled={currentPage === pageCount} onClick={() => { setPage(currentPage + 1); listHeading.current?.focus(); }}>다음 목록</button>
      </nav> : null}
      {!simple && pageRows.some((row) => row.findings.length) ? <button className="secondary" type="button" onClick={() => {
        const ids = pageRows.flatMap((row) => row.findings.map((f) => f.id)); requestBulk(ids, `현재 목록 ${pageRows.length}개 항목에 포함된 기록`);
      }}>현재 목록 {pageRows.reduce((count, row) => count + row.findings.length, 0)}건 검토 완료</button> : null}
    </div>
    {confirmation ? <div className="modal-backdrop"><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="review-confirm-title"
      onKeyDown={(e) => { if (e.key === "Escape") closeConfirm(); if (e.key === "Tab") {
        const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
        if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons[1]?.focus(); }
        else if (!e.shiftKey && document.activeElement === buttons[1]) { e.preventDefault(); buttons[0]?.focus(); }
      } }}>
      <h2 id="review-confirm-title">검토 범위 확인</h2><p>{confirmation.scope} {confirmation.ids.length}건을 검토 완료로 표시합니다. 공식 JSON은 바뀌지 않습니다.</p>
      <div className="actions"><button ref={confirmRef} className="secondary" type="button" onClick={closeConfirm}>취소</button>
        <button type="button" className="primary" onClick={() => { onReviewMany(confirmation.ids, true); setNotice(`${confirmation.ids.length}건 검토 완료로 표시했습니다.`); closeConfirm(); }}>검토 완료로 표시</button></div>
    </section></div> : null}
  </div>;
}

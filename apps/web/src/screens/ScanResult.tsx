import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  OFFICIAL_TECHNIQUES,
  type ExtraFinding,
  type CreativeImageView,
  type ImageAnalysis,
  type HostBridge,
  type OfficialResult,
  type OfficialTechnique,
  type ScanSession,
} from "@krds-detector/contracts";
import { techniqueLabel } from "@krds-detector/contracts";
import { formatElapsed, scanStatusLabel } from "../scan-format.js";
import { AssetImage } from "./AssetImage.js";
import { EvidenceRelations } from "./EvidenceRelations.js";
import { useEvidenceRead } from "./evidence-read.js";
import { VisualCoverage } from "./VisualCoverage.js";
import { ReviewCollection } from "./ReviewCollection.js";
import { WorkbookExport } from "./WorkbookExport.js";
import type { ReviewRecord } from "@krds-detector/evidence/report";

interface Props {
  host: HostBridge;
  sessionId: string;
  onEvidence: (findingId: string, context?: string[]) => void;
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
  reviewRecords?: ReviewRecord[];
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
  IMAGE_ONLY_ILLEGAL_AD: "이미지 안의 불법 광고",
};

function extraSummary(finding: ExtraFinding): string {
  if (finding.extra_finding === "IMAGE_ONLY_ILLEGAL_AD") return "이미지 문자와 광고 관련 단서에서 불법 광고 표현이 확인되었습니다.";
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

function ImageAnalysisView({ analysis, image, host, sessionId, displayAsset = !analysis.extraFindingId }: {
  analysis: ImageAnalysis; image?: CreativeImageView; host: HostBridge; sessionId: string; displayAsset?: boolean;
}) {
  const assetId = analysis.assetId ?? image?.assetId;
  return <li className="finding-card">
    <h3>이미지 문자 분석</h3>
    {assetId && displayAsset ? <figure className="visual-evidence">
      <AssetImage host={host} sessionId={sessionId} assetId={assetId} alt="문자를 분석한 수집 이미지" width={image?.width} height={image?.height} />
      <figcaption>수집한 이미지{image ? ` · ${image.width} × ${image.height}` : ""}</figcaption>
    </figure> : null}
    <dl className="evidence">
      <div><dt>이미지 주소</dt><dd>{analysis.sourceUrl}</dd></div>
      <div><dt>관측한 페이지</dt><dd><ul>{analysis.pageUrls.map((url) => <li key={url}>{url}</li>)}</ul></dd></div>
      {analysis.ocr.state === "available" ? <>
        <div><dt>인식한 원문</dt><dd className="raw">{analysis.ocr.text || "인식된 문자가 없습니다."}</dd></div>
      </> : <div><dt>문자 인식 상태</dt><dd>{analysis.ocr.reason === "budget"
        ? "시간·용량 제한으로 문자를 인식하지 못했습니다." : "문자 인식에 실패했습니다."}</dd></div>}
      {analysis.matchedTerms.length ? <div><dt>광고 표현</dt><dd>{analysis.matchedTerms.join(", ")}</dd></div> : null}
      <div><dt>분석 결과</dt><dd>{analysis.ocr.state === "unavailable" ? "판단할 수 없음"
        : analysis.matchedTerms.length ? "광고 표현 확인" : "광고 표현 미확인"}</dd></div>
      {analysis.visibleDomEquivalent ? <div><dt>페이지 문구와 중복</dt><dd>페이지에 같은 광고 문구가 있어 이미지 전용 탐지로 추가하지 않았습니다.</dd></div> : null}
    </dl>
    <details className="advanced"><summary>기술 정보</summary>
      {analysis.ocr.state === "available" ? <p>문자 인식 신뢰도: {String(Math.round(analysis.ocr.confidence * 100))}%</p> : null}
      <p>판단 규칙: {analysis.decision.rule}</p>
      <p>판단 점수 / 기준: {String(analysis.decision.score)} / {String(analysis.decision.threshold)}</p>
      <p>판단 통과 여부: {analysis.decision.passed ? "충족" : "미충족"}</p>
      <p>문자 인식 엔진: {analysis.ocr.backend}</p><p>{analysis.decision.detail}</p>
    </details>
    <EvidenceRelations host={host} sessionId={sessionId} focus={image ? { kind: "creative", id: image.sha256 } : { kind: "page", id: analysis.pageUrls[0] ?? analysis.sourceUrl }} />
  </li>;
}

function ImageOnlyEvidence({ findingId, host, sessionId }: { findingId: string; host: HostBridge; sessionId: string }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const read = useCallback(() => host.getImageAnalysis(sessionId, { extraFindingId: findingId, limit: 1 }), [host, sessionId, findingId]);
  const result = useEvidenceRead(`${sessionId}\0${findingId}`, read, open, toggleRef);
  const analysis = result.value?.items[0];
  return <div>
    <button ref={toggleRef} type="button" className="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "이미지 근거 닫기" : "이미지 근거 보기"}</button>
    {open ? result.state === "loading" ? <p role="status">이미지 근거를 불러오는 중입니다.</p>
      : result.state === "error" ? <div><p role="alert">이미지 근거를 불러오지 못했습니다.</p><button className="secondary" type="button" onClick={result.retry}>이미지 근거 다시 불러오기</button></div>
        : result.state === "unavailable" ? <div><p>이 세션의 이미지 근거 기록을 사용할 수 없습니다.</p><button className="secondary" type="button" onClick={result.retry}>이미지 근거 다시 불러오기</button></div>
          : !analysis ? <p>이 탐지에 연결된 이미지 분석 기록이 없습니다.</p>
          : <ul className="finding-list"><ImageAnalysisView analysis={analysis} host={host} sessionId={sessionId} displayAsset /></ul> : null}
  </div>;
}

function ImageAnalysisList({ host, sessionId, images }: { host: HostBridge; sessionId: string; images: CreativeImageView[] }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [cursor, setCursor] = useState(0);
  const [previous, setPrevious] = useState<ImageAnalysis[]>([]);
  const read = useCallback(() => host.getImageAnalysis(sessionId, { cursor, limit: 12 }), [host, sessionId, cursor]);
  const page = useEvidenceRead(`${sessionId}\0${cursor}`, read, true, headingRef);
  const items = [...previous, ...(page.value?.items ?? [])];
  return <section aria-label="이미지 문자 분석">
    <h2 ref={headingRef} tabIndex={-1}>이미지 문자 분석{page.value ? ` (${String(page.value.total)}건)` : ""}</h2>
    {items.length ? <ol className="finding-list">{items.map((analysis, index) => <ImageAnalysisView key={analysis.analysisId ?? `${analysis.sourceUrl}-${index}`}
      analysis={analysis} host={host} sessionId={sessionId} image={images.find((image) => image.sourceUrl === analysis.sourceUrl)} />)}</ol> : null}
    {page.state === "loading" ? <p role="status">이미지 문자 분석을 불러오는 중입니다.</p>
      : page.state === "error" ? <p role="alert">저장된 이미지 문자 분석을 불러오지 못했습니다. 공식 탐지는 유지됩니다.</p>
        : page.state === "unavailable" ? <p role="status">이 세션의 이미지 문자 분석 기록을 사용할 수 없습니다.</p>
          : !items.length ? <p className="hint">저장된 문자 분석 이미지가 없습니다. 미분석 사유는 이미지 분석 범위를 확인해 주세요.</p> : null}
    {page.state === "error" || page.state === "unavailable" ? <button type="button" className="secondary" onClick={page.retry}>이미지 문자 분석 다시 불러오기</button> : null}
    {page.value?.nextCursor !== undefined ? <>
      <p role="status">전체 {String(page.value.total)}건 중 {String(items.length)}건 표시 · 나머지는 더 보기를 눌러 조회합니다.</p>
      <button type="button" className="secondary" onClick={() => { setPrevious(items); setCursor(page.value!.nextCursor!); }}>이미지 분석 더 보기</button>
    </> : null}
  </section>;
}

export function ScanResult(props: Props) {
  return <SessionResults key={props.sessionId} {...props} />;
}

function SessionResults({ host, sessionId, onEvidence, onExport, onRestart, query, onQueryChange, filter, onFilterChange, view, onViewChange, reviewedIds, onReviewMany, reviewRecords = [], restoreFindingId, selectedFindingId, onSelectionHidden, onFocusRestored }: Props) {
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const [session, setSession] = useState<ScanSession | undefined>(undefined);
  const [result, setResult] = useState<OfficialResult | undefined>(undefined);
  const [loadComplete, setLoadComplete] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const readCoverage = useCallback(() => host.getScanCoverage(sessionId), [host, sessionId]);
  const readSummary = useCallback(() => host.getEvidenceSummary(sessionId), [host, sessionId]);
  const readExtra = useCallback(() => host.getExtraResult(sessionId), [host, sessionId]);
  const coverageRead = useEvidenceRead(sessionId, readCoverage, !!result, resultHeading);
  const summaryRead = useEvidenceRead(sessionId, readSummary, !!result, summaryHeading);
  const extraRead = useEvidenceRead(sessionId, readExtra, !!result && view === "extra", resultHeading);
  const detailBundle = coverageRead.value;
  const evidenceSummary = summaryRead.value;
  const extraResult = extraRead.value;
  const detailLoaded = coverageRead.state !== "loading";
  const detailLoadError = coverageRead.state === "error";
  const extraLoaded = extraRead.state !== "loading";
  const extraLoadError = extraRead.state === "error";

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
      <h1 ref={resultHeading} tabIndex={-1}>점검 결과</h1>
      <p className="lede">{session ? scanStatusLabel(session.status) : "결과를 불러오는 중"}{session?.status === "succeeded" && detailBundle?.coverage.failedPages.length ? " — 일부 페이지 확인 실패" : session?.status === "succeeded" && detailBundle?.coverage.timedOut ? " — 제한 시간 도달" : ""}{result ? ` · 공식 탐지 ${String(result.findings.length)}건 · 경과 시간 ${formatElapsed(result.meta.elapsed_sec)}` : null}</p>
      {result ? <WorkbookExport host={host} sessionId={sessionId} reviews={reviewRecords} /> : null}
      {session?.status === "cancelled" || detailBundle?.coverage.cancelled ? <p role="note" className="empty">점검이 중지되었습니다. 완료된 페이지의 결과를 표시합니다.</p>
        : session?.status === "failed" && session.hasResult === true ? <p role="note" className="empty">점검이 실패했습니다. 완료된 페이지의 결과를 표시합니다.</p> : null}
      {demoMode ? <p role="note" className="empty">브라우저 미리보기 데이터입니다. 입력한 사이트를 실제로 점검한 결과가 아닙니다.</p> : null}
      {result ? <p className="hint">탐지된 페이지 {String(new Set(findings.map((finding) => finding.url)).size)}개{detailBundle ? ` · 확인한 페이지 ${String(detailBundle.coverage.checkedPages)}개 · 실패한 페이지 ${String(detailBundle.coverage.failedPages.length)}개` : ""}</p> : null}
      {result ? <details className="advanced"><summary>이미지 분석 범위</summary><section aria-label="이미지 분석 범위">
        <h2 ref={summaryHeading} tabIndex={-1}>이미지 분석 범위</h2>
        {summaryRead.state === "loading" ? <p role="status">근거 요약을 불러오는 중입니다.</p>
          : summaryRead.state === "error" ? <div><p role="alert">저장된 근거 요약을 불러오지 못했습니다. 공식 탐지와 저장은 유지됩니다.</p><button type="button" className="secondary" onClick={summaryRead.retry}>근거 요약 다시 불러오기</button></div>
            : summaryRead.state === "unavailable" ? <div><p role="status">이 세션의 근거 요약을 사용할 수 없습니다. 이미지 분석 범위는 알 수 없습니다.</p><button type="button" className="secondary" onClick={summaryRead.retry}>근거 요약 다시 불러오기</button></div>
              : <VisualCoverage coverage={evidenceSummary?.visualAnalysisCoverage} />}
      </section></details> : null}
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
        {result ? <ReviewCollection findings={findings} coverage={detailBundle} query={query} onQueryChange={onQueryChange}
          filter={filter} onFilterChange={onFilterChange} view={view} onViewChange={onViewChange}
          reviewedIds={reviewedIds} onReviewMany={onReviewMany} onEvidence={onEvidence}
          selectedFindingId={selectedFindingId} restoreFindingId={restoreFindingId}
          onSelectionHidden={onSelectionHidden} onFocusRestored={onFocusRestored} /> : null}
        {!result && !loadComplete ? (
          <p role="status" className="empty">결과를 불러오는 중입니다.</p>
        ) : !result ? (
          <p role="alert" className="empty">결과 파일을 불러오지 못했습니다. 새 검사를 시작해 주세요.</p>
        ) : view === "extra" ? (
          <div className="coverage-summary">
            <h2>추가 분석</h2>
            {evidenceSummary?.analysisIssues?.length ? <p role="note">추가 분석 일부를 완료하지 못했습니다. 공식 탐지와 점검 범위는 별도로 확인할 수 있습니다.</p> : null}
            {evidenceSummary ? <section aria-label="관련 광고 인프라">
              {evidenceSummary.graphAvailable === false ? <p role="status">이 세션의 관계 분석 기록을 사용할 수 없습니다.</p> : <h3>관련 광고 인프라 {evidenceSummary.infrastructure.length}개</h3>}
              {evidenceSummary.infrastructure.length ? <ul>{evidenceSummary.infrastructure.map((relation) => <li key={relation.domain}>
                <strong>{relation.domain}</strong><p>{relation.pageUrls.length}개 관련 페이지에서 관측</p>
                <EvidenceRelations host={host} sessionId={sessionId} focus={{ kind: "domain", id: relation.domain }} />
              </li>)}</ul> : evidenceSummary.graphAvailable !== false ? <p>광고 근거와 연결된 외부 도메인이 없습니다.</p> : null}
              <details className="advanced"><summary>기술 정보</summary><p>관측한 전체 도메인 {evidenceSummary.observedDomainCount}개</p>
                {evidenceSummary.analysisIssues?.length ? <ul>{evidenceSummary.analysisIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul> : null}
              </details>
            </section> : null}
            {extraLoadError ? <div><p role="alert" className="empty">추가 분석 결과를 불러오지 못했습니다.</p><button type="button" className="secondary" onClick={extraRead.retry}>추가 분석 다시 불러오기</button></div>
              : !extraLoaded ? <p role="status" className="empty">추가 분석 결과를 불러오는 중입니다.</p>
                : !extraResult ? <div><p role="status" className="empty">이 세션의 추가 탐지 기록을 사용할 수 없습니다. 이미지 문자 분석 기록은 별도로 확인할 수 있습니다.</p><button type="button" className="secondary" onClick={extraRead.retry}>추가 분석 다시 불러오기</button></div>
                : extraResult.findings.length === 0 ? <p role="status" className="empty">{evidenceSummary?.imageAnalysisCount ? "반복 소재 등의 추가 탐지 항목은 없습니다." : "추가 분석에서 확인된 항목이 없습니다."}</p>
                  : <>
                    <p role="status" aria-live="polite">추가 분석 {String(extraResult.findings.length)}건</p>
                    <ol className="finding-list" aria-label="추가 분석 목록">
                      {extraResult.findings.map((finding) => {
                        const image = evidenceSummary?.creativeImages.find((item) => item.findingId === finding.id);
                        return <li key={finding.id} className="finding-card">
                        <h3>{extraLabels[finding.extra_finding] ?? finding.extra_finding}</h3>
                        <p>{extraSummary(finding)}</p>
                        {finding.extra_finding === "IMAGE_ONLY_ILLEGAL_AD" ? <>
                          <dl><div><dt>인식한 원문</dt><dd className="raw">{finding.evidence_text}</dd></div></dl>
                          <ImageOnlyEvidence findingId={finding.id} host={host} sessionId={sessionId} />
                        </> : null}
                        {finding.extra_finding === "REUSED_AD_CREATIVE" ? image ?
                          <figure className="visual-evidence">
                            <AssetImage host={host} sessionId={sessionId} assetId={image.assetId} alt="수집한 광고 이미지" width={image.width} height={image.height} />
                            <figcaption>수집한 이미지 · {image.width} × {image.height}</figcaption>
                          </figure>
                          : <p>수집한 이미지가 없습니다.</p> : null}
                        <dl>
                          <div><dt>관련 주소</dt><dd>{finding.url}</dd></div>
                        </dl>
                        <details className="advanced"><summary>기술 정보</summary><p>위치: <code>{finding.location}</code></p>
                          {finding.extra_finding !== "IMAGE_ONLY_ILLEGAL_AD" ? <p>{finding.evidence_text}</p> : null}
                        </details>
                        {image ? <EvidenceRelations host={host} sessionId={sessionId} focus={{ kind: "creative", id: image.sha256 }} /> : null}
                      </li>; })}
                    </ol>
                  </>}
            <ImageAnalysisList host={host} sessionId={sessionId} images={evidenceSummary?.creativeImages ?? []} />
          </div>
        ) : view === "coverage" ? (
          <div className="coverage-summary">
            {!detailLoaded ? <p role="status">점검 범위를 불러오는 중입니다.</p>
              : detailLoadError ? <div><p role="alert" className="error">점검 범위를 불러오지 못했습니다.</p><button type="button" className="secondary" onClick={coverageRead.retry}>점검 범위 다시 불러오기</button></div>
                : detailBundle ? <>
              <p>확인한 페이지 {String(detailBundle.coverage.checkedPages)}개 · 실패한 페이지 {String(detailBundle.coverage.failedPages.length)}개</p>
              {detailBundle.coverage.timedOut ? <p role="status">제한 시간에 도달해 일부 페이지를 확인하지 못했습니다.</p> : null}
              {detailBundle.coverage.failedPages.length > 0 ? <ul>{detailBundle.coverage.failedPages.map((page) => <li key={page.url}>{page.url} — {page.status === 0 ? "연결 또는 분석 실패" : `접근 실패 (HTTP ${String(page.status)})`}</li>)}</ul>
                : <p>확인에 실패한 페이지가 없습니다.</p>}
            </> : <div><p role="status" className="empty">점검 범위 기록을 사용할 수 없습니다.</p><button type="button" className="secondary" onClick={coverageRead.retry}>점검 범위 다시 불러오기</button></div>}
          </div>
        ) : null}

      </section>
      {result ? <p className="hint">검토 완료는 항목을 읽고 검토했다는 표시이며 위반 확정이나 조치 완료가 아닙니다. 공식 탐지와 저장 파일은 바뀌지 않습니다. 검토 표시는 현재 화면 메모리에만 보관되어 새 점검이나 앱 새로고침 시 사라집니다.</p> : null}
      <div className="actions">
        <button id="export-trigger" type="button" onClick={onExport} className="primary" disabled={!result}>
          공식 JSON 저장
        </button>{" "}
        <button type="button" onClick={onRestart} className="secondary">
          새로 검사하기
        </button>
      </div>
    </main>
  );
}

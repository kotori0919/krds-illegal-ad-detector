import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  OFFICIAL_TECHNIQUES,
  type ExtraFinding,
  type CreativeImageView,
  type ImageAnalysis,
  type HostBridge,
  type OfficialResult,
  type OfficialTechnique,
  type ScanSession,
  scanIssueLabel,
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
  simple?: boolean;
  onInfrastructure?: () => void;
  prepareReviews?: () => Promise<ReviewRecord[]>;
  onBusyChange?: (busy: boolean) => void;
  host: HostBridge;
  sessionId: string;
  onEvidence: (findingId: string, context?: string[], origin?: "list" | "relation") => void;
  onExport: () => void;
  onRestart: () => void;
  restartLabel?: string;
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
  allowHiddenSelection?: boolean;
  onSelectionHidden: () => void;
  onFocusRestored?: () => void;
}

type TechniqueFilter = OfficialTechnique | "ALL";

const extraLabels: Record<string, string> = {
  REUSED_AD_CREATIVE: "반복 광고 소재",
  AD_INFRASTRUCTURE_CORRELATION: "연관 광고 인프라",
  ZERO_WIDTH_OBFUSCATION: "제로폭 글자 위장",
  IMAGE_ONLY_ILLEGAL_AD: "이미지 광고 검토 후보",
};

const imageReviewDescription = "이미지 문자와 광고 관련 단서를 확인한 검토 후보입니다. 원문과 연결 주소를 검토해 주세요.";

function extraSummary(finding: ExtraFinding): string {
  if (finding.extra_finding === "IMAGE_ONLY_ILLEGAL_AD") return imageReviewDescription;
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

function ImageAnalysisView({ analysis, image, host, sessionId, displayAsset = !analysis.extraFindingId, onSelectFinding, simple = false }: {
  analysis: ImageAnalysis; image?: CreativeImageView; host: HostBridge; sessionId: string; displayAsset?: boolean; simple?: boolean; onSelectFinding?: (id: string) => void;
}) {
  const assetId = analysis.assetId ?? image?.assetId;
  const embedding = analysis.textEmbedding;
  const textReview = analysis.decision.rule === "image-only-ad-v4-text-review";
  const imageReview = analysis.decision.rule === "image-only-ad-v5-image-review";
  const visual = analysis.visualEmbedding;
  const alternateReadings = analysis.ocrAlternatives?.filter(item => item.state === "available") ?? [];
  const [copyStatus, setCopyStatus] = useState("");
  async function copyDestination() {
    if (!analysis.destinationUrl) return;
    try {
      await navigator.clipboard.writeText(analysis.destinationUrl);
      setCopyStatus("연결 주소를 복사했습니다.");
    } catch {
      setCopyStatus("복사하지 못했습니다. 주소를 직접 선택해 복사해 주세요.");
    }
  }
  return <li className="finding-card">
    <h3>이미지 문자 분석</h3>
    {assetId && displayAsset ? <figure className="visual-evidence">
      <AssetImage host={host} sessionId={sessionId} assetId={assetId} alt="문자를 분석한 수집 이미지" width={image?.width} height={image?.height} />
      <figcaption>수집한 이미지{image ? ` · ${image.width} × ${image.height}` : ""}</figcaption>
    </figure> : null}
    <dl className="evidence">
      <div><dt>관측한 연결 주소</dt><dd className="destination-evidence"><span>{analysis.destinationUrl ?? "수집 기록에 연결 주소가 없습니다."}</span>
        {analysis.destinationUrl ? <><button type="button" className="secondary" aria-label="관측한 연결 주소 복사" onClick={() => void copyDestination()}>주소 복사</button>
          <span role="status">{copyStatus}</span></> : null}</dd></div>
      <div><dt>이미지 주소</dt><dd>{analysis.sourceUrl}</dd></div>
      {analysis.animationFrame ? <div><dt>확인한 애니메이션 장면</dt><dd>{analysis.animationFrame.index + 1}번째 프레임 · {analysis.animationFrame.timestampMs / 1000}초</dd></div> : null}
      {analysis.candidateEvidence?.some(reason => reason === "animation-partial" || reason === "animation-single-frame") ? <div><dt>애니메이션 확인 범위</dt><dd>시간·프레임 제한으로 전체 애니메이션을 확인하지 못했습니다.</dd></div> : null}
      <div><dt>관측한 페이지</dt><dd><ul>{analysis.pageUrls.map((url) => <li key={url}>{url}</li>)}</ul></dd></div>
      {analysis.ocr.state === "available" ? <>
        <div><dt>인식한 원문</dt><dd className="raw">{analysis.ocr.text || "인식된 문자가 없습니다."}</dd></div>
      </> : <div><dt>문자 인식 상태</dt><dd>{analysis.ocr.reason === "budget"
        ? "시간·용량 제한으로 문자를 인식하지 못했습니다." : "문자 인식에 실패했습니다."}</dd></div>}
      {analysis.ocrAlternatives?.length ? <div><dt>문자 인식 비교</dt><dd>
        {analysis.ocrAlternatives.some(item => item.state === "unavailable") ? "다른 문자 인식을 완료하지 못해 기존 결과를 유지했습니다." : "작은 배너의 다른 문자 인식 결과를 함께 비교했습니다."}
        {simple && alternateReadings.length ? <details><summary>다른 인식 원문 {alternateReadings.length}건 보기</summary>
          <p>현재 표시한 원문과 다른 인식 결과입니다.</p>
          <ol>{alternateReadings.map((reading, index) => <li key={index}><p className="raw">{reading.text || "인식된 문자가 없습니다."}</p></li>)}</ol>
        </details> : null}
      </dd></div> : null}
      {analysis.matchedTerms.length ? <div><dt>광고 표현</dt><dd>{analysis.matchedTerms.join(", ")}</dd></div> : null}
      {embedding ? <div><dt>문자 의미 유사도</dt><dd>{embedding.state === "available"
        ? textReview ? "문자 의미 유사도: 검토 필요" : "보조 비교 완료"
        : embedding.reason === "budget" ? "시간 제한으로 보조 비교를 완료하지 못했습니다." : embedding.reason === "invalid-input"
          ? "입력 조건을 충족하지 않아 보조 비교를 수행하지 못했습니다." : "모델 오류로 보조 비교를 완료하지 못했습니다."}</dd></div> : null}
      {embedding ? <div><dt>보조 비교의 의미</dt><dd>의미 유사도는 OCR 원문이나 법적 위반의 증거가 아닙니다.</dd></div> : null}
      {visual ? <div><dt>이미지 의미 비교</dt><dd>{visual.state === "available" ? imageReview ? "이미지 기반 검토 필요" : "보조 비교 완료" : "이미지 보조 비교를 완료하지 못했습니다."}</dd></div> : null}
      {imageReview ? <div><dt>검토 근거</dt><dd>문구를 충분히 읽지 못해 수집 이미지의 형태와 내용을 보조 비교했습니다. OCR 원문은 복구·수정하지 않았으며 사람이 광고 내용을 확인해야 합니다.</dd></div> : null}
      <div><dt>분석 결과</dt><dd>{textReview || imageReview ? "검토 필요" : analysis.ocr.state === "unavailable" ? "판단할 수 없음"
        : analysis.matchedTerms.length ? "광고 표현 확인" : "광고 표현 미확인"}</dd></div>
      {analysis.visibleDomEquivalent ? <div><dt>페이지 문구와 중복</dt><dd>페이지에 같은 광고 문구가 있어 이미지 전용 탐지로 추가하지 않았습니다.</dd></div> : null}
    </dl>
    {!simple ? <details className="advanced"><summary>기술 정보</summary>
      {analysis.ocr.state === "available" ? <p>문자 인식 신뢰도: {String(Math.round(analysis.ocr.confidence * 100))}%</p> : null}
      <p>판단 규칙: {analysis.decision.rule}</p>
      <p>판단 점수 / 기준: {String(analysis.decision.score)} / {String(analysis.decision.threshold)}</p>
      <p>판단 통과 여부: {analysis.decision.passed ? "충족" : "미충족"}</p>
      <p>문자 인식 엔진: {analysis.ocr.backend}</p><p>{analysis.decision.detail}</p>
      {analysis.ocrAlternatives?.length ? <section aria-label="다른 문자 인식 결과">
        <h4>다른 문자 인식 결과</h4>
        <p>각 결과는 별도로 인식한 원문입니다. 표시된 의미 비교 점수는 위에서 선택한 원문을 기준으로 합니다.</p>
        {analysis.ocrAlternatives.map((alternative, index) => <div key={index}>
          <p>다른 문자 인식 엔진: {alternative.backend}</p>
          {alternative.state === "available" ? <>
            <p className="raw">{alternative.text || "인식된 문자가 없습니다."}</p>
            <p>다른 문자 인식 신뢰도: {String(Math.round(alternative.confidence * 100))}%</p>
          </> : <p>{alternative.reason === "budget" ? "시간 제한으로 다른 문자 인식을 완료하지 못했습니다." : "다른 문자 인식에 실패했습니다."}</p>}
        </div>)}
      </section> : null}
      {visual?.state === "available" ? <>
        <p>이미지 의미 모델: {visual.model} · {visual.revision}</p>
        <p>이미지 비교 정책: {visual.policy}</p>
        {visual.policy === "image-ad-embedding-v3" ? <p>실제 광고의 이미지와 비교했습니다. OCR 원문은 이 유사도 계산에 넣지 않았습니다.</p> : null}
        <p>원본 이미지 유사도 차이: {visual.margin}</p><p>픽셀을 섞은 대조 이미지 유사도 차이: {visual.shuffledMargin}</p>
        <p>이미지 비교 시간: {visual.elapsedMs}ms</p><p>이미지 의미 비교는 OCR 전사나 법적 위반의 증거가 아닙니다.</p>
      </> : null}
      {embedding?.state === "available" ? <>
        <p>문자 의미 모델: {embedding.model} · {embedding.revision}</p>
        <p>유사도 (광고 / 비교 대상): {embedding.positiveSimilarity} / {embedding.negativeSimilarity}</p>
        <p>유사도 차이 / 기준: {embedding.margin} / {embedding.threshold}</p>
        <p>문자 의미 비교 시간: {embedding.elapsedMs}ms</p>
      </> : null}
    </details> : null}
    {!simple ? <EvidenceRelations host={host} sessionId={sessionId} focus={image ? { kind: "creative", id: image.sha256 } : { kind: "page", id: analysis.pageUrls[0] ?? analysis.sourceUrl }} onSelectFinding={onSelectFinding} /> : null}
  </li>;
}

function ImageOnlyEvidence({ findingId, ordinal, host, sessionId, onSelectFinding, simple = false }: { ordinal: number; simple?: boolean; findingId: string; host: HostBridge; sessionId: string; onSelectFinding: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const read = useCallback(() => host.getImageAnalysis(sessionId, { extraFindingId: findingId, limit: 1 }), [host, sessionId, findingId]);
  const result = useEvidenceRead(`${sessionId}\0${findingId}`, read, open, toggleRef);
  const analysis = result.value?.items[0];
  return <div>
    <button ref={toggleRef} type="button" className="secondary" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>{ordinal}번 {open ? "이미지 근거 닫기" : "이미지 근거 보기"}</button>
    <div id={panelId} hidden={!open}>
    {open ? result.state === "loading" ? <p role="status">이미지 근거를 불러오는 중입니다.</p>
      : result.state === "error" ? <div><p role="alert">이미지 근거를 불러오지 못했습니다.</p><button className="secondary" type="button" onClick={result.retry}>이미지 근거 다시 불러오기</button></div>
        : result.state === "unavailable" ? <p>이 결과에 저장된 이미지 근거 기록이 없습니다.</p>
          : !analysis ? <p>이 탐지에 연결된 이미지 분석 기록이 없습니다.</p>
          : <ul className="finding-list"><ImageAnalysisView simple={simple} analysis={analysis} host={host} sessionId={sessionId} displayAsset onSelectFinding={onSelectFinding} /></ul> : null}
    </div>
  </div>;
}

function ImageAnalysisList({ host, sessionId, images, onSelectFinding, simple = false }: { simple?: boolean; host: HostBridge; sessionId: string; images: CreativeImageView[]; onSelectFinding: (id: string) => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [cursor, setCursor] = useState(0);
  const [previous, setPrevious] = useState<ImageAnalysis[]>([]);
  const read = useCallback(() => host.getImageAnalysis(sessionId, { cursor, limit: 12 }), [host, sessionId, cursor]);
  const page = useEvidenceRead(`${sessionId}\0${cursor}`, read, true, headingRef);
  const items = [...previous, ...(page.value?.items ?? [])];
  return <section aria-label="이미지 문자 분석">
    <h2 ref={headingRef} tabIndex={-1}>이미지 문자 분석{page.value ? ` (${String(page.value.total)}건)` : ""}</h2>
    {items.length ? <ol className="finding-list">{items.map((analysis, index) => <ImageAnalysisView simple={simple} key={analysis.analysisId ?? `${analysis.sourceUrl}-${index}`}
      analysis={analysis} host={host} sessionId={sessionId} image={images.find((image) => image.sourceUrl === analysis.sourceUrl)} onSelectFinding={onSelectFinding} />)}</ol> : null}
    {page.state === "loading" ? <p role="status">이미지 문자 분석을 불러오는 중입니다.</p>
      : page.state === "error" ? <p role="alert">저장된 이미지 문자 분석을 불러오지 못했습니다. 공식 탐지는 유지됩니다.</p>
        : page.state === "unavailable" ? <p role="status">이 세션의 이미지 문자 분석 기록을 사용할 수 없습니다.</p>
          : !items.length ? <p className="hint">저장된 문자 분석 이미지가 없습니다. 미분석 사유는 이미지 분석 범위를 확인해 주세요.</p> : null}
    {page.state === "error" ? <button type="button" className="secondary" onClick={page.retry}>이미지 문자 분석 다시 불러오기</button> : null}
    {page.value?.nextCursor !== undefined ? <>
      <p role="status">전체 {String(page.value.total)}건 중 {String(items.length)}건 표시 · 나머지는 더 보기를 눌러 조회합니다.</p>
      <button type="button" className="secondary" onClick={() => { setPrevious(items); setCursor(page.value!.nextCursor!); }}>이미지 분석 더 보기</button>
    </> : null}
  </section>;
}

export function ScanResult(props: Props) {
  return <SessionResults key={props.sessionId} {...props} />;
}

function SessionResults({ host, sessionId, onEvidence, onExport, onRestart, restartLabel = "새로 검사하기", query, onQueryChange, filter, onFilterChange, view, onViewChange, reviewedIds, onReviewMany, reviewRecords = [], restoreFindingId, selectedFindingId, allowHiddenSelection, onSelectionHidden, onFocusRestored, simple = false, onInfrastructure, prepareReviews, onBusyChange }: Props) {
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const [session, setSession] = useState<ScanSession | undefined>(undefined);
  const [result, setResult] = useState<OfficialResult | undefined>(undefined);
  const [loadComplete, setLoadComplete] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const focusedResult = useRef(false);
  useEffect(() => {
    if (result && !focusedResult.current) {
      focusedResult.current = true;
      resultHeading.current?.focus();
    }
  }, [result]);
  const readCoverage = useCallback(() => host.getScanCoverage(sessionId), [host, sessionId]);
  const readSummary = useCallback(() => host.getEvidenceSummary(sessionId), [host, sessionId]);
  const readExtra = useCallback(() => host.getExtraResult(sessionId), [host, sessionId]);
  const coverageRead = useEvidenceRead(sessionId, readCoverage, !!result, resultHeading);
  const summaryRead = useEvidenceRead(sessionId, readSummary, !!result, summaryHeading);
  const extraRead = useEvidenceRead(sessionId, readExtra, !!result && (simple || view === "extra"), resultHeading);
  const detailBundle = coverageRead.value;
  const evidenceSummary = summaryRead.value;
  const extraResult = extraRead.value;
  const detailLoaded = coverageRead.state !== "loading";
  const detailLoadError = coverageRead.state === "error";
  const extraLoaded = extraRead.state !== "loading";
  const extraLoadError = extraRead.state === "error";
  const viewChosen = useRef(false);
  const defaultViewChosen = useRef(false);
  const changeView = useCallback((next: Props["view"]) => {
    viewChosen.current = true;
    onViewChange(next);
  }, [onViewChange]);
  useEffect(() => {
    if (defaultViewChosen.current || !simple || !result || extraRead.state === "loading") return;
    defaultViewChosen.current = true;
    if (!viewChosen.current && view === "findings" && result.findings.length === 0 && extraResult?.findings.length) onViewChange("extra");
  }, [simple, result, extraRead.state, extraResult, view, onViewChange]);
  const hasImageCandidates = extraResult?.findings.some(finding => finding.extra_finding === "IMAGE_ONLY_ILLEGAL_AD") ?? false;
  const elapsedSec = Math.max(result?.meta.elapsed_sec ?? 0, session?.progress?.elapsedSec ?? 0);
  const accessLimited = detailBundle?.pageOutcomes.filter((page) => page.issue && ["challenge", "denied", "rate-limit", "login-required"].includes(page.issue.kind)) ?? [];
  const noCheckedCoverage = !!detailBundle && detailBundle.coverage.checkedPages === 0;
  const collectionLimited = detailBundle?.pageOutcomes.filter((page) => page.collectionIssues?.length) ?? [];

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
            {restartLabel}
          </button>
        </div>
      </main>
    );
  }


  return (
    <main className={`page result-page${simple ? " simple-result" : ""}`}>
      <div className="result-layout">
      <div className="result-summary-panel">
      <header className="result-header">
        <div><h1 ref={resultHeading} tabIndex={-1}>점검 결과</h1>
          <p className="result-site">{result?.meta.entry_url ?? session?.entryUrl}</p></div>
        <div className="result-export-actions">
          {result ? <WorkbookExport host={host} sessionId={sessionId} reviews={reviewRecords} prepareReviews={prepareReviews} onBusyChange={onBusyChange} /> : null}
          <details className="result-files"><summary>결과 파일</summary><button id="export-trigger" type="button" onClick={onExport} className="secondary" disabled={!result}>공식 JSON 저장</button></details>
        </div>
      <p className="lede result-completion">{noCheckedCoverage ? accessLimited.length ? "접근 제한으로 점검하지 못함" : "성공적으로 점검한 페이지 없음" : session ? scanStatusLabel(session.status) : "결과를 불러오는 중"}{!noCheckedCoverage && session?.status === "succeeded" && detailBundle?.coverage.failedPages.length ? " — 일부 페이지 확인 실패" : session?.status === "succeeded" && detailBundle?.coverage.timedOut ? " — 제한 시간 도달" : ""}{result ? ` · 경과 시간 ${formatElapsed(elapsedSec)}` : null}</p>
      {result ? <dl className="result-overview" aria-label="점검 요약">
        <div><dt>{simple ? "문구 탐지" : "공식 탐지"}</dt><dd><strong>{result.findings.length}</strong>건</dd></div>
        {simple ? <div className={extraResult?.findings.length ? "has-review-candidates" : undefined}><dt>배너·추가 단서</dt><dd><strong>{extraResult?.findings.length ?? "—"}</strong>{extraResult ? "건" : extraLoadError ? "조회 실패" : extraLoaded ? "기록 없음" : "조회 중"}</dd></div> : null}
        <div><dt>확인한 페이지</dt><dd><strong>{detailBundle?.coverage.checkedPages ?? "—"}</strong>{detailBundle ? "개" : ""}</dd></div>
        <div className={detailBundle?.coverage.failedPages.length ? "coverage-incomplete" : undefined}><dt><button type="button" className="linklike" onClick={() => changeView("coverage")}>확인하지 못한 페이지 ↗</button></dt><dd><strong>{detailBundle?.coverage.failedPages.length ?? "—"}</strong>{detailBundle ? "개" : ""}</dd></div>
      </dl> : null}
      </header>
      {result ? <div className="result-review-entry"><p className="hint">자동 탐지는 위반 확정이 아닙니다. {!detailBundle ? "점검 범위 알 수 없음 · 확인한 범위를 알 수 없어 탐지 건수만으로 안전하다고 판단할 수 없습니다." : "원문 근거와 점검 범위를 함께 검토해 주세요."}</p>
        {!simple ? <a href="#review-workspace" onClick={(event) => { event.preventDefault(); document.getElementById("review-workspace")?.focus(); }}>검토 목록으로 이동 ↓</a> : null}</div> : null}
      {session?.status === "cancelled" || detailBundle?.coverage.cancelled ? <p role="note" className="empty">점검이 중지되었습니다. 완료된 페이지의 결과를 표시합니다.</p>
        : session?.status === "failed" && session.hasResult === true ? <p role="note" className="empty">점검이 실패했습니다. 완료된 페이지의 결과를 표시합니다.</p> : null}
      {demoMode ? <p role="note" className="preview-notice">브라우저 미리보기 데이터입니다. 입력한 사이트를 실제로 점검한 결과가 아닙니다. 검토 메모는 새로고침하면 사라집니다.</p> : null}
      {accessLimited.length ? <p role="note">접근 제한 페이지는 점검하지 못했습니다. 탐지 0건이라도 안전하다고 판단할 수 없습니다. 점검 범위에서 사유를 확인해 주세요.</p> : null}
      {result ? <div className="result-scope-details">
        <div className="result-navigation" role="group" aria-label="결과 영역">
          <button type="button" aria-pressed={view === "findings" || view === "pages"} onClick={() => changeView("findings")}>{simple ? "의심 항목" : "공식 탐지"}</button>
          <button type="button" aria-pressed={view === "extra"} onClick={() => changeView("extra")}>{simple ? `추가 단서 ${extraResult ? `${extraResult.findings.length}건` : extraLoadError ? "조회 실패" : extraLoaded ? "기록 없음" : "불러오는 중"}` : "추가 분석"}</button>
          <button type="button" aria-pressed={view === "coverage"} onClick={() => changeView("coverage")}>점검 범위</button>
          {!simple && onInfrastructure ? <button type="button" onClick={onInfrastructure}>인프라 분석</button> : null}
        </div><details className="advanced"><summary>이미지 분석 범위</summary><section aria-label="이미지 분석 범위">
        <h2 ref={summaryHeading} tabIndex={-1}>이미지 분석 범위</h2>
        {summaryRead.state === "loading" ? <p role="status">근거 요약을 불러오는 중입니다.</p>
          : summaryRead.state === "error" ? <div><p role="alert">저장된 근거 요약을 불러오지 못했습니다. 공식 탐지와 저장은 유지됩니다.</p><button type="button" className="secondary" onClick={summaryRead.retry}>근거 요약 다시 불러오기</button></div>
            : summaryRead.state === "unavailable" ? <div><p role="status">이 결과에 저장된 근거 요약이 없습니다. 이미지 분석 범위는 알 수 없습니다.</p></div>
              : <VisualCoverage coverage={evidenceSummary?.visualAnalysisCoverage} />}
      </section></details>
        {!simple ? <details className="advanced"><summary>기법별 건수</summary><section aria-label="기법별 건수">
          <ul className="counts">
            {OFFICIAL_TECHNIQUES.map((t) => (
              <li key={t}>
                <span>{techniqueLabel[t]}</span> <strong>{counts.get(t) ?? 0}건</strong>
              </li>
            ))}
          </ul>
        </section></details> : null}</div> : null}
      </div>
      <section id="review-workspace" tabIndex={-1} aria-label="결과 목록">
        {result ? <ReviewCollection simple={simple} findings={findings} coverage={detailBundle} query={query} onQueryChange={onQueryChange}
          filter={filter} onFilterChange={onFilterChange} view={view} onViewChange={changeView}
          reviewedIds={reviewedIds} onReviewMany={onReviewMany} onEvidence={onEvidence}
          selectedFindingId={selectedFindingId} restoreFindingId={restoreFindingId} allowHiddenSelection={allowHiddenSelection}
          onSelectionHidden={onSelectionHidden} onFocusRestored={onFocusRestored} /> : null}
        {!result && !loadComplete ? (
          <p role="status" className="empty">결과를 불러오는 중입니다.</p>
        ) : !result ? (
          <p role="alert" className="empty">결과 파일을 불러오지 못했습니다. 새 검사를 시작해 주세요.</p>
        ) : view === "extra" ? (
          <div className="coverage-summary">
            <h2>추가 분석</h2>
            {evidenceSummary?.analysisIssues?.length ? <p role="note">추가 분석 일부를 완료하지 못했습니다. 공식 탐지와 점검 범위는 별도로 확인할 수 있습니다.</p> : null}
            {extraLoadError ? <div><p role="alert" className="empty">추가 분석 결과를 불러오지 못했습니다.</p><button type="button" className="secondary" onClick={extraRead.retry}>추가 분석 다시 불러오기</button></div>
              : !extraLoaded ? <p role="status" className="empty">추가 분석 결과를 불러오는 중입니다.</p>
                : !extraResult ? <div><p role="status" className="empty">이 세션의 추가 탐지 기록을 사용할 수 없습니다. 이미지 문자 분석 기록은 별도로 확인할 수 있습니다.</p></div>
                : extraResult.findings.length === 0 ? <p role="status" className="empty">{evidenceSummary?.imageAnalysisCount ? "반복 소재 등의 추가 탐지 항목은 없습니다." : "추가 분석에서 확인된 항목이 없습니다."}</p>
                  : <>
                    <p role="status" aria-live="polite">추가 분석 {String(extraResult.findings.length)}건</p>
                    {simple && extraResult.findings.some(finding => finding.extra_finding === "IMAGE_ONLY_ILLEGAL_AD") ? <p>{imageReviewDescription}</p> : null}
                    <ol className="finding-list" aria-label="추가 분석 목록">
                      {extraResult.findings.map((finding, index) => {
                        const image = evidenceSummary?.creativeImages.find((item) => item.findingId === finding.id);
                        return <li key={finding.id} className="finding-card">
                        <h3>{extraLabels[finding.extra_finding] ?? finding.extra_finding}</h3>
                        {!simple || finding.extra_finding !== "IMAGE_ONLY_ILLEGAL_AD" ? <p>{extraSummary(finding)}</p> : null}
                        {finding.extra_finding === "IMAGE_ONLY_ILLEGAL_AD" ? <>
                          {finding.evidence_text.length > 240 || finding.evidence_text.split("\n").length > 4
                            ? <details><summary>인식한 원문 전체 보기</summary><p className="raw">{finding.evidence_text}</p></details>
                            : <dl><div><dt>인식한 원문</dt><dd className="raw">{finding.evidence_text}</dd></div></dl>}
                          <ImageOnlyEvidence simple={simple} ordinal={index + 1} findingId={finding.id} host={host} sessionId={sessionId} onSelectFinding={(id) => onEvidence(id, [id], "relation")} />
                        </> : null}
                        {finding.extra_finding === "REUSED_AD_CREATIVE" ? image ?
                          <figure className="visual-evidence">
                            <AssetImage host={host} sessionId={sessionId} assetId={image.assetId} alt="수집한 광고 이미지" width={image.width} height={image.height} />
                            <figcaption>수집한 이미지 · {image.width} × {image.height}</figcaption>
                          </figure>
                          : <p>수집한 이미지가 없습니다.</p> : null}
                        {!simple || finding.extra_finding !== "IMAGE_ONLY_ILLEGAL_AD" || finding.url !== result.meta.entry_url ? <dl>
                          <div><dt>관련 주소</dt><dd>{finding.url}</dd></div>
                        </dl> : null}
                        {!simple ? <details className="advanced"><summary>기술 정보</summary><p>위치: <code>{finding.location}</code></p>
                          {finding.extra_finding !== "IMAGE_ONLY_ILLEGAL_AD" ? <p>{finding.evidence_text}</p> : null}
                        </details> : null}
                        {!simple && image ? <EvidenceRelations host={host} sessionId={sessionId} focus={{ kind: "creative", id: image.sha256 }} onSelectFinding={(id) => onEvidence(id, [id], "relation")} /> : null}
                      </li>; })}
                    </ol>
                  </>}
            {simple && hasImageCandidates ? <p className="hint">각 후보의 이미지 근거를 열어 확인하세요. 전체 이미지 분석 기록은 고급 모드에서 볼 수 있습니다.</p>
              : <ImageAnalysisList simple={simple} host={host} sessionId={sessionId} images={evidenceSummary?.creativeImages ?? []} onSelectFinding={(id) => onEvidence(id, [id], "relation")} />}
          </div>
        ) : view === "coverage" ? (
          <div className="coverage-summary">
            {!detailLoaded ? <p role="status">점검 범위를 불러오는 중입니다.</p>
              : detailLoadError ? <div><p role="alert" className="error">점검 범위를 불러오지 못했습니다.</p><button type="button" className="secondary" onClick={coverageRead.retry}>점검 범위 다시 불러오기</button></div>
                : detailBundle ? <>
              <p>확인한 페이지 {String(detailBundle.coverage.checkedPages)}개 · 실패한 페이지 {String(detailBundle.coverage.failedPages.length)}개</p>
              {collectionLimited.length ? <div role="status">
                <p>수집·보관 제한이 기록된 페이지 {collectionLimited.length}개. 탐지 0건이 전체 내용의 정상 판정을 뜻하지 않습니다.</p>
                <ul aria-label="수집·보관 제한">{collectionLimited.map((page) => <li key={page.url}>
                  {page.url} — {page.collectionIssues!.join(", ")}
                </li>)}</ul>
                {collectionLimited.some(page => page.collectionIssues?.some(issue => issue === "html-snapshot-truncated" || issue === "frame-snapshot-truncated")) ? <p>보관용 HTML 사본이 일부 생략됐습니다. 사본 수집 전에 실행한 실시간 탐지의 실패를 뜻하지 않습니다.</p> : null}
              </div> : null}
              {detailBundle.pageOutcomes.some((page) => page.issue) ? <ul aria-label="접근 및 점검 제한">{detailBundle.pageOutcomes.filter((page) => page.issue).map((page) => <li key={page.url}>
                {page.url} — {scanIssueLabel[page.issue!.kind]}{page.issue!.retryable ? " · 재시도 가능 (다음 점검에서 다시 확인)" : ""}{page.issue!.retryAfterMs !== undefined ? ` · 서버 대기 시간 ${page.issue!.retryAfterMs / 1000}초 이내 적용` : ""}
              </li>)}</ul> : null}
              {detailBundle.coverage.timedOut ? <p role="status">제한 시간에 도달해 일부 페이지를 확인하지 못했습니다.</p> : null}
              {detailBundle.coverage.failedPages.length > 0 ? <ul>{detailBundle.coverage.failedPages.map((page) => <li key={page.url}>{page.url} — {page.status === 0 ? "연결 또는 분석 실패" : `접근 실패 (HTTP ${String(page.status)})`}</li>)}</ul>
                : <p>확인에 실패한 페이지가 없습니다.</p>}
            </> : <div><p role="status" className="empty">이 결과에 저장된 점검 범위 기록이 없습니다.</p></div>}
          </div>
        ) : null}

      </section>
      </div>
      {result ? <details className="advanced"><summary>검토 표시와 저장 안내</summary><p>검토 완료는 읽고 검토했다는 표시이며 위반 확정이나 조치 완료가 아닙니다. 공식 탐지와 원본 파일은 바뀌지 않습니다. 검토 표시·판단·메모는 케이스에 별도로 저장됩니다. 화면 위의 저장 상태를 확인한 뒤 앱을 닫아 주세요. 엑셀 보고서는 검색·필터와 관계없이 전체 기록과 현재 검토 메모를 저장합니다.</p></details> : null}
      <div className="actions">
        <button type="button" onClick={onRestart} className="secondary">
          {restartLabel}
        </button>
      </div>
    </main>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import type { HostBridge, OperatorJudgment } from "@krds-detector/contracts";
import { techniqueLabel } from "@krds-detector/contracts";
import { AssetImage } from "./AssetImage.js";
import { EvidenceRelations } from "./EvidenceRelations.js";
import { useEvidenceRead } from "./evidence-read.js";

interface Props {
  host: HostBridge;
  sessionId: string;
  findingId: string;
  onBack: () => void;
  reviewed: boolean;
  onReviewChange: (reviewed: boolean) => void;
  contextIds?: string[];
  onSelectFinding?: (id: string) => void;
  note?: string;
  onNoteChange?: (value: string) => void;
  judgment?: OperatorJudgment;
  onJudgmentChange?: (value: OperatorJudgment) => void;
}

/** Result-stage inspector backed by the official finding's observed fields. */
export function EvidenceView(props: Props) {
  return <EvidenceInspector key={`${props.sessionId}\0${props.findingId}`} {...props} />;
}

function EvidenceInspector({ host, sessionId, findingId, onBack, reviewed, onReviewChange, contextIds = [findingId], onSelectFinding, note = "", onNoteChange, judgment = "unjudged", onJudgmentChange }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const readFinding = useCallback(async () => (await host.getOfficialResult(sessionId))?.findings.find((finding) => finding.id === findingId), [host, sessionId, findingId]);
  const readDetail = useCallback(() => host.getFindingDetail(sessionId, findingId), [host, sessionId, findingId]);
  const findingRead = useEvidenceRead(`${sessionId}\0${findingId}`, readFinding, true, headingRef);
  const detailRead = useEvidenceRead(`${sessionId}\0${findingId}`, readDetail, true, headingRef);
  const finding = findingRead.value;
  const detail = detailRead.value;
  const detailLoaded = detailRead.state !== "loading";
  const missing = findingRead.state === "unavailable";
  const [demoMode, setDemoMode] = useState(false);
  const [showPosition, setShowPosition] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => { headingRef.current?.focus(); setShowPosition(false); }, [findingId]);

  useEffect(() => {
    let alive = true;
    void host.getCapabilities().then((caps) => { if (alive) setDemoMode(!caps.localScan); }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [host, sessionId, findingId]);

  return (
    <aside className="page result-inspector" aria-label="탐지 상세">
      <div className="inspector-toolbar">
        <button type="button" onClick={onBack} className="secondary">결과 목록으로</button>
        {finding ? <button type="button" onClick={() => onReviewChange(!reviewed)} className="primary">
          {reviewed ? "검토 완료 취소" : "검토 완료로 표시"}
        </button> : null}
      </div>
      <h1 ref={headingRef} tabIndex={-1}>탐지 상세</h1>
      <p>현재 검토 범위 {Math.max(0, contextIds.indexOf(findingId)) + 1} / {contextIds.length}건 · 기록 {findingId}</p>
      {onSelectFinding && contextIds.length > 1 ? <nav className="actions" aria-label="검토 기록 이동">
        <button className="secondary" type="button" disabled={contextIds.indexOf(findingId) <= 0} onClick={() => onSelectFinding(contextIds[contextIds.indexOf(findingId) - 1]!)}>이전 기록</button>
        <button className="secondary" type="button" disabled={contextIds.indexOf(findingId) >= contextIds.length - 1} onClick={() => onSelectFinding(contextIds[contextIds.indexOf(findingId) + 1]!)}>다음 기록</button>
      </nav> : null}
      {demoMode ? <p role="note" className="empty">브라우저 미리보기의 예시 근거입니다. 실제 사이트 점검 결과가 아닙니다.</p> : null}
      {findingRead.state === "error" ? <div><p role="alert">탐지 내용을 불러오지 못했습니다.</p><button type="button" className="secondary" onClick={findingRead.retry}>탐지 내용 다시 불러오기</button></div> : missing ? (
        <p role="alert" className="error">
          해당 탐지를 찾을 수 없습니다. 결과 목록으로 돌아가 다시 선택해
          주세요.
        </p>
      ) : !finding ? (
        <p role="status">근거를 불러오는 중입니다…</p>
      ) : (
        <>
          <section aria-label="탐지 내용">
            <h2>탐지 내용</h2>
            <dl className="evidence">
              <div>
                <dt>페이지</dt>
                <dd>{finding.url}</dd>
              </div>
              <div>
                <dt>유형</dt>
                <dd>
                  <span className="badge">{techniqueLabel[finding.technique]}</span>
                </dd>
              </div>
              <div>
                <dt>원문</dt>
                <dd className="raw">{finding.evidence_text}</dd>
              </div>
            </dl>
          </section>
          <section aria-label="판단 근거">
            <h2>판단 근거</h2>
            {!detailLoaded ? <p role="status">판단 근거를 불러오는 중입니다.</p> : detailRead.state === "error" ? <div><p role="alert">저장된 판단 근거를 불러오지 못했습니다. 공식 탐지 내용은 유지됩니다.</p><button type="button" className="secondary" onClick={detailRead.retry}>판단 근거 다시 불러오기</button></div> : detail ? <dl className="evidence">
              {detail.matchedTerms.length > 0 ? <div><dt>광고 표현</dt><dd>{detail.matchedTerms.join(", ")}</dd></div> : null}
              {detail.destinationUrl ? <div><dt>연결 주소</dt><dd>{detail.destinationUrl}</dd></div> : null}
              {finding.technique === "HOMOGLYPH" || finding.technique === "JAMO" ?
                <div><dt>변환된 문구</dt><dd className="normalized">{detail.normalizedText}</dd></div> : null}
              {finding.technique === "OFFSCREEN" ? <div>
                <dt>{finding.location.includes(">>>") ? "프레임 화면 기준 위치" : "페이지 화면 기준 위치"}</dt>
                <dd>가로 {String(Math.round(detail.observed.box.x))}px · 세로 {String(Math.round(detail.observed.box.y))}px</dd>
              </div> : null}
              {detail.textPolicy?.techniqueSpans.length ? <div><dt>원문에서 복원한 부분</dt><dd>{detail.textPolicy.techniqueSpans.map((span) => span.raw).join(" · ")}</dd></div> : null}
              {detail.textPolicy ? <div><dt>관측과 판단</dt><dd>{detail.textPolicy.reasonCodes.includes("AD_OFFER") ? "가입·신청·지급 등 광고 유도 표현을 관측했습니다. " : "광고 관련 범주 표현을 관측했습니다. "}
                {detail.textPolicy.reasonCodes.includes("OBSERVED_DESTINATION_PATTERN") ? "광고 관련 링크 주소 패턴도 기록했습니다. 연결 대상을 방문하거나 최종 도착지를 확인하지 않았습니다. " : "연결 대상이나 실제 거래는 확인하지 않았습니다. "}자동 탐지는 검토 대상이며 법적 위반 확정이 아닙니다.</dd></div> : null}
              {detail.observed.renderingIssues?.length ? <div><dt>확인하지 못한 화면 조건</dt><dd>{detail.observed.renderingIssues.join(" · ")}</dd></div> : null}
            </dl> : <p className="empty">이 결과에 저장된 상세 판단 기록이 없습니다.</p>}
          </section>
          {detail ? <section aria-label="실제 화면">
            <h2>실제 화면</h2>
            {detail?.visual.state === "available" && detail.visual.assetId ? (
              <>
                {detail.visual.target?.state === "available" ? <button type="button" className="secondary"
                  aria-pressed={showPosition} onClick={() => setShowPosition(!showPosition)}>분석 위치 표시</button> : null}
                <figure className="visual-evidence">
                  <div className="visual-evidence-stage">
                    <AssetImage host={host} sessionId={sessionId} assetId={detail.visual.assetId} alt="탐지 당시 페이지의 실제 화면" />
                    {showPosition && detail.visual.target?.state === "available" && detail.visual.viewport ?
                      <svg className="visual-evidence-overlay" viewBox={`0 0 ${String(detail.visual.viewport.width)} ${String(detail.visual.viewport.height)}`}
                        role="img" aria-label="측정한 요소 위치의 분석 표시">
                        <rect x={detail.visual.target.box.x} y={detail.visual.target.box.y}
                          width={detail.visual.target.box.width} height={detail.visual.target.box.height} />
                      </svg> : null}
                  </div>
                  <figcaption>촬영 시각 {detail.visual.capturedAt} · 화면 크기 {detail.visual.viewport?.width}×{detail.visual.viewport?.height}</figcaption>
                </figure>
                {showPosition ? <p>분석 표시{detail.visual.element?.state === "unavailable" && detail.visual.element.reason === "outside-viewport"
                  ? " · 캡처 화면 밖 위치" : ""} · {finding.evidence_text}</p> : null}
                {detail.visual.element?.state === "available" ? <figure className="visual-evidence">
                  <AssetImage host={host} sessionId={sessionId} assetId={detail.visual.element.assetId} alt="탐지 요소 위치의 실제 화면 캡처" />
                  <figcaption>요소 위치 캡처 · {detail.visual.element.box.width}×{detail.visual.element.box.height}px</figcaption>
                </figure> : <p className="hint">요소 캡처 없음{detail.visual.element?.reason === "outside-viewport" ? " (화면 밖 위치)"
                  : detail.visual.element?.reason === "budget" ? " (시간·용량 제한)"
                    : detail.visual.element?.reason === "target-unavailable" ? " (요소 위치 확인 불가)" : " (캡처 실패)"}</p>}
              </>
            ) : <p className="empty">화면 캡처 없음{detail?.visual.reason === "budget" ? " (시간·용량 제한)" : detail?.visual.reason === "capture-error" ? " (캡처 실패)" : ""}</p>}
          </section> : <p className="hint">화면 캡처 없음 (이 세션에 저장된 상세 근거 기록이 없습니다). 원문과 요소 위치는 공식 기록에서 확인할 수 있습니다.</p>}
          <button type="button" className="secondary" onClick={() => void navigator.clipboard.writeText(`${finding.url}\n${finding.location}`).then(() => setCopyStatus("페이지와 위치를 복사했습니다."), () => setCopyStatus("복사하지 못했습니다. 페이지와 위치를 직접 선택해 복사해 주세요."))}>페이지와 위치 복사</button>
          {copyStatus ? <p role="status">{copyStatus}</p> : null}
          <EvidenceRelations key={findingId} host={host} sessionId={sessionId} focus={{ kind: "finding", id: findingId }} onSelectFinding={onSelectFinding} />
          <details className="advanced"><summary>기술 정보</summary>
            <dl className="evidence"><div><dt>위치</dt><dd><code>{finding.location}</code></dd></div>
              <div><dt>공식 기법 코드</dt><dd><code>{finding.technique}</code></dd></div>
              {detail ? <><div><dt>판단 신호</dt><dd>{detail.techniqueReason}</dd></div>
                <div><dt>계산된 CSS</dt><dd><code>{JSON.stringify(detail.observed.css)}</code></dd></div>
                <div><dt>요소 사각형 (페이지·프레임 화면 기준)</dt><dd><code>{JSON.stringify(detail.observed.box)}</code></dd></div></> : null}
              {detail?.textPolicy ? <><div><dt>텍스트 정책</dt><dd>{detail.textPolicy.version} · {detail.textPolicy.reasonCodes.join(", ")}</dd></div>
                <div><dt>원문 구간 정렬</dt><dd>{detail.textPolicy.alignment === "exact" ? "원본 소유 텍스트 구간과 정확히 대응" : "정렬 확인 불가"}{detail.textPolicy.truncated ? " · 일부만 분석" : ""}</dd></div></> : null}
            </dl>
          </details>
        </>
      )}
      {onNoteChange && finding ? <div className="review-note"><label htmlFor="review-note">검토 메모</label>
        <textarea id="review-note" rows={4} maxLength={2000} value={note} onChange={(e) => onNoteChange(e.target.value)} aria-describedby="review-note-hint" />
        <p id="review-note-hint" className="hint">검토 기록 저장 상태를 확인해 주세요. 저장된 메모는 케이스를 다시 열 때 복원되며 엑셀 보고서에 포함됩니다. 브라우저 미리보기는 영구 저장되지 않습니다.</p>
      </div> : null}
      {finding && onJudgmentChange ? <div><label htmlFor="operator-judgment">담당자의 판단</label><select id="operator-judgment" value={judgment} onChange={(event) => {
        const value = event.target.value;
        if (value === "unjudged" || value === "suspected" || value === "judged-normal" || value === "needs-more-evidence") onJudgmentChange(value);
      }}><option value="unjudged">판단 전</option><option value="suspected">위반 의심</option><option value="judged-normal">정상으로 판단</option><option value="needs-more-evidence">추가 근거 필요</option></select></div> : null}
      <p className="hint">검토 완료는 항목을 읽었다는 표시입니다. 담당자의 판단·메모와 구분되며 공식 원본 결과를 바꾸지 않습니다. 위반 확정이나 조치 완료를 뜻하지 않습니다.</p>
    </aside>
  );
}

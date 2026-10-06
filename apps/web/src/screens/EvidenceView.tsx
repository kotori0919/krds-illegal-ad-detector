import { useEffect, useRef, useState } from "react";
import type { FindingDetail, HostBridge, OfficialFinding } from "@krds-detector/contracts";
import { techniqueLabel } from "../technique-label.js";

interface Props {
  host: HostBridge;
  sessionId: string;
  findingId: string;
  onBack: () => void;
  reviewed: boolean;
  onReviewChange: (reviewed: boolean) => void;
}

/** Result-stage inspector backed by the official finding's observed fields. */
export function EvidenceView({ host, sessionId, findingId, onBack, reviewed, onReviewChange }: Props) {
  const [finding, setFinding] = useState<OfficialFinding | undefined>(undefined);
  const [detail, setDetail] = useState<FindingDetail | undefined>(undefined);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [showPosition, setShowPosition] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { headingRef.current?.focus(); setShowPosition(false); }, [findingId]);

  useEffect(() => {
    let alive = true;
    void host.getCapabilities().then((caps) => { if (alive) setDemoMode(!caps.localScan); }).catch(() => undefined);
    host.getOfficialResult(sessionId).then((r) => {
      if (!alive) return;
      const found = r?.findings.find((f) => f.id === findingId);
      if (found) setFinding(found);
      else setMissing(true);
    }).catch(() => { if (alive) setMissing(true); });
    host.getDetailBundle(sessionId).then((bundle) => {
      if (alive) setDetail(bundle?.findings.find((item) => item.findingId === findingId));
    }).catch(() => undefined).finally(() => { if (alive) setDetailLoaded(true); });
    return () => {
      alive = false;
    };
  }, [host, sessionId, findingId]);

  return (
    <aside className="page result-inspector" aria-label="탐지 상세">
      <p className="eyebrow">결과 검토</p>
      <h1 ref={headingRef} tabIndex={-1}>탐지 상세</h1>
      {demoMode ? <p role="note" className="empty">브라우저 미리보기의 예시 근거입니다. 실제 사이트 점검 결과가 아닙니다.</p> : null}
      {missing ? (
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
            {!detailLoaded ? <p role="status">판단 근거를 불러오는 중입니다.</p> : detail ? <dl className="evidence">
              {detail.matchedTerms.length > 0 ? <div><dt>광고 표현</dt><dd>{detail.matchedTerms.join(", ")}</dd></div> : null}
              {detail.destinationUrl ? <div><dt>연결 주소</dt><dd>{detail.destinationUrl}</dd></div> : null}
              {finding.technique === "HOMOGLYPH" || finding.technique === "JAMO" ?
                <div><dt>변환된 문구</dt><dd className="normalized">{detail.normalizedText}</dd></div> : null}
              {finding.technique === "OFFSCREEN" ? <div>
                <dt>{finding.location.includes(">>>") ? "프레임 화면 기준 위치" : "페이지 화면 기준 위치"}</dt>
                <dd>가로 {String(Math.round(detail.observed.box.x))}px · 세로 {String(Math.round(detail.observed.box.y))}px</dd>
              </div> : null}
            </dl> : <p className="empty">상세 판단 기록 없음</p>}
          </section>
          {detailLoaded ? <section aria-label="실제 화면">
            <h2>실제 화면</h2>
            {detail?.visual.state === "available" && detail.visual.dataUrl ? (
              <>
                {detail.visual.target?.state === "available" ? <button type="button" className="secondary"
                  aria-pressed={showPosition} onClick={() => setShowPosition(!showPosition)}>분석 위치 표시</button> : null}
                <figure className="visual-evidence">
                  <div className="visual-evidence-stage">
                    <img src={detail.visual.dataUrl} alt="탐지 당시 페이지의 실제 화면" />
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
                  <img src={detail.visual.element.dataUrl} alt="탐지 요소 위치의 실제 화면 캡처" />
                  <figcaption>요소 위치 캡처 · {detail.visual.element.box.width}×{detail.visual.element.box.height}px</figcaption>
                </figure> : <p className="hint">요소 캡처 없음{detail.visual.element?.reason === "outside-viewport" ? " (화면 밖 위치)"
                  : detail.visual.element?.reason === "budget" ? " (시간·용량 제한)"
                    : detail.visual.element?.reason === "target-unavailable" ? " (요소 위치 확인 불가)" : " (캡처 실패)"}</p>}
              </>
            ) : <p className="empty">화면 캡처 없음{detail?.visual.reason === "budget" ? " (시간·용량 제한)" : detail?.visual.reason === "capture-error" ? " (캡처 실패)" : ""}</p>}
          </section> : null}
          <details className="advanced"><summary>기술 정보</summary>
            <dl className="evidence"><div><dt>위치</dt><dd><code>{finding.location}</code></dd></div>
              <div><dt>공식 기법 코드</dt><dd><code>{finding.technique}</code></dd></div>
              {detail ? <><div><dt>판단 신호</dt><dd>{detail.techniqueReason}</dd></div>
                <div><dt>계산된 CSS</dt><dd><code>{JSON.stringify(detail.observed.css)}</code></dd></div>
                <div><dt>요소 사각형 (페이지·프레임 화면 기준)</dt><dd><code>{JSON.stringify(detail.observed.box)}</code></dd></div></> : null}
            </dl>
          </details>
        </>
      )}
      <div className="actions">
        {finding ? <button type="button" onClick={() => onReviewChange(!reviewed)} className="primary">
          {reviewed ? "검토 완료 취소" : "검토 완료로 표시"}
        </button> : null}{" "}
        <button type="button" onClick={onBack} className="secondary">
          결과 목록으로
        </button>
      </div>
    </aside>
  );
}

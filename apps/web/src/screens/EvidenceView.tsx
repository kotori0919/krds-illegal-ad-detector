import { useEffect, useRef, useState } from "react";
import type { FindingDetail, HostBridge, OfficialFinding } from "@krds-detector/contracts";
import { techniqueExplanation, techniqueLabel } from "../technique-label.js";

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
  const [missing, setMissing] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { headingRef.current?.focus(); }, [findingId]);

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
    }).catch(() => undefined);
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
          <section aria-label="발견 내용">
            <h2>무엇을 발견했나요?</h2>
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
                <dt>확인된 원문</dt>
                <dd className="raw">{finding.evidence_text}</dd>
              </div>
            </dl>
          </section>
          <section aria-label="판단 설명">
            <h2>왜 문제인가요?</h2>
            <p>{techniqueExplanation[finding.technique]}</p>
            {detail ? <p>광고 표현 근거: {detail.matchedTerms.length > 0 ? detail.matchedTerms.join(", ") : "연결 주소"}</p>
              : <p>상세 판단 기록을 사용할 수 없습니다. 공식 결과의 원문과 위치를 확인해 주세요.</p>}
          </section>
          <section aria-label="실제 화면">
            <h2>실제 화면</h2>
            {detail?.visual.state === "available" && detail.visual.dataUrl ? (
              <figure className="visual-evidence"><img src={detail.visual.dataUrl} alt="탐지 당시 페이지의 실제 화면" />
                <figcaption>점검 당시 페이지 화면 · {detail.visual.capturedAt} · 화면 크기 {detail.visual.viewport?.width}×{detail.visual.viewport?.height}. 숨겨진 글자는 화면에 보이지 않을 수 있으며 위치와 CSS 수치를 함께 확인해야 합니다.</figcaption></figure>
            ) : <p className="empty">이 결과에는 화면 캡처가 없습니다{detail?.visual.reason === "budget" ? " (시간 또는 용량 제한)" : detail?.visual.reason === "capture-error" ? " (캡처 실패)" : ""}. 원문과 위치 정보로 확인해 주세요.</p>}
          </section>
          <details className="advanced"><summary>기술 정보</summary>
            <dl className="evidence"><div><dt>위치</dt><dd><code>{finding.location}</code></dd></div>
              <div><dt>공식 기법 코드</dt><dd><code>{finding.technique}</code></dd></div>
              {detail ? <><div><dt>정규화한 문장</dt><dd>{detail.normalizedText}</dd></div>
                <div><dt>판단 신호</dt><dd>{detail.techniqueReason}</dd></div>
                <div><dt>계산된 CSS</dt><dd><code>{JSON.stringify(detail.observed.css)}</code></dd></div>
                <div><dt>화면 내 위치</dt><dd><code>{JSON.stringify(detail.observed.box)}</code></dd></div></> : null}
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

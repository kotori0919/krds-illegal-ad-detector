import { useEffect, useState } from "react";
import type { HostBridge, OfficialFinding } from "@krds-detector/contracts";

interface Props {
  host: HostBridge;
  sessionId: string;
  findingId: string;
  onBack: () => void;
  onExport: () => void;
}

/** Screen 4: 탐지 근거. Observed / derived / inference layers stay separate. */
export function EvidenceView({ host, sessionId, findingId, onBack, onExport }: Props) {
  const [finding, setFinding] = useState<OfficialFinding | undefined>(undefined);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    host.getOfficialResult(sessionId).then((r) => {
      if (!alive) return;
      const found = r?.findings.find((f) => f.id === findingId);
      if (found) setFinding(found);
      else setMissing(true);
    });
    return () => {
      alive = false;
    };
  }, [host, sessionId, findingId]);

  if (missing || (!finding && typeof window !== "undefined")) {
    // Render loading first; missing only after fetch resolves.
  }

  return (
    <main className="page">
      <p className="eyebrow">판단 근거</p>
      <h1>탐지 근거</h1>
      {missing ? (
        <p role="alert" className="error">
          해당 탐지를 찾을 수 없습니다. 결과 목록으로 돌아가 다시 선택해
          주세요.
        </p>
      ) : !finding ? (
        <p role="status">근거를 불러오는 중입니다…</p>
      ) : (
        <>
          <section aria-label="관찰된 증거">
            <h2>관찰된 증거</h2>
            <dl className="evidence">
              <div>
                <dt>페이지</dt>
                <dd>{finding.url}</dd>
              </div>
              <div>
                <dt>위치 (선택자)</dt>
                <dd>
                  <code>{finding.location}</code>
                </dd>
              </div>
              <div>
                <dt>기법</dt>
                <dd>
                  <span className="badge">{finding.technique}</span>
                </dd>
              </div>
              <div>
                <dt>증거 원문 (정규화 전)</dt>
                <dd className="raw">{finding.evidence_text}</dd>
              </div>
            </dl>
          </section>
          <section aria-label="도출된 정보">
            <h2>도출된 정보</h2>
            <p className="hint">
              정규화 텍스트·스크린샷·OCR·연관 인프라는 데스크톱 앱에서
              수집됩니다. 미리보기에서는 원문과 위치 정보만 제공합니다.
            </p>
            <dl className="evidence">
              <div>
                <dt>정규화 텍스트</dt>
                <dd>데스크톱 앱에서 확인</dd>
              </div>
              <div>
                <dt>CSS / 크기</dt>
                <dd>데스크톱 앱에서 확인</dd>
              </div>
              <div>
                <dt>iframe 경로</dt>
                <dd>
                  <code>{finding.location.includes(">>>") ? finding.location : "(없음 — 최상위 문서)"}</code>
                </dd>
              </div>
            </dl>
          </section>
          <section aria-label="추론">
            <h2>추론 (보조 판단)</h2>
            <p className="hint">
              추론 결과는 관찰된 증거가 아닙니다. 확정 판정은 두 축 증거
              (은폐 기법 + 불법광고 의미)가 모두 있을 때만 내려집니다.
            </p>
            <p>미리보기 데모에는 추론 결과가 없습니다.</p>
          </section>
        </>
      )}
      <div className="actions">
        <button type="button" onClick={onBack} className="secondary">
          결과 목록으로
        </button>{" "}
        <button type="button" onClick={onExport} className="primary">
          검증 및 내보내기
        </button>
      </div>
    </main>
  );
}

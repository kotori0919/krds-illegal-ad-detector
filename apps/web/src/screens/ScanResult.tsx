import { useEffect, useMemo, useState } from "react";
import {
  OFFICIAL_TECHNIQUES,
  type HostBridge,
  type OfficialResult,
  type OfficialTechnique,
  type ScanSession,
} from "@krds-detector/contracts";

interface Props {
  host: HostBridge;
  sessionId: string;
  onEvidence: (findingId: string) => void;
  onExport: () => void;
  onRestart: () => void;
}

type TechniqueFilter = OfficialTechnique | "ALL";

export function ScanResult({ host, sessionId, onEvidence, onExport, onRestart }: Props) {
  const [session, setSession] = useState<ScanSession | undefined>(undefined);
  const [result, setResult] = useState<OfficialResult | undefined>(undefined);
  const [filter, setFilter] = useState<TechniqueFilter>("ALL");

  useEffect(() => {
    let alive = true;
    host.getSession(sessionId).then((s) => {
      if (alive) setSession(s);
    });
    host.getOfficialResult(sessionId).then((r) => {
      if (alive) setResult(r);
    });
    return () => {
      alive = false;
    };
  }, [host, sessionId]);

  // A cancelled session never produces a result: send the evaluator back to
  // the start screen instead of stranding them on an empty result list
  // (OBSERVED on VM: cancel landed on `상태: crawling` with zero rows).
  if (session?.status === "cancelled") {
    return (
      <main className="page">
        <p className="eyebrow">검사 결과</p>
        <h1>탐지 결과</h1>
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

  const findings = result?.findings ?? [];
  const counts = useMemo(() => {
    const map = new Map<OfficialTechnique, number>();
    for (const t of OFFICIAL_TECHNIQUES) map.set(t, 0);
    for (const f of findings) map.set(f.technique, (map.get(f.technique) ?? 0) + 1);
    return map;
  }, [findings]);
  const visible = filter === "ALL" ? findings : findings.filter((f) => f.technique === filter);

  return (
    <main className="page">
      <p className="eyebrow">검사 결과</p>
      <h1>탐지 결과</h1>
      <p className="lede">
        세션 <code>{sessionId}</code>
        {session ? ` · 상태: ${session.status}` : null}
        {result ? ` · 총 ${String(result.findings.length)}건` : null}
      </p>
      {result ? (
        <section aria-label="기법별 건수">
          <ul className="counts">
            {OFFICIAL_TECHNIQUES.map((t) => (
              <li key={t}>
                <span>{t}</span> <strong>{counts.get(t) ?? 0}건</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-label="탐지 목록">
        <div className="toolbar">
          <label htmlFor="technique-filter">기법 필터</label>
          <select
            id="technique-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as TechniqueFilter)}
          >
            <option value="ALL">전체</option>
            {OFFICIAL_TECHNIQUES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        {findings.length === 0 ? (
          <p role="status" className="empty">
            확정된 탐지가 없습니다. 탐지가 끝난 뒤에도 비어 있다면 검사
            범위를 넓히거나 시작 주소를 확인해 주세요.
          </p>
        ) : visible.length === 0 ? (
          <p role="status" className="empty">
            선택한 기법에 해당하는 탐지가 없습니다. 필터를 바꿔 보세요.
          </p>
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
                    <span className="badge">{f.technique}</span>
                  </td>
                  <td>{f.evidence_text}</td>
                  <td>
                    <button type="button" onClick={() => onEvidence(f.id)} className="linklike">
                      근거 보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <div className="actions">
        <button type="button" onClick={onExport} className="primary" disabled={findings.length === 0 && !result}>
          검증 및 내보내기
        </button>{" "}
        <button type="button" onClick={onRestart} className="secondary">
          새로 검사하기
        </button>
      </div>
    </main>
  );
}

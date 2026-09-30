import { useEffect, useState } from "react";
import type {
  HostBridge,
  OfficialResult,
  ScanSession,
} from "@krds-detector/contracts";

interface Props {
  host: HostBridge;
  sessionId: string;
  onRestart: () => void;
}

export function ScanResult({ host, sessionId, onRestart }: Props) {
  const [session, setSession] = useState<ScanSession | undefined>(undefined);
  const [result, setResult] = useState<OfficialResult | undefined>(undefined);

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

  const findings = result?.findings ?? [];

  return (
    <main className="page">
      <h1>탐지 결과</h1>
      <p>
        세션 <code>{sessionId}</code>
        {session ? ` · 상태: ${session.status}` : null}
      </p>
      {findings.length === 0 ? (
        <p role="status">
          브라우저 미리보기에는 확정된 탐지가 없습니다. 실제 탐지 결과는
          데스크톱 앱에서 확인하고 result.json으로 내보냅니다.
        </p>
      ) : (
        <table>
          <caption>확정된 탐지 목록</caption>
          <thead>
            <tr>
              <th scope="col">페이지</th>
              <th scope="col">위치</th>
              <th scope="col">기법</th>
              <th scope="col">증거 원문</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((f) => (
              <tr key={f.id}>
                <td>{f.url}</td>
                <td>
                  <code>{f.location}</code>
                </td>
                <td>{f.technique}</td>
                <td>{f.evidence_text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" onClick={onRestart}>
        새로 검사하기
      </button>
    </main>
  );
}

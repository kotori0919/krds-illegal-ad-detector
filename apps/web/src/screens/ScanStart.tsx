import { useState, type FormEvent } from "react";
import type { HostBridge } from "@krds-detector/contracts";

interface Props {
  host: HostBridge;
  onStarted: (sessionId: string) => void;
}

export function ScanStart({ host, onStarted }: Props) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const entryUrl = url.trim();
    if (!entryUrl) {
      setError("검사할 웹사이트 주소를 입력해 주세요.");
      return;
    }
    try {
      void new URL(entryUrl);
    } catch {
      setError("http(s)로 시작하는 올바른 주소를 입력해 주세요.");
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const session = await host.startScan({ entryUrl });
      onStarted(session.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "탐지를 시작하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <h1>불법광고 탐지 도구</h1>
      <p>
        공공 웹사이트의 숨겨진 불법광고를 검사합니다. 검사할 웹사이트 첫
        주소를 입력하면 관련 하위 페이지를 수집하고 4가지 공식 은폐 기법을
        판별합니다.
      </p>
      <form onSubmit={onSubmit} aria-label="탐지 시작">
        <label htmlFor="entry-url">검사할 웹사이트 주소</label>
        <input
          id="entry-url"
          name="entry-url"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://example.kr/"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "entry-url-error" : undefined}
          required
        />
        {error ? (
          <p id="entry-url-error" role="alert" className="error">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy}>
          {busy ? "시작 중…" : "탐지 시작"}
        </button>
        <details>
          <summary>고급 설정</summary>
          <p>
            최대 페이지 수·탐색 깊이·제한 시간은 데스크톱 앱에서 조정합니다.
            브라우저 미리보기는 실제 스캔을 수행하지 않습니다.
          </p>
        </details>
      </form>
    </main>
  );
}

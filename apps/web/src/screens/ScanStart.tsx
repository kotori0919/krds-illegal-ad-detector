import { useState, type FormEvent } from "react";
import type { HostBridge } from "@krds-detector/contracts";

interface Props {
  host: HostBridge;
  onStarted: (sessionId: string) => void;
}

export function ScanStart({ host, onStarted }: Props) {
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [maxPages, setMaxPages] = useState("200");
  const [maxDepth, setMaxDepth] = useState("4");
  const [timeoutSec, setTimeoutSec] = useState("1500");
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const entryUrl = url.trim();
    if (!entryUrl) {
      setError("검사할 웹사이트 주소를 입력해 주세요.");
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(entryUrl);
    } catch {
      setError("http(s)로 시작하는 올바른 주소를 입력해 주세요.");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      setError("http(s)로 시작하는 올바른 주소를 입력해 주세요.");
      return;
    }
    const limits: Record<string, number> = {};
    const pages = Number.parseInt(maxPages, 10);
    const depth = Number.parseInt(maxDepth, 10);
    const timeout = Number.parseInt(timeoutSec, 10);
    if (!Number.isFinite(pages) || pages < 1 || pages > 2000) {
      setError("최대 페이지 수는 1부터 2000까지 입력해 주세요.");
      return;
    }
    if (!Number.isFinite(depth) || depth < 0 || depth > 10) {
      setError("탐색 깊이는 0부터 10까지 입력해 주세요.");
      return;
    }
    if (!Number.isFinite(timeout) || timeout < 60 || timeout > 1750) {
      setError("제한 시간은 60초부터 1750초까지 입력해 주세요.");
      return;
    }
    limits["maxPages"] = pages;
    limits["maxDepth"] = depth;
    limits["timeoutSec"] = timeout;
    setError(undefined);
    setBusy(true);
    try {
      const session = await host.startScan({
        entryUrl,
        topic: topic.trim() || undefined,
        limits,
      });
      onStarted(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "탐지를 시작하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <p className="eyebrow">공공 웹사이트 불법광고 탐지</p>
      <h1>탐지 시작</h1>
      <p className="lede">
        검사할 웹사이트 첫 주소를 입력하면 관련 하위 페이지를 수집하고
        게시글·댓글·iframe 내용을 검사하여 4가지 공식 은폐 기법을 판별합니다.
      </p>
      <form onSubmit={onSubmit} aria-label="탐지 시작" noValidate>
        <div className="field">
          <label htmlFor="entry-url">검사할 웹사이트 주소</label>
          <input
            id="entry-url"
            name="entry-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.kr/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "entry-url-error" : "scan-hint"}
            required
          />
          <p id="scan-hint" className="hint">
            하나의 시작 주소만 입력합니다. 같은 사이트 안의 하위 페이지는
            도구가 자동으로 수집합니다.
          </p>
        </div>
        <div className="field">
          <label htmlFor="scan-topic">주제 (선택)</label>
          <input
            id="scan-topic"
            name="scan-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="예: 2026년 10월 정기 점검"
          />
        </div>
        {error ? (
          <p id="entry-url-error" role="alert" className="error">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="primary">
          {busy ? "시작 중…" : "탐지 시작"}
        </button>
        <details className="advanced">
          <summary>고급 설정</summary>
          <div className="advanced-grid">
            <div className="field">
              <label htmlFor="limit-pages">최대 페이지 수</label>
              <input
                id="limit-pages"
                inputMode="numeric"
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="limit-depth">탐색 깊이</label>
              <input
                id="limit-depth"
                inputMode="numeric"
                value={maxDepth}
                onChange={(e) => setMaxDepth(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="limit-timeout">제한 시간(초)</label>
              <input
                id="limit-timeout"
                inputMode="numeric"
                value={timeoutSec}
                onChange={(e) => setTimeoutSec(e.target.value)}
              />
            </div>
          </div>
          <p className="hint">
            공식 제한 30분 안에 끝나도록 기본값은 1500초입니다. 브라우저
            미리보기에서는 실제 스캔을 수행하지 않습니다.
          </p>
        </details>
      </form>
    </main>
  );
}

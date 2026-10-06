import { useEffect, useRef, useState, type FormEvent } from "react";
import type { HostBridge } from "@krds-detector/contracts";

interface Props {
  host: HostBridge;
  onStarted: (sessionId: string) => void;
}

type FieldName = "url" | "maxPages" | "maxDepth" | "timeoutSec";
type ScopeMode = "automatic" | "quick" | "custom";

/** DOM order. The first entry carrying an error is the one focused on submit. */
const FIELD_ORDER: FieldName[] = ["url", "maxPages", "maxDepth", "timeoutSec"];

export function ScanStart({ host, onStarted }: Props) {
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [scopeMode, setScopeMode] = useState<ScopeMode>("automatic");
  const [maxPages, setMaxPages] = useState("200");
  const [maxDepth, setMaxDepth] = useState("4");
  const [timeoutSec, setTimeoutSec] = useState("1500");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const pagesRef = useRef<HTMLInputElement>(null);
  const depthRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<HTMLInputElement>(null);
  const advancedRef = useRef<HTMLDetailsElement>(null);

  // Focus the URL field on mount: evaluators (and automation) type
  // immediately without tab-hunting. Invalid-submit still refocuses via
  // focusFirstInvalid; this only sets the initial focus.
  useEffect(() => {
    urlRef.current?.focus();
  }, []);

  const FIELD_REFS: Record<FieldName, () => HTMLInputElement | null> = {
    url: () => urlRef.current,
    maxPages: () => pagesRef.current,
    maxDepth: () => depthRef.current,
    timeoutSec: () => timeoutRef.current,
  };

  /** Move focus to the first invalid field, opening 고급 설정 first if the target is hidden there. */
  function focusFirstInvalid(errors: Partial<Record<FieldName, string>>) {
    const target = FIELD_ORDER.find((f) => errors[f]);
    if (!target) return;
    if (target !== "url" && advancedRef.current && !advancedRef.current.open) {
      advancedRef.current.open = true;
    }
    FIELD_REFS[target]()?.focus();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const entryUrl = url.trim();
    const errors: Partial<Record<FieldName, string>> = {};
    if (!entryUrl) {
      errors.url = "검사할 웹사이트 주소를 입력해 주세요.";
    } else {
      let parsed: URL | undefined;
      try {
        parsed = new URL(entryUrl);
      } catch {
        parsed = undefined;
      }
      if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
        errors.url = "http(s)로 시작하는 올바른 주소를 입력해 주세요.";
      }
    }
    const pages = scopeMode === "quick" ? 50 : scopeMode === "automatic" ? 200 : Number.parseInt(maxPages, 10);
    const depth = scopeMode === "quick" ? 2 : scopeMode === "automatic" ? 4 : Number.parseInt(maxDepth, 10);
    const timeout = scopeMode === "quick" ? 600 : scopeMode === "automatic" ? 1500 : Number.parseInt(timeoutSec, 10);
    if (scopeMode === "custom" && (!Number.isFinite(pages) || pages < 1 || pages > 2000)) {
      errors.maxPages = "최대 페이지 수는 1부터 2000까지 입력해 주세요.";
    }
    if (scopeMode === "custom" && (!Number.isFinite(depth) || depth < 0 || depth > 10)) {
      errors.maxDepth = "탐색 깊이는 0부터 10까지 입력해 주세요.";
    }
    if (scopeMode === "custom" && (!Number.isFinite(timeout) || timeout < 60 || timeout > 1500)) {
      errors.timeoutSec = "60~1500초로 입력해 주세요.";
    }
    if (Object.keys(errors).length > 0) {
      setFormError(undefined);
      setFieldErrors(errors);
      focusFirstInvalid(errors);
      return;
    }
    const limits: Record<string, number> = {
      maxPages: pages,
      maxDepth: depth,
      timeoutSec: timeout,
    };
    setFieldErrors({});
    setFormError(undefined);
    setBusy(true);
    try {
      const session = await host.startScan({
        entryUrl,
        topic: topic.trim() || undefined,
        limits,
      });
      onStarted(session.id);
    } catch {
      // Not the user's URL text: report at form level so the URL input is not marked invalid.
      setFormError("점검을 시작하지 못했습니다. 앱을 다시 열고 시도해 주세요. 계속 실패하면 담당자에게 알려 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <p className="eyebrow">공공 웹사이트 불법광고 탐지</p>
      <h1>공공 웹사이트 점검</h1>
      <form onSubmit={onSubmit} aria-label="탐지 시작" noValidate>
        <div className="field">
          <label htmlFor="entry-url">점검할 웹사이트 <span className="required">필수</span></label>
          <input
            id="entry-url"
            name="entry-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.kr/"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (fieldErrors.url) {
                setFieldErrors((prev) => ({ ...prev, url: undefined }));
              }
            }}
            ref={urlRef}
            aria-invalid={fieldErrors.url ? true : undefined}
            aria-describedby={fieldErrors.url ? "entry-url-error" : "scan-hint"}
            required
          />
          <p id="scan-hint" className="hint">같은 사이트의 하위 페이지도 확인합니다. 기본 점검은 최대 25분입니다.</p>
          {fieldErrors.url ? (
            <p id="entry-url-error" role="alert" className="error">
              {fieldErrors.url}
            </p>
          ) : null}
        </div>
        {formError ? (
          <p id="scan-form-error" role="alert" className="error">
            {formError}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="primary">
          {busy ? "시작 중…" : "점검 시작"}
        </button>
        <details className="advanced" ref={advancedRef}>
          <summary>상세 설정</summary>
          <fieldset className="scope-options">
            <legend>점검 범위</legend>
            <label><input type="radio" name="scope-mode" value="automatic" checked={scopeMode === "automatic"} onChange={() => setScopeMode("automatic")} /> 자동 점검 — 최대 200페이지, 하위 4단계, 25분</label>
            <label><input type="radio" name="scope-mode" value="quick" checked={scopeMode === "quick"} onChange={() => setScopeMode("quick")} /> 빠른 점검 — 최대 50페이지, 하위 2단계, 10분</label>
            <label><input type="radio" name="scope-mode" value="custom" checked={scopeMode === "custom"} onChange={() => setScopeMode("custom")} /> 직접 설정</label>
          </fieldset>
          {scopeMode === "custom" ? <div className="advanced-grid">
            <div className="field">
              <label htmlFor="limit-pages">최대 페이지 수</label>
              <input
                id="limit-pages"
                ref={pagesRef}
                type="number"
                inputMode="numeric"
                min={1}
                max={2000}
                step={1}
                value={maxPages}
                onChange={(e) => {
                  setMaxPages(e.target.value);
                  if (fieldErrors.maxPages) {
                    setFieldErrors((prev) => ({ ...prev, maxPages: undefined }));
                  }
                }}
                aria-invalid={fieldErrors.maxPages ? true : undefined}
                aria-describedby={
                  fieldErrors.maxPages ? "limit-pages-error" : undefined
                }
              />
              {fieldErrors.maxPages ? (
                <p id="limit-pages-error" role="alert" className="error">
                  {fieldErrors.maxPages}
                </p>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="limit-depth">탐색 깊이</label>
              <input
                id="limit-depth"
                ref={depthRef}
                type="number"
                inputMode="numeric"
                min={0}
                max={10}
                step={1}
                value={maxDepth}
                onChange={(e) => {
                  setMaxDepth(e.target.value);
                  if (fieldErrors.maxDepth) {
                    setFieldErrors((prev) => ({ ...prev, maxDepth: undefined }));
                  }
                }}
                aria-invalid={fieldErrors.maxDepth ? true : undefined}
                aria-describedby={
                  fieldErrors.maxDepth ? "limit-depth-error" : undefined
                }
              />
              {fieldErrors.maxDepth ? (
                <p id="limit-depth-error" role="alert" className="error">
                  {fieldErrors.maxDepth}
                </p>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="limit-timeout">제한 시간(초)</label>
              <input
                id="limit-timeout"
                ref={timeoutRef}
                type="number"
                inputMode="numeric"
                min={60}
                max={1500}
                step={1}
                value={timeoutSec}
                onChange={(e) => {
                  setTimeoutSec(e.target.value);
                  if (fieldErrors.timeoutSec) {
                    setFieldErrors((prev) => ({ ...prev, timeoutSec: undefined }));
                  }
                }}
                aria-invalid={fieldErrors.timeoutSec ? true : undefined}
                aria-describedby={
                  fieldErrors.timeoutSec ? "limit-timeout-error" : undefined
                }
              />
              {fieldErrors.timeoutSec ? (
                <p id="limit-timeout-error" role="alert" className="error">
                  {fieldErrors.timeoutSec}
                </p>
              ) : null}
            </div>
          </div> : null}
          <div className="field">
            <label htmlFor="scan-topic">점검 주제 (선택)</label>
            <input id="scan-topic" name="scan-topic" type="text" value={topic}
              onChange={(e) => { setTopic(e.target.value); if (formError) setFormError(undefined); }}
              placeholder="예: 정기 점검" />
          </div>
        </details>
      </form>
    </main>
  );
}

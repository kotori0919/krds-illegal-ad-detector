import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  serializeOfficialResult,
  validateOfficialResultText,
  type HostBridge,
  type OfficialResult,
} from "@krds-detector/contracts";

interface Props {
  host: HostBridge;
  sessionId: string;
  onClose: () => void;
}

interface Check {
  label: string;
  passed: boolean;
  detail: string;
}

/** Results-workspace confirmation dialog. Validation failure blocks save. */
export function ExportDialog({ host, sessionId, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<OfficialResult | undefined>(undefined);
  const [checks, setChecks] = useState<Check[]>([]);
  const [jsonText, setJsonText] = useState("");
  const [exported, setExported] = useState<string | undefined>(undefined);
  const [exportError, setExportError] = useState<string | undefined>(undefined);

  useEffect(() => { dialogRef.current?.querySelector<HTMLElement>("h2")?.focus(); }, []);

  function onDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), summary, [tabindex='0']") ?? [])]
      .filter((control) => !control.closest("details:not([open])"));
    if (controls.length === 0) return;
    const first = controls[0]!;
    const last = controls[controls.length - 1]!;
    const title = dialogRef.current?.querySelector("h2");
    if (document.activeElement === title) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  useEffect(() => {
    let alive = true;
    host.getOfficialResult(sessionId).then((r) => {
      if (!alive) return;
      setResult(r);
      if (!r) {
        setChecks([
          { label: "결과 존재", passed: false, detail: "세션 결과가 없습니다." },
        ]);
        return;
      }
      const text = serializeOfficialResult(r);
      setJsonText(text);
      const verdict = validateOfficialResultText(text);
      const ids = new Set(r.findings.map((f) => f.id));
      const identity = new Set(r.findings.map((f) => `${f.url}\0${f.location}\0${f.technique}`));
      setChecks([
        {
          label: "스키마 (필수 fields, findings 배열)",
          passed: verdict.ok,
          detail: verdict.ok ? "meta/findings 구조가 유효합니다." : verdict.errors.join("; "),
        },
        {
          label: "UTF-8 / BOM 없음 / JSON 파싱",
          passed: verdict.ok || !verdict.errors.some((e) => e.includes("BOM") || e.includes("JSON")),
          detail: "직렬화 출력은 BOM 없이 생성됩니다.",
        },
        {
          label: "기법 값 (4종 공식)",
          passed: r.findings.every((f) =>
            ["HOMOGLYPH", "JAMO", "TRANSPARENT", "OFFSCREEN"].includes(f.technique),
          ),
          detail: "ETC 등 확장 값은 result.json에 들어갈 수 없습니다.",
        },
        {
          label: "선택자 (비어 있지 않음)",
          passed: r.findings.every((f) => f.location.trim().length > 0),
          detail: "빈 location은 허용되지 않습니다.",
        },
        {
          label: "중복 제거 (url+location+technique)",
          passed: identity.size === r.findings.length,
          detail:
            identity.size === r.findings.length
              ? `${String(r.findings.length)}건 모두 고유합니다.`
              : "중복된 url+location+technique이 있습니다.",
        },
        {
          label: "고유 ID",
          passed: ids.size === r.findings.length,
          detail: ids.size === r.findings.length ? "ID가 모두 고유합니다." : "중복된 ID가 있습니다.",
        },
      ]);
    }).catch(() => { if (alive) setExportError("결과를 불러오지 못했습니다. 창을 닫고 다시 시도해 주세요."); });
    return () => {
      alive = false;
    };
  }, [host, sessionId]);

  const allPassed = checks.length > 0 && checks.every((c) => c.passed);

  async function download() {
    setExportError(undefined);
    setExported(undefined);
    // Browser-only fallback: the Tauri host has a real filesystem, so only
    // the browser preview (filesystem: false) downloads client-side.
    const caps = await host.getCapabilities().catch(() => undefined);
    if (caps && !caps.filesystem) {
      const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "result.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExported("result.json (브라우저 다운로드)");
      return;
    }
    try {
      const out = await host.exportResult(sessionId, ".");
      if (out.resultJson == null) {
        // Native dialog cancellation is a no-op: stay on the screen with
        // the validated result intact, no file, no error, no download.
        return;
      }
      setExported(out.resultJson);
    } catch (err) {
      // Validation and write failures surface as-is: no automatic
      // fallback, so a false "saved" message can never follow a failure.
      setExportError(err instanceof Error ? err.message : "내보내기에 실패했습니다.");
    }
  }

  return (
    <div className="modal-backdrop">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="export-title" className="modal-panel" onKeyDown={onDialogKeyDown}>
      <h2 id="export-title" tabIndex={-1}>결과 파일 생성</h2>
      <p>공식 탐지 결과를 확인한 뒤 result.json을 저장합니다.</p>
      {!result ? (
        <p role="status">검증할 결과를 불러오는 중입니다.</p>
      ) : (
        <>
          <p>저장할 공식 탐지: {String(result.findings.length)}건</p>
          <section aria-label="검증 상태">
            <h3>검증 상태</h3>
            <ul className="checks">
              {checks.map((c) => (
                <li key={c.label} className={c.passed ? "pass" : "fail"}>
                  <strong>{c.passed ? "통과" : "실패"} — {c.label}</strong>
                  <span>{c.detail}</span>
                </li>
              ))}
            </ul>
            {!allPassed ? (
              <p role="alert" className="error">
                검증 실패가 있습니다. 실패 항목을 해결하기 전에는 제출용으로
                사용하지 마세요.
              </p>
            ) : null}
          </section>
          <details className="advanced"><summary>기술 정보: JSON 미리보기</summary>
            <pre className="preview" tabIndex={0} aria-label="result.json 미리보기">
              {jsonText.slice(0, 4000)}
            </pre>
          </details>
          <section aria-label="내보내기">
            {exported ? (
              <p role="status">저장됨: {exported}</p>
            ) : (
              <p className="hint">검증을 모두 통과한 뒤 result.json을 저장합니다.</p>
            )}
            {exportError ? (
              <p role="alert" className="error">
                {exportError}
              </p>
            ) : null}
          </section>
        </>
      )}
      <div className="actions">
        <button type="button" onClick={onClose} className="secondary">취소</button>{" "}
        <button type="button" onClick={download} className="primary" disabled={!allPassed}>파일 저장</button>
      </div>
    </div>
    </div>
  );
}

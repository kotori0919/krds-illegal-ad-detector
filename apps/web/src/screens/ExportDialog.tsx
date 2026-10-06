import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  serializeOfficialResult,
  validateOfficialResultText,
  type HostBridge,
  type OfficialResult,
  type ScanCoverage,
} from "@krds-detector/contracts";

interface Props {
  host: HostBridge;
  sessionId: string;
  onClose: () => void;
}

/** Results-workspace confirmation dialog. Validation failure blocks save. */
export function ExportDialog({ host, sessionId, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const savePending = useRef(false);
  const [result, setResult] = useState<OfficialResult | undefined>(undefined);
  const [resultLoadComplete, setResultLoadComplete] = useState(false);
  const [validationPassed, setValidationPassed] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [exported, setExported] = useState<string | undefined>(undefined);
  const [exportError, setExportError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [coverageLoaded, setCoverageLoaded] = useState(false);
  const [coverage, setCoverage] = useState<ScanCoverage | undefined>(undefined);

  useEffect(() => { dialogRef.current?.querySelector<HTMLElement>("h2")?.focus(); }, []);

  function onDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); if (!savePending.current) onClose(); return; }
    if (event.key !== "Tab") return;
    const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), summary, [tabindex='0']") ?? [])]
      .filter((control) => !control.closest("details:not([open])"));
    if (controls.length === 0) {
      event.preventDefault();
      dialogRef.current?.querySelector<HTMLElement>("h2")?.focus();
      return;
    }
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
    if (saveAttempt > 0 && !saving) saveRef.current?.focus();
  }, [saveAttempt, saving]);

  useEffect(() => {
    let alive = true;
    void host.getDetailBundle(sessionId).then((bundle) => {
      if (alive) setCoverage(bundle?.coverage);
    }).catch(() => undefined).finally(() => { if (alive) setCoverageLoaded(true); });
    host.getOfficialResult(sessionId).then((r) => {
      if (!alive) return;
      setResult(r);
      if (!r) {
        setExportError("저장할 결과가 없습니다. 창을 닫고 새로 검사해 주세요.");
        setResultLoadComplete(true);
        return;
      }
      const text = serializeOfficialResult(r);
      setJsonText(text);
      setValidationPassed(validateOfficialResultText(text).ok
        && r.findings.every((finding) => finding.location.trim().length > 0));
      setResultLoadComplete(true);
    }).catch(() => {
      if (alive) {
        setExportError("결과를 불러오지 못했습니다. 창을 닫고 다시 시도해 주세요.");
        setResultLoadComplete(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [host, sessionId]);

  async function download() {
    if (savePending.current || !validationPassed || !coverageLoaded) return;
    savePending.current = true;
    setSaving(true);
    setSaveAttempt((attempt) => attempt + 1);
    dialogRef.current?.querySelector<HTMLElement>("h2")?.focus();
    setExportError(undefined);
    setExported(undefined);
    // Browser-only fallback: the Tauri host has a real filesystem, so only
    // the browser preview (filesystem: false) downloads client-side.
    try {
      const caps = await host.getCapabilities();
      if (!caps.filesystem) {
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
      const out = await host.exportResult(sessionId, ".");
      if (out.resultJson == null) {
        // Native dialog cancellation is a no-op: stay on the screen with
        // the validated result intact, no file, no error, no download.
        return;
      }
      setExported(out.resultJson);
    } catch {
      setExportError("파일을 저장하지 못했습니다. 저장 위치의 권한과 남은 공간을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      savePending.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="export-title" className="modal-panel" onKeyDown={onDialogKeyDown}>
      <h2 id="export-title" tabIndex={-1}>결과 저장</h2>
      {!result ? (
        resultLoadComplete
          ? <p role="alert" className="error">{exportError}</p>
          : <p role="status">결과를 불러오는 중입니다.</p>
      ) : (
        <>
          <p>공식 탐지 {String(result.findings.length)}건</p>
          {!coverageLoaded ? <p role="status">점검 범위를 불러오는 중입니다.</p>
            : !coverage ? <p role="note" className="empty">점검 범위 기록 없음</p> : null}
          {coverage && (coverage.failedPages.length > 0 || coverage.timedOut || coverage.cancelled) ? (
            <p role="note" className="empty">
              {coverage.failedPages.length > 0 ? `확인 실패 ${String(coverage.failedPages.length)}페이지` : ""}
              {coverage.failedPages.length > 0 && coverage.timedOut ? " · " : ""}
              {coverage.timedOut ? "점검 시간 초과" : ""}
              {coverage.cancelled ? `${coverage.failedPages.length > 0 || coverage.timedOut ? " · " : ""}중지 전 완료된 부분 결과` : ""}
            </p>
          ) : null}
          {!validationPassed ? (
            <p role="alert" className="error">결과 파일에 오류가 있어 저장할 수 없습니다. 창을 닫고 새로 검사해 주세요.</p>
          ) : null}
          {exported ? <p role="status">저장 완료: {exported}</p> : null}
          {exportError ? <p role="alert" className="error">{exportError}</p> : null}
        </>
      )}
      <div className="actions">
        {saving ? <p role="status">저장 중입니다.</p> : null}
        <button type="button" onClick={onClose} className="secondary" disabled={saving}>{exported ? "닫기" : "취소"}</button>{" "}
        <button ref={saveRef} type="button" onClick={download} className="primary" disabled={!validationPassed || !coverageLoaded || saving}>{saving ? "저장 중…" : exported ? "다시 저장" : "저장"}</button>
      </div>
    </div>
    </div>
  );
}

import { useEffect, useRef, useState, type DragEvent } from "react";
import type { HostBridge, TargetPreview } from "@krds-detector/contracts";
import type { ReportSession, ReviewRecord } from "@krds-detector/evidence/report";
import { BatchCoordinator, type BatchState, type TargetStatus } from "../batch-coordinator.js";
import { importTargets } from "../import-targets.js";
import { readReportSession } from "../report-data.js";

const labels: Record<TargetStatus, string> = { pending: "대기", running: "점검 중", complete: "완료", partial: "일부 점검", blocked: "미점검·접근 제한", failed: "실패", cancelled: "중지" };
const rowLabels = { valid: "점검 가능", invalid: "입력 오류", duplicate: "중복 제외" };
export function BatchWorkspace({ host, onBack, onInspect, reviews }: {
  host: HostBridge; onBack: () => void; onInspect: (sessionId: string) => void;
  reviews: Record<string, Record<string, ReviewRecord>>;
}) {
  const [preview, setPreview] = useState<TargetPreview>();
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [batch, setBatch] = useState<BatchState>();
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState<"entry" | "quick" | "automatic">("quick");
  const [localScan, setLocalScan] = useState(false);
  const coordinator = useRef<BatchCoordinator | undefined>(undefined);
  const unsubscribe = useRef<(() => void) | undefined>(undefined);
  const revision = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const running = batch?.phase === "running";
  const completed = batch?.targets.filter((target) => target.session?.hasResult) ?? [];
  useEffect(() => {
    let alive = true;
    void host.getCapabilities().then((capabilities) => { if (alive) setLocalScan(capabilities.localScan); }).catch(() => undefined);
    return () => { alive = false; revision.current++; unsubscribe.current?.(); };
  }, [host]);

  const load = async (file: File): Promise<void> => {
    if (running || parsing || batch) return;
    const current = ++revision.current;
    setParsing(true); setError(false); setMessage("파일을 해석하는 중입니다. 대상 사이트에는 연결하지 않습니다."); setPreview(undefined);
    try {
      const result = await importTargets(file);
      if (revision.current !== current) return;
      setPreview(result); setFileName(file.name); setMessage("미리보기 완료. 점검 가능 행만 실행합니다. 아래 목록을 확인해 주세요.");
    } catch (failure) { if (revision.current === current) { setError(true); setMessage(failure instanceof Error ? failure.message : "파일을 읽지 못했습니다."); } }
    finally { if (revision.current === current) setParsing(false); }
  };
  const operate = (task: Promise<void>): void => {
    void task.catch((failure) => { setError(true); setMessage(failure instanceof Error ? failure.message : "일괄 점검을 진행하지 못했습니다."); });
  };
  const start = (): void => {
    if (!preview?.valid || !localScan || coordinator.current) return;
    const targets = preview.rows.flatMap((row) => row.status === "valid" && row.target ? [row.target] : []);
    const current = new BatchCoordinator(host, targets, scope === "entry"
      ? { maxPages: 1, maxDepth: 0, timeoutSec: 60 }
      : scope === "quick" ? { maxPages: 50, maxDepth: 2, timeoutSec: 600 }
        : { maxPages: 200, maxDepth: 4, timeoutSec: 1500 });
    coordinator.current = current; unsubscribe.current = current.subscribe(setBatch);
    setMessage("사이트를 한 곳씩 점검합니다. 화면을 바꾸어도 현재 작업은 유지됩니다."); setError(false);
    operate(current.start());
  };
  const save = async (type: "official" | "xlsx"): Promise<void> => {
    if (!completed.length || saving) return;
    setSaving(true); setError(false); setMessage("저장된 사이트별 결과를 준비하고 있습니다.");
    try {
      const ids = completed.map((target) => target.session!.id);
      let path: string | null;
      if (type === "official") path = await host.exportBatchResults(ids);
      else {
        const sessions: ReportSession[] = [];
        for (const target of completed) {
          const data = await readReportSession(host, target.session!.id, Object.values(reviews[target.session!.id] ?? {}));
          sessions.push({ ...data, label: target.label });
        }
        const { createOperationalWorkbook } = await import("@krds-detector/evidence/report");
        path = await host.saveWorkbook(ids, await createOperationalWorkbook(sessions, { targets: batch!.targets.map((target) => ({
          key: String(target.key + 1), label: target.label, entryUrl: target.entryUrl, status: labels[target.status],
          sessionId: target.session?.id, reason: target.error,
        })) }));
      }
      setMessage(path ? `저장 완료: ${path}` : "저장을 취소했습니다. 완료된 결과는 유지됩니다.");
    } catch { setError(true); setMessage("저장을 완료하지 못했습니다. 위치·권한·여유 공간을 확인해 주세요. 사이트별 파일이 일부 저장되었을 수 있습니다. 점검 결과는 유지됩니다."); }
    finally { setSaving(false); }
  };
  const drop = (event: DragEvent): void => {
    event.preventDefault();
    if (event.dataTransfer.files.length !== 1) { setError(true); setMessage("파일을 한 개씩 선택해 주세요."); return; }
    const file = event.dataTransfer.files.item(0); if (file) void load(file);
  };
  return <main className="page batch-workspace">
    <p className="eyebrow">운영자 일괄 점검</p><h1>여러 사이트 일괄 점검</h1>
    <p>파일의 시작 주소마다 독립된 점검을 실행합니다. 공식 결과는 사이트별로 따로 저장합니다.</p>
    {!localScan ? <p role="status" className="hint">브라우저에서는 파일 미리보기만 가능합니다. 실제 일괄 점검과 저장은 데스크톱 앱에서 실행해 주세요.</p> : null}
    {!batch ? <section aria-label="대상 파일 가져오기" className="batch-import" onDragOver={(event) => event.preventDefault()} onDrop={drop}>
      <h2>1. 대상 파일 확인</h2>
      <label htmlFor="batch-file">대상 파일 선택 또는 여기로 끌어 놓기</label>
      <input id="batch-file" ref={fileInput} className="sr-only" tabIndex={-1} type="file" accept=".xlsx,.csv,.jsonl,.xml" disabled={parsing} aria-describedby="batch-file-hint" onChange={(event) => { const file = event.target.files?.item(0); if (file) void load(file); event.target.value = ""; }} />
      <button type="button" className="secondary" disabled={parsing} onClick={() => fileInput.current?.click()}>파일 선택</button>
      <p id="batch-file-hint" className="hint">XLSX·CSV·JSONL·XML Sitemap, 최대 2MiB·100개 대상. 사이트명·시작 주소 열을 사용합니다. 비공개·내부 주소는 점검할 수 없습니다.</p>
      <button type="button" className="secondary" onClick={() => {
        setError(false); void host.saveTargetTemplate().then((path) => setMessage(path ? `양식 저장 완료: ${path}` : "양식 저장을 취소했습니다.")).catch(() => { setError(true); setMessage("양식을 저장하지 못했습니다. 데스크톱 앱에서 다시 시도해 주세요."); });
      }}>CSV 양식 내려받기</button>
      <details><summary>파일 형식과 열 이름 안내</summary><p>CSV·XLSX 첫 행: 사이트명, 시작 주소. JSONL: {"{\"label\":\"사이트명\",\"entryUrl\":\"https://example.kr/\"}"}. XML은 urlset·sitemapindex를 지원합니다. url, entryUrl / name, label 영문 열도 사용할 수 있습니다. 대상 URL 열은 한 개여야 합니다.</p></details>
    </section> : null}
    {message ? <p role={error ? "alert" : "status"}>{message}</p> : null}
    {preview && !batch ? <section aria-label="대상 미리보기">
      <h2>2. 미리보기 확인 후 시작</h2><p>{fileName} · 점검 가능 {preview.valid} · 오류 {preview.invalid} · 중복 {preview.duplicate}</p>
      <ul className="batch-targets">{preview.rows.map((row) => <li key={row.row}><strong>{row.row}행 · {rowLabels[row.status]}</strong><span>{row.target?.label}</span><span className="mono">{row.target?.entryUrl}</span>{row.reason ? <span>{row.reason}</span> : null}</li>)}</ul>
      <fieldset className="scope-options"><legend>사이트별 점검 범위</legend>
        <label><input type="radio" name="batch-scope" checked={scope === "entry"} onChange={() => setScope("entry")} /> 입력한 페이지만 — 1페이지·하위 링크 제외·1분</label>
        <label><input type="radio" name="batch-scope" checked={scope === "quick"} onChange={() => setScope("quick")} /> 빠른 점검 — 최대 50페이지·2단계·10분</label>
        <label><input type="radio" name="batch-scope" checked={scope === "automatic"} onChange={() => setScope("automatic")} /> 자동 점검 — 최대 200페이지·4단계·25분</label>
      </fieldset>
      <button type="button" className="primary" disabled={!preview.valid || !localScan} onClick={start}>점검 가능 {preview.valid}개 사이트 점검 시작</button>
    </section> : null}
    {batch ? <section aria-label="일괄 점검 현황">
      <h2>일괄 점검 현황</h2><p role="status">{running ? batch.pauseRequested ? "현재 사이트 완료 후 일시정지합니다." : "사이트를 한 곳씩 점검하고 있습니다." : batch.phase === "paused" ? "일시정지됨" : batch.phase === "stopped" ? "중지됨 · 완료된 결과 유지" : "일괄 점검 종료"} · 저장 가능한 결과 {completed.length}/{batch.targets.length}</p>
      <div className="actions">{running ? <><button type="button" className="secondary" disabled={batch.pauseRequested} onClick={() => coordinator.current?.pause()}>현재 사이트 완료 후 일시정지</button><button type="button" className="secondary" onClick={() => { setMessage("현재 점검을 중지하고 결과를 보관하는 중입니다."); operate(coordinator.current!.stop()); }}>일괄 점검 중지</button></>
        : batch.targets.some((target) => target.status === "pending") ? <button className="primary" type="button" onClick={() => operate(coordinator.current!.start())}>남은 사이트 점검 계속</button> : null}</div>
      <ol className="batch-targets">{batch.targets.map((target) => <li key={target.key}><strong>{target.label} · {labels[target.status]}</strong><span className="mono">{target.entryUrl}</span>
        {target.session ? <span>확인 시도 {target.session.progress.visitedPages}페이지 · 실패 {target.session.progress.failedPages} · 탐지 {target.session.progress.confirmedFindings}건</span> : null}
        {target.error ? <><span className="error">{target.error.includes("public network") ? "공개 네트워크 정책에서 주소를 차단했습니다. 내부·비공개 주소는 일괄 점검할 수 없습니다." : "이 사이트의 점검을 완료하지 못했습니다. 다른 사이트의 완료 결과는 유지됩니다."}</span><details><summary>실패 원인 확인</summary><p className="mono">{target.error}</p></details></> : null}
        {target.session?.hasResult ? <button type="button" className="secondary" onClick={() => onInspect(target.session!.id)}>{target.label} 결과 검토</button> : null}
        {target.canRetry && !running ? <button type="button" className="secondary" onClick={() => operate(coordinator.current!.retry(target.key))}>{target.label} 재시도 가능 항목 다시 점검</button> : null}
      </li>)}</ol>
      <div className="actions"><button type="button" className="primary" disabled={!completed.length || saving} onClick={() => void save("xlsx")}>완료된 대상 통합 엑셀 저장</button>
        <button type="button" className="secondary" disabled={!completed.length || saving} onClick={() => void save("official")}>사이트별 공식 JSON 저장</button></div>
      <p className="hint">중지해도 완료된 세션과 저장 파일은 유지됩니다. 검토 메모는 현재 앱 화면에 보관되므로 종료 전에 보고서를 저장해 주세요. 결과를 다른 사이트와 합친 공식 JSON은 만들지 않습니다.</p>
      {!running ? <button type="button" className="secondary" onClick={() => { unsubscribe.current?.(); coordinator.current = undefined; setBatch(undefined); setPreview(undefined); setMessage(""); }}>다른 대상 파일 가져오기</button> : null}
    </section> : null}
    <div className="actions"><button type="button" className="secondary" disabled={running} onClick={onBack}>단일 URL 점검으로 돌아가기</button></div>
  </main>;
}

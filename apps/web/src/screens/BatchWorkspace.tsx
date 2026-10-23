import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import type { BatchGroup, BatchGroupList, BatchGroupScope, HostBridge, HostCapabilities, ScanConnection, TargetPreview } from "@krds-detector/contracts";
import { batchGroupProgress } from "@krds-detector/contracts";
import type { ReportSession, ReviewRecord } from "@krds-detector/evidence/report";
import { BatchCoordinator, type BatchState, type TargetStatus } from "../batch-coordinator.js";
import { batchGroupFingerprint, batchGroupPhaseLabels, batchScopeLimits, newBatchGroupId, restoreBatchGroup, toBatchGroup, type BatchGroupSource } from "../batch-group.js";
import { importTargets } from "../import-targets.js";
import { readReportSession } from "../report-data.js";
import { ConnectionChoice } from "./ConnectionChoice.js";

const labels: Record<TargetStatus, string> = { pending: "대기", running: "점검 중", complete: "완료", partial: "일부 점검", blocked: "미점검·접근 제한", failed: "실패", cancelled: "중지" };
const rowLabels = { valid: "점검 가능", invalid: "입력 오류", duplicate: "중복 제외" };
export function BatchWorkspace({ host, onBack, onInspect, reviews, onWarpSetup, onBusyChange, prepareReviews }: {
  host: HostBridge; onBack: () => void; onInspect: (sessionId: string) => void;
  reviews: Record<string, Record<string, ReviewRecord>>;
  onWarpSetup?: () => void;
  onBusyChange?: (busy: boolean) => void;
  prepareReviews?: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<TargetPreview>();
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [batch, setBatch] = useState<BatchState>();
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState<BatchGroupScope>("quick");
  const [capabilities, setCapabilities] = useState<HostCapabilities>();
  const [connection, setConnection] = useState<ScanConnection>("direct");
  const [starting, setStarting] = useState(false);
  const [groups, setGroups] = useState<BatchGroupList>();
  const [groupsError, setGroupsError] = useState(false);
  const [restored, setRestored] = useState<{ interrupted: number; unreadable: number }>();
  const [persistence, setPersistence] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const coordinator = useRef<BatchCoordinator | undefined>(undefined);
  const unsubscribe = useRef<(() => void) | undefined>(undefined);
  const identity = useRef<BatchGroupSource | undefined>(undefined);
  const fingerprint = useRef("");
  const writes = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const running = batch?.phase === "running";
  const localScan = capabilities?.localScan ?? false;
  const storage = capabilities?.filesystem ?? false;
  const completed = batch?.targets.filter((target) => target.session?.hasResult) ?? [];
  const uncovered = batch?.targets.filter((target) => !target.session?.hasResult).length ?? 0;
  useEffect(() => { onBusyChange?.(running || saving || parsing || starting); }, [running, saving, parsing, starting, onBusyChange]);

  const reloadGroups = useCallback(async (): Promise<void> => {
    const list = await host.listBatchGroups();
    setGroups(list); setGroupsError(false);
  }, [host]);

  /** Durable identity exists only after a batch starts; polling progress never rewrites it. */
  const persistGroup = useCallback((state: BatchState, force = false): void => {
    const source = identity.current;
    if (!source || !storage) return;
    const key = batchGroupFingerprint(state);
    if (!force && key === fingerprint.current) return;
    fingerprint.current = key;
    const group = toBatchGroup(source, state);
    setPersistence("saving");
    writes.current = writes.current
      .then(() => host.saveBatchGroup(group))
      .then(() => { setPersistence("saved"); },
        () => { fingerprint.current = ""; setPersistence("error"); });
  }, [host, storage]);

  const attach = (next: BatchCoordinator): void => {
    unsubscribe.current?.();
    coordinator.current = next;
    unsubscribe.current = next.subscribe((state) => { setBatch(state); persistGroup(state); });
  };
  useEffect(() => {
    let alive = true;
    void host.getCapabilities().then((available) => {
      if (!alive) return;
      setCapabilities(available);
      if (!available.filesystem) return;
      void reloadGroups().catch(() => { if (alive) setGroupsError(true); });
    }).catch(() => undefined);
    return () => { alive = false; revision.current++; unsubscribe.current?.(); };
  }, [host, reloadGroups]);

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
  const start = async (): Promise<void> => {
    if (!preview?.valid || !localScan || coordinator.current || starting) return;
    setStarting(true);
    try {
    if (connection === "warp" && (await host.getWarpStatus()).state !== "ready") {
      setError(true); setMessage("WARP 등록·구성을 확인하지 못했습니다. 연결 설정을 확인하거나 기본 연결을 선택해 주세요."); return;
    }
    const targets = preview.rows.flatMap((row) => row.status === "valid" && row.target ? [row.target] : []);
    const current = new BatchCoordinator(host, targets, batchScopeLimits(scope), 500, connection);
    identity.current = { groupId: newBatchGroupId(), createdAt: new Date().toISOString(), scope, connection };
    fingerprint.current = "";
    setRestored(undefined);
    attach(current);
    setMessage("사이트를 한 곳씩 점검합니다. 화면을 바꾸어도 현재 작업은 유지되며, 완료된 대상은 이 묶음으로 저장됩니다."); setError(false);
    operate(current.start());
    } catch { setError(true); setMessage("연결 구성·일괄 묶음 저장을 확인하지 못했습니다. 기본 연결을 선택하거나 설정을 확인해 주세요."); }
    finally { setStarting(false); }
  };
  const restore = async (group: BatchGroup): Promise<void> => {
    if (coordinator.current || starting || saving) return;
    setStarting(true); setError(false); setRestored(undefined);
    setMessage("저장된 일괄 묶음을 불러오는 중입니다. 대상 사이트에 다시 연결하지 않습니다.");
    try {
      const recovered = await restoreBatchGroup(host, group);
      identity.current = { groupId: group.groupId, createdAt: group.createdAt, scope: group.scope, connection: group.connection };
      fingerprint.current = "";
      setScope(group.scope); setConnection(group.connection);
      const current = new BatchCoordinator(host,
        group.targets.map((target) => ({ label: target.label, entryUrl: target.entryUrl, kind: target.kind })),
        batchScopeLimits(group.scope), 500, group.connection, recovered);
      setRestored({ interrupted: recovered.interrupted, unreadable: recovered.unreadable });
      attach(current);
      setMessage(`저장된 일괄 묶음을 복원했습니다. 완료된 대상 ${group.targets.filter((target) => target.caseId).length}/${group.targets.length}개의 저장된 판단으로 통합 엑셀을 다시 만들 수 있습니다.`);
    } catch { setError(true); setMessage("저장된 일괄 묶음을 복원하지 못했습니다. 저장 폴더·권한·여유 공간을 확인해 주세요."); }
    finally { setStarting(false); }
  };
  const save = async (type: "official" | "xlsx"): Promise<void> => {
    if (!completed.length || saving) return;
    setSaving(true); setError(false); setMessage("저장된 사이트별 결과를 준비하고 있습니다.");
    try {
      await prepareReviews?.();
      const ids = completed.map((target) => target.session!.id);
      let path: string | null;
      if (type === "official") path = await host.exportBatchResults(ids);
      else {
        const sessions: ReportSession[] = [];
        for (const target of completed) {
          const data = await readReportSession(host, target.session!.id, Object.values(reviews[target.session!.id] ?? {}), !!prepareReviews);
          sessions.push({ ...data, label: target.label });
        }
        const { createOperationalWorkbook } = await import("@krds-detector/evidence/report");
        // A target without a stored result is never reported as covered.
        path = await host.saveWorkbook(ids, await createOperationalWorkbook(sessions, { targets: batch!.targets.map((target) => target.session?.hasResult
          ? { key: String(target.key + 1), label: target.label, entryUrl: target.entryUrl, status: labels[target.status], sessionId: target.session.id, reason: target.error }
          : { key: String(target.key + 1), label: target.label, entryUrl: target.entryUrl, status: "미완료",
            reason: target.error ?? "이 대상은 점검이 완료되지 않아 통합 보고서에 포함되지 않았습니다." }) }));
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
    {storage && !batch ? <section aria-label="이전 일괄 점검 묶음">
      <h2>이전 일괄 점검 묶음</h2>
      <p>앱을 다시 시작해도 완료된 대상의 저장된 검토 판단으로 통합 엑셀을 다시 만들 수 있습니다. 복원할 때 대상 사이트에 다시 연결하지 않습니다.</p>
      {groupsError ? <p role="alert">이전 일괄 묶음 목록을 읽지 못했습니다. 저장 폴더·권한을 확인한 뒤 다시 시도해 주세요.</p> : null}
      {groups?.groups.length ? <ol className="batch-targets">{groups.groups.map((group) => {
        const progress = batchGroupProgress(group);
        return <li key={group.groupId}>
          <strong>{group.createdAt.replace("T", " ").slice(0, 16)} · {batchGroupPhaseLabels[group.phase]} · 대상 {progress.total}개</strong>
          <span>저장된 결과 {progress.completed}/{progress.total}</span>
          {progress.incomplete ? <span className="error">미완료 대상 {progress.incomplete}개 · 이 대상은 완료로 계산하지 않습니다.</span> : null}
          <button type="button" className="secondary" disabled={starting || saving || !!coordinator.current} onClick={() => void restore(group)}>이 묶음 복원 · 통합 엑셀 다시 만들기</button>
        </li>;
      })}</ol> : <p role="status">아직 저장된 일괄 묶음이 없습니다. 일괄 점검을 시작하면 이 묶음이 자동으로 저장됩니다.</p>}
      {groups?.issues.length ? <p role="note">읽을 수 없는 묶음 {groups.issues.length}개는 목록에서 제외했습니다.</p> : null}
    </section> : null}
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
    {connection === "warp" && onWarpSetup && (error || batch?.targets.some((target) => target.status === "failed")) ? <><p>점검하지 못한 페이지는 미점검으로 남습니다. 연결 상태를 확인한 뒤 필요한 대상을 직접 다시 점검해 주세요.</p><button type="button" className="secondary" onClick={onWarpSetup}>WARP 연결 설정 확인</button></> : null}
    {preview && !batch ? <section aria-label="대상 미리보기">
      <h2>2. 미리보기 확인 후 시작</h2><p>{fileName} · 점검 가능 {preview.valid} · 오류 {preview.invalid} · 중복 {preview.duplicate}</p>
      <ul className="batch-targets">{preview.rows.map((row) => <li key={row.row}><strong>{row.row}행 · {rowLabels[row.status]}</strong><span>{row.target?.label}</span><span className="mono">{row.target?.entryUrl}</span>{row.reason ? <span>{row.reason}</span> : null}</li>)}</ul>
      <fieldset className="scope-options"><legend>사이트별 점검 범위</legend>
        <label><input type="radio" name="batch-scope" checked={scope === "entry"} onChange={() => setScope("entry")} /> 입력한 페이지만 — 1페이지·하위 링크 제외·1분</label>
        <label><input type="radio" name="batch-scope" checked={scope === "quick"} onChange={() => setScope("quick")} /> 빠른 점검 — 최대 50페이지·2단계·10분</label>
        <label><input type="radio" name="batch-scope" checked={scope === "automatic"} onChange={() => setScope("automatic")} /> 자동 점검 — 최대 200페이지·4단계·25분</label>
      </fieldset>
      <ConnectionChoice value={connection} onChange={setConnection} onSetup={onWarpSetup} />
      <button type="button" className="primary" disabled={!preview.valid || !localScan || starting} onClick={() => void start()}>점검 가능 {preview.valid}개 사이트 점검 시작</button>
    </section> : null}
    {batch ? <section aria-label="일괄 점검 현황">
      <h2>일괄 점검 현황</h2><p role="status">{running ? batch.pauseRequested ? "현재 사이트 완료 후 일시정지합니다." : "사이트를 한 곳씩 점검하고 있습니다." : batch.phase === "paused" ? "일시정지됨 · 남은 사이트를 이어서 점검할 수 있습니다." : batch.phase === "stopped" ? "중지됨 · 완료된 결과 유지" : "일괄 점검 종료"} · 저장 가능한 결과 {completed.length}/{batch.targets.length}</p>
      {storage ? <p role={persistence === "error" ? "alert" : "status"}>{persistence === "error"
        ? "일괄 묶음을 저장하지 못했습니다. 완료된 사례와 검토 기록은 유지되지만, 앱을 다시 시작하면 이 묶음을 복원할 수 없습니다."
        : persistence === "saved" ? "일괄 묶음 저장됨 · 앱을 다시 시작해도 완료된 대상의 판단으로 통합 엑셀을 다시 만들 수 있습니다."
          : persistence === "saving" ? "일괄 묶음 저장 중입니다." : "일괄 묶음 저장을 준비하고 있습니다."}
        {persistence === "error" ? <button type="button" className="secondary" onClick={() => persistGroup(batch, true)}>묶음 저장 재시도</button> : null}</p> : null}
      {restored ? <p role="note">{restored.interrupted ? `이전 실행에서 완료하지 못한 대상 ${restored.interrupted}개는 다시 점검할 수 있는 상태로 표시했습니다. ` : ""}
        {restored.unreadable ? `저장된 사례를 다시 열지 못한 대상 ${restored.unreadable}개는 통합 보고서에서 제외됩니다. ` : ""}
        복원은 저장된 결과만 읽었으며 대상 사이트에 다시 연결하지 않았습니다.</p> : null}
      {uncovered ? <p role="note">저장된 결과가 없는 대상 {uncovered}개는 미완료로 남으며, 통합 엑셀의 대상 요약에서 완료로 계산되지 않습니다.</p> : null}
      <div className="actions">{running ? <><button type="button" className="secondary" disabled={batch.pauseRequested} onClick={() => coordinator.current?.pause()}>현재 사이트 완료 후 일시정지</button><button type="button" className="secondary" onClick={() => { setMessage("현재 점검을 중지하고 결과를 보관하는 중입니다."); operate(coordinator.current!.stop()); }}>일괄 점검 중지</button></>
        : batch.targets.some((target) => target.status === "pending") ? <button className="primary" type="button" onClick={() => operate(coordinator.current!.start())}>남은 사이트 점검 계속</button> : null}</div>
      <ol className="batch-targets">{batch.targets.map((target) => <li key={target.key}><strong>{target.label} · {labels[target.status]}</strong><span className="mono">{target.entryUrl}</span>
        {target.session ? <span>확인 시도 {target.session.progress.visitedPages}페이지 · 실패 {target.session.progress.failedPages} · 탐지 {target.session.progress.confirmedFindings}건</span> : null}
        {target.error ? <span className="error">{target.error.includes("public network") ? "공개 네트워크 정책에서 주소를 차단했습니다. 내부·비공개 주소는 일괄 점검할 수 없습니다." : "이 사이트의 점검을 완료하지 못했습니다. 다른 사이트의 완료 결과는 유지됩니다."}</span> : null}
        {target.session?.hasResult ? <button type="button" className="secondary" onClick={() => onInspect(target.session!.id)}>{target.label} 결과 검토</button> : null}
        {target.canRetry && !running ? <button type="button" className="secondary" onClick={() => operate(coordinator.current!.retry(target.key))}>{target.label} 재시도 가능 항목 다시 점검</button> : null}
      </li>)}</ol>
      <div className="actions"><button type="button" className="primary" disabled={!completed.length || saving} onClick={() => void save("xlsx")}>완료된 대상 통합 엑셀 저장</button>
        <button type="button" className="secondary" disabled={!completed.length || saving} onClick={() => void save("official")}>사이트별 공식 JSON 저장</button></div>
      <p className="hint">중지해도 완료된 사례와 저장된 검토 기록은 유지됩니다. 이 묶음은 저장되므로 앱을 다시 시작한 뒤에도 완료된 대상의 판단을 포함한 통합 엑셀을 다시 만들 수 있습니다. 결과를 다른 사이트와 합친 공식 JSON은 만들지 않습니다.</p>
      {!running ? <button type="button" className="secondary" disabled={saving} onClick={() => { unsubscribe.current?.(); coordinator.current = undefined; identity.current = undefined; fingerprint.current = ""; setBatch(undefined); setPreview(undefined); setConnection("direct"); setRestored(undefined); setPersistence("idle"); setMessage(""); void reloadGroups().catch(() => setGroupsError(true)); }}>다른 대상 파일 가져오기</button> : null}
    </section> : null}
    <div className="actions"><button type="button" className="secondary" disabled={running} onClick={onBack}>단일 URL 점검으로 돌아가기</button></div>
  </main>;
}

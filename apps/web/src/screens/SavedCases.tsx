import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { CaseList, HostBridge, SavedCase, SupportDiagnostics } from "@krds-detector/contracts";

export function SavedCases({ host, onOpen }: { host: HostBridge; onOpen: (caseId: string) => Promise<void> }) {
  const [list, setList] = useState<CaseList>();
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const [supported, setSupported] = useState<boolean>();
  const [deleting, setDeleting] = useState<SavedCase>(); const [diagnostics, setDiagnostics] = useState<SupportDiagnostics>();
  const [shown, setShown] = useState(20);
  const dialog = useRef<HTMLElement>(null); const trigger = useRef<HTMLElement | null>(null);
  const refresh = useCallback(async () => {
    setError("");
    try { setList(await host.listCases()); } catch { setError("저장된 케이스 목록을 불러오지 못했습니다. 기존 결과는 삭제되지 않았습니다."); }
  }, [host]);
  useEffect(() => {
    let alive = true;
    void host.getCapabilities().then((capabilities) => {
      if (!alive) return;
      setSupported(capabilities.filesystem);
      if (capabilities.filesystem) void refresh();
    }).catch(() => { if (alive) setError("저장 환경을 확인하지 못했습니다."); });
    return () => { alive = false; };
  }, [host, refresh]);
  useEffect(() => { if (deleting) dialog.current?.querySelector<HTMLElement>("h3")?.focus(); }, [deleting]);
  const action = async (run: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await run(); } catch { setError("케이스 작업을 완료하지 못했습니다. 저장 위치의 권한·여유 공간과 전달 폴더 형식을 확인하고 다시 시도해 주세요."); }
    finally { setBusy(false); }
  };
  const closeDelete = () => { setDeleting(undefined); requestAnimationFrame(() => trigger.current?.focus()); };
  const trap = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !busy) { event.preventDefault(); closeDelete(); }
    if (event.key !== "Tab") return;
    const buttons = [...(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [])];
    const first = buttons[0], last = buttons.at(-1);
    if (!first || !last) { event.preventDefault(); return; }
    if (document.activeElement?.tagName === "H3" || event.shiftKey && document.activeElement === first) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <section className="page saved-cases" aria-label="저장된 케이스">
    <div inert={!!deleting}>
    <h2>저장된 케이스</h2>
    {supported === false ? <p className="hint">브라우저 미리보기는 영구 보관을 지원하지 않습니다. 저장·다시 열기는 데스크톱 앱을 사용해 주세요.</p> : <>
      <p>다시 열기는 저장된 결과와 검토 기록을 읽습니다. 사이트를 새로 점검하지 않습니다.</p>
      {list ? <p className="hint">저장 위치: {list.storageRoot} · 최근 최대 {list.limit}개</p> : <p role="status">저장된 케이스를 불러오는 중입니다.</p>}
      <div className="actions"><button type="button" className="secondary" disabled={busy} onClick={() => void refresh()}>케이스 목록 새로고침</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => void action(async () => {
          const id = await host.importCase(); if (!id) { setMessage("가져오기를 취소했습니다."); return; }
          await refresh(); await onOpen(id);
        })}>전달 케이스 가져오기</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => void action(async () => setDiagnostics(await host.getDiagnostics()))}>설치 진단 미리보기</button>
      </div>
      {list?.cases.length === 0 ? <p>저장된 케이스가 없습니다. 점검이 끝나면 이곳에서 다시 열 수 있습니다.</p> : null}
      <ul className="finding-list">{list?.cases.slice(0, shown).map((saved) => <li className="finding-card" key={saved.manifest.caseId}>
        <h3>{saved.manifest.entryUrl}</h3><p>{saved.manifest.finishedAt} · 원본 탐지 {saved.manifest.findings}건 · {saved.manifest.status === "cancelled" ? "중지 전 일부 결과" : "완료된 결과"}</p>
        {saved.manifest.issues.length ? <p>일부 근거 사용 제한 {saved.manifest.issues.length}건 · 공식 결과는 별도로 보관됩니다.</p> : null}
        <div className="actions"><button type="button" className="primary" disabled={busy} onClick={() => void action(() => onOpen(saved.manifest.caseId))}>케이스 다시 열기<span className="sr-only"> {saved.manifest.entryUrl}</span></button>
          <button type="button" className="secondary" disabled={busy} onClick={() => void action(async () => { const path = await host.exportCase(saved.manifest.caseId); setMessage(path ? `전달 폴더 저장 완료: ${path}` : "전달 저장을 취소했습니다."); })}>전달 폴더 저장<span className="sr-only"> {saved.manifest.entryUrl}</span></button>
          <button type="button" className="secondary" disabled={busy} onClick={(event) => { trigger.current = event.currentTarget; setDeleting(saved); }}>케이스 삭제<span className="sr-only"> {saved.manifest.entryUrl}</span></button></div>
      </li>)}</ul>
      {list && list.cases.length > shown ? <button type="button" className="secondary" onClick={() => setShown((count) => count + 20)}>저장된 케이스 20개 더 보기</button> : null}
      {list?.issues.length ? <p role="note">읽을 수 없는 케이스 {list.issues.length}개가 있습니다. 목록 새로고침으로 다시 확인할 수 있습니다. 원본 폴더를 보존하고 유지보수 담당자에게 문의해 주세요.</p> : null}
      {diagnostics ? <section aria-label="진단 미리보기"><h3>전달 전 진단 내용 확인</h3><p>원문·주소·쿠키·인증정보는 포함하지 않습니다. 저장 경로에는 사용자명이 있을 수 있으므로 전달 전에 확인해 주세요.</p>
        <pre>{JSON.stringify(diagnostics, null, 2)}</pre><button type="button" className="secondary" onClick={() => void action(async () => { await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2)); setMessage("확인한 진단 내용을 복사했습니다. 전달할 위치는 직접 선택해 주세요."); })}>확인한 진단 내용 복사</button></section> : null}
    </>}
    {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    </div>
    {deleting ? <div className="modal-backdrop"><section ref={dialog} className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="case-delete-title" onKeyDown={trap}>
      <h3 id="case-delete-title" tabIndex={-1}>케이스 삭제 확인</h3><p>{deleting.manifest.entryUrl}</p>
      <p>케이스 {deleting.manifest.caseId}의 원본 탐지 {deleting.manifest.findings}건, 근거 파일, 검토 판단과 메모를 이 앱의 보관 폴더에서 삭제합니다. 전달·백업 폴더는 유지됩니다.</p>
      <p>필요한 자료는 먼저 전달 폴더로 저장해 주세요. 삭제 후 앱에서 되돌릴 수 없습니다.</p>
      <div className="actions"><button className="secondary" type="button" disabled={busy} onClick={closeDelete}>취소</button><button className="primary" type="button" disabled={busy} onClick={() => void action(async () => { await host.deleteCase(deleting.manifest.caseId); closeDelete(); await refresh(); setMessage("선택한 케이스를 삭제했습니다."); })}>이 케이스의 기록 삭제</button></div>
    </section></div> : null}
  </section>;
}

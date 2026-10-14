import { useEffect, useRef, useState } from "react";
import type { HostBridge, WarpFailureCode, WarpStatus } from "@krds-detector/contracts";
import { WARP_TERMS_URL } from "@krds-detector/contracts";

const guidance: Record<WarpFailureCode, string> = {
  "config-permission": "설정 저장 권한을 확인하지 못했습니다. 담당자에게 앱 데이터 폴더의 접근 권한 확인을 요청해 주세요.",
  "config-invalid": "저장된 설정을 확인하지 못했습니다. 담당자에게 설정 상태 확인을 요청해 주세요. 기존 설정을 임의로 덮어쓰지 마세요.",
  "binary-missing": "앱의 연결 구성 요소가 없습니다. 담당자에게 설치 파일 확인을 요청해 주세요.",
  "binary-integrity": "앱의 연결 구성 요소 검증에 실패했습니다. 담당자에게 설치 파일 확인을 요청해 주세요.",
  "registration-failed": "등록 완료 여부를 확인하지 못했습니다. 새 장치를 반복 등록하지 않습니다. 담당자에게 기존 장치와 설정 저장 상태 확인을 요청해 주세요.",
  "preparation-failed": "연결 준비에 실패했습니다. 외부 연결 허용 상태를 확인한 뒤 상태를 새로고침해 주세요. 점검은 직접 다시 시작해야 합니다.",
  "tunnel-exited": "점검 연결이 종료되었습니다. 외부 연결 허용 상태를 확인해 주세요. 남은 페이지는 미점검이며 보관된 일부 결과를 검토할 수 있습니다.",
};

export function WarpSetup({ host }: { host: HostBridge }) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<WarpStatus>();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;
    void host.getCapabilities().then(async (capabilities) => {
      if (!alive.current || !capabilities.windowsIntegration) return;
      setSupported(true);
      try { const next = await host.getWarpStatus(); if (alive.current) setStatus(next); }
      catch { if (alive.current) setError("연결 상태를 확인하지 못했습니다. 상태를 새로고침하거나 담당자에게 문의해 주세요."); }
    }).catch(() => { /* Setup is unavailable until the native capability is established. */ });
    return () => { alive.current = false; };
  }, [host]);

  async function refresh() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try { const next = await host.getWarpStatus(); if (alive.current) setStatus(next); }
    catch { if (alive.current) setError("연결 상태를 확인하지 못했습니다. 담당자에게 문의해 주세요."); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function register() {
    if (locked.current || !consent || status?.state !== "unregistered") return;
    locked.current = true; setBusy(true); setError(""); setStatus({ state: "registering" });
    try {
      const registered = await host.registerWarp({ acceptTerms: true });
      if (alive.current) { setStatus(registered); setConsent(false); }
      try {
        const next = await host.getWarpStatus();
        if (alive.current) setStatus(next);
      } catch { if (alive.current) setError("등록 응답 이후 상태를 확인하지 못했습니다. WARP 상태 새로고침으로 다시 확인해 주세요."); }
    } catch {
      if (alive.current) { setStatus({ state: "unavailable", reason: "registration-failed" }); setConsent(false); }
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }

  async function openTerms() {
    setError("");
    try { await host.openWarpTerms(); }
    catch { if (alive.current) setError(`약관을 브라우저에서 열지 못했습니다. 브라우저에서 ${WARP_TERMS_URL} 주소를 직접 열어 확인해 주세요.`); }
  }

  if (!supported || status?.state === "unsupported") return null;
  return <section id="warp-setup" tabIndex={-1} className="page" aria-label="앱 전용 WARP 연결 설정">
    <h2>앱 전용 WARP 연결 설정</h2>
    <p>공개 사이트 점검에 사용할 앱 전용 장치를 Cloudflare에 등록합니다. 단일·일괄 점검이 같은 설정을 사용합니다.</p>
    <p role="status">{status?.state === "ready" ? "저장된 설정 확인 완료 · 실제 연결은 점검마다 준비하고 검증합니다."
      : status?.state === "registering" ? "앱 전용 장치 등록 중입니다. 완료될 때까지 기다려 주세요."
        : status?.state === "unregistered" ? "앱 전용 장치가 등록되지 않았습니다."
          : status?.state === "unavailable" ? "앱 전용 연결을 사용할 수 없습니다." : "연결 상태 확인 중입니다."}</p>
    {status?.state === "unavailable" ? <p role="alert">{guidance[status.reason]}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {status?.state === "unregistered" ? <>
      <p><a href={WARP_TERMS_URL} target="_blank" rel="noreferrer" onClick={(event) => { event.preventDefault(); void openTerms(); }}>Cloudflare 이용약관</a>을 읽고 동의하는 경우에만 등록하세요. 등록 정보는 앱 데이터 폴더에 저장됩니다.</p>
      <label><input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} />Cloudflare 이용약관에 동의합니다.</label>
      <button type="button" className="primary" disabled={!consent || busy} onClick={() => void register()}>동의하고 앱 전용 WARP 등록</button>
    </> : status?.state === "registering" ? <button type="button" disabled>등록 중…</button> : null}
    <button type="button" className="secondary" disabled={busy || status?.state === "registering"} onClick={() => void refresh()}>WARP 상태 새로고침</button>
    <p className="hint">상태 확인과 점검 시작은 장치를 등록하지 않습니다. 저장된 결과 열기·검토·내보내기는 등록이나 인터넷 연결 없이 사용할 수 있습니다.</p>
  </section>;
}

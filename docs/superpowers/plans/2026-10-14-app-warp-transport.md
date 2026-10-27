# App-scoped WARP Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows 앱이 공식 WARP 클라이언트 없이 검사별 usque 터널로 공개 사이트를 검사하고, 기존 IP 검증·결과·취소 계약을 유지한다.

**Architecture:** 기존 공개망 정책이 모든 DNS 응답을 검증하고 선택한 숫자 IP를 공통 소켓 전송에 전달한다. Node worker가 세션별 usque를 소유하며 Tauri의 기존 Windows Job이 자식 정리를 보장한다. Tauri는 사용자 동의·ACL·등록 상태만 관리하고 UI는 비밀 없는 상태와 복구 동작을 제공한다.

**Tech Stack:** TypeScript, Node 22, Playwright, Vitest, Rust/Tauri 2, Windows Job/ACL, usque 4.2.1.

**Spec:** [Approved design](../specs/2026-10-14-app-warp-transport-design.md), 사용자의 2026-10-14 명시적 상세 설계 승인.

## Global Constraints

- Windows 제품 통합만 수행한다. canonical `<repository>`, 기존 `dev/bootstrap`와 사용자 변경을 보존한다. 별도 worktree·remote 변경은 하지 않는다.
- usque `4.2.1`, commit `6aa03fc97d12848dce34eedbd187fb1077b5d1ea`, `http-proxy` 고정. 자동 모드 선택·재시도·직접 fallback은 없다.
- archive SHA-256 `f6f7f0a1a2bc9bcc15cf563ec1f892d00690a92c086b23ed3211b802209099e7`; EXE SHA-256 `122f2e40208e81bb814fcb4be4fbbbdc9246860f1f3784f72ae4512b97667e91`.
- socket 64, DNS answers 32, DNS 2000ms, header 16384 bytes, socket idle 20000ms 및 기존 전역 deadline을 유지한다. 준비 시간도 같은 deadline을 소비한다.
- 공개 DNS의 비공개·metadata·혼합 응답과 redirect를 계속 거절한다. 정확한 수동 평가/소유 fixture 원점만 기존 직접 연결을 유지한다.
- TLS Host/SNI/인증서 검증, Chromium 직접 DNS·QUIC·비프록시 WebRTC 차단을 유지한다. CAPTCHA 우회·광고 클릭·작품 열기는 없다.
- 등록 JSON은 평문이다. 생성 전 부모 폴더, 생성 후 파일 ACL을 현재 사용자와 SYSTEM으로 제한한다. 동일 사용자 프로세스 격리나 디스크 암호화를 주장하지 않는다.
- 등록은 약관 동의와 명시적 동작이 있어야 한다. 실패 후 자동 재등록하지 않는다. 기존 시험 장치 1개 승인으로 새 장치를 등록하지 않는다.
- 키·토큰·프록시 인증·전체 자식 argv·trace의 IP/계정 필드는 로그/IPC/Case/XLSX/패키지에 남기지 않는다. listener는 인증된 `127.0.0.1`만 사용한다.
- 공식 JSON schema와 탐지 의미는 유지한다. 과거 official/review/XLSX와 원래 설치 후보를 수정하지 않는다. 전역 DNS/라우팅·공식 클라이언트 제어·push/PR/배포/merge는 범위 밖이다.
- 아래 commit 단계는 각 변경만 명시적으로 stage하는 로컬 coherent commit이다. 실행 시 repository-discipline 지침을 먼저 확인하고, 접근할 수 없다면 history 변경을 보류한다.

## Review Focus

1. 등록되지 않은 상태의 오프라인 Case 재열기와 수동 평가 원점은 계속 동작해야 한다 — Task 3/4.
2. 중복 등록 클릭·등록 후 저장 실패는 중복 계정 생성이나 거짓 준비 완료로 이어지면 안 된다 — Task 3.
3. 분할 CONNECT 헤더·초과 헤더·조기 종료·응답 뒤 첫 payload는 유실/무한 대기/인증 유출 없이 처리해야 한다 — Task 1.
4. 준비 중 취소·잘린 시작 로그·터널 종료는 자식을 남기거나 다음 검사를 막으면 안 된다 — Task 2/5.
5. 혼합 DNS·비공개 redirect·Sitemap 요청이 브라우저 이외 경로로 검증을 빠져나가면 안 된다 — Task 1/5.

---

## File map and execution order

| Task | Files and responsibility |
| --- | --- |
| 1 | New `packages/scanner/src/pinned-transport.ts`: 직접/CONNECT 소켓. Existing `public-network.ts`, `crawl.ts`, `index.ts`: 검증 이후 세 요청 경로에 전송 적용. |
| 2 | New `packages/detection/src/warp-runtime.ts`: usque 생명주기·준비. Existing `worker.ts`, `worker-args.ts`, `scan.ts`: 같은 deadline과 전송 전달. Existing runtime preparation/lock/verifier: 고정 EXE·license. |
| 3 | New `packages/contracts/src/warp.ts`, `src-tauri/src/warp.rs`: 비밀 없는 상태/등록. Existing contracts exports/HostBridge, Rust main/session, web host adapters/test helper: IPC·관리 경로·Case provenance. |
| 4 | New `apps/web/src/screens/WarpSetup.tsx`: 명시적 등록 UI. Existing `App.tsx`, 시작/일괄 화면: 준비/실패 복구. Existing `docs/USER_MANUAL.md`, `DATA_HANDLING_KO.md`, `DESKTOP.md`: 운영·저장·번들 설명. |
| 5 | Existing native session harness, artifact verifier and dogfood ledger: 통합·실제 Windows·역사 파일 보존 증거. |

순서 1 → 2 → 3 → 4 → 5. 동일 파일과 lifecycle 계약을 공유하므로 직접 구현 후 한 번의 독립 리뷰를 권장한다. 구현 전 실제 root/dirty state/topology를 다시 읽으며 기존 문서 변경을 덮어쓰지 않는다.

### Task 1: Keep the pinned destination boundary across all request paths

**Files:** Create `packages/scanner/src/pinned-transport.ts`, `packages/scanner/test/pinned-transport.test.ts`; modify `packages/scanner/src/public-network.ts`, `crawl.ts`, `index.ts`; extend `packages/scanner/test/public-network.test.ts`, `manual-network.test.ts`, `access-sitemap.test.ts`.

**Interfaces:**
- Extend existing `PinnedTarget` with `route: "public" | "owned-origin"`, set only by existing policy validation; export its type. Resolver exceptions remain exact-origin policy state.
- Produce `PinnedTransport.open(target: PinnedTarget, options: { signal?: AbortSignal; timeoutMs: number }): Promise<import("node:net").Socket>` and `close(): Promise<void>`.
- Produce `createDirectTransport(): PinnedTransport` and `createConnectTransport(proxy: { port: number; username: string; password: string }): PinnedTransport`. Upstream host is hardcoded loopback; callers cannot set it.
- `PublicNetworkPolicy` keeps its current resolver constructor argument and adds optional second `publicTransport?: PinnedTransport`. Its factories accept the same optional trusted transport. `CrawlOptions.publicTransport?: PinnedTransport` is internal source API; no UI or imported-file equivalent.
- `resolveTarget`, `fetch`, and `startPublicNetworkProxy` retain their existing public signatures. Policy selects direct only for its validated owned-origin target; other targets use the supplied public transport or existing direct source behavior.

- [x] **1. Write real TCP/HTTP/TLS regression tests.** Add a test-owned CONNECT server and certificates for a fixture hostname, using an injected fixture resolver rather than weakening public address rules. Pin these assertions:
  ```ts
  expect(connectAuthority).toBe("1.1.1.1:443");
  expect(destinationHost).toBe("fixture.example");
  expect(tlsServername).toBe("fixture.example");
  expect(destinationHeaders["proxy-authorization"]).toBeUndefined();
  ```
  Fixture proxy maps the validated public test IP to its owned local destination. Verify actual HTTP response bodies for browser HTTP, HTTPS and policy.fetch/Sitemap. A wrong-host certificate must reject; IPv6 authority must be `[2001:4860:4860::8888]:443`. Private/metadata/mixed DNS and public→private redirect must reject before upstream connection; observe upstream accept count zero for each denied target.
- [x] **2. Run `npx vitest run packages/scanner/test/pinned-transport.test.ts`.** Expected initial failure: missing transport API. Also test split headers, 407, oversized headers, early close, payload immediately following header, cancellation and deadline; assert error/received bytes and socket close, not mocked call arguments.
- [x] **3. Implement the transport and three-path integration.** CONNECT contains numeric authority and ephemeral proxy auth only. Bound parser to 16384 bytes, preserve trailing payload, and acknowledge browser CONNECT only after upstream success. Per-request Node HTTP/HTTPS agents use the connected socket; HTTPS wraps it with original SNI and normal hostname/certificate verification. Destroy agents/sockets on completion/cancel. Retain existing policy checks, hop-header stripping, limits and browser blocking flags.
- [x] **4. Run `npx vitest run packages/scanner/test/pinned-transport.test.ts packages/scanner/test/public-network.test.ts packages/scanner/test/manual-network.test.ts packages/scanner/test/access-sitemap.test.ts`.** Expected all pass; owned-origin HTTP still works without any upstream and rejected public targets never reach it.
- [x] **5. Commit only Task 1 files**, message `feat: preserve pinned network policy through upstream CONNECT`.

### Task 2: Own and verify one usque process per worker session

**Files:** Create `packages/detection/src/warp-runtime.ts`, `packages/detection/test/warp-runtime.test.ts`; modify `packages/detection/src/worker.ts`, `worker-args.ts`, `scan.ts`; extend `packages/detection/test/worker-args.test.ts`, `cancelled-scan.test.ts`, `deadline-scan.test.ts`; modify `scripts/prepare-windows-runtime.mjs`, `windows-runtime.lock.json`, `verify-artifact.mjs`.

**Interfaces:**
- Consume Task 1 `PinnedTransport`/factories.
- Produce `startWarpRuntime(options: { executablePath: string; configPath: string; deadline: ScanDeadline; signal: AbortSignal }): Promise<WarpRuntime>`.
- `WarpRuntime` has `transport: PinnedTransport`, `failure: Promise<Error>` (resolves only on unexpected tunnel exit), `close(): Promise<void>` (idempotent). All startup resources close before rejected startup returns.
- Worker arguments add paired `--warp-executable` / `--warp-config-file` and boolean `--require-warp`; none contains credentials. Tauri always passes `--require-warp`, including an unregistered owned-origin scan; source CLI without it retains its direct behavior. Reject one-sided, duplicate and malformed inputs within existing argv bound 32.
- Add `ScanInput.deadline?: ScanDeadline`. `scanSite` uses supplied deadline or creates its existing default; worker creates one before route preparation and passes it plus `crawl.publicTransport` onward.
- Product public scan requires both managed paths; existing source CLI/owned fixture runs retain direct behavior. Worker validates the initial route with existing policy; an exact owned-origin route skips usque and installs a rejecting public transport for that session. Public resources/redirects from that local page fail closed rather than silently go direct. A public initial route starts usque before page work.

- [x] **1. Add process/socket behavior tests.** Run an owned child fixture that actually binds/authenticates a loopback proxy and serves a bounded trace response. Exercise fragmented startup output, `warp=off`, child exit during setup/scan, cancellation and deadline. Assert closed child PID/listener, no direct destination traffic and no credentials in captured stdout/stderr/artifacts. Test a 60-second shared budget with preparation consuming time: `scanSite` must not restart its clock.
- [x] **2. Run `npx vitest run packages/detection/test/warp-runtime.test.ts packages/detection/test/worker-args.test.ts`.** Expected initial failures for missing runtime/paired arguments. Child fixtures prove process/transport behavior; they do not establish real usque compatibility.
- [x] **3. Pin the runtime resource.** Add usque archive provenance and EXE/license inventory to existing runtime preparation/lock. Use existing download/extraction/hash machinery; reject modified/missing EXE before execution. No scan-time download. Require the resources in artifact verification, without a second manifest convention.
- [x] **4. Implement `startWarpRuntime` and worker integration.** Use random per-session auth, explicit `127.0.0.1`, `http-proxy`, managed config and port `0`; discover the actual loopback listener by the exact owned child PID using one bounded Windows Get-NetTCPConnection process. Observed 4.2.1 accepts port 0 but logs :0, so startup logs cannot supply the port. Require exactly one loopback listener and a still-live owned child; no port-race/retry scheme. Discovery consumes the shared deadline. Consume child output privately; never log argv/raw output. Request fixed `https://www.cloudflare.com/cdn-cgi/trace` through validated policy/transport, bounded by `min(10000ms, remaining deadline)`, retain only `warp=on`. Do not increment page counters.
- [ ] **5. Connect failure and cleanup.** Worker combines cancellation and unexpected exit into scan failure, closes runtime in finally, and uses the existing host-owned Job subtree. Mid-scan failure preserves any committed official bytes and emits failed/incomplete coverage, never a successful empty result. Owned-origin-only source scans require no registration; a public request cannot obtain the direct default when the product requires WARP.
- [x] **6. Run `npx vitest run packages/detection/test/warp-runtime.test.ts packages/detection/test/worker-args.test.ts packages/detection/test/cancelled-scan.test.ts packages/detection/test/deadline-scan.test.ts` and `npm run prepare:windows-runtime -- --verify`.** Expected tests pass and exact inventory matches including EXE/license; real Windows port-0/trace smoke is recorded separately with official WARP off. Reuse the single authorized test registration; do not register a new device for this smoke.
- [x] **7. Commit only Task 2 files**, message `feat: run a bounded WARP tunnel per scan worker`.

### Task 3: Add consented native registration and safe persisted provenance

**Files:** Create `packages/contracts/src/warp.ts`, `src-tauri/src/warp.rs`; modify `packages/contracts/src/index.ts`, `host.ts`, `src-tauri/src/main.rs`, `session.rs`, `apps/web/src/host/tauri.ts`, `browser.ts`, `apps/web/test/evidence-host.ts`; extend `apps/web/test/tauri-host.test.tsx`, Rust module/session tests and Task 2 worker metadata output.

**Interfaces:**
- Produce `WarpFailureCode = "config-permission" | "config-invalid" | "binary-missing" | "binary-integrity" | "registration-failed" | "preparation-failed" | "tunnel-exited"`.
- `WarpStatus = { state: "unsupported" | "unregistered" | "registering" } | { state: "ready"; backend: "usque"; version: "4.2.1" } | { state: "unavailable"; reason: WarpFailureCode }`. Ready describes validated stored configuration/resources, not a live tunnel.
- HostBridge adds required `getWarpStatus(): Promise<WarpStatus>` and `registerWarp(request: { acceptTerms: boolean }): Promise<WarpStatus>`; Tauri commands `get_warp_status`, `register_warp` use the corresponding camelCase JSON request. BrowserHost returns unsupported and rejects registration; migrate every HostBridge implementation/test helper.
- Rust `warp::status(app: &tauri::AppHandle) -> Result<WarpStatus, String>` and `warp::register(app: &tauri::AppHandle, accept_terms: bool) -> Result<WarpStatus, String>` use app-managed paths only. Serialize registration with managed `tokio::sync::Mutex<()>`.
- Worker emits a single bounded `KRDSTRANSPORT ` stderr record before page work: `TransportProvenance = { kind: "direct"; reason: "owned-origin" | "source-cli" } | { kind: "warp"; backend: "usque"; version: "4.2.1" }`. Host validates that union and session identity from its owned pipe, then stores `settings.transport`. No arbitrary object merge or official JSON field. Preparation messages use existing `stage-changed`, not a new ScanEventKind.

- [x] **1. Add native registration/state tests.** False consent must leave the test-owned child registration fixture's durable device-creation counter unchanged. The fixture is an actual spawned local process that writes a valid test configuration; never call the live registration service from regression tests. Two overlapping explicit calls produce one persisted configuration/device. Simulated persistence failure after device creation returns unavailable and causes no second registration on status/scan/restart. Native Windows ACL test reads actual effective DACL: inheritance off, only current user/SYSTEM granted access, checked before child creates config and after file creation. Reject existing insecure/invalid config without printing contents.
- [x] **2. Run `cargo test --manifest-path src-tauri/Cargo.toml warp -- --nocapture` on the supported Windows build environment.** Expected initial missing module/API failure. Use an owned local registration fixture for deterministic tests; live Cloudflare registration is not authorized by a test command.
- [x] **3. Implement native registration.** Fixed app-data `warp` directory/config, native Windows ACL operations following existing WinAPI patterns, verified pinned binary, bounded 60-second registration process under owned Job. Validate required usque JSON fields without exposing values. Explicit consent required before execution; reuse valid configuration; uncertain persistence returns actionable failure without retry. Do not inspect official-client state/keys. Worker paths come solely from the host; private authorized evaluator starts stay available unregistered, public starts fail with recoverable registration state.
- [x] **4. Implement contracts, adapters and provenance persistence.** Parse metadata with an exact prefix, bounded record length and strict enum validation; drop invalid records without copying to diagnostics. Preserve official stdout and existing review revision behavior. Native errors use stable reason codes; no raw process output/config returned. No tunnel claim is saved until preparation succeeds.
- [x] **5. Run the Windows Rust warp tests plus `npx vitest run apps/web/test/tauri-host.test.tsx` and `npm run typecheck`.** Expected all pass. Add session persistence tests that reopen stored direct/WARP metadata, reject secret/extra metadata and prove unchanged official bytes. Existing cases missing transport remain readable without rewritten artifacts or invented historical provenance.
- [x] **6. Commit only Task 3 files**, message `feat: register user WARP configuration with restricted Windows ACLs`.

### Task 4: Expose explicit setup and actionable scan failures

**Files:** Create `apps/web/src/screens/WarpSetup.tsx`, `apps/web/test/WarpSetup.test.tsx`; modify `apps/web/src/App.tsx`, `screens/ScanStart.tsx`, `screens/BatchWorkspace.tsx` where recovery needs a setup action; extend `apps/web/test/ScanStart.test.tsx`; update `docs/USER_MANUAL.md`, `DATA_HANDLING_KO.md`, `DESKTOP.md`.

**Interfaces:**
- Consume Task 3 HostBridge/WarpStatus and existing capability `windowsIntegration`.
- Produce `WarpSetup({ host }: { host: HostBridge }): React.JSX.Element`, mounted once in native scan workspace for both single/batch flows. No global registration gate around saved cases.
- Status refresh follows explicit registration completion; scan failure offers the shared setup action. UI never accepts executable/config/proxy paths or credentials.

- [ ] **1. Write interaction tests.** On mount/start-scan/failure rerender, assert no registration side effect. Without terms checkbox, user action cannot create a device. With consent, one action enters pending state and prevents duplicate actions; failure restores an actionable state without retry. Browser unsupported hides native setup. Open a real saved-case fixture offline while unregistered; read/edit/reopen review must remain usable. Verify both single and batch start use the same setup/state contract, and preparation failure shows uninspected coverage rather than an empty success result.
- [ ] **2. Run `npx vitest run apps/web/test/WarpSetup.test.tsx apps/web/test/ScanStart.test.tsx`.** Expected missing component/behavior failure. Use established host/evidence helpers for interaction testing; native behavior remains Task 5's acceptance gate.
- [ ] **3. Implement the component and recovery flow.** Explain registration, link Cloudflare terms, require explicit consent, show preparation/failure/next action in Korean operator language. Do not expose port/MASQUE controls. Existing result browsing/review/export remains independent of registration or network state.
- [ ] **4. Update documentation in the same change.** Describe first-use consent, per-scan lifecycle, required outbound connectivity, plaintext ACL storage and same-user boundary, no silent fallback and failure recovery. Explain direct local evaluation and Case transport provenance without implying improved detection accuracy.
- [ ] **5. Repeat the Task 4 test command.** Expected pass; assert state transitions and accessible actions rather than pinning incidental wording.
- [ ] **6. Commit only Task 4 files**, message `feat: add explicit WARP setup and scan recovery actions`.

### Task 5: Exercise the packaged native path and finish evidence gates

**Files:** Extend `benchmarks/native-session-l3` tests only for a deterministic consumer-visible gap uncovered by integration; update `docs/DOGFOOD_LEDGER_20261014.md`. Put throwaway receipts/screenshots under ignored `artifacts/dogfood-20261014/`, never credentials. No permanent probe scaffold.

**Interfaces:** Consume all preceding contracts and existing package/manifest/native Case/XLSX workflow. No new product API is introduced by this verification task.

- [ ] **1. Run integrated checks once after integration:** `npm run check`, `npm run build:scanner`, `npm run smoke:sidecar`, `npm run smoke:native-session`. Expected exit 0, real owned-fixture scan/persist/reopen succeeds without registration. Any new deterministic behavior regression receives its owner task's test and minimal correction before this gate repeats.
- [ ] **2. On Windows, build `npm run package:windows` and run `npm run verify:artifact -- <generated-manifest-path>`, substituting the actual manifest emitted by the build.** Require exact EXE/license inventory, no test credentials, source identity and payload verification. Exercise the separate candidate directly; do not overwrite/install over the original candidate. Hash original installed EXE and historical official/review/XLSX files before/after.
- [ ] **3. With official WARP already off, reuse the authorized single test-device config in restricted test storage.** Do not trigger live registration or change official client/global routes. Verify pinned usque's dynamic port/auth/trace through the actual worker/Job, not standalone Playwright. Native two-target batch: `https://blacktoon424.com/` and `https://tvwkwk1.tv/`, each maxPages 1, depth 0, timeout 60 seconds. No automatic retry, advertisement/content click or challenge bypass. Capture actual coverage/findings and transport provenance; zero findings alone is not evidence of successful ad detection.
- [ ] **4. Exercise native cancellation during preparation and navigation, normal close, owned worker failure and forced candidate exit.** Observe owned usque/browser PIDs and sockets disappear; leave unrelated processes untouched. Run the next explicit scan successfully. Mid-scan loss must retain already committed official artifacts and display incomplete scope. Compare the complete historical hash inventory and original installation after all checks.
- [ ] **5. Execute D08 using an actual detected item.** Save an explicitly synthetic memo, judgment and read mark, normal-close/restart, reopen both batch targets and export their integrated XLSX after restart. Inspect actual Excel cells and unchanged official bytes. The known missing batch-group restoration is a separate unresolved acceptance condition: if the native UI still cannot produce the two-target report after restart, record the exact failed action and obtain a scoped design amendment for that gap; do not substitute a one-target workbook or claim D08/Sprint completion.
- [ ] **6. Update ledger with OBSERVED/MEASURED/INFERRED/NOT_RUN labels**, actual commands/environment/hash receipts, remaining native viewport/focus or D08 gaps. Transport success is reported separately from detector accuracy and sprint completion. Remove task-only scaffolds; preserve evidence artifacts and user files.
- [ ] **7. Review the integrated diff against the approved spec**, then commit only verification/docs changes, message `docs: record native app WARP transport verification`. A failed native gate remains explicitly incomplete; compilation/unit success cannot replace it.

## Plan review and handoff

Self-review: spec sections map to Tasks 1 (network), 2 (runtime/resources/deadline), 3 (registration/security/persistence), 4 (operator behavior/docs), 5 (packaged native acceptance). All five Review Focus classes have owner-task behavior checks. Shared signatures use one PinnedTransport, one ScanDeadline and one provenance union; official JSON has no new fields. Dynamic port support and complete D08 are explicit real-execution gates, not claimed observations.

User approved this plan and selected task-by-task implementation/review agents. Tasks 1, 2 and 3 are locally committed; Task 4 is in progress. Task 2 step 5 retains a cross-task gate for Task 3 failed-Case persistence and Task 5 native Job cleanup. No new device registration, publication or original-installation overwrite is authorized.

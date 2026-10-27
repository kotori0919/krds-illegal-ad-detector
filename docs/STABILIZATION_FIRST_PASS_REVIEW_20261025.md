# KRDS 첫 안정화 패스 독립 검수 — 2026-10-25

검수 대상: `<stabilization-worktree>`
기준: `7bf3e6837c9d98d8a38b634091487bdf29195eb0`
제출: `e33b88d983c698175af76c139d1e6a5ca67eff85`
branch: `codex/stabilize-first-pass-20261025`

## 판단

이벤트 등록 경합의 국소 수정은 독립 전후 재현으로 타당함을 확인했다. 변경 코드에서 새 Critical/High/Medium 제품 결함은 발견하지 못했다. 다만 Windows 설치본과 D08/Excel 등 중요 수용 기준이 미실행이므로 전체 안정화 승인이나 출시 승인은 보류한다. 단일 결함 수정 및 Linux fixture 통과만으로 대회 경쟁력이 충분하다고 판단할 수 없다.

## 심각도별 발견 및 한계

### Low — 기존 원시 로그의 exact HEAD 귀속이 자체 증명되지 않음 (높은 확신)

위치: `docs/STABILIZATION_FIRST_PASS_20261025.md:78`, `:117`; `artifacts/stabilization-20261025/full-test-host.log:1`; `SHA256SUMS:1`.
기존 전체 로그에는 실행 경로/테스트 개수/시간은 있으나 최종 HEAD·소스 tree hash·dirty 상태가 없다. INITIAL.md에는 baseline만 있다. SHA256SUMS의 4개 로그 해시는 모두 일치하지만 이는 로그 바이트 동일성을 확인할 뿐 실행 소스를 최종 HEAD에 결속하지 않는다. 최종 커밋 시각보다 테스트가 앞선 것은 정상일 수 있으며 조작 증거가 아니다. 그러나 기존 793 PASS를 그것만으로 immutable e33b88d 실행이라고 확정할 수는 없다.

영향: 후속 Windows 후보 또는 재현 결과의 출처를 잘못 연결할 수 있음. 다음 실행부터 commit/tree hash, source diff/status, 명령·환경·exit와 로그 해시를 함께 보존할 것. 이번 독립 검수는 git archive의 제출 HEAD로 실행하고 494개 추적 파일을 Git blob hash와 대조해 모두 일치시켰다. `identity.json`, `source-verification.json` 참조.

### Low — 이벤트 누락/cleanup에 관한 테스트 표현이 실제 관측보다 넓음 (높은 확신)

위치: `apps/web/test/tauri-host.test.tsx:77`, `:85`, `:109`; `docs/STABILIZATION_FIRST_PASS_20261025.md:28`.
새 시험은 보류 Promise를 사용해 등록 수, invoke 대기, 단일 callback 전달, handler 해제, 실패 후 재등록을 결정적으로 확인한다. baseline에서 실제 실패하므로 회귀 감도가 있다. 다만 전달 이벤트는 `{ type: "fixture-event" }`로 실제 ScanEvent 계약/진행 상태를 검증하지 않는다. 실패 시험은 재시도 후 이벤트 전달 및 네이티브 callback 자원 cleanup을 확인하지 않는다. 기존 "immediate completion cannot be lost" 시험도 listen→invoke 호출 순서만 확인하며 실제 완료 이벤트를 발생시키지 않는다.

영향: mock 통과를 native IPC 이벤트 유실·중복·부분 등록 실패 복구까지 보장한 것으로 확대 해석하면 안 됨. 이 자체는 제품 버그의 재현이 아니며 국소 수정 반려 사유도 아니다. Windows 설치본에서 실제 payload, 즉시 완료, 실패/재시도 후 전달 개수와 자원 수명주기를 관측할 것.

추가 문서 정밀도: `ScanProgress.tsx:77`은 sequence 중복/역전을 무시하고 `:131`은 완료 화면 전환을 poll에 맡긴다. 따라서 baseline의 중복 callback 재현을 곧바로 사용자 화면 완료 전환 중복의 재현이라고 보고하지 말아야 한다.

### 중요 수용 공백 — 제품 결함이 아닌 미검증 게이트

`docs/STABILIZATION_FIRST_PASS_20261025.md:80-81` 자체가 Windows native/NSIS 및 실제 D08/Excel/AT/잔류 프로세스를 NOT_RUN으로 명시한다. 이번 독립 검수도 해당 장비/앱을 실행하지 않았다. 제품 전체 승인에는 중요한 공백이다. 실패가 입증된 것도, 통과한 것도 아니다.

## 코드·상태 근거

`apps/web/src/host/tauri.ts:133-151` 핵심:

```ts
if (this.subscribed) return;
if (this.subscriptionPending) return this.subscriptionPending;
this.subscriptionPending = (async () => {
  const { listen } = await loadTauri();
  await listen("scan-event", (e) => {
    for (const h of this.handlers) h(e.payload);
  });
  this.subscribed = true;
})();
try { await this.subscriptionPending; }
finally { this.subscriptionPending = undefined; }
```

`startScan(:164)`와 `startBatchScan(:175)` 모두 이를 await한 뒤 invoke한다. `onScanEvent(:190)`는 먼저 handler를 Set에 추가한 후 구독을 시작한다. 등록이 성공할 때까지 subscribed는 false이고 실패 시 finally가 대기 상태를 해제하므로 다음 호출은 새 등록을 시도한다. await 전에 pending이 공유되므로 같은 인스턴스의 동시 호출은 단일 등록을 기다린다.

`stop()`은 `:193`에서 frontend handler만 제거한다. native unlisten을 호출하는 기능은 이번 수정에 추가되지 않았으며 기존과 동일하다. 따라서 검수에서 말하는 cleanup 통과는 pending Promise와 handler 수준이다. 앱 수명 동안 한 TauriHost listener를 유지하는 현재 구조에서 이 사실만으로 새 누수 결함이라고 판단하지 않았다.

변경 범위: adapter 23줄(+17/-6), 테스트 +55줄(2개 시험), 문서 +121줄. 탐지·임계치·모델·Rust·패키징·공식 JSON 계약 변경은 없다. 전체 3개 파일, +193/-6.

검수 시작 및 종료 상태: 제출 HEAD/branch 일치, 제출 및 원본 `git status --porcelain=v1` 빈 값. 원본 HEAD는 baseline, branch `codex/post-submission-d08`. `git worktree list --porcelain`에서도 같은 연결 확인. `<workspace-instructions>/AGENTS.md`를 읽었고 canonical 루트 아래 새 worktree 금지 정책 확인. 대상/하위에 추가 AGENTS.md는 없었다.

현재 clean과 HEAD 일치로 추적 원본의 현재 보존은 확인했다. 과거 수행 전체에서 모든 ignored 데이터가 한 번도 바뀌지 않았다는 주장은 현재 git status만으로 증명할 수 없다. 이번 검수는 대상/원본을 읽기만 하고, 실행·빌드·캐시·로그는 /tmp 안에 격리했다. 복사본 외부를 가리키는 symlink 0개 확인. 의존성 설치는 수행하지 않았다.

## 독립 재실행

환경: Linux, Node v26.8.1 / npm 11.19.0 / Vitest 3.2.7. 새 npm ci 없이 제공된 의존성과 모델 캐시를 별도 복사했다. clean install 재현성은 미검증.
제출 소스는 `git archive e33b88d983c698175af76c139d1e6a5ca67eff85`로 /tmp/submitted에 추출. baseline은 별도 git archive로 추출하고 제출 테스트 파일만 복사해 같은 회귀 시험을 실행했다. 대상 worktree를 checkout/reset/수정하지 않았다.

| 명령 | 결과 | 증거 |
|---|---|---|
| baseline + 제출 테스트: `node node_modules/vitest/vitest.mjs run apps/web/test/tauri-host.test.tsx -t shares` | exit1, 2 FAIL/8 필터 skip. 리스너 3회; 실패 중 start 2개 fulfilled | baseline-shares.log |
| 제출: `node node_modules/vitest/vitest.mjs run apps/web/test/tauri-host.test.tsx` | exit0, 10 PASS | focused.log |
| `node node_modules/vitest/vitest.mjs run --project web` | exit0, 172 PASS/23 files, 15.62s | web.log |
| `npm run lint` | exit0 | lint.log |
| `npm run build:scanner` | exit0, 모델 manifest 크기/해시 확인 경로 포함 | build-scanner.log |
| `npm run typecheck` | exit0 | typecheck.log |
| `npm run build` | exit0, report chunk >500KB 경고 | build.log |
| `git diff --check baseline HEAD` (대상에서 read-only) | exit0 | 검수 도구 출력 |
| 기본 샌드박스 loopback bind probe | exit1, listen EPERM 127.0.0.1 | 환경 제한, 제품 실패 아님 |
| 호스트 `KRDS_TEST_UNSANDBOXED=1 npm run test` | exit0, 793 PASS/1 SKIP, 99 passed/1 skipped files, Vitest 214.11s | full-test.log |
| 호스트 `npm run test:integration` (위 환경변수 제거) | exit0, production sandbox worker, officialFindings=1 / requests=2, 한글 경로 공식 JSON 검증 | integration.log |

웹 172개 안에는 scan-progress 11개, ScanStart 13개, batch-coordinator 4개가 포함된다. 진행 상태 시험은 다른 session/stale sequence 무시, poll과 terminal event 순서, finalizing 유지, 취소 성공/실패, 조회 실패 후 회복, 보존 결과 전환을 다룬다. 이들은 mock HostBridge/jsdom 시험이며 Tauri 실제 전달과 결합한 E2E는 아니다.

## 미검증 범위 및 부모 보고 후 다음 순서

1. 부모가 국소 수정 검수 결과 및 전체 승인 보류를 사용자에게 보고. 이 검수자가 후속 구현을 시작하거나 Tasks를 완료 처리하지 않음.
2. e33b88d 또는 후속 명시 HEAD로 Windows 후보 생성, 실행파일/installer SHA 및 source tree/환경 연결. 설치 직후 scan, 즉시 완료 이벤트, 등록 실패·재시도, cancel/restart/close를 실제 Tauri/WebView2에서 관측.
3. 실제 서로 다른 양성 2건 D08: 개별 판단·메모 저장 → 종료/재시작 → 사례·묶음 복원 → 통합 XLSX를 실제 Excel에서 열어 내용 확인.
4. Windows upgrade/rollback/uninstall/reinstall 후 기존 사례·공식 JSON 바이트 보존, 취소·deadline·종료 후 Node/Chromium 잔류 프로세스 확인.
5. `KRDS_RUN_HOLDOUT=1` opt-in 평가, 공개 양성/음성 holdout 및 실제 위치 검증·OCR 원문/이미지/모델 근거를 구분해 성능과 오탐/누락 측정. 기본 skip authored holdout과 실제 공개 모집단 성능을 동일시하지 않음.
6. 다수 이미지/관계 그래프 열람 시 메모리와 Windows keyboard/200% zoom/AT. evidenceReads 장기 보존은 기존 측정 후보이며 이번 diff로 새로 도입된 문제가 아님.

Windows 실기기 합격·배포 가능·대회 경쟁력 확보를 선언하지 않는다. 소스 수정, commit, push, PR, 배포, Tasks 변경은 수행하지 않았다. 검수 산출물만 본 임시 디렉터리에 보존한다.

## 추가 검수 — 현재 main 대비 ancestry 및 PR 영향

부모가 읽기 전용 원격 확인으로 제공한 현재 canonical 목적지: `https://github.com/kotori0919/krds-illegal-ad-detector`, 원격 main `3e20d5830c2447b53c7873c06595364f5aa61a14`. 이 검수자는 원격 변경이나 fetch를 하지 않고 이미 있는 로컬 객체로 관계를 검증했다.

- `git merge-base mainHead submittedHead` = `3e20d583...`; `git rev-list --left-right --count mainHead...submittedHead` = `0 2`.
- 제출 branch는 제공된 main의 직계 후손이다. 갈라진 구현 계보나 누락된 main 커밋은 이 비교에 없다.
- main → 7bf3e683은 `docs/ADOPTION_HANDOFF_KO.md` +19줄, `docs/ADOPTION_LEDGER.md` +24줄의 인계 기록뿐이다. 제품 소스 차이 없음.
- main → e33b88d는 2 commits / 5 files / +236,-6. 위 문서 2개와 이번 adapter·시험·인계 문서 3개가 PR에 포함된다. 따라서 baseline 대비 3개 파일 변경을 그대로 main 대상 PR 전체 범위라고 표기하면 부정확하다.
- 제공된 main이 유지된다면 Git ancestry 관점에서 rebase나 충돌 해소가 필요한 상태는 아니다. 실제 보호 규칙/CI/mergeability 및 최신 main 변화는 PR 직전 별도 읽기 확인이 필요하다.
- 로컬 origin은 여전히 `snowman0919/...`이다. 이를 현재 canonical `kotori0919/...`와 동일 목적지라고 임의 가정하지 말아야 한다. 부모가 목적지 승인 응답을 기다리는 동안 remote 변경·push·PR 생성은 진행하지 않는다. 이 검수는 PR을 준비하거나 생성하지 않았다.

근거: `ancestry.log`. 이 결과는 기존 baseline 대비 코드 검수 결론을 바꾸지 않으나, 향후 PR 범위 설명에는 문서 2개와 선행 인계 commit을 포함해야 한다.

## 요구사항/위험 → 근거 최종 매핑

| 위험 | 독립 관측 | 판정/한계 |
|---|---|---|
| 동시 등록 및 중복 전달 | baseline 3회 FAIL → 제출 1회/handler1회 PASS | 국소 PASS, 실제 IPC 미검증 |
| 등록 실패 중 시작 차단 | 동시 start 2개 reject, invoke 0 | mock PASS |
| 실패 cleanup/retry | subscribed false → retry true, 등록2회/invoke1회 | pending cleanup PASS, native 자원 cleanup 미검증 |
| 진행 상태 회귀 | web 172 PASS, progress11/batch4 포함 | mock UI PASS, real Tauri 결합 E2E 미검증 |
| 실제 worker 경계 | production sandbox, 공식1건/요청2건 | Linux loopback 통합 PASS |
| 전체 Linux suite | 793 PASS/1 SKIP | opt-in holdout 미실행 |
| 대상/원본 보존 | 전후 status clean, tracked blob494 일치, 외부 symlink0 | 현재 추적 데이터 보존 확인 |
| Windows 제품 안정화 | 설치본/업데이트/잔류 프로세스/D08/Excel 미실행 | 전체 승인 보류 |

모든 호스트 실행은 허용되어 완료됐으며 자동 승인 거부나 결과 불명 작업은 없다. 기본 샌드박스 loopback 제한은 호스트 격리 복사본 실행으로 해결했다. 검수 범위 내 남은 도구 blocker는 없다. Windows 수용 증거는 여전히 없다.

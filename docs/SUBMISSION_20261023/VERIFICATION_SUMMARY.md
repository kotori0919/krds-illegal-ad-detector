# 검증 기록 요약

이 문서는 2026-10-23 제출물에 포함된 검증 기록만 모은다. 각 행은 실행 환경과
성공/미실행을 구분한다. 출처를 적지 않은 수치는 싣지 않았다. 제출물 목록은
[`README.md`](README.md), 제품 요약은 [`APPLICATION_SUMMARY.md`](APPLICATION_SUMMARY.md),
절차는 [`BUILD_AND_RUN.md`](BUILD_AND_RUN.md), 잔여 위험은
[`LIMITATIONS_AND_RISKS.md`](LIMITATIONS_AND_RISKS.md)를 따른다.

## 1. 실행 환경과 시점

| 항목 | 값 |
| --- | --- |
| 호스트 | Linux x64 개발기(Chromium sandbox 없음) |
| 코드 기준 commit(후보) | `85a286f5fcaf125fcadec155eac729bfe019db92` |
| 전체 로컬 suite 실행 시점 HEAD | `16d4b561cc2eb4ade960da82a6864823f68cd7f1` |
| Node(로컬 suite) | `v22.23.3`, 별도로 `v26.8.1`에서도 green |
| 내장 worker 런타임 | `22.19.0`(runtime lock `nodeVersion`) |
| 교차 빌드 target | `x86_64-pc-windows-gnullvm` |
| LLVM-MinGW | `20260908`, clang `23.1.1`, `bin/clang` sha256 `bab7f174d7e136ae093ad232d5a894ee00f0a8f9051bcff4eb6a70c132898248` |
| NSIS | `3.09-4`(Ubuntu noble), makensis sha256 `ca9f28d9726d38d33b403187871af920b59c265eade7fa463684cf1e8b322d3e` |

중요한 구분: **전체 suite(`npm run check`)는 `16d4b56`에서 실행되었고, 그 뒤
`95bb51d`, `2ea59e4`, `85a286f` 세 commit이 추가되었다.** `85a286f`에서는 Rust
target 검사·fmt·build·package·artifact verify가 실행되었으나 전체 JS suite 재실행
기록은 없다. 따라서 "704 passed"를 `85a286f`의 전체 suite 결과로 표기하지 않는다.
근거: `docs/ADOPTION_LEDGER.md` §「2026-10-23 후보 재빌드와 검증」 §「소스·시험 상태」,
§「재빌드 (85a286f)」.

## 2. 로컬 suite

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 명령 | `PATH=/usr/bin:$PATH KRDS_TEST_UNSANDBOXED=1 npm run check` | `ADOPTION_LEDGER.md` §소스·시험 상태 |
| 종료 코드 | `0` | 같은 절 |
| 파일 수 | `Test Files 94 passed \| 1 skipped (95)` | 같은 절 |
| 테스트 수 | `Tests 704 passed \| 1 skipped (705)` | 같은 절 |
| 소요 시간 | `204.4`초 | 같은 절 |
| Node | `v22.23.3`(같은 suite가 `v26.8.1`에서도 green) | 같은 절 |
| 원시 로그 | `/tmp/final-check-node22.log`, `/tmp/final-check-node26.log`(저장소 밖 임시 경로) | 같은 절 |

`KRDS_TEST_UNSANDBOXED=1`은 **소유 loopback fixture의 Chromium sandbox만** 해제한다.
외부 사이트 탐지나 배포본 sandbox를 우회하는 권한이 아니며 production 격리 증거로
전용하지 않는다 (`docs/BUILD_MANUAL.md` §공통 명령, `ADOPTION_LEDGER.md` 같은 절).

## 3. 빌드

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| `npm run build` | EXIT `0` | `ADOPTION_LEDGER.md` §소스·시험 상태 |
| `npm run build:desktop` | EXIT `0` | `ADOPTION_LEDGER.md` §재빌드 |
| `npm run package:windows` | EXIT `0` | 같은 절 |
| 런타임 closure 검증 | `node scripts/prepare-windows-runtime.mjs --verify` → `{"runtime":"verified","files":1197,"nodeVersion":"22.19.0"}` | 같은 절 |
| closure lock | `scripts/windows-runtime.lock.json` 1197개 항목(runtime lock 미변경) | 같은 절, `BUILD_MANUAL.md` §`npm run package:windows` 준비 |

`npm run build`는 contracts → evidence(보고서 포함) → web 순서로 컴파일한다
(`package.json` scripts, `docs/BUILD_MANUAL.md` §공통 명령).

## 4. Windows target Rust 검사

| 명령 | 결과 | 비고 |
| --- | --- | --- |
| `cargo check --target x86_64-pc-windows-gnullvm --all-targets` | EXIT `0` | Linux 호스트에서 교차 검사 |
| Windows target clippy(CI와 같은 명령) | EXIT `0` | 같은 절 |
| `cargo test --bins` | `78 passed / 0 failed / 2 ignored` | **호스트 실행**. Windows 실행이 아니다 |
| `cargo fmt --check` | EXIT `0` | 같은 절 |

근거: `docs/ADOPTION_LEDGER.md` §「재빌드 (85a286f)」. 같은 절은 "NOT_RUN: Windows에서의
시험 실행(cross sysroot 없음)"을 명시하므로 `cargo test --bins`의 78 pass를 Windows
실행 결과로 읽지 않는다. CI의 Windows lane 정의는
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) `windows-native` job
(`cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`,
`cargo test --locked`, `integration-smoke --packaged`, `build:desktop`)이다.

## 5. Windows 설치 후보 identity

후보: `artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-76e7d5ec6ce4-20261022T163747830Z/`

| 항목 | 값 |
| --- | --- |
| buildId | `0.2.1-x86_64-pc-windows-gnullvm-76e7d5ec6ce4-20261022T163747830Z` |
| appVersion / target | `0.2.1` / `x86_64-pc-windows-gnullvm` |
| source.commit / dirty | `85a286f5fcaf125fcadec155eac729bfe019db92` / `false` |
| sourceSha256 | `76e7d5ec6ce4f9d2b7b5446b2ae29f934a2c85f98dc76821b4225a106af90b19` |
| installer | `796,348,611` B (759.46 MiB), sha256 `54c8f1cdff25e9077a2432b8e75af14cef7597fe1fb21eb8325fbb6b6dfdf406` |
| standalone `krds-detector.exe` | `20,220,928` B, sha256 `bd57296b8823ff79d0aa9da6c7e9dc578cb3ac853a086be1f1b690cc69bac121` |
| 설치본 exe(marker 변환 후, `markerOffset` 13455874) | sha256 `8059cb5d93fecccf013b3645d046bc9d8f8ae26bbe498896492b4dee8f61413e` |
| `releaseStatus` / `signing` | `candidate` / `unsigned-internal-candidate` |
| 빌드 도구(manifest `tools`) | node `v26.8.1`, rustc `1.98.1`, tauri `2.12.1` |

`verify-artifact` 결과: `node scripts/verify-artifact.mjs <candidate>/manifest.json`
EXIT `0`, **8 files, 8/8 hash 일치, 목록 밖 파일 없음**
(`ADOPTION_LEDGER.md` §재빌드). 이 검증은 설치 파일·native exe·manifest·build/resource
manifest·SBOM·Cargo license inventory·third-party notices의 무결성을 확인하며,
**발행자 인증이 아니다**. standalone과 설치본 hash 차이는 Tauri의 `UNK`→`NSS` marker
변환에 따른 예상된 차이다 (`docs/BUILD_MANUAL.md` §산출물과 한계).

## 6. 브라우저 UI smoke

| 항목 | 기록된 결과 | 근거 |
| --- | --- | --- |
| `node benchmarks/ui-modes-smoke.mjs` (production web bundle + 실제 Chromium, Tauri adapter replay) | 617기록, 실제 XLSX 618행(머리글 포함), 메모 포함, 공식 JSON bytes 동일, WARP 호출 `0`, page error `0`, 재실행 모드 기억 | `ADOPTION_LEDGER.md` §「2026-10-20 일반 연결·화면 모드·단일 사례 인프라 초기 구현」 검증 표 |
| 617건 production UI smoke 회귀 | card/review 좌표 분리, 첫 3행 하단 `748.25px` | `ADOPTION_LEDGER.md` §현재565 설치본의 운영·인계 마감 |
| 화면 크기 기록 | 1366×768, `17px` 본문, 320px 화면에서 원문 폭 `300px` | `docs/DOGFOOD_LEDGER_20261014.md` §Task outcomes D03, `ADOPTION_LEDGER.md` §후속 UI 화면 관찰 |

**범위 제한**: 이 smoke는 브라우저/Tauri adapter replay이며 Windows native 실행이
아니다. 기록된 실행 시점은 2026-10-20~22 소스 상태이고, `85a286f` UI에 대해 다시
실행한 기록은 이 제출 시점에 없다. 따라서 이 결과를 최신 후보의 Windows 화면 수용으로
전용하지 않는다 (`ADOPTION_LEDGER.md` §후속 UI 화면 관찰).

## 7. NOT_RUN 표

| 항목 | 상태 | 이유 / 근거 |
| --- | --- | --- |
| Windows 11 설치·대화형 UI 수용 | NOT_RUN | 후보를 Windows에서 설치·조작한 기록 없음. 검증 호스트(Pocket4) 2026-10-14 접속 불가 (`PLANNING_DOC.md` §0) |
| Windows target 시험 실행 | NOT_RUN | cross sysroot 없음 (`ADOPTION_LEDGER.md` §재빌드) |
| MSVC CI(`windows-native`, `required`) | BLOCKED | 계정 결제 차단으로 job 미시작(§8 원문) |
| WebView2 부재 offline 설치 | NOT_RUN | offline 설치 profile 없음 (`BUILD_MANUAL.md` §산출물과 한계) |
| 코드 서명(Authenticode) | NOT_RUN | 조직 인증서·승인 없음, `unsigned-internal-candidate` |
| D08 재시작 후 두 대상 통합 보고서 | NOT_RUN | 판단·메모 포함 두 대상 통합 워크북의 재시작 후 생성 기록 없음 (`DOGFOOD_LEDGER_20261014.md` §Task outcomes) |
| 일괄 그룹 재시작 복원 | 미구현 | (`docs/UX_FLOW.md` §고급 모드, `PLANNING_DOC.md` §12) |
| 실제 사람 사용성 평가 | NOT_RUN | 수행하지 않음 (`PLANNING_DOC.md` §8.4) |
| 보조기기(AT) 판독 | NOT_RUN | 수행하지 않음, `ADOPTION_LEDGER.md` A11 |

## 8. CI 차단 기록(원문 인용 1회)

이 브랜치에서 GitHub Actions를 5회 시도했고, 최신 run(dispatch `39806914699`, PR
`39806920316`, HEAD `16d4b56`)은 시작되지 않았다. GitHub 표기 원문:

> The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings

실행된 step은 없다. 계정 결제 차단이며 시험·빌드 실패가 아니다. 근거:
`docs/ADOPTION_LEDGER.md` §「CI 시도와 차단 원인 (NOT_RUN / BLOCKED)」.

역사 기록으로, source `50941bd` CI run
[`37959883958`](https://github.com/snowman0919/krds-illegal-ad-detector/actions/runs/37959883958)의
`verify`, `windows-native`, `required`가 SUCCESS였고 b30 CI `37967025068`, 8b CI
`37967491010`의 Linux verify도 SUCCESS다. 이는 당시 commit의 기록이며 **현재 HEAD의
CI 통과를 뜻하지 않는다** (`ADOPTION_LEDGER.md` §마일스톤과 검증 범위).

## 9. 재현 명령

```sh
npm ci
npx playwright-core install chromium --only-shell
KRDS_TEST_UNSANDBOXED=1 npm run check
npm run build
node --test scripts/test/build-boundaries.test.mjs
node --test scripts/test/windows-runtime-closure.test.mjs
```

Windows 후보 검증은 [`BUILD_AND_RUN.md`](BUILD_AND_RUN.md) §6, 전체 절차는
[`docs/BUILD_MANUAL.md`](../BUILD_MANUAL.md)를 따른다.

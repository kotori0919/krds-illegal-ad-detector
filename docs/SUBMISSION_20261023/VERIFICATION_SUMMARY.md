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
| 코드 기준 commit(후보·전체 suite 동일) | `1c0e8a34c407776ea6fb16943a1e8c73961c6d77` |
| 교차 빌드 target | `x86_64-pc-windows-gnullvm` |
| LLVM-MinGW | `20260908`, clang `23.1.1`, `bin/clang` sha256 `bab7f174d7e136ae093ad232d5a894ee00f0a8f9051bcff4eb6a70c132898248` |
| NSIS | `3.09-4`(Ubuntu noble), makensis sha256 `ca9f28d9726d38d33b403187871af920b59c265eade7fa463684cf1e8b322d3e` |
| Windows 수용 호스트 | `ssh win` → `Pocket4`, `pocket4\dbsgu`, Windows 11 Pro `10.0.26200`, PowerShell `7.6.6`, Cua Driver `0.30.1` |

이번에는 **전체 suite와 후보 빌드가 같은 commit(`1c0e8a3`)에서 실행되었다.**
`85a286f` 후보(`76e7d5ec…`)는 이 후보로 대체(superseded)되었다. 근거:
`docs/ADOPTION_LEDGER.md` §「2026-10-23 통합 검증과 최종 후보」.

## 2. 로컬 suite

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 명령 | `PATH=/usr/bin:$PATH KRDS_TEST_UNSANDBOXED=1 npm run check` | `ADOPTION_LEDGER.md` §통합 검증과 최종 후보 |
| 종료 코드 | `0` | 같은 절 |
| 파일 수 | `Test Files 98 passed \| 1 skipped (99)` | 같은 절 |
| 테스트 수 | `Tests 754 passed \| 1 skipped (755)` | 같은 절 |
| 소요 시간 | `216.7`초 | 같은 절 |
| 내장 worker 런타임 | `22.19.0`(runtime lock `nodeVersion`) | 같은 절 |
| 원시 로그 | 저장소 밖 임시 경로(같은 절) | 같은 절 |

`KRDS_TEST_UNSANDBOXED=1`은 **소유 loopback fixture의 Chromium sandbox만** 해제한다.
외부 사이트 탐지나 배포본 sandbox를 우회하는 권한이 아니며 production 격리 증거로
전용하지 않는다 (`docs/BUILD_MANUAL.md` §공통 명령, `ADOPTION_LEDGER.md` 같은 절).

## 3. 빌드

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| `npm run build` | EXIT `0` | `ADOPTION_LEDGER.md` §통합 검증과 최종 후보 |
| `npm run build:desktop` | EXIT `0` | 같은 절 |
| `npm run package:windows` | EXIT `0` | 같은 절 |
| 런타임 closure 검증 | `node scripts/prepare-windows-runtime.mjs --verify` → EXIT 0, **1177 files** | 같은 절 |
| closure 시험 | `scripts/test/windows-runtime-closure.test.mjs` 8/8 | 같은 절 |
| closure lock | `scripts/windows-runtime.lock.json` 1177개 항목(`1c0e8a3` pruning 이전 1197) | 같은 절 |

`npm run build`는 contracts → evidence(보고서 포함) → web 순서로 컴파일한다
(`package.json` scripts, `docs/BUILD_MANUAL.md` §공통 명령).

## 4. Windows target Rust 검사

| 명령 | 결과 | 비고 |
| --- | --- | --- |
| `cargo check --target x86_64-pc-windows-gnullvm --all-targets` | EXIT `0` | Linux 호스트에서 교차 검사 |
| Windows target clippy(CI와 같은 명령) | EXIT `0` | 같은 절 |
| `cargo test --bins` | `80 passed / 0 failed / 2 ignored` | **호스트 실행**. Windows 실행이 아니다 |
| `cargo fmt --check` | EXIT `0` | 같은 절 |

근거: `docs/ADOPTION_LEDGER.md` §「2026-10-23 통합 검증과 최종 후보」. 이 절은 "Windows에서의
시험 실행(cross sysroot 없음)"을 NOT_RUN으로 명시하므로 `cargo test --bins`의 80 pass를
Windows 실행 결과로 읽지 않는다. CI의 Windows lane 정의는
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) `windows-native` job
(`cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`,
`cargo test --locked`, `integration-smoke --packaged`, `build:desktop`)이다.

## 5. Windows 설치 후보 identity

후보: `artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-307f6b6ff09b-20261023T013033441Z/`

| 항목 | 값 |
| --- | --- |
| buildId | `0.2.1-x86_64-pc-windows-gnullvm-307f6b6ff09b-20261023T013033441Z` |
| appVersion / target | `0.2.1` / `x86_64-pc-windows-gnullvm` |
| source.commit / dirty | `1c0e8a34c407776ea6fb16943a1e8c73961c6d77` / `false` |
| sourceSha256 | `307f6b6ff09b9ce04e0b157c6a9b9e1d87cf8c25148605e7731a4892addab731` |
| installer | `747,381,035` B (712.76 MiB), sha256 `753b873c2b1454eae27fb5524cafaf4f70e682ae6ad660be2412a877a44f5ebc` |
| standalone `krds-detector.exe` | `20,356,608` B, sha256 `112e1099daf303eacadee12339fa31083f96b55c6f61e8452aa33059b4cb8f9c` |
| 설치본 exe(marker 변환 후, `markerOffset` 13534994) | sha256 `b6cc4411d2feecb9048dbb8f7dc3ecd568a4a944c368bedb7cb3877270211699` |
| `releaseStatus` / `signing` | `candidate` / `unsigned-internal-candidate` |
| 빌드 도구(manifest `tools`) | node `v26.8.1`, rustc `1.98.1`, tauri `2.12.1` |

`verify-artifact` 결과: `node scripts/verify-artifact.mjs <candidate>/manifest.json`
EXIT `0`, **8 files, 8/8 hash 일치, 목록 밖 파일 없음**
(`ADOPTION_LEDGER.md` §통합 검증과 최종 후보). 이 검증은 설치 파일·native exe·manifest·
build/resource manifest·SBOM·Cargo license inventory·third-party notices의 무결성을
확인하며, **발행자 인증이 아니다**. standalone과 설치본 hash 차이는 Tauri의 `UNK`→`NSS`
marker 변환에 따른 예상된 차이다 (`docs/BUILD_MANUAL.md` §산출물과 한계).

installer 크기는 predecessor `…76e7d5ec…`(759.46 MiB, `796,348,611` B) 대비
**−46.7 MiB**다. `1c0e8a3`의 `onnxruntime` payload pruning(win32-x64만 staging)에 따른
결과이며, 스테이징 `node_modules`는 376 MB → 153 MB다.

## 6. Windows 11 실제 환경 수용 (v2, OBSERVED)

증거: `artifacts/win-verify-20261023/README.md` v2 절·`RECEIPT-v2.json`·`screenshots/v2-*`·
`exports-v2/`. 후보는 §5와 같다.

| 항목 | 관측값 |
| --- | --- |
| 전송·해시 | ASCII tar 767,805,440 B → installer 747,381,035 B, 4m32s, EXIT 0. Windows `Get-FileHash` installer `753b873c…f5ebc`, standalone `112e1099…8f9c` — 기대값 일치 |
| 설치(대화형 NSIS) | UAC 없음(per-user), "Setup was completed successfully". 설치본 EXE `b6cc4411…1699`, 20,356,608 B — expected installed-marker와 정확히 일치 |
| 실행 | 설치 관리자 Run 옵션으로 시작, 시작 화면 정상, 오류 대화상자 없음 |
| loopback 점검 | detached Node fixture(127.0.0.1:18777, SSH 세션 비소유) → case `8991fad4-6aa4-41f5-9227-03e7f8a0f986`: **탐지 17건**, 확인 **15페이지**, 실패 **0**, 경과 **15초**, 기법 `TRANSPARENT`/`HOMOGLYPH`/`JAMO`/`OFFSCREEN`, 서버 로그에 앱 요청 19건 |
| 닫힌 포트 | 127.0.0.1:18779(리스너 없음) → `502 access-navigation`(`network-policy` 아님) |
| 검토 | 근거 보기 + 판단 **`광고 의심`**(저장값 `suspected`) + 메모 저장 |
| 공식 JSON | 4,586 B, BOM 없음, 17 findings, `elapsed_sec` 15.407, sha256 `701ed484fc76106c1b94be34a9a1a461140e45d7f07a17f6d98f0eb6375f0a3d` — 저장된 `result.json`과 **byte-identical** |
| XLSX | 16,514 B, 6 시트(`점검 요약, 반복 항목, 탐지 상세, 페이지·점검 범위, 추가 분석, 검토 기록`), 메모·판단 라벨 포함. **Excel 열람은 NOT_RUN** |
| 재시작 | 종료 후 재실행: 메모 원문 복원, 담당자 판단 `광고 의심` 복원, 공식 bytes 불변 |
| 프로세스 | `krds-detector` 0, `setup` 0, `chrome`/`chromium` 0 (`msedgewebview2` 6은 기존 baseline) |
| 보존 | AppData 194 → 218 files, **추가 24·삭제 0·기존 수정 0**. 기존 케이스·설치본 삭제 없음 |

**v1 정정**: 같은 날 v1 기록이 loopback 점검을 `403 access-network-policy` 회귀로 적은
것은 **철회**한다. v1 fixture 서버는 스캔 시점에 이미 죽어 있었고(로그에 앱 요청 없음),
[INFERENCE] 닫힌 포트를 측정한 것이었다. v2는 살아 있는 loopback 서버의 정상 점검과
닫힌 포트의 `502 access-navigation` 분류를 모두 관측했다. v1 절은 역사 기록으로 남는다.

**범위 제한**: 이 결과는 Windows 11 설치본·대화형 UI에 대한 것이다. MSVC 제품 경로,
사람 사용성, 보조기기, 실제 Excel, D08 실제 앱 재시작 수용을 대신하지 않는다.

## 7. NOT_RUN 표

| 항목 | 상태 | 이유 / 근거 |
| --- | --- | --- |
| Windows MSVC CI(`windows-native`, `required`) | BLOCKED | 계정 결제 차단으로 job 미시작(§8 원문) |
| Windows target 시험 실행 | NOT_RUN | cross sysroot 없음 (`ADOPTION_LEDGER.md` §통합 검증과 최종 후보) |
| D08 실제 Tauri window 재시작 후 통합 보고서 | NOT_RUN | 그룹 파일·IPC·재마운트 복원·통합 XLSX 재생성은 구현·자동 시험으로 확인(`bdcc0e8`). 설치된 앱 프로세스를 실제로 재시작하는 Windows 수용 시험은 없음 |
| 기기 간 그룹 이식 | NOT_RUN | `bdcc0e8` commit message에 명시 |
| WebView2 부재 offline 설치 | NOT_RUN | offline 설치 profile 없음 (`BUILD_MANUAL.md` §산출물과 한계) |
| 코드 서명(Authenticode) | NOT_RUN | 조직 인증서·승인 없음, `unsigned-internal-candidate` |
| Excel에서 내보낸 XLSX 실제 열람 | NOT_RUN | v2 수용에서 파일 구조만 검증 |
| 무인 설치·제거·선행 후보 업그레이드 스크립트 경로 | NOT_RUN | 대화형 "Already Installed" 재설치만 수행 |
| 실제 사람 사용성 평가 | NOT_RUN | 수행하지 않음 (`PLANNING_DOC.md` §8.4) |
| 보조기기(AT) 판독 | NOT_RUN | 수행하지 않음, `ADOPTION_LEDGER.md` A11 |

## 8. CI 차단 기록(원문 인용 1회)

이 브랜치에서 GitHub Actions를 5회 시도했고, 최신 run(dispatch `39806914699`, PR
`39806920316`, HEAD `16d4b56`)은 시작되지 않았다. GitHub 표기 원문:

> The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings

실행된 step은 없다. 계정 결제 차단이며 시험·빌드 실패가 아니다. 근거:
`docs/ADOPTION_LEDGER.md` §「CI 시도와 차단 원인 (NOT_RUN / BLOCKED)」. 최종 HEAD
`1c0e8a3`에서도 CI는 시작되지 않았다.

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

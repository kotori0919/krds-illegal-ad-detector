# 유지보수 인계

수신팀은 [빌드 매뉴얼](BUILD_MANUAL.md)의 준비/검증/packaging 명령부터 실행한다. source build ID와 탐지 정책 버전은 별개다. 현재 내부 후보는 앱 0.2.1, 정책 2, Case schema 1이다. 과거 0.1.0 결과/설치본을 덮어쓰거나 새 정책 결과와 같다고 취급하지 않는다. [계약 명세](CONTRACTS.md)는 설정, 진행, 공식 JSON, Case와 검토의 wire/disk 경계를 정의한다.

## 소유 경계와 변경 방법

| 경계 | 책임 | 변경 후 좁은 검증 |
|---|---|---|
| packages/contracts | 공식 JSON, location, progress/detail/review 계약과 한계 | TS fixture + native conformance |
| packages/scanner | URL/transport/DNS/redirect, bounded collection, rendering/frame observation | 실제 Chromium controlled fixture + locator round trip |
| packages/detection | 순수 원문 정규화/span/의미, 규칙, scan orchestration | 순수 regression + live scan |
| packages/evidence | 자산/OCR, extra contribution, bounded graph/review/report projection | 해당 consumer 행동/실제 report artifact |
| src-tauri | 검증, process/Job/watchdog, session, CaseStore/원본 export | native harness + Windows 변경 경계 |
| apps/web | typed HostBridge, 사례/선택/검토 UI | 해당 UI smoke + keyboard/reflow |
| scripts/CI | 고정 입력, 오프라인 build, source/resource/artifact provenance | script boundary tests + 식별 후보 packaging |

브라우저 측정은 adapter이고 순수 텍스트 정책에서 Playwright를 호출하지 않는다. UI는 네이티브 내부나 임의 경로에 직접 접근하지 않는다. Rust는 의미 탐지를 다시 구현하지 않는다. 테스트 서버 시작은 test/benchmark harness가 소유하며 production scan import에 서버가 들어가면 안 된다. 사례 원본은 native store가 소유하고 검토 revision은 별도다. 기존 오류를 고쳐 future finding이 달라질 때 정책 버전과 기대값 변경 이유를 함께 남긴다.

[탐지 확장](DETECTORS.md)은 실제 zero-width extra 경계와 테스트 전용 예제를 설명한다. 계약 개정 시 공식 schema와 내부 IPC/Case schema를 혼동하지 말고 TS/Rust 공유 양성/음성 fixture를 함께 갱신한다. Case 미래 버전을 빈 사례로 읽거나 destructive downgrade하지 않는다. schema migration이 필요하면 새 버전이 쓰기 전에 백업하고 실패/복구/구형 열기를 검증한다.

## 일상 검증과 의존성 변경

`npm run check`는 빠른 타입/lint/unit 경계다. 실제 worker는 `npm run test:integration`으로 한 번 확인한다. 브라우저 격리가 지원되지 않는 Linux 시험 환경에서는 테스트 파일만 `KRDS_TEST_UNSANDBOXED=1`을 명시할 수 있다. 이 adapter는 Vitest setup에만 있고 생산 worker/UI에서 읽지 않는다. 따라서 이 결과는 sandbox 수용 증거가 아니다. Windows CI/실행 후보에서 격리를 따로 관찰한다. 코드 변경 없는 문서 수정 때문에 역사 전체 installer/benchmark matrix를 반복하지 않는다.

`npm ci`/`cargo --locked`를 기본으로 하고 자동 대규모 upgrade를 하지 않는다. 업데이트 이유, 호환성/라이선스/보안 영향, lockfile diff, 관련 consumer 검증을 남긴다. runtime 변경은 reviewed `windows-runtime.lock.json` 해시와 실제 install payload를 함께 갱신한다. production에는 test fixture/mock/server를 bundle하지 않는다.

2026-10-09 `npm audit --json` OBSERVED: 6 package 항목(3 moderate/1 high/2 critical)이 보고됐다. Vitest 3.2.7, tinypool, @vitest/mocker 항목은 개발 test runner에 있고 설치 worker 런타임에는 없다. untrusted PR 코드를 개인 privileged runner에서 실행하지 않는다. source-map-js는 PostCSS 빌드 입력이고 packaged browser scanner 입력은 아니다. ExcelJS 4.4.0의 uuid 8 항목은 런타임 의존성에 존재한다. 해당 advisory는 buffer를 받는 v3/v5/v6 경로이며 현재 workbook writer의 v4 사용이 그 조건에 도달하지 않는다는 것은 STATIC_REVIEW/INFERRED이며 일반 무취약 주장으로 바꾸지 않는다. 자세한 advisory ID/범위는 해당 후보 npm audit 원본을 함께 보관한다. 자동 제안은 Vitest major upgrade 또는 ExcelJS downgrade를 포함하므로 적용하지 않았다. 네트워크 audit는 별도 준비 단계이며 cached packaging이 새 네트워크 검사에 의존하지 않는다.

`npm run supply-chain -- <folder>`는 locked production npm CycloneDX와 대상 Windows Cargo license inventory/notices를 만든다. dependency graph는 build/platform inputs를 포함하므로 모두 실제 배포된 코드라는 뜻은 아니다. 실제 파일은 resource manifest와 대조한다. root notice 누락/미선택 first-party license는 license-review.json에 남고 소유자 결정 없이 선택하지 않는다.

## 독립 평가와 증거의 범위

새 authored holdout은 `packages/synth-eval/test/holdout`이고 감사 regression이나 역사 617 레코드 표시 fixture와 다르다. gold를 보고 탐지기를 조정하면 해당 세트는 regression으로 옮기고 새 holdout으로 평가한다. 벤치마크 명령과 scope는 `benchmarks/adoption-holdout.mjs`에 있다. per-technique TP/FP/FN, actual locator resolution, coverage, full analysis wall time, 관측 가능한 process-tree RSS를 기록한다. 작은 표본에 p95/보편 성능/TP21 독립성/캘리브레이션된 confidence를 만들지 않는다. mock/리플레이/테스트 전용 sandbox 예외는 실제 native 설치/production 격리 증거와 분리한다.

인계 시 commit/source/build/policy ID, 변경 경계, 실행한 명령·출력 범위, 못 실행한 정확한 이유, 다음 소유자를 적는다. OBSERVED/MEASURED/STATIC_REVIEW/INFERRED/NOT_RUN을 구분한다. 최신 후보 판정은 별도 adoption handoff를 확인하고 [역사 RC](RELEASE_CANDIDATE.md)는 그때의 파일/도구/조건에만 적용한다.

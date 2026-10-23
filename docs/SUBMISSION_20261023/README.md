# 2026-10-23 제출물 묶음 — 공공 웹사이트 불법광고 탐지 도구

2026 행정안전부 / 한국지능정보사회진흥원 "공공 웹사이트 불법광고 탐지 도구 개발
공모전" 제출에 함께 내는 문서 묶음이다. 외부 요약이 아니라 저장소 안의 실제 실행
기록을 인용한다. 이 묶음은 제출 준비 상태를 스스로 선언하지 않으며, 어떤 항목이
실행되었고 어떤 항목이 실행되지 않았는지만 구분해 적는다.

- 기획서(본문 5–10쪽): [`docs/PLANNING_DOC.md`](../PLANNING_DOC.md)
- 이 묶음의 요약 신청서: [`APPLICATION_SUMMARY.md`](APPLICATION_SUMMARY.md)
- 검증 기록: [`VERIFICATION_SUMMARY.md`](VERIFICATION_SUMMARY.md)
- 빌드·실행 절차: [`BUILD_AND_RUN.md`](BUILD_AND_RUN.md)
- 한계와 위험: [`LIMITATIONS_AND_RISKS.md`](LIMITATIONS_AND_RISKS.md)
- 주장–증거 대응표: [`EVIDENCE_INDEX.md`](EVIDENCE_INDEX.md)

## 1. 기준 소스

| 항목 | 값 |
| --- | --- |
| 저장소 origin | `https://github.com/snowman0919/krds-illegal-ad-detector.git` |
| 브랜치 | `dev/bootstrap` |
| 코드 기준 commit | `85a286f5fcaf125fcadec155eac729bfe019db92` |
| 이 묶음 작성 시점 HEAD | `37168549ee699e815d4ae4d17241374fd8c833a6` (85a286f + 문서 commit) |
| 앱 버전 / 탐지 정책 | `0.2.1` / `0.2.1-policy2` |
| Case / detail / config / policy 계약 | `1` / `2` / `1` / `2` |

Windows 후보의 `source.commit`은 후보 `manifest.json`에 기록된
`85a286f5fcaf125fcadec155eac729bfe019db92`다. 이 문서 묶음의 commit은 후보 빌드
이후에 추가된 문서 변경이므로 후보 identity에 포함되지 않는다. 근거:
[`docs/ADOPTION_LEDGER.md`](../ADOPTION_LEDGER.md) §「2026-10-23 후보 재빌드와 검증」.

## 2. 제출물 목록

| # | 파일 | 내용 | 상태 |
| --- | --- | --- | --- |
| 1 | `docs/SUBMISSION_20261023/README.md` | 제출물 안내와 체크리스트(이 문서) | 준비됨 |
| 2 | `docs/SUBMISSION_20261023/APPLICATION_SUMMARY.md` | 신청서 지원용 2–3쪽 요약 | 준비됨 |
| 3 | `docs/SUBMISSION_20261023/VERIFICATION_SUMMARY.md` | 로컬·교차 빌드 검증 기록과 NOT_RUN 표 | 준비됨 |
| 4 | `docs/SUBMISSION_20261023/BUILD_AND_RUN.md` | 수신팀용 최소 빌드·실행 절차 | 준비됨 |
| 5 | `docs/SUBMISSION_20261023/LIMITATIONS_AND_RISKS.md` | 한계·위험과 완화 방향 | 준비됨 |
| 6 | `docs/SUBMISSION_20261023/EVIDENCE_INDEX.md` | 주장별 증거 파일·해시 대응표 | 준비됨 |
| 7 | `docs/PLANNING_DOC.md` | 공모전 기획서 본문 | 준비됨 |
| 8 | `docs/BUILD_MANUAL.md` | 전체 빌드 매뉴얼(수신팀 기준) | 준비됨 |
| 9 | `docs/USER_MANUAL.md` | 사용자 매뉴얼(간단·고급 모드) | 준비됨 |
| 10 | `docs/OPERATIONS_GUIDE_KO.md` | 운영·배포·백업·제거 인계 | 준비됨 |
| 11 | `docs/DATA_HANDLING_KO.md` | 원본·검토·진단 데이터 처리 | 준비됨 |
| 12 | Windows 설치 후보 | `artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-76e7d5ec6ce4-20261022T163747830Z/` | 산출물 있음(서명 없음) · Windows 설치 수용 미실행 |

## 3. Windows 설치 후보 식별

| 항목 | 값 |
| --- | --- |
| buildId | `0.2.1-x86_64-pc-windows-gnullvm-76e7d5ec6ce4-20261022T163747830Z` |
| target | `x86_64-pc-windows-gnullvm` (Linux 교차 빌드, Tauri "실험적" 표시) |
| source.commit / dirty | `85a286f5fcaf125fcadec155eac729bfe019db92` / `false` |
| sourceSha256 | `76e7d5ec6ce4f9d2b7b5446b2ae29f934a2c85f98dc76821b4225a106af90b19` |
| installer 파일명 | `불법광고 탐지 도구_0.2.1_x64-setup.exe` |
| installer 크기 | `796,348,611` B (759.46 MiB) |
| installer SHA-256 | `54c8f1cdff25e9077a2432b8e75af14cef7597fe1fb21eb8325fbb6b6dfdf406` |
| standalone `krds-detector.exe` | `20,220,928` B, SHA-256 `bd57296b8823ff79d0aa9da6c7e9dc578cb3ac853a086be1f1b690cc69bac121` |
| 설치본 exe(marker 변환 후) | SHA-256 `8059cb5d93fecccf013b3645d046bc9d8f8ae26bbe498896492b4dee8f61413e` |
| artifact verify | `node scripts/verify-artifact.mjs <candidate>/manifest.json` EXIT 0, 8 files, 8/8 hash 일치, 목록 밖 파일 없음 |
| `signing` 값 | `unsigned-internal-candidate` |

같은 날 먼저 만든 후보 `candidate-0.2.1-...-3fb23ff998ea-20261022T160030222Z`
(source `16d4b56…`, installer `c76c133f…`)는 **대체(superseded)되었고** 현재 후보가
아니다. 삭제하지 않고 `/mnt/nas/illegal-ad-artifacts-archive-20261023/`로 이동했다.
현재 후보의 SHA-256은 위 표의 `54c8f1cd…df406` 하나뿐이다. 근거: `ADOPTION_LEDGER.md`
§「재빌드 (85a286f)」, `/mnt/nas/illegal-ad-build/moved-artifacts-20261023.txt`.

## 4. 체크리스트

### 준비됨 (근거 있는 항목)

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 소스·브랜치·HEAD 식별 | 준비됨 | 이 문서 §1, 후보 `manifest.json` |
| 기획서 본문 | 준비됨 | `docs/PLANNING_DOC.md` |
| 빌드 매뉴얼 | 준비됨 | `docs/BUILD_MANUAL.md` |
| 사용자 매뉴얼 | 준비됨 | `docs/USER_MANUAL.md` |
| 운영·데이터 인계 | 준비됨 | `docs/OPERATIONS_GUIDE_KO.md`, `docs/DATA_HANDLING_KO.md` |
| Windows 후보 파일·크기·SHA-256 | 준비됨 | 후보 `manifest.json`, `ADOPTION_LEDGER.md` §재빌드 |
| artifact verify 8/8 | 준비됨 | EXIT 0, `ADOPTION_LEDGER.md` §재빌드 |
| 로컬 검사 704 passed / 1 skipped | 준비됨 | `ADOPTION_LEDGER.md` §「소스·시험 상태」 |
| `npm run build` | 준비됨 | EXIT 0, 같은 절 |
| Windows target `cargo check`/clippy | 준비됨 | EXIT 0, `ADOPTION_LEDGER.md` §재빌드 |
| 런타임 closure lock | 준비됨 | `--verify` 1197 files |
| 증거 원장 | 준비됨 | `ADOPTION_LEDGER.md`, `DOGFOOD_LEDGER_20261014.md` |
| 문서 6종 상호 참조 | 준비됨 | 이 디렉터리 |

### 미실행 (NOT_RUN)

| 항목 | 이유 |
| --- | --- |
| Windows 11 설치·대화형 UI 수용 | 교차 빌드 후보를 Windows에서 실행·설치한 기록이 없다. Windows 검증 호스트(Pocket4)는 2026-10-14 접속 불가였다. |
| Windows MSVC CI (`windows-native`, `required`) | GitHub Actions job이 계정 결제 차단으로 시작되지 않았다(§5 인용). 시험 실패가 아니다. |
| WebView2 부재 상태의 완전 오프라인 설치 | offline 설치 profile이 없고 검증하지 않았다. |
| 코드 서명(Authenticode) | 조직 인증서·승인 절차가 없어 후보는 서명 없는 내부 평가용이다. |
| D08 재시작 후 두 대상 통합 보고서 | 판단·메모가 포함된 두 대상 통합 워크북이 재시작 후 생성된 기록이 없다. |
| 실제 사람 사용성 평가·보조기기(AT) 판독 | 수행하지 않았다. |

## 5. CI 차단 기록(원문 인용)

GitHub Actions는 5회 시도했고, 수정 후 최신 run(dispatch `39806914699`, PR
`39806920316`, HEAD `16d4b56`)은 시작되지 않았다. GitHub 표기 원문:

> The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings

실행된 step은 없다. 계정 결제 차단이며 시험·빌드 실패가 아니다. **CI 통과를 주장하지
않는다.** 근거: `docs/ADOPTION_LEDGER.md` §「CI 시도와 차단 원인 (NOT_RUN / BLOCKED)」.

## 6. 읽는 순서

1. 이 문서 §4 체크리스트로 무엇이 준비되고 무엇이 미실행인지 확인한다.
2. `APPLICATION_SUMMARY.md`로 제품 범위와 판정 구조를 읽는다.
3. `VERIFICATION_SUMMARY.md`로 실제 실행 수치와 NOT_RUN 경계를 확인한다.
4. `BUILD_AND_RUN.md`로 수신 환경에서 빌드·검증을 재현한다.
5. `LIMITATIONS_AND_RISKS.md`를 반드시 함께 읽는다.
6. 인용 수치의 출처는 `EVIDENCE_INDEX.md`에서 추적한다.

## 7. 표기 규칙

`OBSERVED`는 해당 환경에서 실제로 실행·관찰한 기록, `MEASURED`는 계측값,
`NOT_RUN`은 실행 기록이 없는 항목, `BLOCKED`는 외부 원인으로 시작조차 못 한 항목이다.
이 저장소는 "구현됨"과 "검증됨"을 구분하며, 한 환경의 결과를 다른 환경(예: Linux
fixture → Windows 설치본)으로 전용하지 않는다. 모든 수치는 인용한 문서의 절 단위까지
추적 가능해야 하고, 추적할 수 없는 수치는 싣지 않는다.

## 8. 관련 문서

- 채택 인계: [`docs/ADOPTION_HANDOFF_KO.md`](../ADOPTION_HANDOFF_KO.md)
- 채택 원장: [`docs/ADOPTION_LEDGER.md`](../ADOPTION_LEDGER.md)
- 도그푸드 원장: [`docs/DOGFOOD_LEDGER_20261014.md`](../DOGFOOD_LEDGER_20261014.md)
- 화면 명세: [`docs/SCREEN_SPEC.md`](../SCREEN_SPEC.md), 흐름: [`docs/UX_FLOW.md`](../UX_FLOW.md)
- 설계 결정: [`docs/ADR/0016-separate-ui-mode-from-scan-transport.md`](../ADR/0016-separate-ui-mode-from-scan-transport.md), [`docs/ADR/0017-bounded-animation-and-korean-banner-ocr.md`](../ADR/0017-bounded-animation-and-korean-banner-ocr.md)
- CI 정의: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)

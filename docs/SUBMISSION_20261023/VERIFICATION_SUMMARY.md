# 검증 기록 요약

> 제품 `dd5ceb4`, source `8628ba4a4488…`, 서명 없는 gnullvm 내부 평가 후보.
> Windows에서 NIA 5페이지·실패 0, 공개 두 대상 저장·재시작 복원·통합 XLSX·Excel 열람을 확인했다.
> JS/TS 770 passed / 1 skipped, 최종 native 82 passed / 0 failed / 2 ignored. 전체 E2E·제출 완료 표시는 아니다.

## 1. 실행 환경과 소스

- Linux x64, Rust 1.98.1. Windows 교차 target `x86_64-pc-windows-gnullvm`.
- LLVM-MinGW 20260908 / clang 23.1.1, NSIS 3.09-4. 내장 Node 22.19.0, runtime closure1177 files.
- Windows11 Pro10.0.26200, Pocket4, PowerShell7.6.6, Cua Driver0.30.1.
- 제품 commit `dd5ceb414e941ea8deef448899d1042e8d49a010`, source SHA-256
  `8628ba4a4488d9b3c6bf9a3080151784b1376aa7ced929f6cce545eb7b64b97c`.
- 빌드 시 dirty=true는 제출/인계 문서 편집이다. 제품 파일은 커밋되어 있으며 manifest를 고쳐 쓰지 않는다.

## 2. 자동 검사 (OBSERVED)

| 검사 | 실제 결과 | 근거 |
| --- | --- | --- |
| scanner build 후 `KRDS_TEST_UNSANDBOXED=1 npm run check` | EXIT0, 99 files passed/1 skipped, 770 tests passed/1 skipped, 220.15s | resumed-validation/check.log |
| Node build-boundaries/runtime-closure | 13 passed/0 failed | resumed-validation/build-boundaries.log |
| 최종 native host `cargo test --bins --locked --offline` | EXIT0, 82 passed/0 failed/2 ignored, 15.28s | restored-progress-native-verified.log |
| fmt | EXIT0 | restored-progress-windows-checks.log |
| Windows gnullvm clippy all-targets `-D warnings`, check all-targets | 둘 다 EXIT0 | 같은 로그 |

위 로그의 공통 경로는 `artifacts/dogfood-20261023/resumed-validation/`이다.
770/1 suite의 소스 hash는 `70a599fb…`이며, 이후 `dd5ceb4`는 네이티브 사례 복원과
그 회귀 시험만 변경했다. JS/TS·worker는 동일하고 최종 native만 다시 검사했다.
`KRDS_TEST_UNSANDBOXED=1`은 소유 loopback fixture의 Linux Chromium에 한정된다.
Windows 설치본의 Chromium sandbox·네트워크 정책·호스트 제한은 유지했다.

초기 전체 검사에서1초 취소 fixture의 회귀를 발견해 준비 guard를 제거했고, stale dist로
실행한 첫 재검사도 보존했다. canonical scanner 재빌드 후 전체 검사를 통과했다.
추가 native 시험 fixture의 pageOutcomes 누락과 canonical formatting 비교 오류도 수정했다.
실패 로그와 최종 로그를 함께 보존하며 재시도만으로 통과 처리하지 않았다.

## 3. 수정과 검증 경계

| 결함 | 수정 | 관측 |
| --- | --- | --- |
| NIA200 이후 JS 이동 시 홈페이지 누락 | committed main document 추적, 준비 단계 최대2회 전환, 최종 상태 분류 | loopback 회귀13건, Windows source worker·최종 설치본 NIA 5 checked / 0 failed |
| D08 묶음 저장 거부 | 공통 serializer에서 값 없는 error/finishedAt 생략, 실제 오류 유지 | native 회귀, 최종 설치본 공개 두 대상 저장·실제 재시작 복원 2/2 |
| 복원 카드 카운터0 | 검증된 저장 evidence의 checked+failed를 open_case에서 progress로 복원 | persistent roundtrip 시험과 최종 설치본의 기존·신규 그룹 카운터 복원 확인 |

문서 전환 수정은 host·port 경계, 기존 페이지/전체 마감, 단일 live 분석을 유지한다.
콜백 실행 뒤 문서가 바뀌면 stale 결과를 성공으로 남기지 않는다. Correction D는
중간 실험 이력이며 현재 구현은 `3598f48`이다. 검증기 완화나 특정 사이트 예외는 없다.

## 4. 최종 Windows 설치본 관측 (8628ba4a, OBSERVED_CUA_OPERATOR)

공통 증거 경로는 `artifacts/dogfood-20261023/resumed-windows/`다.
Cua Driver로 실제 설치본을 조작했다. 사람 사용성 평가나 기관 수용을 뜻하지 않는다.

| 경로 | 실제 관측 | 근거 |
| --- | --- | --- |
| 대화형 재설치 | NSIS Installation Complete, 예상 installed EXE·worker hash 일치 |0164·0170, installed-final-receipt.json |
| NIA 단일 | 최대 5페이지·깊이 1·90초, 5 checked / 0 failed / 0 findings, 18.414초. 진입200 checked, 최종 `/site/nia_kor/main.do` |0246·0252, nia-final-receipt.json |
| 공개 두 대상 batch | 입력한 페이지만(1페이지·깊이0·60초), 기본 연결. NIA complete(1 checked / 0 failed), 정부24 blocked(0 checked / 1 failed), 각각 findings0. 저장2/2 |0191·0194, batch-final-complete-verified-receipt.json |
| 실제 재시작 | PID14196 정상 종료 후 새 PID28640. 두 caseId·complete/blocked 상태·확인 시도1/1·실패0/1 복원 |0204·0212·0214, batch-final-restart-comparison.json |
| 공식 원본 | 두 공개 사례의 재시작 전후 result SHA-256 동일 | 같은 comparison |
| 통합 XLSX | 전후 7개 시트의 모든 셀 값 동일, 수식0, ZIP 정상. 사례·확인/실패수·최종URL·external-redirect도 대조 | exports/restart-final-workbook-comparison.json |
| 실제 Excel | 통합 보고서 7시트·대상 요약의 확인1/0·실패0/1·완료/접근제한 관측, 복구 경고 없음 |0224·0230 |
| 소유 단일 양성 복원 | 이전 설치에서 만든 17 findings / 15 checked / 0 failed 사례를 최종 앱에서 재열기. f13 메모 원문·광고 의심·검토 완료, review revision3 보존 |0263, positive-final-receipt.json |
| 양성 공식 JSON |4,586B, BOM 없음,17 findings, 설치 전 result.json과 byte-identical. SHA `ee73ffa07ac758efff7dfd6bceb7e6f0a4c2b1a2e945c8105b47019ed554f0bd` | exports/positive-final-official.json |
| 양성 XLSX |16,508B,6시트, 탐지 상세18행·검토 기록2행. f13 메모·검토 완료·위반 의심 포함, 수식0·ZIP 정상. 실제 Excel 검토 시트 관측 | exports/positive-final-workbook-inspection.json,0289 |
| 보존·종료 | 최초36사례286파일 전부 byte-identical. 설치 전40사례338파일 중337개 불변·기존 그룹 updatedAt만1건 갱신. 삭제0·예상치 못한 변경0, 현재43사례. 앱·Excel·소유 worker·시험 listener0 | final-closed-receipt.json, owned-cleanup.log |

정부24는 `https://plus.gov.kr/`로 외부 이동해 미점검으로 남는다. 성공 점검이나
문제 없음으로 간주하지 않는다. 공개 두 대상의 탐지가0건이므로 **판단·메모를 포함한
두 대상 통합 D08 수용은 NOT_RUN**이다. 소유 단일 양성은 별도 보충 증거다.

신규 그룹은 `c92ac68e-e7f7-497f-bdeb-378cf5ac3a84`이며 NIA case
`5661f10f-40af-4ba0-a2c8-df2a04c3e62a`, 정부24 case
`58d39d56-29c9-49d7-baa4-9354f7d4cacd`를 연결한다.
NIA 5페이지 단일 case는 `324adbc4-c8ba-4807-9991-590670d5d12c`,
보충 양성 case는 `83af74d3-34b3-46df-b7cd-419064f21e22`다.

보존 검사가 기존 그룹 `38c182c0…`의 변경을 탐지했다. 실제 파일과 설치 전 백업을
대조한 결과 명시적 복원 시 `updatedAt`만 갱신됐고 대상·caseId·상태는 같았다.
그 정확한 파일의 다른 필드가 모두 같은 증가 시각 갱신만 예상 변경으로 기록했다.
다른 변경·삭제는 계속 실패시킨다. 제품 검증기는 변경하지 않았다. 초기 검사 실패도 보존했다.

## 5. 전달 후보와 이전 후보 구분

buildId `0.2.1-x86_64-pc-windows-gnullvm-8628ba4a4488-20261023T061726351Z`.
`build:desktop`, `package:windows`, `verify:artifact` EXIT0,8개 파일 검증·runtime1,177파일.
파일별 크기·해시는 [EVIDENCE_INDEX.md](EVIDENCE_INDEX.md) §1을 따른다.
빌드 후 제품 소스를 바꾸지 않았으며 문서 커밋은 별도다.

- `0361562d…`: NIA 진입 누락·D08 저장 실패가 재현된 이전 후보. 최종 통과본이 아니다.
- `70a599fb…`: NIA5/0·공개2대상 저장/재시작/보고서는 확인했으나 복원 카드 카운터0 결함 발견.
  최종 후보에서 같은 경로를 다시 관측했고 중간 후보와 실패 증거는 보존했다.
- 양성 fixture의 탐지17개는 기존 Windows v3와 주소·위치·기법·원문·판정 튜플 및 순서가
  동일하다(`positive-findings-comparison.json`). ML 모집단 재현율 주장은 아니다.

## 6. 정밀도 재측정 (Linux, `f481d73`, MEASURED)

`e54fe63`의 규칙 강화(정산 앵커 `가입코드`/`테더`/`usdt`로 축소, `환전`·`꽁머니`·`롤링`은
리베이트 용어로만, `첫충`은 `/첫충(?!전)/`)를 **같은 190개 입력**에 다시 적용했다.
입력은 `artifacts/vision-cpu-20261022/inputs.json`, sha256
`eb1572b6162e76790ae477d921ae5ee1b96789bb7370add137c78a9f3a3e8ad3`이다. 원시 자료:
`/mnt/nas/illegal-ad-artifacts-archive-20261023/vision-cpu-current-head/`.

| 묶음 | 결과 | 이전 측정 대비 |
| --- | --- | --- |
| 실제 출처 불법광고 배너 | `60/60` | 동일 |
| 실제 정상 광고 오탐 | `0/74` | 동일 |
| 파생 양성 대조군 | `17/18` | 동일 |
| 파생 정상 대조군 오탐 | `0/38` | 동일 |

판정이 바뀐 7행(`knownBlacktoon` original-1·2·3·4·5·8, `positive-bets8`)은 모두
**v4 검토 → v3 규칙**으로 강화된 양성이며 pass/fail이 바뀐 행은 없다. 남은 누락은
파생 `new-positive-butter` 1건이다. 이 표는 Linux CPU 환경의 측정이며 Windows 이미지
경로의 실행 증거가 아니다. 상세: `docs/VISION_CPU_OPTIMIZATION_20261022.md` §정확도.


## 7. 미실행 항목

| 항목 | 상태 | 경계 |
| --- | --- | --- |
| 판단·메모 포함 공개2대상 D08 | NOT_RUN | 공개 두 대상 탐지0건, 소유 단일 양성은 별도 증거 |
| Windows MSVC CI/제품 경로 | BLOCKED/NOT_RUN | 계정 결제 차단 이력, 새 remote 실행 없음 |
| Windows Rust 단위 시험 실행 | NOT_RUN | host 실행과 교차 check만 수행 |
| 강화된 이미지 광고의 Windows 실사이트 경로 | NOT_RUN | Linux190입력 역사 측정과 구분 |
| 기기 간 그룹 이식 | NOT_RUN | 동일 PC 재시작만 확인 |
| WebView2 부재 offline 설치/무인 관리·제거 | NOT_RUN | 대화형 per-user 재설치만 확인 |
| 코드 서명 | NOT_RUN | unsigned-internal-candidate |
| 사람 사용성·AT·저사양 목표환경 | NOT_RUN | Cua 조작·현재 PC 관측과 구분 |

## 8. CI 차단 기록(원문 인용 1회)

이 브랜치의 Actions는 5회 시도 후 계정 결제 차단으로 job이 시작되지 않았고, 이후
push(`1c0e8a3`, `e87799a`, `ee123bb`, `e54fe63`, `f481d73`)에 대해서도 동일하게 시작되지
않았다. 당시 기록된 시도는 HEAD `16d4b56`(dispatch `39806914699`, PR `39806920316`)이며 그조차
실행된 step은 0개다. GitHub 표기 원문:

> The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings

실행된 step은 없다. 계정 결제 차단이며 시험·빌드 실패가 아니다. 근거:
`docs/ADOPTION_LEDGER.md` §「CI 시도와 차단 원인 (NOT_RUN / BLOCKED)」.

역사 기록으로, source `50941bd` CI run
[`37959883958`](https://github.com/snowman0919/krds-illegal-ad-detector/actions/runs/37959883958)의
`verify`, `windows-native`, `required`가 SUCCESS였고 b30 CI `37967025068`, 8b CI
`37967491010`의 Linux verify도 SUCCESS다. 이는 당시 commit의 기록이며 **현재 HEAD의
CI 통과를 뜻하지 않는다** (`ADOPTION_LEDGER.md` §마일스톤과 검증 범위).


## 9. 재현 자료

정확한 명령·버전·실패와 최종 결과는 `resumed-validation/COMMANDS.md`와
`check-native-final.sh`, Windows `resumed-windows/*.ps1`, Cua 원시 요청/응답에 보존했다.
빌드 절차는 [BUILD_AND_RUN.md](BUILD_AND_RUN.md)를 따른다.

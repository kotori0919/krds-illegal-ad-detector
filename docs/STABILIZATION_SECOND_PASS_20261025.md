# 두 번째 안정화 패스 — 2026-10-25

## 인계와 검증 소스 식별

부모의 첫 검수는 국소 이벤트 경합 수정만 승인하고 제품 전체 안정화/출시는 보류했다.
원문을 [첫 패스 독립 검수](STABILIZATION_FIRST_PASS_REVIEW_20261025.md)에 보존했다.
`/tmp/krds-independent-review-nqkxyzrd/`의 REVIEW_KO, ancestry, full-test, integration,
identity, source-verification 파일은 이 worktree의
`artifacts/stabilization-pass2-20261025/independent-review/`에 바이트 그대로 복사하고
SHA256SUMS.json을 남겼다. 독립 검수의 실행과 이번 실행을 구분한다.

이번 제품 코드/시험/probe 커밋은 **7395be2452a3a6a9b2da0f18361378682596923c**다.
그 뒤에는 인계 및 운영 안내 문서만 커밋한다. 기존 branch
`codex/stabilize-first-pass-20261025`와 worktree
`/home/monad/Documents/Codex/2026-10-25/task/krds-stabilization`를 이어 사용했다.
원본 `/home/monad/develop/illegal_ad`의 HEAD7bf3e683과 기존 worktree는 보존했다.

실행 wrapper `artifacts/stabilization-pass2-20261025/verify.py`가 각 실행의
`.receipt.json`, `.sources.json`, `.log`를 만든다. commit/Git tree/status, 비문서
코드·fixture의 파일별 SHA256/종합 SHA256, 명령 인수, Node/npm/OS, 필요한 환경 플래그,
UTC 시작/종료, exit, log SHA256, wrapper SHA256 및 실행 전후 코드 동일성을 보존한다.
코드·fixture의 종합 SHA256은
`77a9fe529b5ab770c9db848ea9587ba5fb9ced94a6dd5d25c27293a543ea0893`다.
이 해시는 Git tree 자체나 제품 빌드 sourceSha와는 다른, 소스 manifest JSON의 해시다.
범위는 Git 추적/비ignored 미추적 파일에서 docs/artifacts 및 Markdown을 제외한 파일이다.

빌드 스크립트 `sourceIdentity`와 같은 경로+NUL+파일 SHA 알고리즘의 제품 sourceSha는
`774dbb973b4a1453065bf9c8a8f3c24428fa73a5544e993ca62c5ea3d9f57dfd`(290파일)이다.
`product-source-identity.json`에 경로별 해시를 보존했다. 기본 샌드박스에서 Node의
spawnSync(git)가 EPERM을 보고해 Python으로 같은 알고리즘을 계산했다. 이 과정의
문서 dirty 상태도 기록했으며 clean candidate나 Windows 빌드 결과로 표시하지 않는다.
최종 문서 commit의 hash를 실행 당시 commit으로 소급하지 않는다. 최종
`FINAL_IDENTITY.json`과 `git diff --name-only 7395be2 HEAD`로 문서-only 관계를 확인한다.

## 실제 Windows 접근과 후보

기존 `/home/monad/.ssh/config`의 `win` 별칭(100.117.248.33)을 사용해
`ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=yes -o UpdateHostKeys=no win hostname`
만 요청했다. 연결 timeout, **exit255**, 원격 hostname은 얻지 못했다.
`virsh -c qemu:///session list --all`은 **exit0**, 기존 clean11은 **shut off**다.
새 접속/자격증명/권한/서비스를 만들지 않았고 VM 시작·OS 설치도 하지 않았다.
해당 probe는 windows-ssh/windows-vm receipt에 보존했다.

기존 후보
`/home/monad/develop/illegal_ad/artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-d42ae4ab1879-20261023T092151358Z/manifest.json`
의 `verify-artifact`를 읽기 전용 재실행하여 8 payload와 manifest 결속 검증이 **PASS**했다.
그 소스는 **59933580b4fc27fd5e6fc3ec50b7b1c3326dcc35**, sourceSha **d42ae4ab1879…**로
이번 코드7395be2와 다르다. installer SHA
`37181bd5eefd9d3620676e402c6f5d01575310b43dae9033a994722f6857fb24`, 예상 설치 EXE SHA
`e4591c3151dc83ceb9e49324bdf86905b2a330c06232bf65ec1d349101c8613b`는 기존 후보의
식별값이며 현재 설치 관측값이 아니다. 이번 패스의 새 Windows 후보는 만들지 않았다.

설치본 수명주기, 양성 두 공개 대상 D08 재시작/실제 Excel, upgrade/rollback/
uninstall/reinstall, 잔류 프로세스·AT는 이번에 **NOT_RUN**이다. 기존
benchmarks/windows-adoption.mjs는 실제 app process 재시작·case 바이트/판단 복원·native
저장·취소 시 worker/renderer PID+생성시각 잔류 검사를 구현한다. 이것만 실행해도
두 공개 양성 D08나 실제 Excel 수용 전체를 대신하지 않는다. 설치 전45사례410파일의
기존 보존 기준과 제출 릴리스는 계속 보존한다.

## 수정과 전후 재현

### 근거 응답 캐시와 삭제 경합

TauriHost는 모든 성공 근거 응답 Promise를 앱 수명 동안 유지했다. 많은 이미지·사례를
열어 보면 base64와 metadata가 누적된다. 또한 삭제가 cache.clear()를 수행한 뒤 같은
키를 재조회하는 동안 옛 요청이 실패하면 옛 catch가 새 요청까지 삭제했다.

이번 변경은 완료 응답을 최근 사용 순서로 재사용하되 **16MiB의 보수적 직렬화 크기와
128항목**을 넘으면 오래된 완료 응답을 퇴출한다. 가중치는 key+JSON의 UTF-16 크기다.
한 응답만 예산을 넘으면 그 응답은 호출자에게 전달하고 cache에는 남기지 않으며 유용한
기존 항목을 밀어내지 않는다. 진행 중 요청은 계속 병합하고 완료된 뒤 제한을 적용한다.
완료/실패 callback은 자신이 아직 cache의 현재 entry인지 확인하여 삭제 후 새 요청을
건드리지 않는다. 열린 UI가 보유한 근거와 디스크/native 사례는 변경하지 않는다.

기준 e33b88d에서 이미지 장기 보존·metadata 보존·삭제 전 요청 실패의 새 회귀3개가
실패했다(cache-before.log). 수정 후 oversized 보존/최근 항목/활성 근거 바이트/
replacement 병합 포함 TauriHost **14개 PASS**. 정책은 프런트 완료 응답의 보관량만
제한한다. 총 앱 메모리, UI가 보유한 데이터, 진행 중 요청 수의 hard cap은 아니다.

### 검수 지적에 대한 시험·문서 정밀화

실제 ScanEvent 계약 형태의 session-finished를 전달해 보류 등록 후 단일 전달,
등록 실패 후 재시도 전달, invoke 중 즉시 완료 전달을 확인한다. native callback
cleanup은 검증하지 않는다. ScanProgress는 sequence 중복을 이미 무시하므로 이전
중복 callback을 사용자 화면 중복 전환의 실제 재현으로 표현하지 않는다.

ACCESS_LIMITATIONS의 오래된 'Retry-After 최대5초' 안내를 현재 구현에 맞게 수정했다.
현재 코드는 유효한 서버 대기시간을 축소하지 않고 남은 전체 예산으로 감당하지 못하면
후속 페이지 요청을 시작하지 않는다. 해당 실제 HTTP/취소/deadline 회귀도 전체 suite에
포함한다. 문서 수정 때문에 제품 정책을 변경한 것이 아니다.

## 성능 비교의 범위

`node --expose-gc benchmarks/evidence-cache.mjs [adapter.ts]`는 production adapter를
번들하고 Tauri IPC 경계만 synthetic으로 바꾼다. 각기 생성한256KiB raw payload96개를
base64로 읽고 GC 후 프로세스 memoryUsage를 비교한다. 실제 JPEG decode, native IPC,
Windows WebView2나 공개 사이트 성능 시험이 아니다. e33b88d의 adapter 원문을 별도
artifact로 두고 같은 probe를 5번씩 교대 실행했다. 양쪽 adapter 파일 해시는 각 log에 있다.

| 5회 중앙값 | e33b88d | 7395be2 |
| --- | ---: | ---: |
| GC 후 V8 heap 증가 | 33,608,016 B | 8,432,216 B |
| 96개 최초 채우기 | 10.459ms | 22.478ms |
| 첫 이미지 다시 열기 | 0.0016ms | 0.130ms |
| 다시 열기 후 누적 IPC 호출 | 96 | 97 |

heap 관측은 약74.9% 줄었으나 직렬화 가중치 계산의 최초 CPU/지연 비용과 eviction 후
재조회 비용이 생겼다. 실제 IPC 재조회 지연은 측정하지 않았다. 최신 항목은 양쪽 모두
추가 읽기0, 열린 첫 이미지와 다시 읽은 이미지 SHA가 모든 실행에서 같았다.
RSS/외부 메모리의 원시값도 log에 보존하지만 Windows 총 메모리 개선으로 일반화하지 않는다.

시청형 synthetic fixture의 이번 C1/C2/C3/C4 wall은8.828/5.910/4.516/4.498s이며
탐지·실패 페이지 동등성 통과다. worker는 이번에 바꾸지 않았고 이 단일 실행을
속도 향상으로 해석하지 않는다. Windows200페이지 게이트는 NOT_RUN이다.

## 심사 기준과 실제 흐름의 검증

| 심사/운영 경계 | 이번 근거 | 판정과 남은 범위 |
| --- | --- | --- |
| 탐지45·추출35의 공식4기법 | opt-in authored holdout6템플릿, 4TP/0FP/0FN, 정상2페이지FP0, 전체4건 locator 해결, C1/C3 동등 | PASS. 각1페이지 소표본이며 공개web 정확도·병렬 처리량의 증명이 아님 |
| 시간20·불완전 점검 | C1–C4, single-pass, cancelled-scan, deadline-scan, Retry-After/접근제한 실제 HTTP 시험 | Linux fixture PASS. Windows200페이지·30분 상한 실기기는 NOT_RUN |
| OCR/멀티모달 추가 판정 | 고정 해시의 기존 보관 배너 픽셀8/8탐지, 대조5건FP0, 흰 첫frame0건→파생 animation1건 | PASS. 보관 스크린픽셀·합성 시간축이며 원본 공개GIF나 새 live site 검증이 아님. 이미지-only를 공식 결과에 섞지 않음 |
| 실용성20·근거 저장/재생 | mock UI의 case review/batch restore/export, 지연/실패 근거 재시도, 관계 그래프, 제한 cache, 실제 worker 공식JSON 저장 | 해당 suite PASS. native 저장/재시작·실제 Excel/AT는 NOT_RUN |
| 배포성10·Windows/Tauri | 역사적 식별 후보8payload 무결성, 기존 JobGuard/session/Windows driver 구현 확인 | 옛 후보 무결성만 PASS. 새 후보/실제 설치/업데이트/제거/잔류process는 NOT_RUN |
| 독창성20·관계/OCR 보조 | 유사성·관측 연결을 소유권/위반 확정과 구분하는graph, OCR+semantic/visual 근거를 보존하는 기존 구현과fixture | 구현과 제한 회귀 확인. 모집단 정확도, Windows 대량이미지 메모리, 실제 사용자 유용성은 미검증 |

새 임계치나 탐지 기능을 늘리지 않았다. 공식 결과 무결성을 보존하고 근거 열람의 장기
메모리 누적·삭제 경합을 줄였다. 대회 경쟁력 확보나 전체 안정화 완료를 선언하지 않는다.

## 실행 결과와 재현

공통 검증 코드7395be2, Node26.8.1/npm11.19.0/Vitest3.2.7/Linux다. 의존성은 기존 복사본을
사용했고 clean npm ci는 NOT_RUN이다. 모델은 빌드에서 고정 manifest 크기/SHA를 검증했다.

| 실행 명령 (verify.py가 receipt와 log 생성) | 결과 |
| --- | --- |
| `KRDS_TEST_UNSANDBOXED=1 KRDS_RUN_HOLDOUT=1 KRDS_HOLDOUT_REPORT=artifacts/stabilization-pass2-20261025/holdout-report.json python3 artifacts/stabilization-pass2-20261025/verify.py check-holdout npm run check` | PASS exit0, type/lint와798 tests/100files, skip0, Vitest219.95s |
| `python3 artifacts/stabilization-pass2-20261025/verify.py build npm run build` | PASS exit0, 기존 report chunk>500kB 경고 유지 |
| `python3 artifacts/stabilization-pass2-20261025/verify.py integration npm run test:integration` | PASS exit0, production sandbox 실제 worker, 공식1건/요청2, 한글경로 JSON검증 |
| `KRDS_TEST_UNSANDBOXED=1 python3 artifacts/stabilization-pass2-20261025/verify.py archived-banners node benchmarks/banner-recall.mjs` | PASS exit0, 보관픽셀8/8·대조5FP0·파생GIF1건 |
| `python3 artifacts/stabilization-pass2-20261025/verify.py memory-after-1 node --expose-gc benchmarks/evidence-cache.mjs` | PASS. before adapter 경로 지정과1–5회 반복으로 paired probe 재현 |
| 보관e33b88d web소스 +7395be2시험의 cache회귀6개 | 기대 FAIL exit1: 4failed/2passed, 다른8건 필터skip. 운영 코드를 checkout/reset하지 않음 |
| 역사 후보 verify-artifact | PASS exit0. 현 코드의 Windows 후보는 아님 |
| 기존Windows SSH / VM목록 | SSH FAIL timeout exit255 / 목록PASS exit0·shut off. 설치본 검증NOT_RUN |

baseline-check/identity.json에 baseline/test commit과 파일별 SHA가 있다. 대응 최종 로그는
baseline-retention-final.log다. 초기 baseline 명령은 상대config 중복 경로로 startup실패,
다음 실행은 복사본의 browser.ts 누락으로 collect실패했다. 이를 제품 회귀 실패로 세지
않고 로그를 보존했다. e33b88d web/src를 archive로 갖춘 뒤에만4개 실제 회귀 실패를 확인했다.

archived-banners 실행은 기존 script의 고정 출력 경로
artifacts/detection-improvement-20261021/corpus를 사용했으며, 이번에 새로 생성한 결과를
artifacts/stabilization-pass2-20261025/archived-banner-results로 옮겨 보존했다.
폴더 이름의 과거 날짜를 이번 관측 시각으로 사용하지 않는다. receipt UTC는
2026-10-25T12:32:47~12:32:58이며 테스트코드/입력픽셀 manifest도 연결된다.

최종 문서 commit 후 FINAL_IDENTITY.json과 EVIDENCE_INDEX.json에 최종HEAD·코드-only
귀속·증거 파일 SHA를 기록한다. 검증 당시 코드commit은7395be2이며 문서commit은
추가 실행을 했다는 의미가 아니다. 원시 log와403개 코드/fixture manifest는 worktree
artifacts/stabilization-pass2-20261025에 있다. 원격push/PR·배포·제출·Tasks는 하지 않았다.

## 부모 검수 후 후속 우선순위

1. Windows접속 복구 후 새 식별 후보를 만들고 설치 전 기존사례를 백업/해시대조한다.
   실제 설치EXE/worker/모델/공식 출력/source를 묶고 즉시완료·취소/재실행/종료를 관측한다.
2. 서로 다른 공식양성2건 D08 판단/메모→정상재시작→두case/묶음복원→통합XLSX→실제Excel.
   소유fixture나 공식0/추가양성만 있는 대상과 합산하지 않는다.
3. 같은 후보로 업그레이드/rollback/제거·재설치의 데이터 바이트 보존과 PID+생성시각 기반
   자식process 잔류를 검증한다. 장비/사용자 입력 소유권이 불명확하면 임의로 조작하지 않는다.
4. Windows에서 다수사례·617건 결과·관계graph/이미지 반복열람의 working set·재조회 지연,
   keyboard/200%zoom/AT를 측정한다. cache정책은 실제 native IPC 비용까지 포함해 재평가한다.
5. 새 승인된 독립 공개양성/음성·원본미디어 holdout을 구성한다. 이번 authored/기존 픽셀은
   제한회귀로 유지하며 이 결과에 맞춰 threshold를 조정하지 않는다.

이 두 번째 패스는 여기서 멈추고 부모의 독립 검수를 받는다. 원격 목적지 승인은 대기 중이며
이전 push 거절을 우회하거나 재시도하지 않았다. Google Tasks 완료도 사용자 승인 전 금지다.

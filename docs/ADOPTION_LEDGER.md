# 도입 구현 원장

검토 기준은 `d14b8feadf60a174d3d74ad47e49ba13072c84c7`이다. **2026-10-23 최종 후보의
소스는 `1c0e8a34c407776ea6fb16943a1e8c73961c6d77`**, 브랜치는 `dev/bootstrap`, PR #2는
Draft다(§「2026-10-23 통합 검증과 최종 후보」). 아래 `565d9f6e…`는 2026-10-09 MSVC
설치 검증 후보의 이력 식별자다.
감사 재현 자료를 회귀 입력으로 사용했으며 기준 소스로 현재 checkout을 덮어쓰지 않았다.
과거 RC와 중간 GNU/MSVC 후보를 보존한다. 현재 앱은 `0.2.1`, 공식 tool version은
`0.2.1-policy2`다. 공식 contract v0, Case 1, detail 2, config 1, policy 2를 구분한다.
정확한 후보와 운영 수용 판정은 [채택 인계](ADOPTION_HANDOFF_KO.md)가 기준이다.
후속 UI와683px 수정, 역사 공개native3c·보고서native359·직접 화면재열기565를 최종 후보의
실행과 구분한다. 역사 MSVC 후보 source는 `565d9f6e49f857c6a0a9aaf2ab3b829452584e1e`, build ID는
`0.2.1-x86_64-pc-windows-msvc-d33dc9f7c097-20261009T185838006Z`다. Canonical receiving 빌드와 Windows·로컬 artifact verify를 통과했고
실제 직접 실행에서 보관 케이스를 재열었다. 재개 후 전체 installer의 upgrade·build rollback·
제거·프로그램 fresh install, 일반 사용자 단일/공개batch·검토·재열기·JSON/XLSX·실제 Excel
관찰을 완료했다. 실제 사람/AT·기관 운영 수용은 NOT_RUN이다. 앞선 공개 두 대상 native 점검에서 범위·보고 누락을 관측해 후속 수정했다.
[공개 대상 결과와 수정 근거](PUBLIC_BATCH_OBSERVED_KO.md)에 실제3c 점검과 후속 웹 replay를 구분한다.

| ID | 현재 상태 | 구현 커밋 | 실행 근거와 적용 범위 |
| --- | --- | --- | --- |
| A01 | OBSERVED | `082b552` | 대문자·전각·키릴·자모 복원 후 의미 판정, 원문 UTF-16 span, 관련 없는 script 음성, TS/native 공통 corpus |
| A02 | OBSERVED | `082b552` | 도서관·인용·보도 문맥 음성과 같은 페이지의 숨긴 판촉 양성을 분리하는 순수/실제 브라우저 회귀 |
| A03 | OBSERVED | `082b552`, `5fb0adc` | 문자 Range·alpha·배경·조상 clipping·frame 조상 관측. 큰 glyph가 실제 2 CSS px 이하로 잘린 fragment 회귀를 full Chromium/headless shell·여러 글꼴로 확인 |
| A04 | OBSERVED | `082b552`, `88ee282` | duplicate-src/ID, 상대·중첩·srcdoc·populated blank의 고유 owner 경로 역해결. fixture 준비 이벤트로 중첩 문서 수집 경합 제거; 운영 settle 시간 유지 |
| A05 | OBSERVED_INSTALLED_MSVC | `082b552` | 원본 독립 commit/restart/reopen, optional 손상·누락 격리, 잘못된 원본 거부. 최종 MSVC 정상 종료/새 실행·cancelled case 재열기/export에서 공식 JSON bytes·검토 보존 |
| A06 | OBSERVED_WINDOWS_INSTALLED | `082b552`, `9ed3af9` | receiving built/packaged worker 및 최종 MSVC 설치본 production sandbox 실행. 빈 browser-path poison에서 bundled runtime, host/renderer integrity·no-sandbox 인자 없음 확인. 자동 fallback 없음; Linux fixture 우회와 분리 |
| A07 | OBSERVED | `082b552` | 모든 페이지 cheap 관측과 bounded live bytes reservoir. early/9th/final/reorder의 동일 후보 선택·이유·coverage; 재방문 없음 |
| A08 | OBSERVED | `082b552` | 공유 capture/creative asset 참조와 hash 검증. 1/200 finding 공유 바이트 및 실제 큰 JPEG 두 finding의 native 저장·재열기 |
| A09 | MEASURED_BOUNDED_FIXTURES | `082b552` | 독립 DOM/frame/resource 수집 상한, 삽입 전 후보·graph cap, truncation issue와 bounded 원문 accumulator. 표본 process-tree RSS이며 보편 메모리 상한·p95 증명은 아님 |
| A10 | OBSERVED_INSTALLED_MSVC; FOLLOWUP_UI_REPLAY_AND_NATIVE_REOPEN | `082b552`, `2a9d98f`, `3c8295e`, `359ef05`, `565d9f6` | 식별 MSVC 일반 사용자 scan→판단/메모/reading→정상 종료→새 실행/재열기→실제 JSON/XLSX Save As, 재크롤 없음·원본 bytes 동일. 후속 React/Tauri adapter 617개 기록 replay와 실제 XLSX 617행 확인. 별도 native3c 공개 batch·JSON/XLSX chooser, native359 제한 열 export, native565 보관 케이스 재열기 관찰. 617개 replay를 native 과업으로 전용하지 않음 |
| A11 | OBSERVED_CONTROLLED_AND_MSVC_UI; FOLLOWUP_UI_REPLAY_AND_NATIVE_REOPEN | `082b552`, `2a9d98f`, `565d9f6` | bounded graph·공유 inspector의 기존 MSVC keyboard 관찰. 후속 desktop 요약 rail/검토 목록, setup grouping, sticky 뒤로/검토, 320px 원문 폭 300px·200% CSS zoom·키보드 복귀는 web replay에서 확인. 실제 native565 재열기에서 제한 안내·수정된 간격 관찰. 실제 사람/AT 수용은 미실행 |
| A12 | OBSERVED_BOUNDED_HOLDOUT | `082b552` | 합성 6 template, 네 기법 각 TP1/FP0/FN0, 정상 2 FP0, locator 8/8, C1/C3 동등. 공개 웹 일반화·독립 TP21·확률 calibration 근거 아님 |
| A13 | OBSERVED_RECEIVING_BUILD_AND_IDENTIFIED_OPERATIONS | `082b552`, `70f3033`, `d94ff28`, `c4bb952`, `559e35a`, `703b473`, `50941bd`, `565d9f6` | clean Windows source build·MSVC/NSIS provenance와 현재565 package/verify. 재개 후509→565 upgrade67파일 보존,565→509 build rollback·565 복귀·일반 제거·프로그램 fresh install95파일/exports 보존. 일반 사용자565 재열기 전후123파일/14케이스 동일. 실제 installer Completed·설치 build/hash 근거이며 새 upgrade/rollback 명령 종료코드 관측으로 전용하지 않음. 역사 GNU rollback 중단은 별도 유지 |
| A14 | OBSERVED | `082b552`, `5fb0adc` | 실제 Retry-After/retryAt, 취소·deadline 회귀. 120초 요청을 5초 재요청으로 축소하지 않음; Chromium disposal 지연 무한 대기 제거 |

## 마일스톤과 검증 범위

| 단계 | 산출물·관찰 | 남은 수용 범위 |
| --- | --- | --- |
| M0 | `f81f133` checkout·원격·감사 재현, [ADR 0015](ADR/0015-durable-adoption-boundaries.md) | 없음 |
| M1 | policy 2 text/rendering/location, production 격리, 명시 네트워크 정책, deadline/retry | 공개 웹 일반화는 주장하지 않음 |
| M2 | 공식 원본 우선 저장, 공유 자산, Case/review 전달·재열기·손상 격리, 최종 MSVC 저장/재열기/export | 미실행 외부 수용과 구분 |
| M3 | bounded visual/graph·공유 근거 동선, desktop 요약 rail/검토 목록·setup grouping·sticky inspector, 좁은 화면 React 검증과 설치565의 실제 graph→원본 검토 | 실제 사람·AT 수용 별도 |
| M4 | typed 확장, 공통 policy/TS-native corpus, clean Windows MSVC build, 관리 배포/진단 | 조직 서명·offline provisioning·라이선스 결정 별도 |
| M5 | 분리 holdout, 식별565 후보·receiving build, 네 수신팀 역할의 내부 자동 실행 시연·한국어 인계, 일반 사용자 native UI·실제 Excel·build rollback·제거/재설치 보존 | 내부 구현·시연 완료. 실제 사람/AT·기관 채택·서명·라이선스·WebView2 부재/완전 offline 등 외부 수용은 NOT_RUN이며 완료 주장에 포함하지 않음 |

OBSERVED: 설치 후보 소스 509의 통합 검사에서 타입/lint와 491 테스트 통과, 1 skip(80 파일).
Linux 브라우저 fixture에만 `KRDS_TEST_UNSANDBOXED=1`을 사용했으며 production 격리
증거로 전용하지 않는다. 초기 `nia-final-check.log`의 487 통과와 최종
`nia-final-check-509.log`의 491 통과를 구분한다.
receiving Windows 소스 50941bd의 native 51 테스트, fmt/Clippy, built/packaged worker,
desktop build, NSIS package, artifact verify는 각각 실제 실행했다.
OBSERVED: source 509 CI [run 37959883958](https://github.com/snowman0919/krds-illegal-ad-detector/actions/runs/37959883958)의
`verify`, `windows-native`, `required`가 모두 SUCCESS다. 이후 UI 변경에 이 검사 결과를
소급 적용하지 않는다.
후속 b30 통합 검사는 491 pass/1 skip, 웹 검사는 107 pass다. b30 CI `37967025068`의
Linux verify도 SUCCESS다. 중간 683px 제목 reflow 회귀를 `8b68248`에서 수정하고
617건·320/683px·CSS zoom·BrowserHost의 실제 화면 smoke를 다시 통과했다.
8b CI `37967491010`의 Linux verify도 SUCCESS이며 Windows/required의 완료 판정과는 구분한다.

## 후속 UI 화면 관찰과 검증 우선순위

사용자 방향 전환에 따라 설치 반복 matrix를 중단하고 실제 화면과 Rust/web 검증을
우선한다. installer는 runtime/resource/배포 경계 변경 때 확인한다. 일반 UI 변경은
관련 web 행동 회귀·타입/lint와 실제 빌드 화면, Rust 변경은 관련 native 경계를 검증한다.

변경 전 기준은 실제 509 소스에서 생성한 dist의 `nia-ui-adoption-before/geometry.json`과
workspace screenshot이다. 변경 후 `/tmp/nia-ui-adoption-after/observed.json`은 실제
React와 Tauri adapter의 **file-backed IPC replay**다. 617개 기록·211페이지·19반복항목을
표시/검토/보고 입력으로 썼으며 탐지 정답이나 실제 native scan으로 읽지 않는다.

MEASURED: 1366×768에서 첫 3행 마지막 bottom은 이전 830.25px, 변경 후 748.25px다.
320px에서 원문 폭은 300px(이전 관찰 132px)이며 원문을 그대로 유지한다. OBSERVED:
320 reflow, 200% CSS zoom, 키보드 필터·초점 복귀·결과 초점 1회/목록 jump, 판단/메모/reading,
f372 원문과 묶음 확인, official canonical JSON bytes 동일, 실제 XLSX 617행 및 검토 메모,
외부 요청 0·errors 0. 이 617개 과업의 Save As는 replay다. 이후 native3c·359·565의
별도 과업은 아래 공개 두 대상 절에 기록하며 617개 과업의 native 실행으로 전용하지 않는다.
별도 실제 BrowserHost preview는 Tauri IPC 없이 임시 preview로 표시하고 잘못된 영구
저장 장애를 만들지 않았으며 외부 요청이 없었다. 사용자 사용성/AT 수용을 대신하지 않는다.

역사 GNU rollback은 사용자 방향 전환 시 **NOT_COMPLETED**로 중단됐다. 당시509 MSVC 0.2.1을
복원했으며 `preservation-restored-021.json`에 build ID
`0.2.1-x86_64-pc-windows-msvc-a56389284dba-20261009T163714286Z`, 실제 설치 EXE SHA-256
`3bceb64e5dcd64925cc3eca398b9145bfcf5c39ea869cfb1e88a34d941396a4f`, persistent 33파일과
GNU workbook hash 보존을 기록했다. 앱 실행 중의 `cases/.store.lock`은 제외했다.
이 당시 안전 복원은 rollback/일반 제거의 전체 수용 완료가 아니다. 재개 후 완료한
565→509 build rollback·제거/재설치는 [현재 후보 시연](ADOPTION_HANDOFF_KO.md#최종-후보의-설치운영-시연--2026-10-10-utc)과 별도 receipt로 식별한다.

mock/replay, GNU 설치, MSVC source build, 최종 MSVC 설치를 구분한다. 현재 후보는
서명 없는 내부 평가용이며 [채택 인계](ADOPTION_HANDOFF_KO.md)의 미실행 행을 성공으로
읽어서는 안 된다. 공식 원본과 선택 기능 장애 격리·공개망·취소·deadline은 구현 회귀와
설치본 과업 증거를 함께 확인한다.

## 공개 두 대상과 수집·보관 제한 후속 수정

사용자의 직접 선정 지시에 따라 source3c 빌드의 실제 Windows native 화면에서 두 공개
대상을 각1페이지·깊이0·60초·public-pinned로 점검했다. 각HTTP200, 확인1/실패0/탐지0이며
HTML 사본 제한을 기록했다. 실제 native CSV/JSON/XLSX chooser, 공식 계약·원본 hash,
기존48파일 보존을 확인했다. 새 installer 실행으로 읽지 않는다.

b4ca202는 보관된collectionIssues를 점검 범위와 Excel8열/요약에 표시하고320px긴주소
줄바꿈을 수정했다. 359ef05는 root/desktop 빌드가 contracts→evidence→web을 컴파일하도록
수정해 이전 dist 의존을 없앴다. OBSERVED: evidence dist 없는 실제 rootbuild, 실제production
UI1366/320+XLSX 제한 열,23집중회귀/타입/lint,5buildboundary 통과. 공식 정책·원본은 그대로다.
읽기 전용 별도 scoped review에서 actionable finding은 없었고 추가 실행 검증으로 주장하지 않는다.

565d9f6는 실제native359에서 발견한 정의되지 않은 gap6를 기존gap7(24px)로 수정했다.
617건production UI smoke의 실제 card/review 좌표 분리 회귀를 추가했고 첫3행하단748.25px와
나머지 키보드·원문·JSON/XLSX를 통과했다. 현재565 후보는 단회315.93초package/verify와
native 보관 케이스 재열기·제한 안내/시각 간격 관측을 완료했다. 원래48파일·공개19파일
해시를 보존했다. 이 직접 실행 증거를 설치 수용으로 전용하지 않는다.

## 현재565 설치본의 운영·인계 마감

OBSERVED: elevated installer 자동화와 일반 사용자 운영을 구분했다. Explorer 시작 host
RID8192의565에서 실제 단일2finding·확인1/404실패1, graph CONTAINS→f2 원본,
판단/메모/검토 완료revision3, fixture 서버 중지 후 정상 종료·새 hostRID8192/재열기를
확인했다. 재열기 전후123 persistent 파일·14케이스 hash 동일이다. 실제 native Save As
공식JSON708bytes는 계약 통과·원본 동일, XLSX14,125bytes는6시트·수식0·점검 범위8열·
검토 메모/판단을 포함한다. 실제 Excel 요약·검토 시트에서 한국어 표시를 관측했고 재저장
없이 동일 hash를 확인했다. 실제 사람·AT 관찰로 읽지 않는다. A05/A10/A11의 현재565 근거다.

동일 일반 사용자 실행의 CSV 공개2대상은 각1/0/60·public-pinned, HTTP200·확인1/실패0/
공식0·html-snapshot-truncated다. [공개 대상 결과](PUBLIC_BATCH_OBSERVED_KO.md)의 새
case ID/hash로 식별한다. 기존67파일, rollback 기준95파일, 최종 재열기123파일을 혼동하지 않는다.
`operations-565-20261010/`의 receipt·권한·검증 요약은 새 operations supplement로 전달한다.

OBSERVED: cb89의 PR CI [37979745618](https://github.com/snowman0919/krds-illegal-ad-detector/actions/runs/37979745618)
verify/windows-native/required SUCCESS, Linux493pass/1skip·boundary5, Windows native51·
fmt/Clippy·production packaged worker·MSVC Tauri release 통과. 이전87 PR의 취소 fixture
40초 timeout 원인은 미확정이며 통과 결과로 지우지 않는다. 마지막 변경은 인계 문서이며
후보 build ID·bytes·policy2를 다시 발행하거나 변경하지 않았다.

## 2026-10-20 일반 연결·화면 모드·단일 사례 인프라 초기 구현

사용자 승인 범위는 일반 점검의 WARP 필수 해제, 간단·고급 모드 분리, 기존 단일
사례 인프라 기능 재배치다. 여러 사례 통합, 일괄 작업 그룹의 재시작 복원, 외부 능동
탐색, 인프라 역할 자동 분류는 구현하지 않았다. [ADR 0016](ADR/0016-separate-ui-mode-from-scan-transport.md),
[화면 명세](SCREEN_SPEC.md), [사용자 흐름](UX_FLOW.md), [사용 설명서](USER_MANUAL.md)를 함께 갱신했다.
작업 기준은 `dev/bootstrap` / `56fd3563e031ef1850e88b4fdac0c39ead08eea5`의 미커밋
작업 트리다. 기존 DOGFOOD_LEDGER·superpowers 변경은 보존했으며 이 작업에서 수정하지 않았다.
새 commit·push·설치·배포·WARP 등록·OS 설정 변경은 실행하지 않았다.

OBSERVED_SOURCE: 단일·일괄 native 요청의 기본 연결은 `direct`이며 이 경로에서 WARP
등록 정보와 실행 자원을 조회하지 않는다. 고급 모드에서 명시적으로 고른 `warp`만
기존 준비·검증을 실행하고 실패 시 직접 연결로 전환하지 않는다. 직접 연결 출처는
`operator`로 기록하며 기존 `source-cli`, `owned-origin`, WARP 보관 결과도 읽는다.
첫 실행 모드는 간단 기본값으로 선택하고 다음 실행에 기억한다. 두 화면은 탐지기·공식
원본·사례·검토 writer를 공유한다. 저장된 결과는 별도 화면으로 이동했다.

OBSERVED_SOURCE: 고급 인프라 화면은 기존 한 사례의 도메인 요약·근거·관계 그래프를
읽는다. 도메인 검색, 반복 관측 필터, 원본 근거 이동과 복귀를 제공한다. 이 화면을
열거나 저장 사례를 다시 읽는 것으로 점검·WARP 등록·외부 탐색을 시작하지 않는다.
검토 완료·다음은 저장 완료를 기다리며 저장 실패 시 편집 내용을 남긴다. 저장 중
이동과 새 점검의 경쟁을 막고, 보고서는 저장된 검토를 다시 읽지 못하면 중단한다.

검증 원본은 로컬 ignored [증거 폴더](../artifacts/ui-modes-20261020/)에 보관한다.
`source-manifest.json`은 기준 HEAD와 변경 소스 SHA-256을, `SHA256SUMS`는 화면·보고서·로그의
해시를 식별한다. 과거 설치565 수용을 이번 미커밋 소스의 수용으로 전용하지 않는다.

| 증거 | 실제 결과와 범위 |
| --- | --- |
| `KRDS_TEST_UNSANDBOXED=1 npm run check` | 타입/lint 및 579 pass / 1 skip, 86 pass / 1 skipped 파일. Linux 브라우저 시험 격리 예외이며 production 격리 증거가 아님 |
| 최종 소스 집중 회귀 | 전체 검사 뒤 웹 136 pass, 마지막 입력 검증 변경 뒤 ScanStart/App 18 pass. 마지막 소스의 typecheck·eslint·build 성공. 전체 581개 재실행으로 주장하지 않음 |
| `npm run build` + `node benchmarks/ui-modes-smoke.mjs` | production web bundle·실제 Chromium, Tauri adapter replay. 617기록, 실제 XLSX 618행(머리글 포함), 메모 포함, 공식 JSON bytes 동일, WARP 호출0, page error0, 재실행 모드 기억 |
| 실제 화면 크기 | 1366×768 첫3행 하단759.875px. 360px 화면/document 폭360px. 간단 결과·고급 인프라 screenshot 보관. native 확대·사람/AT 수용과 구분 |
| native 공유 모듈 | WARP 관련9 pass / child-entry fixture1 ignored, 직접/기존 사례 저장·재열기1 pass |
| 실제 bundled worker → native 보관 | direct/operator와 warp/owned-origin 두 시험2 pass. 공식 bytes·session-scoped JPEG·재열기/export 경계 확인. 아래 Linux fixture 예외 적용 |
| bundled sidecar fixture | 공식/상세5건, JPEG5개, 확인5/의도한 실패1, progress22. 공식/상세/확장 계약 validator 통과. 아래 fixture 예외 적용 |
| 빌드 경계 회귀 | `node --test scripts/test/build-boundaries.test.mjs` 5 pass |

검증 제한: 이 Linux 환경의 기본 Chromium sandbox 실행은 실제로 실패했으며
`logs/illegal-ad-mode-native-direct.log`에 보존했다. 실제 worker/native 보관 시험과
sidecar fixture에만 임시 Node preload로 Chromium sandbox를 끈 통제 loopback 시험을
사용했다. preload는 제거했으며 production 실행 옵션은 변경하지 않았다. 브라우저 UI
replay와 이 fixture는 Windows native 실행·production 격리 수용 증거가 아니다.
`cargo check --manifest-path src-tauri/Cargo.toml --locked --offline`는 시스템
`libsoup-3.0` 부재로 중단됐다(`logs/illegal-ad-mode-native-host-check.log`).
이번 소스의 Windows 전체 build·installer·native GUI·200% native 확대·실제 사람/AT
수용은 NOT_RUN이다. 기존 후보의 과거 검증과 분리한다.

## 2026-10-21 Windows 시험 전 탐지 누락 점검

사용자는 뉴토끼·블랙툰의 이전 누락을 우선 확인하도록 요청했다. 이 회차는 탐지
능력의 진단이며 detector·crawler·UI 제품 소스는 수정하지 않았다. 기존 미커밋 변경과
DOGFOOD_LEDGER는 보존했다. 설치·배포·WARP 등록·OS 설정 변경·광고 목적지 방문은 없다.

결론: 현재 엔진을 실제 배너 탐지에 충분하다고 판정할 근거가 없다. 기존 회귀검사
통과와 실제 배너 인식은 분리해야 한다. 산출물은 local ignored
`artifacts/detection-audit-20261021/`에 보관한다. `observed.json`, 원본 HTTP 입력,
OCR 원문·판정, 실제 scanner의 공식/추가/상세 결과, 실행 스크립트와 해시로 식별한다.

| 점검 | 관찰과 해석 |
| --- | --- |
| 블랙툰 과거 OCR의 현재 판정 재실행 | native 보관 사례 `cffaeb83-5d00-4090-80d8-1d8bf4c2a38d`의 8이미지 중 OCR 완료6, 현재 통과0. `첫충70%`를 읽은 항목도 category/독립 단서 조건을 충족하지 못해2/3으로 거절. 이 데이터의 누락은 현재 판정에도 남음. 새 live OCR 실행과 구분 |
| 실제 보관 화면의 배너 재현 | `blacktoon-usque.png`에서 보이는 브랜드와 기존 관측 위치를 수동 대응한8개 화면 crop을 사용. 개별 offline OCR8개 모두 현재 판정 미통과. 실제 scanner loopback 경로에서는 후보8/이미지 수집7/OCR 완료6/공식0/추가0, byte·후보·OCR 제한 기록. 세 계약 validator 통과. 원래 resource bytes 또는 live 사이트 재현율 시험이 아니며 화면 crop의 해상도·당시 GIF 프레임 차이를 포함 |
| 단순 확대 가설 | 동일8개 crop의3배 확대를 시험했지만 현재 통과0. 2개는 기존250,000byte OCR 한도를 넘어 인식하지 않았고 나머지도 지원 광고 어휘 판정 미충족. 단순 확대만으로 해결된다고 주장하지 않음 |
| 뉴토끼 현재 공개 입력 | 공개 IP 고정·정상 TLS의 직접 HTTP GET으로 `https://newtoki1.org/` 본문200,128,632bytes. HTML에 `data-banner-href`를 가진 배너 버튼24개. 첫8개 명시 이미지 자원의 GET 모두 ECONNRESET. 한 이미지의 Referer 가설도 ECONNRESET으로 기각. 브라우저 이미지 로드/현재 탐지 재현율을 판단할 수 없음 |
| 뉴토끼 DOM 구조 대조 | 첫 실제 배너 버튼 markup에서 이미지만 읽기 쉬운 기존 fixture로 교체한 loopback 대조는 추가 탐지1건. 부모 banner class로 후보가 되어 버튼 구조 자체가 후보 탈락 원인이라는 가설은 기각. 실제 `data-banner-href`는 목적지로 보존되지 않아 인프라 정보는 빠짐. 실제 뉴토끼 광고를 탐지한 것으로 읽지 않음 |
| 블랙툰 현재 주소 이동 | `https://blacktoon424.com/` GET301의 Location은 `https://blacktoon425.com/`. 후자 GET200,26,718bytes. 공개 HTML 입력 관찰이며 live DOM 실행은 아님. crawler의 입력 host 밖 이동 중단 정책 때문에 이전 주소 입력만으로 본문 분석이 보장되지 않음 |
| 기존 detector 회귀 | detection/realistic/adversarial/visual-pipeline/visual-decision/image-analysis/visual-coverage7파일35 pass. 깨끗한 기준 이미지와 기존 부정 예제의 회귀이며 위 배너 누락을 반박하지 않음 |
| crawler 이동 경계 회귀 | redirect-scope4 pass. HTTP/script의 host 밖 이동은 분석 중단, 같은 host 이동과 외부 frame의 기존 분석은 유지함을 통제 fixture에서 실제 확인 |

INFERRED_FROM_SOURCE: 한 점검 전체의 고유 이미지 OCR 상한은6이며 페이지마다6이
아니다. 후보 수집도8개/문서,250,000bytes/페이지와 전체 보관 한도에 묶인다.
`visual-scheduler.ts`와`scan.ts`가 이 선택을 소유한다. 더 넓은 페이지 수만으로
이미지 분석 범위가 비례해 늘지 않는다. 미선택·접속 실패·OCR 불명확을 광고 없음으로
처리하면 안 된다. 목적지 도메인이 불투명하다는 이유로 기준만 낮추는 변경은 하지 않았다.

NOT_RUN: 현재 공개 사이트의 canonical browser 전체 점검. Linux에서 production
Chromium sandbox 시작이 실패했으며 `live-scanner-attempt.json`에 실제 실패를 보존했다.
공개 사이트를 sandbox 없이 실행하거나 challenge/TLS를 우회하지 않았다. 위 OCR·scanner
재현과 대조의 sandbox 예외는 기존과 동일한 통제 loopback/신뢰된 시험 코드에만 적용했다.
추가 수용에는 실제 광고 이미지가 정상 로드된 고정 입력, 원본 크기·애니메이션 프레임을
보존한 OCR 비교, 미선택 후보와 실제 오탐을 포함한 검증이 필요하다. 현재 결과는
Windows 패키징을 우선하기보다 배너 수집·인식·분석 예산을 먼저 개선해야 할 근거다.

## 2026-10-21 배너 수집·다중 프레임·한국어 OCR 개선

사용자 승인 범위는 배너 수집·OCR·분석 예산 개선과 실제 광고 기준 전후 비교다.
`dev/bootstrap`, 기준 HEAD `56fd3563e031ef1850e88b4fdac0c39ead08eea5` 위의 미커밋
변경이다. 앞선 간단/고급·선택적 WARP 변경과 DOGFOOD_LEDGER를 보존했다. Windows
실행·설치·배포·제출·WARP 등록·OS 네트워크 설정 변경은 수행하지 않았다.

실행 경로: `creative.ts`의 GIF/버튼 목적지 수집 → `visual-scheduler.ts`의 제한된
보관/선택 → `scan.ts` → `LocalOcrBackend` 자식 프로세스 → Tesseract 또는 고정
PP-OCRv5 한국어 CPU 모델 → `image-only-ad-v3` → 추가 결과/상세/기존 인프라 근거.
공식 네 기법과 text-policy-2는 유지한다. 상세 근거·native 검증·보고서는 프레임
번호/시각을 보존한다. 큰 파일·프레임·시간 상한과 미분석 범위는 남는다.
선택 기준/모델/프로세스 결정과 대안은 [ADR-0017](ADR/0017-bounded-animation-and-korean-banner-ocr.md)을 따른다.

| MEASURED / OBSERVED | 결과와 한계 |
| --- | --- |
| 실제 블랙툰 보관 화면 crop8개 | 앞선 동일 crop 판정0/8 → 현재 canonical scanner 추가 탐지1/8. 새 OCR은8개 완료, 나머지7개는 누락. `페이백10%`, `콤프3.5%`, `입금`과 실제 관측 외부 목적지를 결합한 한 배너만 복구. 화면 crop이며 원본 이미지/GIF 또는 live 재현율 아님 |
| GIF 시점 대조 | 같은 실제 crop에 흰 프레임을 넣어 만든 파생 GIF. 첫 흰 프레임만 넣은 대조 탐지0 → 다중 프레임 탐지1, 실제 frame index1 / 40ms. 원본 현장 GIF를 확보한 것으로 읽지 않음 |
| 음성 비교5개 | 정상 상업·게임/로고·공공 안내 등 합성4개와 기존 illustration1개, 외부 href/ad marker를 붙여도 추가 탐지0. 5개 표본의 오탐0이며 공개 웹 오탐률 아님 |
| 뉴토끼 | 실제 HTML의 배너 버튼24개와 같은 구조의 통제 fixture 수집/목적지 보존 확인. 실제 이미지 서버 ECONNRESET으로 원본 광고 전후 비교 NOT_RUN. 외부 공개 확인도403. 정부 차단 원인이라는 주장은 확인하지 않음 |
| `KRDS_TEST_UNSANDBOXED=1 node benchmarks/banner-recall.mjs` | 위8개 양성/5개 음성/시점 대조의 실제 scan 및 official/extra/detail 계약 검증 모두 통과. `corpus/observed.json` 및 각 원본 결과에 OCR 원문/판정 보관 |
| `KRDS_TEST_UNSANDBOXED=1 npm run check` | typecheck/lint 성공, 86파일609 pass / 1파일1 skip. 이후 취소 검증을 보강한 `ocr.test.ts`만 재실행6 pass. 전체 최신609개를 다시 실행했다고 주장하지 않음 |
| 실제 OCR 종료·복구 | 독립 probe에서 native ORT 실행 중 WorkerThread 종료는2회 모두 부모exit134. 자식 프로세스 방식은 강제 종료3회 부모 생존 및 다음 인식 성공. canonical API의 warmed timeout→재인식→AbortSignal 종료 경로도 통과 |
| Rust 공유 근거 경계 | `cargo test --manifest-path benchmarks/native-session-l3/Cargo.toml --locked --offline evidence::tests`: 5 pass. frame 범위/legacy/가짜 수집 수 검사. Windows native 실행 아님 |
| 빌드 | `npm run build:scanner`, `npm run build:sidecar`, `npm run build` 성공. 새 Windows runtime lock/installer/플랫폼 네이티브 OCR 실행은 NOT_RUN |

원본 모델은 최초 빌드 준비에서 지정 URL·크기·SHA-256 검증 후 캐시/복사한다. 점검
중에는 모델을 내려받거나 이미지/코드를 외부 AI로 보내지 않는다. ORT 네이티브
의존성 때문에 기존 Windows 후보의 runtime inventory/수용은 이번 소스에 재사용할
수 없다. Linux Chromium sandbox 예외는 앞선 것과 같은 소유 loopback 시험에만
적용했고 공개 사이트를 격리 없이 실행하지 않았다.

증거는 ignored `artifacts/detection-improvement-20261021/`의 `source-manifest.json`,
`receipt.json`, `SHA256SUMS`, corpus 결과와 실행 로그에 보관한다. 실험 환경/의존성
폴더는 증거 hash 목록에서 제외하고 모델 hash는 소스 manifest로 식별한다.
EmbeddingGemma 2는 공식 모델 카드의 멀티모달 임베딩/기본 영상1fps 특성을 검토한
PROPOSED 보조 유사도 분석이며 설치·실행·품질 비교하지 않았다. 원본 애니메이션과
더 넓은 독립 정상 광고 자료가 필요하며, 현재 탐지 누락 해결/제출 준비 완료로
판정하지 않는다. Windows 검증은 사용자 지시대로 계속 보류한다.

## 2026-10-21 EmbeddingGemma2 동일 입력 비교 완료

사용자는 남은7개 원인을 분석하고 실제 EmbeddingGemma2 보조 효과와 오탐을 같은
입력으로 비교하도록 요청했다. 별도 Python 환경의 offline 실험 경로에 고정 모델을
연결했다. 제품 기본 경로·공식 결과·배너 판정 기준은 변경하지 않았다. Windows는 계속
보류다. 전체 분석/입력/기준/결과/한계는
[EMBEDDINGGEMMA2_EVAL_20261021.md](EMBEDDINGGEMMA2_EVAL_20261021.md)를 따른다.

MEASURED: canonical scanner에서 동일 블랙툰 화면 crop8개 + 기존 음성5개 + 실제
삼성/LG 광고6개 + 합성 혼동6개를 재실행했다.25개 모두 수집/OCR 완료, 제외0,
baseline1/8·FP0/17, 세 계약 validator 통과. 누락7개는 수집 전 탈락이 아니라
숫자·%·카지노/환전/콤프/페이백/입금 등의 손실 후 의미 조건에서 탈락했다.
수동 문자 대조와 과거 동일 SHA RapidOCR 원문은 진단으로만 보관하고 모델 입력을
교체하지 않았다. 현재 생산자 source37개는 앞선 검증 build snapshot과 hash가 같다.

사전 고정 모델 revision `914f7f89142e33e77833254d9c9b90c3cef7303b`, CPU float32,
2스레드/batch4, seed17/29/43의3반복을 실행했다. 모델 LFS 크기/SHA 대조, 입력·기준
hash, 실제 벡터/점수 유한성·단위 norm·반복 오차1e-5와 픽셀 perturbation을 검사했다.
반복 벡터 최대 차이는0이다. canonical baseline과 benchmark/수치 검사·lint가 통과했다.
이전609개 전체 검사를 새로 실행했다고 주장하지 않는다.

| 조건 | 결과: 동일 배너8 / 음성17 |
| --- | --- |
| 사전 고정 점수차>=0.05: 문자 보조 | 후보2/8·FP0/17 |
| 사전 고정 점수차>=0.05: 이미지 보조 | 후보1/8·FP0/17 |
| 사전 고정 주 비교: 이미지+OCR | 후보3/8·FP0/17. 기존7번 외1번·5번 추가, 남은5개 누락 |
| 흰 이미지+동일 OCR | 후보2/8·FP0/17. 실제 픽셀의 추가 기여는5번1개 |
| 점수차>=0 진단용: 문자 / 이미지+OCR | 각각7/8·FP0/17 / 8/8·FP1/17. 후자의 오탐은 합성 스포츠 뉴스·도박 예방 안내 |
| 사후 추가: 기존 PUBLIC_INFORMATION 제외 + 점수차>=0 | 문자7/8·FP0/17, 이미지+OCR8/8·FP0/17. 기존 canonical 제외 규칙을 재사용한 추가 조합이며 사전 고정 주 비교/독립 검증 아님 |

CPU Ryzen7 9700X/약32GiB에서25개 문자1.366초(1.352~1.374), 이미지+OCR148.514초
(148.313~149.200), 각3회 중앙값/범위다. Python 자체peak RSS3155.2MiB, shm cache에서
모델 로드1.574초다. 문자 전용 경량 모델·전체 앱 메모리·per-image p95·end-to-end
추가 모델 scan·원본 GIF 효과·Windows 실행은 측정하지 않았다. 모델의 이미지 처리
비용이 크므로 현재 개발 회귀에서8/8이 나왔다는 이유로 제품 수용/일반 정확도로
판정하지 않는다. 실제 정상 광고6개도 전자제품 판매처2곳에 한정된다.

새 근거는 ignored `artifacts/embeddinggemma2-eval-20261021/`의 receipt/source-manifest,
SHA256SUMS, `observed.json`(사전 고정), `public-guard-composition.json`(사후 추가),
`miss-analysis.json`, baseline 세 결과, 원본 정상 광고/HTML, 실제 벡터/모델 hash와 로그다.
실행 source/고정 protocol은 `benchmarks/embeddinggemma2/`에 있다. 모델 가중치 캐시는
명시된 task-owned `/dev/shm/illegal-ad-embeddinggemma2-20261021`이며 휘발성으로,
고정 snapshot 다운로드/해시 재현 방법을 README에 남겼다. 생성된 실험 환경/캐시는
소스 변경이나 제품 runtime inventory가 아니다. commit/push/배포/제출은 없다.

## 2026-10-21 문자 임베딩 보조를 실제 점검에 통합

사용자 승인 범위: 문자 의미 보조를 실제 일반 점검에 연결, 기존 공공안내 제외 유지,
이전 평가와 겹치지 않는 실제 배너·실제 정상 광고로 탐지/오탐/시간 비교. Windows는
계속 보류한다. 일반 direct/WARP 선택, 공식 네 기법, 여러 사례 통합/외부 능동 탐색
범위는 바꾸지 않았다. `dev/bootstrap`, HEAD56fd3563, 미커밋 작업이다.

OBSERVED: 공식 JSON 확정→선택 OCR 전체 완료→애매한 외부 연결 배너의 문자 보조
경로를 연결했다. 고정 ONNX text FP32/ORT1.30/tokenizers0.2, CPU2스레드, 한·영
설명16개와 margin0이다. 새 extra는 검토 후보고 OCR 원문/literal matches를 보존한다.
모델/오류/시간 근거의 TS·Rust 검증과 간단/고급·XLSX 표시를 통합했다. 모델은 약1.12GB
SHA 고정 빌드 자산이며 점검 중 다운로드/외부 AI 전송은 없다. 취소/마감은 기존 OCR
child를 종료하고 모델 오류는 baseline을 보존한다. 모델 누락/위조 metadata/예약 토큰/
비어 있지 않은 공식 JSON 보존도 검사했다.

MEASURED: 기존 Python25 벡터 대비 JS/ONNX 최대 성분 오차3.20e-7, 코사인 오차
2.98e-12, margin오차3.37e-7, margin0/.05 판정 변화0. 새 corpus 점수를 보지 않은
runtime parity다. 실제 점검 경로에서 세 번 쌍 비교했고 쌍별 OCR 차이0이었다.

- 새 보도 화면의 실제 광고10개(147×40): baseline0/10→review5/10, 세 번 동일.
- 기존 미사용 광고주 블랙툰10개(198×60): 1/10→9/10, 세 번 동일. 이전 화면 계열과
  같은 출처이므로 사이트·시점 독립 성능으로 합산하지 않는다.
- 초기 frozen 정상10개에서2FP: 실제 게임 그림의 OCR `+`, 보이스피싱 예방 캠페인.
  숫자/기호만 있는 OCR 제외와 피싱 예방 공공안내 제외를 보완했다. 초기 결과를 보존했다.
  이 보완 후 같은 자료의0FP는 회귀 검증이며 무편향 holdout 성능이 아니다.
- 별도 frozen 문자 많은 실제 정상4개(쿠폰2/정상 대출/캐시 구매) 추가 비교 포함,
  최종 실제 정상 홍보13개+공공안내1개 모두 수집·OCR 완료, FP0/14. 음성 분모를
  양성 코호트나3반복으로 중복 계산하지 않았다. KB2이미지는 같은 캠페인이다.
- 최종 점검 중앙값: 주10개6.047→7.404초(범위5.962–6.130→7.387–7.673초),
  보조10개6.600→7.973초, 기본 음성10개3.359→4.602초, 추가4개1.445→2.702초.
  각 점검의 새 child/모델 초기화 포함, OS cache 강제 cold/CPU 독점/host 저장은 아님.

초기 supplemental replay는 Content-Length 없는 시험 서버 때문에 JPEG1개가 화면
PNG 변환 상한에 걸렸다. 이를 true negative로 세지 않고 raw 결과를 보관했다.
올바른 MIME/크기 헤더로 재실행한 최종34개는 제외/실패0이다. 실제 클릭 목적지는
원 screenshot에 없어서 모두 동일한 가정 외부 링크로 재현했다. 실사이트 전체 탐지율이
아니다. 새 양성은 하나의 별도 뉴스 화면, 보조 양성은 하나의 보관 화면에 묶여 있다.
뉴토끼 원본24개 연결 초기화는 계속 미해결이며 정부 차단 원인으로 단정하지 않는다.

검증: `npm run build:scanner`, 최종 `npm run build`, `npm run typecheck`, `npm run lint`
통과. Linux owned fixture opt-in `KRDS_TEST_UNSANDBOXED=1 npm test`는633passed,
1skipped. Linux 공유 native harness `cargo test --manifest-path
benchmarks/native-session-l3/Cargo.toml --locked --offline evidence::tests -- --nocapture`
6passed. `git diff --check` 통과. 첫 전체 테스트는 opt-in 없이 실행해 호스트의
usable sandbox 부재로81failed였고, 제품의 격리 설정을 낮추지 않고 시험 설정으로 재실행했다.
첫 lint의 benchmark performance import 누락3개도 수정 후 통과했다. src-tauri 전체
metadata의 offline resolution은 uncached android_system_properties로 실패했으며
공유 Rust 검증으로 한정한다. Windows native/packaging/runtime lock 검증은 NOT_RUN이다.

자료/정책/초기·보완·최종 전후 결과/환경/누락은
`artifacts/text-embedding-integration-20261021/`와
[상세 통합 검증](TEXT_EMBEDDING_INTEGRATION_20261021.md)에 연결한다. 여전히 주 자료5개,
보조1개가 누락된다. 작은 이미지에서 OCR이 잃은 제안 문구를 문자 임베딩이 복원하지
못했다. 자동 확정이나 현장 오탐률0%/제출 준비 완료를 주장하지 않는다. commit/push/
PR/배포/제출/자동 WARP 등록/OS 라우팅 변경은 하지 않았다.

## 2026-10-21 남은 OCR와 GIF 선택 누락 개선

사용자 요청 범위는 남은 MT5개 OCR 원인 개선, GIF 다중 프레임, 기존/새 실제 배너·
정상 광고의 전후 탐지·오탐·처리 시간이다. Windows는 계속 보류한다. dev/bootstrap,
HEAD56fd3563 위의 기존 dirty를 보존한 미커밋 작업이다. 배포/제출/PR/네트워크 변경은 없다.

OBSERVED: 원래147×40을2432×672로 키우는 검출기의 글자 분할/누락과 인식 오류를
detector영역/모든CTC줄/Tesseract로분리했다. 단일4x교체·band·반전·대비·경계실험은
기존양성회귀로거부했다. 기존OCR전체를보존하고 미판정smallPNG에만같은가중치의
4x검출OCR을별도수행,같은공공안내/모델기준을적용한다. 결과를합치거나수동오타복원
하지않고선택외원문은ocrAlternatives(max1/4096자)로저장,TS/Rust/UI/XLSX연결했다.
초과길이/대안실패시기존결과유지,마지막childclose후늦은취소상태도수정했다.

GIF에서는8×8dedup가회색14px20ms문구를흰frame과동일시하고전역대비top4가고대비
장식만고르는누락2개를실제생산capture로재현했다. 빠진frame은기존OCR로정확문구/
confidence.96이므로OCR실패와구별됐다.128×32signature/edge+4인덱스구간분산선택과
선택누락partial표시로개선했다.120프레임/약3초/4선택/250KB/4MP상한과creativehash보존.
같은구간내장식경쟁제어는아직놓치며,모든순간의탐지를보장하지않는다.

MEASURED:수정전worker+scan코드snapshot과수정후canonical의동일세션3쌍비교,
모델/설명16개/margin0고정,2회차실행순서교환. 모든실제61입력수집/OCR완료,탐지수동일.

| 자료 | 전→후 | 전체 시간 중앙값 전→후 |
| --- | --- | --- |
| 기존 MT문제10 |5→7/10|10.570→11.257초|
| 블랙툰18 |16→18/18|19.786→20.166초|
| 새 실제 의심광고9 |6→9/9|9.547→9.951초|
| 기존 정상13+안내1 |FP0→0/14|9.089→9.679초|
| 새 실제 정상10 |FP2→2/10|6.893→7.016초|
| 파생 양성 GIF제어3 |0→2/3|3.076→2.830초|

새양성은Civic2016/2022의새source4(이미4/4)+이전MT화면미사용5(2→5/5)이고,
3개출처화면에묶인다. 정상은Hackers6/IBK1/GS3의실제환급/무료/쿠폰/대출/상품광고다.
라벨·crop·hash·manualoverlap은모델점수전동결(freshmanifest99c95446...).새정상FP2는
무료토익교재/전기기사300%환급,전후같은파일/margin0.016555/0.002843이며이번OCR
대안시도대상이아니었다. 이오탐은미해결이다. 기존 MT는우주선/WINNER/MACHUJA3누락이
남는다. 임계값을이정답에맞춰완화하지않았다. 원본해상도와다른인식검증이필요하다.

실제집행불법/정상animatedGIF0확보,외부portfolio는진단분리. 실제정상6에20ms노출을
붙인파생GIF3쌍은FP1→1/6,같은무료교재오탐이남았다(3.519→3.651초). 이를실제GIF
현장탐지율이나새독립광고분모로세지않는다. 모든href는기록화면에없어동일가정링크다.
호스트CPU독점/OS강제cold/host저장시간이아니며,새9/GIF의쌍별시간변화부호가갈려
속도개선주장은없다. MT쌍별추가시간중앙값.427초(.425–.875초),범위는상세보고서를따른다.

검증: build:scanner/build/typecheck/lint통과,ownedfixtureoptin전체645passed1skipped,
Linux공유Rustevidence7passed,git diff --check통과. focusedOCR/GIF21개,작업자UI/report
30개를검토통합후전체실행했다. 길이/늦은취소리뷰수정은최초timing모듈로드뒤여서
새build/경계회귀/최종소스정상GIF쌍으로별도증명했다. Windows는NOT_RUN이다.
[상세 원인·검증](OCR_GIF_IMPROVEMENT_20261021.md)과
artifacts/ocr-gif-improvement-20261021/의frozenprotocol/rawruns/summary/receipt/환경/
기각실험/remaining-misses/false-positives를따른다. 모든누락·오탐해결이나제출준비완료를
주장하지않는다. DOGFOOD_LEDGER(+514/-4)와docs/superpowers의기존변경은그대로다.

## 2026-10-21 — 교육 광고 비교군 개선과 남은3누락 진단

text-ad-embedding-v2에정상교육설명3개를추가했다. 모델/양성8/이전음성8/margin0/
공공안내제외/공식JSON/OCR/GIF/자원상한은유지,TS/Rust는v1/v2저장근거를읽는다.
실제교육FP2의원문을스포츠토토설명과잘못비교하던정상문맥누락을보정했고,
정상OCR회귀는전실패/후통과했다. 교육키워드/광고주일괄예외는없다.

우주선crop의세로여백이첫충전을첫출전으로읽는원인을같은컴포넌트/CTC로입증했지만,
21→13pxcrop복구만으로최종후보가되지않았고17개전역적용은기존제안을손상시켰다.
WINNER는스타일로고미검출/숫자만,MACHUJA는브랜드만읽고4~6px제안문구손실이다.
넓은교육설명은양성6개를잃고첫충전양성설명은교육FP를재발시켜모두기각했다.
3누락은미해결이며OCR/scan생산코드는baseline와동일하다.

최종66점검3paired반복에서분류수동일,모든입력과선택frameOCR완료했다.

| 자료 | 전→후 | 전체시간중앙값 전→후 |
| --- | --- | --- |
| MT10 |7→7/10|8.584→7.969초|
| 블랙툰18 |18→18/18|14.087→14.136초|
| 이전실제양성9 |9→9/9|6.656→6.663초|
| 새실제사칭광고6 |6→6/6|7.142→7.187초|
| 기존정상13+안내1 |FP0→0/14|6.280→6.292초|
| 이전정상10 |FP2→0/10|4.354→4.433초|
| 새정상정지9,2점검합 |FP2→1/9|7.844→8.146초|
| 새실제정상GIF1 |FP1→0/1|2.314→2.291초|
| 삼성/LG축소회귀6 |FP1→1/6|4.829→4.904초|
| 파생양성GIF3 |2→2/3|1.941→1.972초|

새6개는뉴시스/FN3기사의동일사칭브랜드SNS형식이다.4helper/2직접규칙,
6독립사이트·작은배너회복·6helper성공으로과장하지않는다. 새정상은YBM9/시원1,
원본GIF1=2frame을모두OCR한1광고다. 새FP응시료할인/자료집1과기존축소폰FP1은
여전히남았다. 새정답을보고다시기준을맞추지않았다. 새정상10합은FP3→1,
1MB/page상한유지해4/5/GIF세점검합10.158→10.426초,범위/쌍별변화는상세보고서참조.
초기크기미지정/20ms시험의수집실패는별도보존했고FP0으로세지않았다.
실제width/height를양쪽동일명시한조건의최종3쌍을보고한다. 현장늦은광고보장은없다.

build:scanner/build/check통과,전체645passed1skipped(별도heavyholdoutoptin),
Linux공유Rustevidence7passed,diffcheck통과. Windows/commit/push/PR/배포/제출은NOT_RUN.
[상세원인·비교](OCR_SEMANTIC_REFINEMENT_20261021.md)와
artifacts/ocr-semantic-refinement-20261021/의snapshot/기각probe/fresh동결manifest1af0e7e.../
raw66runs/summary/receipt/읽기전용리뷰를따른다. 3누락·모든오탐해결이나제출준비완료를
주장하지않으며기존DOGFOOD_LEDGER(+514/-4)와docs/superpowers를보존했다.


## 2026-10-21 — 다른 OCR 비교, 응시료·삼성 축소본 오탐 보정

Tesseract의높은meanconfidence가토익누락을숨기고, 같은PP의더낮고짧은4x오독을
positiveOR로받던두원인을고쳤다. 의미비교로만통과한TesseractPNG는기존PP기본으로
검증하며완료된원문/그원문helper판정을선택한다. OCR/의미검증실패는기존양성보존,
공공안내/DOM제외는기존predicate, 직접v3양성은보존한다. PPdefault↔4x가confidence와
문자수모두줄면helper만으로승격하지않고직접문구는허용한다. threshold0/19설명/
모델/공식JSON/GIF/자원상한은그대로다. 인식기추가·광고주예외·문자수정은없다.

EasyOCRG1/G2는3누락핵심문구를충분히복구하지못했고, KoreanTrOCR는일부복구에도
기존정상10중3FP와깨진문자의3/3양성이생겨도입/ONNXexport를기각했다.
TrOCR양성점수를실제탐지회복으로세지않는다. 우주선/WINNER/MACHUJA3누락은미해결이다.

최종130점검=13군×전후×5, warmup2별도, 판정5회동일. 기존40/43·새실제6/6유지,
정상50(축소6·공공안내1포함, exactSHA중복0)FP3→0으로응시료/삼성/새KT쿠폰을제외했다.
실제누락추가회복0. MT7/10·블랙툰18/18·이전9/9·사칭6/6, 실제정상GIF1=2frameFP0,
파생GIF2/3은그대로다. 모든입력/선택frameOCR+optional완료/unavailable0,
공식commitbyteidentity/TS계약/소스·생산자해시통과. 1090image-analysis/보관helper850/
alternate245를검사했다. 새라벨/hash/픽셀은점수전동결(e703a370...),정책후조정없음.

새양성은KCOPA2022보고서1화면nativecrop6, 새정상은교육/KT4운영사10으로,
6독립사이트/현재실시간광고/일반현장FPR로일반화하지않는다. 새실제불법GIF는없다.
시간N5중앙값: 새양성6개4.659→5.438초(쌍별+.785,+.714–+1.078), 새정상10개
4.520→4.747초(쌍별+.251,−.154–+.421), 기존43양성4점검합38.765→40.253초다.
공유호스트변동이있고속도개선/P95보장이아니다. 각군범위/쌍별합계는상세보고서를따른다.

build:scanner/build/check652passed1skipped/focused20passed/Linux공유Rust7passed,
벤치최종수정후lint통과, 코드리뷰finding1개수정·재검증했다. Windows는계속NOT_RUN이며
commit/push/PR/배포/제출은하지않았다. 기존DOGFOOD(+514/-4)/superpowers보존.
[상세비교](OCR_ENGINE_COMPARISON_20261021.md),ADR-0017,인계문서와
artifacts/ocr-engine-comparison-20261021/의protocol+amendment/runtimeidentity/raw/summary/
audit/review/fresh/alternative-ocr/receipt를따른다. 세누락해결·제출준비완료를주장하지않는다.

독립측정검토는130raw/99SHA/전후시간·5회문구/점수동일성을재계산해차단결함없이
마쳤다. 단기존온카양성은후margin+.0000180으로PP검증후문구가손상된경계사례이며,
그양성수보존을안정적이해복구로일반화하지않는다. 다음정보보존/abstention과제로남겼다.


## 2026-10-21 — 작은 배너 이미지 검토·정밀도 보정

일반점검canonical경로에외부링크/작은PNG(height<=96,aspect>=3)/실제OCR숫자문맥을
요구하는이미지보조검토를통합했다. 실제픽셀+실제선택OCR realmargin>=0,
seed1701pixelshuffle margin<0, SHA바인딩계약과별도검토배지다. 문자복구/법적확정이
아니며숫자/이미지유사도하나만으로승격하지않는다. OCR공공/같은DOM제외는미선택읽기
까지우선한다. 온카의유일범주를잃는검증은원문을덮어쓰지않는다.

문자v3는기존양성8/임계값0에일반아이템교환코드normal1개를더한20참조다.
경품단독/가입부분문자열오독/이름한단어승격과그이미지경로재승격을막았다.
이미지v2는20기본+교육/게임정상2참조이며모델/전처리/정책을고정했다.
추가671MBencoder, CPU자식격리, 이미지두forward16s/문자OCR8s/전체마감유지다.
범용영상분류·영상만입력·과도한normal설명·환각OCR은기각했고실패기록을보존했다.

최종76점검+warmup2,189실행입력/소스해시불변,596입력관찰/문자485/이미지38/
대안182기록검사, optionalunavailable0, 공식JSON확정후불변/TS상세계약통과다.
기존49양성46->49(MT7->10/10,블랙툰18/18,나머지21/21),새출처양성4->4/6이다.
출처원본/네이티브crop음성65 FP2->0(실제공공안내1포함),기존축소6음성FP0,
추가축소정상21 FP1->0,제목/로고자원2 FP0이다. 새축소양성4/6,
파생GIF목표frame기준2/3/bin-competition frame1보관누락은남았다. 새실제GIF없음.

초기18개와추가7개는오탐발견뒤개발자료로전환했으며독립holdout으로재포장하지않는다.
최종보정에쓰지않은실제정상2개도FP0이지만같은에듀윌의2캠페인/작은표본이고
그원본/축소본은새vision경로를직접실행하지않았다. 일반현장FPR100%주장은없다.
새양성6은2023문헌1화면/6그림이지6독립사이트가아니다. 실제목적지불명소재의
외부href는재생fixture통제조건이다. source/count보정기록도남겼다.

N5전체점검중앙값: MT10 7.506->23.051초(쌍별+15.604,15.395~16.020),
새양성6 5.501->16.176초(+10.693,10.511~10.885),새정상12 6.920->6.846초,
추가정상7 3.283->3.231초다. 후두묶음차이는분산안으로속도개선주장없다.
다른군N1시간은성능근거가아니다. 공유데스크톱/동일NAS모델상태,독점부하·Windows미검증.

build:scanner/web/typecheck/lint/675passed1skipped/Linux공유Rust8passed/diff통과,
루트소스·원시대조완료. 독립agent재검토는사용량제한으로미완료다. NAS지정사용후
모델cache/stage16파일SHA검증전환,최종원시runs/warmupNAS보관,코드는canonical그대로다.
기존DOGFOOD(+514/-4)/superpowers보존, commit/push/PR/배포/제출/Windows NOT_RUN.
새SMILE/부띠끄2누락과파생GIF1누락을미해결로명시하며전체탐지완료를선언하지않는다.
[상세검증](OCR_GROUNDING_20261021.md),ADR0017,인계및
artifacts/ocr-grounding-20261021/{frozen-protocol,frozen-source-identity,summary,audit}.json과
rejected-v1/v2/precision-followup/의기각·보정·파생분리근거를따른다.

### 2026-10-21 저해상도2·GIF1 추가 개선 및 최종 비교

직전최종after-runtime을이번baseline으로고정했다. SMILE/부띠끄의4–8px한글은
동일ROI인식기·확대/대비변경으로복구못해실제이미지예시와같은checkpoint벡터를비교하는
imagev3로보완했다. OCR원문/대안/실제matchedTerms그대로, threshold0/score3/3,
원본positive AND seed1701pixelshufflenegative/SHA/격리자식/공공·DOM제외유지다.
15positive+11normal+26shuffle=52참조벡터,가중치재학습/새dependency/외부추론없음.
개발참조와정밀도보정자료를독립holdout으로포장하지않았다.

GIF는bucket별edge최대를4프레임streaming다양성선택으로바꿨다. 120검사/3s/4보관과
partial표시유지, 수락후보만PNG인코딩하고실패시이전선택유지다. 실제읽힌교육·휴대폰판매문맥
우선, 일반제목/고립숫자승격방지, 단순보조추론보류와공공·정상·DOM제외를분리하여
약한대안이기존실제카지노범주를지우지못하게했다.

최종29묶음N1전후+4묶음N5추가=90raw+warmup2,190입력/540관찰,
문자345/이미지50/대안176, primary·alternate·helper불가0, official각점검확정byteidentity/
finding0/TS상세계약,394실행소스·입력해시불변. 집중4묶음판정/원문동일,점수1e-5내.
실제출처134=60positive74negative(공공안내1포함),별도대조/자원56분리.
기존55positive53→55,새실제5positive5→5,정상74FP0→0.
이전저해상도6/그축소6은4→6,기존파생GIF3은2→3,위치변형4는1→4,
새정상축소6FP2→0. 새양성의강제137x42변형5는5→4: BUTTER는스포츠해당UP/HE만남아
일반제목승격제한으로보류됐다. 원본은전후탐지,이회귀를숨기거나광고주/단어예외로승격하지않았다.
모든극단변형/모든실제GIF를해결했다는주장은없다.

초기새11실제/11파생은FP발견후개발자료로전환. 추가정상3+축소3도FP0이며점수로fit하지
않았으나knownoperators추가campaigns다. 원본3text만/축소3미진입이라독립vision일반화
증거가아니다. 최초신규정상축소중알라딘1은vision실행후음성이다.

N5전체점검중앙값초: 저해상도6 24.164→21.826(쌍별중앙+0.042,−2.917~+0.499),
파생GIF3 3.618→2.999(−0.477,−0.883~−0.271),새실제양성5 9.494→10.136
(+0.139,−0.601~+1.014),새실제정상6 5.560→5.325(−0.156,−0.479~+0.476).
GIF외3묶음속도우열주장없음. 같은Ryzen9700X/Linux/CPUFP32/동일NAS자산/seed1701,
소유테스트·모델동시실행없음,외부데스크톱부하는미통제. Windows/P95/콜드설치추정없음.

최종scanner/webbuild/typecheck/lint/688passed1skipped/Linux공용Rust8passed/diff통과.
주요구현6package기존소스만변경, UI/저장계약/관련fixtures·tests추가, 기존dirty/DOGFOOD
(+514/-4)/superpowers보존. commit/push/PR/배포/제출/Windows미실행.
[상세보고와남은제한](OCR_LOWRES_GIF_20261021.md), ADR0017,인계및
artifacts/ocr-lowres-gif-20261021/{frozen-protocol,frozen-source-identity,summary,audit}.json.
최종raw는승인된 /mnt/nas/illegal-ad/validation/ocr-lowres-gif-20261021/ 에보관했다.


## 2026-10-22 FP32 고정 문자 벡터 사전 계산

고정20문구를같은4개batch로사전계산하고 model/policy/contentSHA 검증후오프라인번들로읽는다.
실제60양성/74정상과별도56대조의190판정전후동일, 반복540관측1044점수성분최대차이0.
N5전체시간과메모리는쌍별부호혼재로명확한우위주장없다. 중복추론5회제거/378~491ms→2~5ms
로드검증은별도구간진단관측이다. 690passed1skipped/typecheck/lint/build통과.
[상세근거](EMBEDDING_PRECOMPUTE_20261022.md). 기존극단축소미탐1건유지, Windows/양자화보류.
사용자최신우선순위는 UI/UX 다듬기·최적화이며 Windows는내일진행한다.


## 2026-10-22 UI/UX·성능 최적화 통합

간단모드의문구0/배너6건첫화면혼동을해결하고후보를바로표시한다. 중복전체이미지조회1→0,
320px근거값폭88→256px, 추가분석포함경과시간/대기안내, 모드선택가독성을개선했다.
문구/추가결과구분·사용자선택·원본JSON/메모/XLSX/선택WARP를유지했다.
웹152tests/typecheck/lint/build와실제빌드replay통과. 설치/native/Windows는내일로미뤘다.
[화면근거와제한](UI_ADOPTION_KO.md#2026-10-22-화면과-실행-비용을-함께-개선),
[FP32성능비교](EMBEDDING_PRECOMPUTE_20261022.md).

### 2026-10-22 Gemma 선택적 양자화 및 UI 결과 근거 정리

문자+vision 전체INT8 후보는 BC.GAME의 경계점수 부호반전/원문선택·판정경로변경과
5.49초 이미지fallback으로기각했다. 문자FP32+vision8bit를 canonical path에적용하고,
동일참조20+52의model/input/contentSHA를검증했다. threshold0/공공안내제외/OCR/예산불변.
190회귀입력의판정/원문/프레임동일, 실제60/60+정상오탐0/74, 파생17/18+오탐0/38.
1044점수비교 최대0.006846605(text0), 반복0. PNG컨테이너SHA1건차이는동일SHA재현후
RGBA/원본·shuffle입력텐서바이트동일을확인해비교에만동등취급; rawreceipt불변.
4묶음pairedN5/40시간receipt+2warmups, 비성능25묶음의FP32baseline/후보50receipt.
저해상도6전체중앙15.901→15.933초(속도우위없음), childVmHWM2181.1→1778.5MiB,
모델/토크나이저6자산1,787,911,199→1,312,154,937B(−26.6%). 다른묶음메모리차이는부호혼재.
번호/접기/키보드·반응형 UI 및 실제선택양자화결과6건,617건메모/보고서보존확인.
696passed1기존skipped/Rust8/typecheck/lint/scanner·webbuild통과.
보고서 docs/EMBEDDING_QUANTIZATION_20261022.md, 원시/감사 artifacts/embedding-quantization-20261022/.
Windows·설치·배포·제출·외부능동탐색·commit/push/PR은미실행. Windows는사용자정한내일.


### 2026-10-22 이미지 인코더 병렬도·화면 반복 정보 최적화

동결한 FP32문자/8bit vision 기준에서 이미지 인코더2스레드가 병목이었다.
원본·shuffle4forward/참조/정책/원문/예산을 유지하고2/4/6/8/12/16의두N5시리즈를 비교했다.
8스레드가 이 기기에서 가장 빨라 runtime vision만 min(8,availableParallelism())/inter1로 적용했다.
canonical pairedN5 저해상도6개15.935→10.388초(−34.8%), 모든쌍5.496~5.670초단축.
workerHWM1778.4→1776.8MiB(메모리우위주장없음), 별도진단vision9.754→4.168초,
누적workerCPU19.515→33.303초증가. 다른경로/하드웨어전체의최적해로일반화안한다.
190개/29묶음 전후90formal receipt/1044점수비교 maxdelta0, 원문/대체원문/프레임/경로모두동일.
실제60/60·오탐0/74, 파생17/18·오탐0/38, 기존BUTTER극단축소누락1유지.
UI간단안내/동일진입주소중복제거·관측연결주소표시로3카드하단1575.64→1273.14px.
320~1440넘침0/원문·PNG/공식JSON/617건모드·메모·엑셀618행보존/외부요청0/WARP0.
696passed1기존skipped/typecheck/lint/scanner·webbuild/diffcheck통과.
[상세측정/제한](IMAGE_LATENCY_OPTIMIZATION_20261022.md),
증거 artifacts/image-latency-20261022/ (대용량 승인NAS).
setup부하가겹친후보round4/중단된메모리미완료1건은분모제외·raw보존. 전체중단원인SIGTERM미확인;
같은실행본/남은원래순서로재개완료. Windows는내일이며 설치/배포/제출/commit/push/PR미실행.


### 2026-10-22 OCR 중복 연산·CPU 최적화

PP-OCR 확률검증을mask/CTC순회에합치고 x보간좌표재사용·입출력tensor finally해제를 적용했다.
모델/스케일/CTC/confidence bounds/예산/프레임/정책/참조/vision cap8/text2/1 불변.
308보간텐서 byte동일/실제recognizer입력73개 hash·순서동일,190입력·98formal receipt의
원문/대체원문/confidence/프레임·시각/출처/판정 경로 및1200점수비교maxdelta0.
실제60/60·오탐0/74, 파생17/18·오탐0/38, 기존BUTTER극단축소1누락 유지.
pairedN5 저해상도6 전체10.359→10.099초/CPU42.60→42.24초(약0.8%)/workerVmHWM
1774.4→1728.1MiB. 추가5배너 CPU5.95→5.82초. 다른묶음의부호혼재변동은개선주장없음.
두native arena재사용후보는메모리+214MiB/이득없음+52MiB로기각,arenas OFF유지.
간단모드에서대체OCR원문접기를제공하고선택원문과분리·원시문구/키보드/조회/화면폭보존.
699passed1기존skipped/typecheck/lint/scanner·webbuild/617건흐름통과. 첫UI기대값갱신과
재현안된수집관측수1건변동은로그보존,변동원인확정·수집영구수정주장없음.
[상세CPU/시간/메모리·한계](OCR_CPU_OPTIMIZATION_20261022.md),
artifacts/ocr-cpu-20261022/ (raw승인NAS). Windows내일/설치·배포·제출·commit/push/PR미실행.

### 2026-10-22 Gemma 비전 CPU 최적화

유효 패치/픽셀/셔플/GIF 예산을 보존하고 vision의 trailing padding만 제외, runtime cap8→6.
후보선택 별도N5 뒤98 formal scan에서 저해상도6배너 CPU41.99→35.00s(−16.65%),
wall10.024→10.342s(+3.18%), worker VmHWM1718.0→1704.2MiB 관측.
처리시간 증가를 받아들인 CPU 우선 절충이며 cap5/8·스핀·동적블록·auto 후보/산포도 보존했다.
실제60/60·정상0/74, 파생17/18·정상0/38, 원문/신뢰도/GIF/판정경로 동일,1200점수delta0.
UI관측주소복사/실패복구·목록밀도·지연조회·원시근거·JSON·617건/618행 보존.
703passed/1기존skipped/scanner·webbuild/typecheck/lint/diffcheck 통과.
[상세 성능/한계](VISION_CPU_OPTIMIZATION_20261022.md), artifacts/vision-cpu-20261022/.
Windows내일(10/23), commit/push/PR/설치/배포/제출/외부능동탐색 미실행.

## 2026-10-23 후보 재빌드와 검증

### 소스·시험 상태 (OBSERVED_LOCAL)

HEAD `16d4b561cc2eb4ade960da82a6864823f68cd7f1`, 브랜치 `dev/bootstrap`, 작업 트리 clean.
`PATH=/usr/bin:$PATH KRDS_TEST_UNSANDBOXED=1 npm run check` — Node v22.23.3에서 EXIT 0,
`Test Files 94 passed | 1 skipped (95)`, `Tests 704 passed | 1 skipped (705)`, 204.4초.
같은 suite는 Node 26.8.1에서도 green. `npm run build` EXIT 0. 로컬 원시 로그는
`/tmp/final-check-node22.log`, `/tmp/final-check-node26.log`(임시 경로, 저장소 밖).

`56fd356` 이후 추가된 commit 15개: gated OCR/embedding pipeline, simple/advanced 모드,
기본 direct 전송+선택 WARP, 문서, CI 예산, 런타임 의존성 closure staging(`type-fest`
types-only 수정, nested 중복 보존, lock 672→1197), scan teardown 무한 대기 수정(브라우저
종료 중 CDP await 제거), `.gitattributes` CRLF 고정, Vitest 파일 직렬화, 모델 다운로드
재시도(3회×15분, hash/size/4xx 치명), rustfmt, cold-call 시험 warm-up.

### CI 시도와 차단 원인 (NOT_RUN / BLOCKED)

이 브랜치에서 GitHub Actions를 5회 시도했고 그 과정에서 다음을 수정했다: Windows 런타임
staging의 `type-fest` 누락(entry point 없는 types-only 패키지), `cargo fmt --check` 실패,
LF→CRLF checkout이 SHA-256 고정 한국어 vocabulary 바이트를 바꾸는 문제(Windows 전용),
1.08 GiB 모델 다운로드의 3분 전체 전송 abort, 4 vCPU 경합에서 8초/16초 validator를 넘긴
cold-call 증거.

이 브랜치의 Actions는 5회 시도 후 계정 결제 차단으로 job이 시작되지 않았고, 이후
push(`1c0e8a3`, `e87799a`)에 대해서도 동일하게 시작되지 않았다. 마지막으로 step이
실행된 시도는 HEAD `16d4b56`(dispatch `39806914699`, PR `39806920316`)이며 그조차
실행된 step은 0개다. GitHub 표기 그대로:

> The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings

실행된 step은 없다. 계정 결제 차단이며 시험·빌드 실패가 아니다. CI 통과를 주장하지 않는다.

### Linux 교차 빌드 후보 (OBSERVED_CROSS_BUILD)

**이 후보는 아래 `### 재빌드 (85a286f)`로 대체(superseded)되었다. 다음은 당시 관측 기록이다.**

호스트 Linux, `KRDS_WINDOWS_TARGET=x86_64-pc-windows-gnullvm`, LLVM-MinGW 20260908
(clang 23.1.1, sha256 `bab7f174d7e136ae093ad232d5a894ee00f0a8f9051bcff4eb6a70c132898248`),
NSIS 3.09-4(makensis sha256 `ca9f28d9726d38d33b403187871af920b59c265eade7fa463684cf1e8b322d3e`).

`node scripts/prepare-windows-runtime.mjs --verify` →
`{"runtime":"verified","files":1197,"nodeVersion":"22.19.0"}`.
`npm run build:desktop` EXIT 0, `npm run package:windows` EXIT 0. Tauri는 교차 컴파일을
실험적(experimental)으로 표시하고 비Windows 호스트에서는 서명을 건너뛴다.

후보 `artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-3fb23ff998ea-20261022T160030222Z`:

| 항목 | 값 |
| --- | --- |
| buildId | `0.2.1-x86_64-pc-windows-gnullvm-3fb23ff998ea-20261022T160030222Z` |
| appVersion / target | `0.2.1` / `x86_64-pc-windows-gnullvm` |
| source.commit / dirty | `16d4b561cc2eb4ade960da82a6864823f68cd7f1` / `false` |
| sourceSha256 | `3fb23ff998ead8db5eb6b018ef45e55cd6588cc5a10680e474d2913d4c1c7087` |
| installer `불법광고 탐지 도구_0.2.1_x64-setup.exe` | 796,331,514 B(759.44 MiB), sha256 `c76c133fa1fb35736da5b31e9dd1873442a72ef1e204b1765a8ff2fbccb439d8` |
| standalone `krds-detector.exe` | 20,184,576 B, sha256 `896ce98c9a0bfb2cb20e2a117ce412bcd143f8a377db4094da486e77c5ac10a1` |
| 설치본 exe(marker 변환 후) | sha256 `38411c042f2b5aa2dc8729b7586160e0553a9c3089257b59355ddf67cc6ed17b` |
| verify | `node scripts/verify-artifact.mjs <candidate>/manifest.json` EXIT 0, 8 files, `unsigned-internal-candidate` |

상위 8개 파일 hash가 모두 manifest와 일치하고 목록 밖 파일은 없다. standalone과 설치본
hash 차이는 Tauri의 UNK→NSS marker 변환에 따른 예상된 차이다(Hash는 무결성 검사이며
발행자 인증이 아니다). 이 후보는 gnullvm 교차 빌드이지 MSVC 배포 경로가 아니다.

NOT_RUN: Windows에서의 설치, 대화형 UI 수용, MSVC 빌드/제품 경로(CI 결제 차단),
WebView2 부재 offline 설치, 코드 서명.

### 재빌드 (85a286f)

**이 후보(`76e7d5ec…`, installer `54c8f1cd…df406`)는 아래 「2026-10-23 통합 검증과
최종 후보」의 `307f6b6f…` 후보로 대체(superseded)되었다.** 다음은 당시 관측 기록이다.

16d4b56 뒤 source commit 세 개 때문에 같은 날 다시 빌드했다: `95bb51d` credential-bearing
entry URL 거부, `2ea59e4` stale case-store import-status 시험 기대값 수정(제품 동작 변경
없음), `85a286f` clippy `div_ceil`. 위 3fb23 후보는 이 재빌드로 대체되었다.

후보 `artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-76e7d5ec6ce4-20261022T163747830Z`
(디렉터리 819,665,685 B):

| 항목 | 값 |
| --- | --- |
| buildId | `0.2.1-x86_64-pc-windows-gnullvm-76e7d5ec6ce4-20261022T163747830Z` |
| appVersion / target | `0.2.1` / `x86_64-pc-windows-gnullvm` |
| source.commit / dirty | `85a286f5fcaf125fcadec155eac729bfe019db92` / `false` |
| sourceSha256 | `76e7d5ec6ce4f9d2b7b5446b2ae29f934a2c85f98dc76821b4225a106af90b19` |
| installer `불법광고 탐지 도구_0.2.1_x64-setup.exe` | 796,348,611 B(759.46 MiB), sha256 `54c8f1cdff25e9077a2432b8e75af14cef7597fe1fb21eb8325fbb6b6dfdf406` |
| standalone `krds-detector.exe` | 20,220,928 B, sha256 `bd57296b8823ff79d0aa9da6c7e9dc578cb3ac853a086be1f1b690cc69bac121` |
| 설치본 exe(marker 변환 후, markerOffset 13455874) | sha256 `8059cb5d93fecccf013b3645d046bc9d8f8ae26bbe498896492b4dee8f61413e` |
| verify | `node scripts/verify-artifact.mjs <candidate>/manifest.json` EXIT 0, 8 files, 8/8 hash 일치, 목록 밖 파일 없음, `unsigned-internal-candidate` |

검증 실행: `node scripts/prepare-windows-runtime.mjs --verify` 1197 files(runtime lock
미변경), `npm run build:desktop` EXIT 0, `npm run package:windows` EXIT 0,
`cargo check --target x86_64-pc-windows-gnullvm --all-targets` EXIT 0, Windows target
clippy(CI와 같은 명령) EXIT 0, `cargo test --bins` 78 passed / 0 failed / 2 ignored,
`cargo fmt --check` EXIT 0.

NOT_RUN: Windows에서의 시험 실행(cross sysroot 없음), MSVC CI(계정 결제 차단), Windows
설치·대화형 UI 수용, WebView2 부재 offline 설치, 코드 서명.

predecessor `candidate-0.2.1-x86_64-pc-windows-gnullvm-3fb23ff998ea-20261022T160030222Z`는
삭제하지 않고 `/mnt/nas/illegal-ad-artifacts-archive-20261023/`로 이동했다(819,612,236 B,
9개 파일 sha256은 이동 manifest에 기록). 빌드 후 호스트 루트 여유는 약 1.3 GB이며
staging/target은 NAS에 있다.

### 실측 잔여 위험 (MEASURED; 이번에 수정하지 않음)

cold-start embedding(Linux, 2 CPU 고정, page cache evict): text 3.65초(상한 8초,
production timeout 8초), image 11.4초(상한/timeout 16초). 인위적 3배 oversubscription에서
text 5.5~6.0초, image 18.5~46.7초를 관측했다. 느린 하드웨어에서는 첫 text/image embedding
근거가 `budget`으로 탈락할 수 있고(fail-closed, 오탐 없음, 다만 이미지만 있는 광고는 놓칠
수 있다) child worker가 종료된다. production 코드는 바꾸지 않았다. 권장 후속 수정은
post-commit 단계 전 embedding warming과 초기화 시간의 `elapsedMs` 제외다.

installer 크기 759.44 MiB는 모델 약 1.31 GB와 스테이징 `node_modules` 약 376 MB를 포함한다.
`onnxruntime-node`가 모든 플랫폼 바이너리(약 288 MB)를 실어 나르지만 런타임은 win32-x64만
사용하며, **이 시점에는** pruning이 미구현이었다(이후 `1c0e8a3`에서 구현, 아래 「통합 검증과
최종 후보」 절). [빌드 매뉴얼](BUILD_MANUAL.md)의 같은 항목을 참조한다.

### 환경 기록 (OBSERVED_ENVIRONMENT)

호스트 루트 파일시스템 여유가 약 3 GB여서 `src-tauri/target`을
`/mnt/nas/illegal-ad-build/target-gnullvm-20261023`로 symlink했다. `sourceIdentity()`가 그
symlink를 거부했으므로(`git ls-files --others`에서 EISDIR) 로컬 `.git/info/exclude`에
`src-tauri/target`을 추가했다(추적되지 않으며 commit하지 않는다).

gitignore 대상이던 오래된 증거 4건을 삭제하지 않고 이동했다: `artifacts/detection-improvement-20261021`과
`artifacts/NIA_ADOPTION_*_CANDIDATE_20261010.zip` 번들(+ 공개 batch `.sha256`) →
`/mnt/nas/illegal-ad-artifacts-archive-20261023`. 당시 `artifacts/candidate-*`는 건드리지 않았고,
이후 85a286f 재빌드에서 predecessor 후보만 같은 archive로 이동했다(위 재빌드 절).
이동 manifest: `/mnt/nas/illegal-ad-build/moved-artifacts-20261023.txt`, `/tmp/moved-artifacts-20261023.txt`.

## 2026-10-23 통합 검증과 최종 후보

**이 절은 이제 역사 기록이다. 이 절의 `307f6b6f…` 후보(installer `753b873c…f5ebc`)는
뒤의 「2026-10-23 최종 후보 (f481d73)」의 `0361562d…` 후보로 대체(superseded)되었다.**
다음은 그 시점의 관측 기록이며, 현재 후보 값으로 인용하지 않는다. 앞의
`### 재빌드 (85a286f)` 후보(`76e7d5ec…`)는 이 절의 `307f6b6f…` 후보로 대체되었고,
세 후보 모두 `artifacts/`에 삭제하지 않고 보존했다.

### 소스와 commit (OBSERVED_LOCAL)

| 항목 | 값 |
| --- | --- |
| 브랜치 / HEAD | `dev/bootstrap` / `1c0e8a34c407776ea6fb16943a1e8c73961c6d77` |
| 작업 트리 | clean, 원격에 push됨 |
| 앱 버전 / 탐지 정책 | `0.2.1` / `0.2.1-policy2` |

`85a286f` 이후 추가된 commit 5개:

| commit | 내용 |
| --- | --- |
| `953ce2c` | evidence engine을 계측 전에 warm-up. `analyzeAfterInit` seam으로 시계를 엔진 resolve 뒤에 시작, `{warm:true}` 프로토콜 + `LocalOcrBackend.warm`, `scanSite`가 1회 warm(상한 = 분석 예산 1회, 8초, 잔여 500ms 미만이면 생략)하고 `embedding-warm:budget\|error`를 기록 |
| `be9c14a` | 예금·쿠폰 축 광고 의미(ad-semantics) 추가 |
| `bdcc0e8` | D08 일괄 그룹 영속화·재시작 복원(`<cases>/groups/<uuid>.json`, list/save IPC 2개, UUID·RFC3339·enum·자격 없는 공개 URL 검증) |
| `98cae4f` | upstream 연결 실패를 `403 network-policy`가 아니라 `502 access-navigation`으로 보고 |
| `1c0e8a3` | 비대상 `onnxruntime` payload pruning. `bin/napi-v6/win32/x64` + loader/license만 staging, binding/DLL 누락·타 플랫폼 잔존 시 실패. 스테이징 `node_modules` 376 MB → 153 MB(−233,962,380 B), lock 1197 → 1177 |

### 로컬 검사 (OBSERVED_LOCAL)

| 명령 | 결과 |
| --- | --- |
| `PATH=/usr/bin:$PATH KRDS_TEST_UNSANDBOXED=1 npm run check` | EXIT 0, `Test Files 98 passed \| 1 skipped (99)`, `Tests 754 passed \| 1 skipped (755)`, 216.7초 |
| `npm run build` | EXIT 0 |
| `cargo test --bins` | 80 passed / 0 failed / 2 ignored (**호스트 실행, Windows 아님**) |
| `cargo fmt --check` | EXIT 0 |
| Windows target clippy(CI와 같은 명령) | EXIT 0 |
| `cargo check --target x86_64-pc-windows-gnullvm --all-targets` | EXIT 0 |
| `node scripts/prepare-windows-runtime.mjs --verify` | 1177 files |
| closure 시험(`scripts/test/windows-runtime-closure.test.mjs`) | 8/8 |

`KRDS_TEST_UNSANDBOXED=1`은 소유 loopback fixture의 Chromium sandbox만 해제한다.
CI는 여전히 계정 결제 차단으로 시작되지 않았으므로 **CI 통과를 주장하지 않는다**.

### 후보 `307f6b6f…` (OBSERVED_CROSS_BUILD; 이후 superseded)

`artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-307f6b6ff09b-20261023T013033441Z/`

| 항목 | 값 |
| --- | --- |
| buildId | `0.2.1-x86_64-pc-windows-gnullvm-307f6b6ff09b-20261023T013033441Z` |
| appVersion / target | `0.2.1` / `x86_64-pc-windows-gnullvm` |
| source.commit / dirty | `1c0e8a34c407776ea6fb16943a1e8c73961c6d77` / `false` |
| sourceSha256 | `307f6b6ff09b9ce04e0b157c6a9b9e1d87cf8c25148605e7731a4892addab731` |
| installer `불법광고 탐지 도구_0.2.1_x64-setup.exe` | 747,381,035 B(712.76 MiB), sha256 `753b873c2b1454eae27fb5524cafaf4f70e682ae6ad660be2412a877a44f5ebc` |
| standalone `krds-detector.exe` | 20,356,608 B, sha256 `112e1099daf303eacadee12339fa31083f96b55c6f61e8452aa33059b4cb8f9c` |
| 설치본 exe(marker 변환 후, markerOffset 13534994) | sha256 `b6cc4411d2feecb9048dbb8f7dc3ecd568a4a944c368bedb7cb3877270211699` |
| `releaseStatus` / `signing` | `candidate` / `unsigned-internal-candidate` |
| verify | `node scripts/verify-artifact.mjs <candidate>/manifest.json` EXIT 0, **8 files, 8/8 hash 일치**, 목록 밖 파일 없음 |
| 빌드 도구(manifest `tools`) | node `v26.8.1`, rustc `1.98.1`, tauri `2.12.1` |

설치 크기는 predecessor 759.46 MiB 대비 **−46.7 MiB**(796,348,611 → 747,381,035 B)다.
Tauri는 교차 컴파일을 "실험적"으로 표시하며, 이 후보는 MSVC 배포 경로가 아니다.
verify는 무결성 검사이며 발행자 인증이 아니다.

### Windows 실제 환경 v2 (OBSERVED_WINDOWS)

호스트 `ssh win` → `Pocket4`, `pocket4\dbsgu`, Windows 11 Pro `10.0.26200`,
PowerShell `7.6.6`, Cua Driver `0.30.1`. 증거 디렉터리
`artifacts/win-verify-20261023/`(`README.md` v2 절, `RECEIPT-v2.json`,
`screenshots/v2-*`, `exports-v2/`).

| 단계 | 결과 |
| --- | --- |
| 전송·해시 | tar 스트림 767,805,440 B → installer 747,381,035 B, 4m32s, EXIT 0. Windows `Get-FileHash` installer `753b873c…5ebc`, standalone `112e1099…8f9c` — 기대값 일치 |
| 설치(대화형 NSIS, UAC 없음) | "Setup was completed successfully". 설치본 EXE `b6cc4411…1699`, 20,356,608 B — expected installed-marker와 **정확히 일치** |
| 실행 | 설치 관리자의 Run 옵션으로 시작, 시작 화면·오류 대화상자 없음 |
| loopback 점검 | detached Node fixture 서버(127.0.0.1:18777, Win32_Process로 SSH 세션 비소유) → case `8991fad4…`, **탐지 17건**, 확인 15페이지, 실패 0, 경과 15초, 기법 TRANSPARENT/HOMOGLYPH/JAMO/OFFSCREEN, 서버 로그에 앱 요청 19건 |
| 닫힌 포트 | 127.0.0.1:18779(리스너 없음) → `502 access-navigation`(정책 거부 아님) |
| 검토 | 근거 보기 + 판단 `광고 의심`(저장값 `suspected`) + 메모 영속 |
| 공식 JSON | 4,586 B, BOM 없음, 17 findings, elapsed 15.407, sha256 `701ed484…0a3d`, 저장된 `result.json`과 **byte-identical** |
| XLSX | 16,514 B, 6 시트, 메모·판단 포함. 실제 Excel 열람은 NOT_RUN |
| 재시작 | 메모·판단 복원, 공식 bytes 불변 |
| 프로세스 | 앱/chromium 고아 0. AppData 194 → 218 files, 추가 24·삭제 0·기존 수정 0 |
| 보존 | 기존 케이스·설치본 삭제·초기화 없음 |

**v1 정정.** 같은 날 v1 기록은 후보 `76e7d5ec`에서 loopback 점검이 `403
access-network-policy`로 거부되는 것을 회귀(defect)로 적었다. **그 주장은 철회한다.**
v1의 fixture 서버는 SSH 세션의 `Start-Process`로 띄운 것이 스캔 시점에 이미 죽어 있었고
(로그에 앱 요청 없음), [INFERENCE] 따라서 닫힌 포트를 측정한 것이었다. v2는 양쪽을 모두
증명한다: 살아 있는 loopback 서버는 정상 점검되고, 닫힌 포트는 `502 access-navigation`으로
분류된다. v1 절은 역사 기록으로 남기고 "defect/regression" 서술은 이 정정으로 대체한다.

### NOT_RUN (최종 후보 기준)

| 항목 | 이유 |
| --- | --- |
| Windows MSVC CI(`windows-native`, `required`) | 계정 결제 차단으로 job 미시작. 시험 실패 아님 |
| D08 실제 Tauri window 재시작 후 통합 보고서 | 그룹 파일·IPC·재마운트 복원·통합 XLSX 재생성은 구현·자동 시험으로 확인했으나, 설치된 앱 프로세스를 실제로 재시작하는 Windows 수용 시험은 NOT_RUN. 기기 간 그룹 이식도 NOT_RUN |
| WebView2 부재 offline 설치 | offline profile 없음 |
| 코드 서명(Authenticode) | 조직 인증서·승인 절차 없음 |
| 실제 사람 사용성 평가·보조기기(AT) 판독 | 수행하지 않음 |
| Excel에서 XLSX 실제 열람 | v2에서 열지 않음 |
| 무인 설치·제거·선행 후보 업그레이드 스크립트 경로 | 대화형 "Already Installed" 재설치만 수행 |

## 2026-10-23 최종 후보 (f481d73)

이 절은 재개 전 후보의 역사 기록이다. NIA·D08 결함과 새 수정은 뒤의 세션 인계 재개 절을 따른다. 앞 절의 `307f6b6f…` 후보(installer `753b873c…f5ebc`,
712.76 MiB)는 이 후보로 **대체(superseded)**되었고 `artifacts/`에 보존했다. 여기서
바뀐 것은 **탐지 규칙 강화(`e54fe63`)** 와 그 문서화(`f481d73`)뿐이며, 빌드·시험·Windows
수용을 새 후보 기준으로 다시 실행했다.

### 소스와 commit (OBSERVED_LOCAL)

| 항목 | 값 |
| --- | --- |
| 브랜치 / HEAD | `dev/bootstrap` / `f481d73080415a3a64a1f3e0353e689356db11b1` |
| 작업 트리 | clean, 원격에 push됨 |
| 앱 버전 / 탐지 정책 | `0.2.1` / `0.2.1-policy2` |

| commit | 내용 |
| --- | --- |
| `e54fe63` | 이미지·광고 판정의 앵커 축소. `SETTLEMENT_ANCHORS`는 `가입코드`/`테더`/`usdt`만 인정하고 `환전`·`꽁머니`·`롤링`은 리베이트 용어로만 남긴다. `첫충`은 `/첫충(?!전)/`로만 매칭(평범한 `첫충전`/`충전` 제외). 음성 회귀 3건 추가(환전 수수료 무료·충전 시 페이백 / 롤링 이벤트·충전 안내 / 가입코드 첫충전 10% 보너스) |
| `f481d73` | 위 규칙을 `docs/DETECTION.md`에 기록하고, 190입력 재측정 결과를 두 2026-10-22 측정 노트에 남김(문서만) |

### 로컬 검사 (OBSERVED_LOCAL)

| 명령 | 결과 |
| --- | --- |
| `PATH=/usr/bin:$PATH KRDS_TEST_UNSANDBOXED=1 npm run check` | EXIT 0, `Test Files 98 passed \| 1 skipped (99)`, `Tests 757 passed \| 1 skipped (758)` |
| `npm run build` | EXIT 0 |
| `cargo test --bins` | 80 passed / 0 failed / 2 ignored (**호스트 실행, Windows 아님**) |
| Windows target clippy(CI와 같은 명령) | EXIT 0 |
| `node scripts/prepare-windows-runtime.mjs --verify` | 1177 files |

이전 후보(`307f6b6f…`) 대비 시험 수는 754 → **757 passed**(+3: `e54fe63`의 음성 회귀
3건)이고 skipped 1건은 그대로다. `KRDS_TEST_UNSANDBOXED=1`은 소유 loopback fixture의
Chromium sandbox만 해제한다. CI는 계정 결제 차단으로 여전히 시작되지 않았으므로
**CI 통과를 주장하지 않는다**.

### 정밀도 재측정 (MEASURED; Linux, `f481d73`)

`e54fe63` 작업 트리에서 **같은 190개 입력**(`artifacts/vision-cpu-20261022/inputs.json`,
sha256 `eb1572b6162e76790ae477d921ae5ee1b96789bb7370add137c78a9f3a3e8ad3`)을 새 bench
디렉터리에서 다시 재생했다. 원시 자료:
`/mnt/nas/illegal-ad-artifacts-archive-20261023/vision-cpu-current-head/`
(`inputs.json`, `runs/*-after.json`, `protocol.json`).

| 묶음 | 결과 |
| --- | --- |
| 실제 출처 불법광고 배너 | **60/60** |
| 실제 정상 광고 오탐 | **0/74** |
| 파생 양성 대조군 | **17/18** |
| 파생 정상 대조군 오탐 | **0/38** |

네 수치는 `e54fe63` 이전 측정과 **동일**하다. 판정이 바뀐 7행은
`knownBlacktoon` original-1·2·3·4·5·8, `positive-bets8`이며, 모두 **v4 검토 → v3 규칙**으로
강화된 양성이다. pass/fail이 바뀐 행은 없고, 남은 누락은 여전히 파생
`new-positive-butter` 1건이다. 이 재측정은 Linux CPU 환경의 것이며 Windows 이미지
경로를 대신하지 않는다.

### 최종 후보 (OBSERVED_CROSS_BUILD)

`artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-0361562d628c-20261023T025120901Z/`

| 항목 | 값 |
| --- | --- |
| buildId | `0.2.1-x86_64-pc-windows-gnullvm-0361562d628c-20261023T025120901Z` |
| appVersion / target | `0.2.1` / `x86_64-pc-windows-gnullvm` |
| source.commit / dirty | `f481d73080415a3a64a1f3e0353e689356db11b1` / `false` |
| sourceSha256 | `0361562d628c41fc5e1c21a2082388b726725aa0db9863b7d799c47f53618575` |
| installer `불법광고 탐지 도구_0.2.1_x64-setup.exe` | 747,530,910 B(712.90 MiB), sha256 `1f1060dc3a00c2f72b4156f8b9b32a5f70f086bf9ee8d739f4d519b29aed6087` |
| standalone `krds-detector.exe` | 20,356,608 B, sha256 `bc8d4ba469a58b05e8482495289aca23c8dc210b6f4c6a9a19776c1023afa58b` |
| 설치본 exe(marker 변환 후, markerOffset 13534994) | sha256 `6ec092343551ae01f9c0ec472492478878e87b2b92ee67ea5ac34834ba6170ff` |
| `manifest.json` | 55,492 B, sha256 `307d23b510069c93a50d5789ce913c7a013a46374f152c1e0ef3e74b5d6402d4` |
| `releaseStatus` / `signing` | `candidate` / `unsigned-internal-candidate` |
| verify | `node scripts/verify-artifact.mjs <candidate>/manifest.json` EXIT 0, **8 files, 8/8 hash 일치**, 목록 밖 파일 없음 |
| 빌드 도구(manifest `tools`) | node `v26.8.1`, rustc `1.98.1`, tauri `2.12.1` |

installer는 직전 `307f6b6f…`(712.76 MiB) 대비 **+0.14 MiB**(747,381,035 → 747,530,910 B),
pruning 이전 `76e7d5ec…`(759.46 MiB) 대비 **−46.6 MiB**다. packaging 구성은 바뀌지
않았고, 증가분의 원인은 이번에 따로 분해하지 않았다. Tauri는 교차 컴파일을 "실험적"으로
표시하며, 이 후보는 MSVC 배포 경로가 아니다.
verify는 무결성 검사이며 발행자 인증이 아니다.

### Windows 실제 환경 v3 (OBSERVED_WINDOWS)

호스트 `ssh win` → `Pocket4`, `pocket4\dbsgu`, Windows 11 Pro `10.0.26200`,
PowerShell `7.6.6`, Cua Driver `0.30.1`(daemon pid 10344, 세션 `krds3`). 증거:
`artifacts/win-verify-20261023/`(`README.md` v3 절, `RECEIPT-v3.json`,
`screenshots/v3-*`, `exports-v3/`, `phase-v3-*.json`, `server-v3.log`).

| 단계 | 결과 |
| --- | --- |
| 전송·해시 | tar 스트림 4m33s, EXIT 0. Windows `Get-FileHash` installer `1f1060dc…6087`, standalone `bc8d4ba4…a58b`, manifest `307d23b5…02d4` — 모두 기대값 일치 |
| 설치(대화형 NSIS 재설치, UAC 없음) | "Already Installed" → Add/Reinstall → "Setup was completed successfully". 설치본 EXE `6ec09234…70ff`, 20,356,608 B — expected marker와 **정확히 일치**. 설치 직후 AppData 31 cases/218 files 불변 |
| 실행 | 설치 관리자 Run 옵션으로 시작(pid 1480), 시작 화면 정상, 오류 대화상자 없음 |
| loopback 점검 | detached Node fixture(127.0.0.1:18777, pid 14340, SSH 세션 비소유·별도 세션 probe 200 OK), fixture 17파일이 repo `f481d73`과 hash 동일 → case `4f196929-7699-4865-b598-cfec4369e9a9`: **탐지 17건**, 확인 15페이지, 실패 0, 15.4초, 기법 **HOMOGLYPH 5 / TRANSPARENT 3 / JAMO 4 / OFFSCREEN 5**, 앱 요청 19건 |
| v2 대조 | 같은 fixture·같은 URL의 `8991fad4…`와 **(url, location, technique, evidence_text, is_violation) 17개 튜플이 순서까지 동일**. 추가·삭제·재분류·문구 변경 0 |
| 검토 | 근거 보기(`f1`, 유사 문자, `Ｃ카지노 가입 즉시 지급`) + 판단 **`광고 의심`**(저장값 `suspected`) + 메모 저장(`review.json` revision 4) |
| 공식 JSON | 4,586 B, BOM 없음, 17 findings, `elapsed_sec` 15.412, sha256 `afe186850b2481be44c72b1d8fb958fa5551ab9a0ce123b81ede3ba2900d018e` — 저장된 `result.json`과 **byte-identical**, Save As 경로 반영 |
| XLSX | 16,522 B, 유효 zip, 6 시트(`점검 요약, 반복 항목, 탐지 상세, 페이지·점검 범위, 추가 분석, 검토 기록`), 메모·판단 라벨(`위반 의심`) 포함. **Excel 열람은 NOT_RUN** |
| 재시작 | 창 닫기(프로세스 0) 후 재실행(pid 19320) → 저장된 결과에서 `케이스 다시 열기`: 메모 원문·판단 `광고 의심` 복원, 5개 공식 파일 bytes 전부 불변 |
| 프로세스 | `krds-detector` 0, `setup` 0, `chrome`/`chromium` 0(`msedgewebview2` 6은 기존 baseline), fixture 리스너 0 |
| 보존 | AppData **218 → 238 files(+20, 0 삭제, 기존 수정 0)**, cases 31 → 32. 추가분은 새 case `4f196929…`의 5개 파일 + `assets\*` 15개 |

### 실제 공공 사이트 단일 스캔 (scenario 1, OBSERVED_CUA_OPERATOR)

Cua Driver로 조작한 Windows 설치본에서 `https://www.nia.or.kr/`을 단일 대상으로
점검했다. 설정은 고급 모드에서 최대 5페이지·깊이 1·90초였고, 결과는 공식 탐지 0건,
확인 4페이지, 실패 1페이지, 경과 12.186초였다. 실패한 대상은 entry URL
`https://www.nia.or.kr/` 자체였고, `status=200`·`reason=access-unknown`
(case `640fd01e-ed38-4540-a953-9625b9a649e3`)로 기록됐다. Playwright 실행 컨텍스트가
JS 탐색으로 파괴된 스캐너 탐색 수명주기 결함이며(owned fixture 동일 재현), 접근 차단이
아니다. 원본 예외는 `page.evaluate: Execution context was destroyed, most likely
because of a navigation` at `readAccessDocument`이고, root 원인은 entry page의 초기
클라이언트 JS redirect(`/site/nia_kor/main.do`)다. UI에는 "일부 페이지 확인 실패"가
표시됐다. 증거: `artifacts/dogfood-20261023/README.md`,
`screenshots/scenario1-result.png`, `exports/scenario1-official.json`,
`exports/scenario1-report.xlsx`, `artifacts/nia-entry-diagnostic-20261023/README.md`.
이 결과는 **한 사이트의 한 실행**이며 entry page 자체가 처리 실패해 커버리지가
완전하지 않다. 탐지 0건은 정밀도·재현율 측정이 아니며 "문제 없음"/"정상 사이트"로
일반화하지 않는다. 조작은 Cua Driver 기반 에이전트 시뮬레이션이며 사람 사용성 평가가
아니다.

### 스캐너 탐색 수명주기 결함 — Correction D (선택, source-bundle proof 단계)

**근본 원인.** `crawl.ts`가 `page.goto(..., waitUntil:"commit")` +
`waitForLoadState("domcontentloaded")` 이후 `readAccessDocument()`(`page.evaluate`)를
호출하는데, NIA entry page의 클라이언트 JS 탐색이 그 사이 실행 컨텍스트를 파괴한다.
`navigating`은 이미 `false`이고 timeout도 아니므로 `classifyPageError`가 `unknown` /
`access-unknown`으로 분류했다. owned fixture(즉시 `location.href='/landed'`)가 동일
예외를 재현했다.

**선택된 수정 (Correction D).** 원래의 제한된 `domcontentloaded` 대기와 기존 settle을
유지하고, **첫 DOM 접근 분류를 settle 이후로 지연**하며 **중복 pre-settle read를
제거**한다(3 insertions/3 deletions). 보편적인 `load` 대기(universal wait load)는
채택하지 않는다. rejected 이유: `window.onload` redirect에서도 여전히 실패하고 최대
5초 자원 비용이 든다.

**Gov.kr 알려진 한계 (fail-closed 유지).** Correction D의 uninstrumented run에서는 gov.kr이
여전히 `finalUrl=gov.kr`, `issue=unknown`, `reason=access-unknown`으로 남는다. 별도의
instrumented run에서만 meta-refresh → cross-host `plus.gov.kr` 외부 redirect가 관측됐다.
same-site 정책은 fail-closed를 유지하며, gov.kr을 NIA와 같은 case/retry로 특-casing하지
않는다. ordinary D가 gov를 올바르게 분류했다고 주장하지 않는다. Main이 처리 방향을 설계 중이며
정책 완화는 없다. gov.kr은 "수정됨"으로 기록하지 않는다.

**현재 증거 (Correction D, source-bundle proof).**
- 회귀 시험: `packages/scanner/test/redirect-domready.test.ts` (DCL + onload) 2건 통과.
- Windows headless source-bundle proof (sandbox enabled, Chromium 1243):
  `artifacts/nia-entry-diagnostic-20261023/remote-D/*` (entry `/site/nia_kor/main.do`
  checked, 5 checked / 0 failed / not timed out), execution-context 오류 없음.
- Hanging subresource smoke (D): 293ms, final `/landed`, no timeout, issue null
  (no universal load-resource cost).
- External JS redirect smoke (D): rejected navigation/external-redirect, no external doc analyzed.
- Variant bundles: `scanner-worker-baseline.mjs`, `scanner-worker-load.mjs`,
  `scanner-worker-variantD.mjs`, `variantD.diff`.

**상태.** 이것은 source-bundle headless proof만이다. 아직 재빌드·설치된 후보를 대체하지
않는다. Correction D의 baseline-vs-D timed pair(실제 이미지-heavy + synthetic)는 아직
미완료이며, 새 installer/candidate manifest가 만들어진 뒤에만 제출 문서의 현재 후보
identity를 갱신한다. `0361562d…` 후보는 이 경로에 대해 완전 검증되지 않은 역사 관측으로
**Scanner D는 아직 일반 수정으로 확정되지 않았다.** root fix는 onLive 분석 전에 bounded
browser-initiated document handoff를 요구하며, 같은 host 변경은 원래 page/global budget 안에서
최대 2회, 단일 `goto`/단일 page/onLive exactly once, external redirect는 fail-closed 및
정확한 observed URL을 유지해야 한다. 구현은 검토 중이며 acceptance claim은 아직 없다.

### D08 실제 UI 증거 (FAIL, not accepted) — dogfood 2026-10-23

설치본(`6ec09234…70ff`)에서 Cua Driver로 두 공개 대상 일괄 점검을 실행했다.
- NIA 공식 `https://www.nia.or.kr/`: checked 49, failed 1 (access-unknown), findings 0.
- 정부24 `https://www.gov.kr/`: checked 0, failed 1 (access-unknown), findings 0.
- 그룹 `a5a7aceb-4c86-41f1-8316-c81c3186d946`: phase `paused`, 두 대상 모두
  `pending`, NIA caseId만 존재, gov caseId 누락. 저장 UI는 "일괄 묶음을 저장하지
  못했습니다"를 냈고, 정상 종료/새 프로세스 복원은 "저장된 일괄 묶음을 복원했습니다"
  (1/2, 재연결 없음)로 stale partial만 복원했다. **성공이 아니다.**
- 통합 XLSX는 pre/post-restart 모두 생성됐으나, 그룹 identity는 degraded다.
  positive-review criterion은 NOT_RUN(findings 0).
- 스크린샷 `excel-open-d08.png`은 실제 KRDS 앱 화면이고, `scenario2-batch-result.png`는
  폴더 선택기 overlay다. **Excel 실제 열람 증거가 아니다.** worker 주장의 Excel-open
  수용은 현재 후보에 대해 accepted evidence가 아니다.
- 그룹 `1e647088` (sslip.io 우회)는 정책 비준수로 제외했다. 정책 완화 없음, 재발 금지.

**Root cause / native fix (main-reviewed).** native `ScanSession.error: Option<None>`이 null로
직렬화되고, shared TS `error?: string`, batch path가 null을 투영해 strict
`isBatchGroup`이 IPC 전에 `INVALID_BATCH_GROUP`으로 reject하던 문제다. Main이 검토한 수정은
**한 canonical serializer**(start/startBatch/getSession 공통)에서 absent `error`/`finishedAt`을
omit하고 nonempty failures만 유지하는 것이다. validators는 변경하지 않았다. Native 회귀:
running+terminal success는 `hasResult=true`, `error` ABSENT, finish present; failed case는
actual error retained. targeted 1 pass, EXIT 0. **Full native validation은 이제 OBSERVED다**: `cargo test --bins` 81 passed / 0 failed / 2 ignored, EXIT 0; `cargo fmt --check` EXIT 0; Windows gnullvm `cargo clippy --all-targets -- -D warnings` EXIT 0; Windows gnullvm `cargo check --all-targets --offline` EXIT 0 (Rust 1.98.1). 증거: `artifacts/dogfood-20261023/native-validation/{COMMANDS.txt,native-test-full.log,native-fmt.log,win-clippy.log,win-check.log}` (NAS mirror). 이것은 소스 수정 검증이며 설치본/D08 통과를 뜻하지 않는다. 역사적 후보의 80 passed 수치는 그 후보 기준으로 남기고, 새 소스 uncommitted 81 passed는 별도로 기록한다. Scanner handoff 구현은 검토 중(generation cap / error classification / test isolation gaps)이며 acceptance claim 없음. 출하 전 상태이며, final candidate identity는 integration 이후에만 갱신한다.
**범위 제한(NOT_RUN).** 이번 fixture는 `배너·추가 단서 0건`이므로 강화된 이미지 광고
경로를 Windows에서 실행하지 못했다. 규칙 강화의 근거는 Linux 190입력 재측정과 fixture
자동 시험뿐이며, Windows에서 관측된 것은 *변하지 않은* 17개 문자 탐지다. Excel 실제
열람, 무인 설치/제거, 서명도 NOT_RUN이다.

## 2026-10-23 세션 인계 재개 (진행 중)

### 상태와 보존

- 시작 ROOT `/home/monad/develop/illegal_ad`, `dev/bootstrap@f481d73`.
  staged/unmerged 없음. `git stash list`는 비어 있었다. 인계된 문서 8개,
  `crawl.ts`, `session.rs`, untracked `redirect-domready.test.ts`가 모두 존재했다.
- 시작 diff/stat/status와 시험 원본을
  `artifacts/dogfood-20261023/resumed-validation/resume-start*`,
  `redirect-domready.start.ts`에 보존했다. stash 자동 적용·파일 일괄 복원은 하지 않았다.
- 네이티브 serializer와 같은 파일 회귀 시험만 `43c6ff5`에 독립 커밋했다.
  새 실행 `cargo test --bins --locked --offline`: 81 passed / 0 failed / 2 ignored.
  fmt 및 Windows gnullvm clippy/check all-targets EXIT 0. 로그는 같은 디렉터리
  `native-test.log`, `native-fmt.log`, `win-clippy.log`, `win-check.log`.

### 목표·불변 조건·수용 근거

- 목표: 문서 전환 때문에 누락된 NIA 진입 페이지를 분석하고, 공개 두 대상 D08의
  저장·실제 앱 재시작·통합 XLSX 재생성을 새 Windows 설치 후보에서 확인한다.
- 불변 조건: 호스트(포트 포함) 제한, public-network 정책, Chromium sandbox,
  단일 goto/단일 live 분석, 페이지·전체 마감, 실제 오류 보존, 묶음 검증기 유지.
  기존 사용자 사례·검토·내보내기 파일을 보존한다.
- 이번 범위는 로컬 수정·커밋·후보 제작·지정 Windows PC 검증·승인된 NAS/HDD0 보존이다.
  push/PR/공개 배포/실제 공모전 제출은 실행하지 않는다.
- 수용 조건: 전체 check와 네이티브 검사, source hash가 고정된 후보의 artifact verify,
  새 설치본 NIA 진입 포함, D08 두 case 연결·terminal 상태 유지, 재시작 후 보고서,
  이전 자료 보존의 실제 파일·UI 근거. 부분 실패는 탐지 완료로 바꾸지 않는다.

### 스캐너 수정과 현재 증거

- `crawl.ts`: DOM 분류는 settle 이후 수행한다. 실제 main document의 응답·commit을
  추적해 최종 HTTP 상태를 분류하고, 최대 2회 문서 전환 안에서 준비를 완료한다.
  history/hash 변경은 문서 교체로 세지 않는다. 준비 중 context 파괴는 실제 전환을
  확인한 경우에만 기존 시간 안에서 다시 준비한다. `timeout: 0` 무제한 대기는 금지한다.
  live 분석은 반복하지 않으며 이후 문서가 바뀌면 stale 링크/HTML을 성공으로 남기지 않는다.
- 격리된 loopback 회귀 13개 통과. 기존 접근/사이트맵 5개 통과.
  최종 403/429/503·외부 이동·전환 상한·페이지 timeout·hanging image를 확인했다.
- Windows source-worker (설치본 아님): NIA 5 checked / 0 failed,
  entry finalUrl `https://www.nia.or.kr/site/nia_kor/main.do`, 18,502ms.
  정부24 0 checked / 1 failed, `https://plus.gov.kr/`, `external-redirect`, 3,029ms.
  두 실행 EXIT 0, worker SHA-256 `f0d9b8980675cd9181f4b8908cca6bf005639c1224b4f629dde7e2f5688f8c04`.
  sandbox 유지. temp worker는 기존 설치본의 동일 모델/런타임을 junction으로 참조했다.
  최초 temp 실행은 ESM이 NODE_PATH를 읽지 않아 playwright-core 해석에 실패했다.
  temp node_modules junction으로 수정했으며 실패 로그도 보존했다.
- 전체 검사 진행 중. 새 설치 후보·설치본 D08는 아직 NOT_RUN.
  기존 `0361562d…`는 두 수정이 없는 역사 후보이며 최종 E2E 통과본이 아니다.

### 재개 소스 검증 완료 (새 설치본 검증 전)

- 스캐너와 격리 시험은 `3598f48`로 독립 커밋했다. 네이티브 `43c6ff5` 포함.
  최종 실행 소스 SHA-256 `70a599fb051d852058b5df6f8efcbcf00fb0c35d86dfab4af6b81356c496b4e0`.
- 전체 `KRDS_TEST_UNSANDBOXED=1 npm run check` EXIT 0:
  99 files passed / 1 skipped; 770 tests passed / 1 skipped, 220.15s.
  기존 1초 페이지 예산의 취소 시험에서 추가한 준비 guard의 회귀를 발견해 제거했다.
  기존 실제 페이지 타이머를 유지하며, canonical scanner dist 재빌드 뒤 취소 2개와
  전체 suite를 다시 통과했다. 이전 실패·stale-dist 실행 로그도 같은 evidence에 보존했다.
- Node build-boundaries/runtime-closure 합계 13 passed / 0 failed.
- 최종 worker SHA-256 `5a2e1c6f3f5209d48db641ee259ce4b559b40398583a382d3fa2ec81f689df11`로
  Windows source-worker 재실행: NIA 5 checked / 0 failed (15,948ms),
  정부24 `plus.gov.kr` external-redirect (2,998ms), 두 실행 EXIT 0.
  `windows-source-worker-final.log`, `source-identity-final.json` 참조.
- 다음 작업: 검증된 두 소스로 새 후보 제작 → 기존 자료 보존 → Windows 설치·D08 재시작
  → 통합 XLSX 확인. 공개 두 대상은 탐지 0건이므로 양성 판단/메모 포함 D08 수용은 별도다.

### 새 Windows 후보 제작 (설치 검증 전)

- `build:desktop`와 `package:windows` EXIT 0. 후보:
  `artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-70a599fb051d-20261023T052502674Z/`.
- source commit `3598f48824884ad146dc60dcd16a7ab97407ca7d`, source hash
  `70a599fb051d852058b5df6f8efcbcf00fb0c35d86dfab4af6b81356c496b4e0`는 전체 검사 hash와 같다.
  `source.dirty=true`는 남아 있는 제출/인계 문서 편집 때문이다. 제품 소스는 두 독립 커밋에
  보존했으며 빌드 중 변경하지 않았다. 이 값을 clean으로 고쳐 쓰지 않는다.
- `verify:artifact` EXIT 0, 8 files verified, runtime closure 1177 files.
  설치 파일 712.84 MiB. 소스·무결성 검증이며 설치본 E2E 수용 결과는 아니다.
- 기존 앱 정상 종료 후 AppData 36개 사례·286개 파일(5,765,587 B)을 별도 Windows
  `backup-node-before-install`에 복사하고 파일별 크기·SHA-256을 대조했다.

### 새 후보 Windows 재설치·보존 확인 (OBSERVED)

- Windows 전송 installer 747,470,896 B, SHA-256
  `05bbb3da6a2e7d1b0c5a9b7a5241ade7d8e3717a3b50cf7f2acab4cc04df7a12`가 후보와 일치했다.
- Cua Driver 대화형 NSIS `Already Installed` → Add/Reinstall → 같은 사용자 설치 경로 →
  `Installation Complete / Setup was completed successfully.`를 관측했다(0027 screenshot).
- 설치된 EXE `af4f830ec4abf0a11bdb47d16c742df7f22e1c2168edfa89521ad608021ea408`,
  worker `5a2e1c6f3f5209d48db641ee259ce4b559b40398583a382d3fa2ec81f689df11`가 각각
  manifest 예상 설치본 hash와 검증한 worker에 일치했다.
- `postinstall-receipt.json`: 기존 286 files missing 0 / changed 0. 기존 그룹·사례 불변.
  새 앱 스캔과 D08 수용은 다음 단계다.

### 새 설치본 NIA 단일 점검 (OBSERVED_CUA_OPERATOR)

- 제한 5페이지·깊이1·90초, 기본 연결. UI 점검 완료, 5 checked / 0 failed / findings 0, 경과 00:14.
- 새 case `daaa2955-58dc-494a-a6ef-8185c551a5a6`, entry finalUrl `/site/nia_kor/main.do`, status200·checked.
- 근거: `resumed-windows/0056` 설정, `0061` 결과 screenshot, `nia-installed-receipt.json`.
- 실행 중 사례 저장소의 0-byte `cases/.store.lock`은 배타 잠금되어 원시 hash 읽기가 EBUSY였다.
  검사 스크립트는 그 정확한 lock만 locked로 기록하며 나머지 기존 파일은 missing0/changed0.
  앱 종료 후에는 lock까지 다시 대조한다. 제품 검증기나 잠금을 바꾸지 않았다.

### D08 재시작·통합 XLSX와 추가 복원 결함 (재개 15:15 KST)

- 70a599fb 후보에서 공개 두 대상 저장 2/2, 정상 종료·새 프로세스 재시작 뒤
  그룹 `38c182c0-23a9-4bac-a9e2-f552823bf3db` 복원 2/2.
  NIA complete와 정부24 blocked 및 각각의 caseId가 보존됐다.
- 재시작 전후 XLSX 7개 시트의 모든 셀 값 동일. 대상 요약 NIA checked1/failed0,
  정부24 checked0/failed1. ZIP 오류 없음. `restart-workbook-comparison.json` 근거.
- 추가 결함: 복원 카드의 확인 시도/실패 카운터는 0으로 표시됐다(0100/0102).
  `SessionRegistry::open_case`가 저장 evidence의 범위를 progress에 복원하지 않았다.
  보고서와 저장 자료는 정상이며 카드 표시 경로 결함이다. 신규 persistent roundtrip
  시험은 visitedPages expected2/actual0으로 실패해 재현했다.
- 저장 evidence를 canonical 복원 경로에서 사용하도록 수정·검증 중이다. 70a599fb 후보는
  이 표시 결함이 있는 중간 후보로 보존하며 전체 E2E 최종 통과로 표기하지 않는다.

### 복원 카운터 수정 검증·새 후보 압축 중

- `dd5ceb4` 독립 커밋. `open_case`가 검증된 evidence의 checkedPages와 failedPages를
  복원해 전체 확인 시도 수와 실패 수를 만든다. absent/corrupt evidence는 기존 0 기본값을
  유지하며 검증기를 변경하지 않았다. 공식 결과와 검토 저장 계약은 유지한다.
- 호스트 Rust 82 passed/0 failed/2 ignored; fmt, Windows gnullvm clippy/check all-targets EXIT0.
  fixture의 pageOutcomes 누락·공식 canonical formatting 비교 오류는 수정했고 실패 로그를 보존했다.
- 새 제품 소스 hash `8628ba4a4488d9b3c6bf9a3080151784b1376aa7ced929f6cce545eb7b64b97c`.
  JS/TS·worker는 770/1 전체 검사와 동일하며 네이티브 복원만 추가 검증했다.
- 실제 Excel에서 재시작 후 XLSX 열기와 7시트·대상 요약을 확인(0116/0118). 복구 경고 없음.
  70a599fb에서 만든 파일의 증거이며 새 후보 수용과 구분한다.

###8628ba4a 새 후보 제작·무결성 검증 (OBSERVED)

- 제품 commit dd5ceb414e941ea8deef448899d1042e8d49a010, source hash8628ba4a4488d9b3c6bf9a3080151784b1376aa7ced929f6cce545eb7b64b97c.
- buildId0.2.1-x86_64-pc-windows-gnullvm-8628ba4a4488-20261023T061726351Z.
- build:desktop·package:windows·verify:artifact EXIT0.8파일·runtime1177파일 검증.
- installer746,947,332B(712.34MiB), SHA33ce86950fe11ef2dc2e210c60e6604797c2a2ffb4c8e222f4c28a0015b36d56.
- standalone20358144B, SHAada6d48d1d271a7e119f3292454b3f92c57bca617aca41833d69496d916b7c7b.
  expected installed EXEf1466e88aefe985075faa3c9fb2f6227c251011893ad543726369fc497d90e2c, markerOffset13535570.
- Source dirty=true는 문서9개뿐이며 제품 코드 변경은 모두 독립 커밋에 보존했다.
  Windows 전송·설치 수용 중이다. 현 후보도 최종 E2E 전체 통과로 표기하지 않는다.

###8628ba4a Windows 재설치·보존 확인 (OBSERVED_CUA_OPERATOR)

- 전송746947332B·installer SHA33ce8695…36d56 원본과 일치.
-0164 Cua: Installation Complete / Setup was completed successfully.
  Run옵션 해제 후 정상 Finish,0170에서 설치창 소멸2회 관측.
- installed-final-receipt: buildId8628ba4a, installed EXEf1466e88…90e2c, worker5a2e1c6f…9df11 일치.
- 기존40사례338파일 missing0/changed0/locked0. 양성 신규 메모를 포함한 prefinal backup과 동일.
- 새 앱 실행·복원·새 batch·실제 재시작 검증은 다음 단계다.

###8628ba4a 실제 복원 카운터 확인

-0178/0180 Cua 새 설치 앱 PID14196에서 기존38c182c0그룹2/2복원.
- NIA 확인시도1/실패0, gov 확인시도1/실패1을 실제화면과 UIA에서 확인했다.
  두 대상case연결과 complete/blocked도 유지된다. dd5ceb4수정이 설치본에서 관측됐다.
- 같은 공개2대상 CSV를 다시 선택, entry범위1page/depth0/60s·기본 연결로 신규 batch 실행 중.

###8628ba4a 신규 공개2대상·실제 재시작 (OBSERVED_CUA_OPERATOR)

- group c92ac68e-e7f7-497f-bdeb-378cf5ac3a84, phase complete.
  NIA case5661f10f-40af-4ba0-a2c8-df2a04c3e62a complete,1checked/0failed/0findings.
  gov case58d39d56-29c9-49d7-baa4-9354f7d4cacd blocked,0checked/1failed/0findings,plus.gov.kr external-redirect.
-0191설정·0194완료,0201 XLSX저장,0204정상창종료(1124ms/2samples),
  새 PID28640에서0210묶음목록·0212/0214복원2/2와정확한카운터.
- batch-final-restart-comparison.json: 두 caseId·terminal상태 동일, 공식 resultSHA 두개동일.
- 최초338파일 보존검사는 복원한 기존38그룹의 updatedAt변경1개를 잡았다.
  저장소의 실제 baseline backup과 대조해 그 필드만 변경됨을 확인했다.
  검사는 그 정확한 한 파일의 updatedAt-only(다른필드동일,유효증가시각)만예상변경으로
  기록하며 나머지 변경/삭제는 계속실패한다. 제품검증기·저장소를바꾸지 않았다.
  그 strict실패로그도 보존. batch-final-closed에서 lock까지읽기완료, missing0,
  예상metadata갱신1,unexpectedChanges0. 원본·검토·case내용은불변.

### 최종 후보 NIA·양성 검토 복원

- NIA5페이지·깊이1·90초 직접설정(0246/0248),0252결과5checked/0failed/0findings·18.414초.
  case324adbc4-c8ba-4807-9991-590670d5d12c, entry200checked final/site/nia_kor/main.do.
- 최종D08 전후 XLSX7시트 모든셀 동일·수식0·ZIP정상. 대상 요약과 페이지 범위의
  caseId·확인/실패수·최종URL·external-redirect도 저장case와 대조했다.
 0230실제Excel 대상요약 오른쪽열 확인,0250Excel창0으로정상닫기.
- 새설치본에서 소유양성83af74d3를 검색·다시열기,0263 screenshot에17탐지·15checked·0failed와
  f13메모원문·광고의심·검토완료 복원. positive-final-receipt의review revision3와
  officialSHAee73ffa0…f0bd가 설치전과 동일하다. 새원본작성·외부재점검 없이 복원했다.

- 새후보에서 양성 재시작후 XLSX도 내보냈다.16,508B, SHA751098a4bdfdf78d2033841c80d440f38afc49f52a16dc512122886a2eaa75e6.
 6시트·탐지상세18행(머리글포함)·점검범위16행·검토기록2행. 검토행에f13/검토완료/
  메모원문/위반의심이 포함되고 수식0·ZIP정상.positive-final-workbook-inspection.json근거.

- 양성 공식JSON도 최종설치본에서 SaveAs로저장했다.4,586B/BOM없음/17findings,
  SHAee73ffa07ac758efff7dfd6bceb7e6f0a4c2b1a2e945c8105b47019ed554f0bd,
  설치전보관result.json과byte-identical.0285/0291 UI 저장완료경로 확인.
-0287~0289실제Excel 양성보고서의검토기록시트에서f13/검토완료/메모를확인했다.
  대상2건D08에양성검토가포함된것은아니며단일보충증거로구분한다.

### 재개 최종 확인·인계 범위 (2026-10-23 16시대)

- final-closed-receipt와preinstall/prefinal baseline을대조: 최초286파일전부byte-identical.
  prefinal338파일기준337불변·기존38그룹updatedAt-only갱신1,missing0/unexpectedChanges0/locked0.
  양성reviewrevision3·공식SHA불변,새공개3case의로컬복사resultSHA와build.sourceSHA검증.
- 최종공개두대상XLSX전후7시트모든셀동일,두공식원본SHA동일,실제Excel대상요약확인.
  NIA단일5checked/0failed/18.414초,양성단일검토복원·공식JSON byte동일·XLSX검토기록확인.
- owned-cleanup.log: detector0,Excel0,설치binaries하위worker0,listener0.
  실제TCP소유PID20400의exacttaskserver명령·127.0.0.1:18777을확인후그프로세스만종료.
  인계PID14340을추정으로사용하지않았고Cua/WARP/다른앱·권한은바꾸지않았다.
- 제출/인계문서9개를현재후보·실행증거·한계로정리했다. 제품변경없이문서커밋을별도보존한다.
  sourceIdentity재확인과artifact verify후NAS/HDD0전체사본manifest와읽기대조를실행한다.
  candidate9파일의두사본은이미크기·SHA일치했다. 전체사본최종영수증은각전달루트의
  DELIVERY_MANIFEST.json/DELIVERY_VERIFICATION.json을따른다.
- 허용범위는로컬수정/커밋,후보제작,지정Windows시험,승인NAS/HDD0인계다.
  push/PR/공개배포/실제공모전제출은없다.
- 남은수용: 공개두대상판단·메모D08는양성0건으로NOT_RUN,소유단일양성으로합산하지않음.
  gov는external-redirect로blocked이며미점검이다. MSVC현재제품·CI/Windows이미지실사이트
  재현율/WebView2부재offline/사람·AT/목표8GB환경/기기간그룹이식도미실행이다.
  원래재현된3결함의수정·관측은완료했지만전체E2E나실제제출완료로확장하지않는다.

### 공개 양성 두 대상 후속 실행과 정상 충전기 오탐 수정 (2026-10-23)

- 시작b186651/clean/stash없음을확인했다. 기존43사례369파일을백업·대조했다.
- 기존8628설치본의새배치39158f46: blacktoon425공식1/이미지5,
  별도blacktoonurls/address-collection공식0/이미지14. 각1checked/0failed.
  group/case/coverage원문은d08-positive-20261023/batch-complete-receipt.json이다.
- 두번째x5의원본이미지SHAa6ee86aa5cda87ed7154bc244dfa28f36f7654f94a2d89915c749c29863c1dda는
  정상100W/GaN충전기다. 목적지는mkt.shopping.naver.com, OCRconfidence.96777,
  text-embedding-v3 margin+.003644로v4review오탐. 원본case·charger-diagnostic2.log보존.
- 2e43ec9는충전기+실제사양문맥을보조의미/이미지승격에서제외하되베팅/정산어를보호한다.
  정확OCR·목적지·임베딩수치회귀와양성보존관련97pass. 검증기는완화하지않았다.
- 전체check최초778pass/1fail/1skip: 이미지복원후focus effect직전assertion race를확인했다.
  포커스요구는유지하고waitFor로기다리게수정. check-final-verified.log는
  typecheck/lint+779pass/1skip,225.32초/EXIT0. 최초실패로그도보존했다.
- 새설치전45사례410파일백업완료. 새제품source98fd0102후보빌드/재설치/최종D08는진행중.
  소유단일양성이나이전탐지0배치와합산해양성D08완료로처리하지않는다.

### 제출 우선 전환과 새 후보 확정

- 새후보98fd/source2e43의builddesktop/package/verifyartifactEXIT0. 설치파일746959183B,
  SHA fbaa7b6f8e957a6ecd46e4549e54863ebc23fb68ff8fb8b7d7a0296772808d23.
- 새workerWindows원인대조: 동일충전기imageSHAa6ee86aa…를실수집한상태로14->13,
  제거위치#img_comp-mrxpkrp0만/추가0. prefilter-causal-comparison.json 근거.
- 공식0/extra13은isCaseReview의공식ID계약상영구검토대상이아님을소스로확인했다.
  두번째공식양성이필요하며이쌍을판단/메모D08완료로쓰지않는다.
- 앱정상종료확인후Pocket4오프라인/SSH+Cua단절. 사용자가현재복구불가를확인하고
  제출준비우선,GitHubpublic전환과단일ZIP을명시적으로요청했다. 최신설치본수용미완료.
- 제출앞문서는제품기능과수행한실험의환경/버전/수치만정확히제시하며내부작업회고는제외.
  이원장과원시증거의미완료기록을유지하고검증완료를허위로확장하지않는다.

## 2026-10-23 제출 후 main 정리와 저장·복원 수정

사용자는 제출 완료 후 남은 결함 수정, Windows 복구 후 실제 설치본 D08,
GitHub main 정리·보호와 후속 독립 브랜치 작업을 요청했다. 시작은
`dev/bootstrap@d47299e`, clean/stash 없음이다. `main@a866bd4`는 403커밋 뒤였고
보호가 없었다. `codex/post-submission-d08`에서 수정·검증하며 기존 PR #2로
초기 main 통합을 준비한다. 제출 태그와 ZIP은 유지한다.

OBSERVED: main branch protection API 읽기 대조로 PR 필수, GitHub Actions app15368의
`required` 성공·최신 base·대화 해결 필수, 관리자 적용, force push/삭제 금지를
확인했다. 사람 승인 인원은 0이다. GitHub run39926440891은 세 job 모두 성공:
Linux779pass/1skip, Windows MSVC80pass/2ignored, fmt/clippy,
packaged worker 공식1탐지·요청2건, release desktop build를 실행했다.
로컬82와 Windows80은 플랫폼별 시험 구성이 다른 실제 관측값이다.

OBSERVED: 묶음 running 상태에 이미 저장된 caseId가 있으면 복원 때 pending으로
되돌아가는 실패를 재현했다. 실제 coordinator는 저장 결과 수신을 publish한 뒤
coverage 조회를 기다리므로 이 중간 상태가 디스크에 남을 수 있다. 복원은 같은
batchResultStatus 판별을 사용해 완료/부분/차단/실패/취소를 유지하고, 미저장 대상만
재개한다. 기존 공식 결과·판단의 JSON이 변하지 않고 미완료 둘째 대상만 시작하는
회귀 및 상태별 시험을 추가했다.

OBSERVED: PR #2의 미해결 지적 중 삭제·같은 ID 가져오기 후 검토 캐시가 오래된
레코드를 반환하는 실패를 재현했다. 다시 열 때 캐시를 디스크에서 갱신하고 진행 중
저장을 기다린다. 읽는 동안 loaded=false로 새 revision 확인 전 저장을 막으며,
수정한 로컬 메모는 조회 결과와 병합한다. App에서 저장 목록/묶음 화면을 떠나 다시
검토 화면으로 들어올 때 load가 실행되도록 활성 조건을 연결했다. 실제 React 화면의
재열기에서도 옛 메모가 남는 실패를 확인한 뒤 수정했다. 별도 Windows 수용은 아니다.

기존 PR의 오래된 지적은 현재 구현·실행 근거를 직접 대조했다.

| 검토 주제 | 현재 근거 |
| --- | --- |
| worker/runtime 묶음 | tauri.conf resources, scripts/desktop.mjs, CI resources·packaged smoke·MSVC build |
| entry URL·limits 전달 | main.rs start_scan → --entry-url/max-pages/max-depth/timeout-sec, worker args 시험 |
| 결과 수신·종료 | session.rs collect_output/commit, main.rs finished emit, native 시험·packaged smoke |
| 자식 Job Object | session.rs spawn_sidecar의 JobGuard::assign_pid(child PID), Windows native 시험 |
| 탐지 deadline | worker.ts/scan.ts 공유 ScanDeadline, deadline-scan·cancelled-scan·single-pass 시험 |
| ID 없는 요소 | pipeline.ts extractTextOwners와 selector engine, general-text·selector-generation 시험 |
| private network 차단 | PublicNetworkPolicy/강제 proxy, public-network·manual-network·pinned-transport 시험 |
| 양수 화면 좌표 제안 | viewport 밖이라는 이유만으로 OFFSCREEN 처리하는 제안은 채택하지 않음. policy2는 스크롤 가능한 본문을 은닉으로 보지 않으며 rendering-observation의 below 대조가 이를 보호함. 실제 clip/negative/unrendered 조건과 구분 |
| watchdog 유예 | session.rs sidecar_watchdog_sec의 worker deadline + hostGraceSec, hardLimitSec 상한과 native 시험 |
| 외부 최종 문서 | crawl.ts requireSameSiteDocument, redirect-scope·redirect-domready 시험 |
| query 충돌 | urls.ts URLSearchParams 직렬화와 urls·redirect-scope 시험 |
| URL 자격 정보 | main.rs url_like_valid에서 세션/argv 전 거부, native URL 시험 |
| 삭제/가져오기 후 캐시 | 이번 CaseReviewWriter + App 수정과 class/React 회귀 시험 |

NOT_RUN: Pocket4는 SSH 연결 시간 초과로 현재 사용할 수 없다. 새 수정 포함
설치본의 공식 양성 두 공개 대상 판단·메모·정상 재시작·통합 XLSX·Excel 검증은
Windows 복구 후 수행한다. 기준45사례410파일 및 공식 결과 해시를 보존한다.
원시 검증: `artifacts/post-submission-20261023/`.

OBSERVED: 제품 커밋 `0ee497f`(묶음 복원), `7e6f87a`(검토 재열기).
최종 `PATH=/usr/bin:$PATH KRDS_TEST_UNSANDBOXED=1 npm run check` EXIT0,
99파일 통과/1파일 skip, 789pass/1skip, 224.56초. 수정 전 두 재현과 화면 재현 실패를
각각 보존했고 최종 관련6파일51시험이 통과했다. 추가 sandbox 예외·검증기 완화·시험
skip은 없다. 제출 릴리스의 ZIP 두 개는 공개 API size/digest 재조회로 기존 해시와
일치했다. source/test 변경 검토 후 기존 PR #2의 초기 main 통합에 반영한다.

### 추가 P1 검토 반영

PR #2의 후속 자동 검토에서 두 결함이 확인됐다. rotating DOM에서 분석할 때의
광고 원문과 렌더링 관측 때 바뀐 정상 문구가 섞이는 실패를 실제 Chromium으로
재현했다. `673553a`는 관측 원문이 분석 snapshot과 다른 후보를 공식·추가 분석에서
제외한다. 이전 광고 분석을 새 문구의 근거로 내보내지 않으며 재분석/재방문은 없다.
단일 evaluate 합성 실험은 반환값을 얻지 못해 시험 실패 후 폐기했고, 최종 수정은
원문 동일성 검사다. 중간 실패 로그도 보존한다.

배치의 `timeoutSec + 45초`가 native의 `timeoutSec + hostGraceSec(150초)`보다 먼저
실행을 취소하는 실패도 가상 시계로 재현했다. 후속 batch 수정은 동일 SCAN_POLICY의
defaults/hostGraceSec/hardLimitSec를 사용하며, finalization 중에는 다음 대상을
시작하지 않고 terminal 결과를 받은 뒤 이어간다. 네트워크 경계·호스트 상한은 유지한다.

OBSERVED: 관련6파일38시험 통과, 최종 typecheck/lint EXIT0.
직전3211e43의 전체789pass는 앞선 수정의 checkpoint이며 추가2수정의 전체 검증은
후속 HEAD의 GitHub 필수 CI로 확인한다. 3211e43의 새 패키징은 추가 결함을 반영하기
위해 소유한 process group만 TERM으로 중단(EXIT143)했으며 후보로 채택하지 않았다.
제출 설치본과 릴리스 자산은 그대로 보존한다.

### 최종 CI·main 통합·Windows 재개 후보

OBSERVED: 최종 HEAD `59933580b4fc27fd5e6fc3ec50b7b1c3326dcc35`, source SHA
`d42ae4ab1879aa26da24f4c6402344d9d19b0c262727706d31eedad801d3176f`의
GitHub run39931222789 verify/windows-native/required 모두 성공.
Linux791pass/1skip, Windows MSVC80pass/2ignored, fmt/clippy,
production sandbox packaged worker 공식1탐지·요청2건, desktop release build 성공이다.
미해결 리뷰0·MERGEABLE/CLEAN과 정확한 HEAD를 확인하고 보호 규칙을 유지한 채
PR #2를 merge했다. main `3e20d5830c2447b53c7873c06595364f5aa61a14`는 검증 HEAD와
동일한 tree다. 후속 브랜치도 main으로 fast-forward하고 이후 기록·검증을 이어간다.

OBSERVED: 같은 clean source290파일에서 gnullvm 새 후보 제작·verify:artifact EXIT0,
runtime1177파일/8payload+manifest 검증. 후보 폴더는
`candidate-0.2.1-x86_64-pc-windows-gnullvm-d42ae4ab1879-20261023T092151358Z`다.
installer747,014,364B, SHA37181bd5eefd9d3620676e402c6f5d01575310b43dae9033a994722f6857fb24.
NAS/HDD0의 `illegal-ad-maintenance-20261023/`에 후보9파일770,467,147B를 복사해
누락0/해시불일치0을 확인했다. 원시 CI·패키징·검증·사본 receipt는
`artifacts/post-submission-20261023/`에 보존한다. main push의 별도 CI 재실행과
검증 PR의 통과를 구분하며, tree 동일성 때문에 같은 검사를 수동 반복하지 않는다.

NOT_RUN: Pocket4 재확인도 SSH timeout이다. 이 후보의 실제 설치 및 공식 양성 두
공개 대상 판단·메모·정상 재시작 복원·통합 XLSX·실제 Excel은 기기 복구 후 수행한다.
제출 태그·두 ZIP·과거 사례 및 설치 후보는 보존한다.

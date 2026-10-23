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

이 절은 2026-10-23 제출 기준의 최종 상태다. 앞의 `### 재빌드 (85a286f)` 후보
(`76e7d5ec…`)는 이 절의 `307f6b6f…` 후보로 **대체(superseded)**되었고, `artifacts/`
에 삭제하지 않고 보존했다.

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

### 최종 후보 (OBSERVED_CROSS_BUILD)

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

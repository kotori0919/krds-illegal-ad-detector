# 도입 구현 원장

검토 기준은 `d14b8feadf60a174d3d74ad47e49ba13072c84c7`이다. 설치 검증한 네이티브 후보 소스는
`50941bd99f9d09d1b7abec93417a94d659c5dcb2`, 브랜치는 `dev/bootstrap`, PR #2는 Draft다.
감사 재현 자료를 회귀 입력으로 사용했으며 기준 소스로 현재 checkout을 덮어쓰지 않았다.
과거 RC와 중간 GNU/MSVC 후보를 보존한다. 현재 앱은 `0.2.1`, 공식 tool version은
`0.2.1-policy2`다. 공식 contract v0, Case 1, detail 2, config 1, policy 2를 구분한다.
정확한 후보와 운영 수용 판정은 [채택 인계](ADOPTION_HANDOFF_KO.md)가 기준이다.
후속 UI `2a8356d`와 683px 수정 `8b68248`의 화면 검증을 위 설치 후보와 구분한다.
최종 UI 후보 build ID는 `0.2.1-x86_64-pc-windows-msvc-7ae9f6144bf9-20261009T173735184Z`이며 receiving에서
한 번 빌드하고 Windows·로컬 artifact verify를 통과했다. 설치 과업·실제 사람/AT와
사용자 UI/UX 수용은 아직 완료 판정하지 않는다. 운영 코드 이후 변경은 테스트·문서다.

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
| A10 | OBSERVED_INSTALLED_MSVC; FOLLOWUP_UI_REPLAY | `082b552`, `2a9d98f`; 후속 UI 변경 별도 | 식별 MSVC 일반 사용자 scan→판단/메모/reading→정상 종료→새 실행/재열기→실제 JSON/XLSX Save As, 재크롤 없음·원본 bytes 동일. 후속 실제 React/Tauri adapter 617개 기록 replay에서 결과 초점·목록 jump·필터·메모와 실제 XLSX 617행 확인. native Save As replay와 실제 chooser를 구분; 후속 UI 바이너리 수용 미실행 |
| A11 | OBSERVED_CONTROLLED_AND_MSVC_UI; FOLLOWUP_UI_REPLAY | `082b552`, `2a9d98f`; 후속 UI 변경 별도 | bounded graph·공유 inspector의 기존 MSVC keyboard 관찰. 후속 화면은 desktop 요약 rail/검토 목록, setup grouping, 상단 sticky 뒤로/검토, 320px 원문 폭 300px·200% CSS zoom·키보드 복귀 확인. 실제 사람/AT와 후속 native 화면은 미실행 |
| A12 | OBSERVED_BOUNDED_HOLDOUT | `082b552` | 합성 6 template, 네 기법 각 TP1/FP0/FN0, 정상 2 FP0, locator 8/8, C1/C3 동등. 공개 웹 일반화·독립 TP21·확률 calibration 근거 아님 |
| A13 | OBSERVED_RECEIVING_BUILD_AND_UPGRADE; ROLLBACK_STOPPED_NOT_COMPLETED | `082b552`, `70f3033`, `d94ff28`, `c4bb952`, `559e35a`, `703b473`, `50941bd` | Windows clean source 509의 15단계 exit 0, MSVC/NSIS 후보·SDK/compiler/resource 해시. upgrade 종료 0·34 data파일/hash·workbook 보존. 전체 rollback은 사용자 방향 전환으로 중단. 최종 MSVC 복원 후 persistent 33파일·GNU workbook hash 동일, 앱 실행 중 volatile cases/.store.lock 제외. CI run 37959883958의 verify/windows-native/required 모두 SUCCESS |
| A14 | OBSERVED | `082b552`, `5fb0adc` | 실제 Retry-After/retryAt, 취소·deadline 회귀. 120초 요청을 5초 재요청으로 축소하지 않음; Chromium disposal 지연 무한 대기 제거 |

## 마일스톤과 검증 범위

| 단계 | 산출물·관찰 | 남은 수용 범위 |
| --- | --- | --- |
| M0 | `f81f133` checkout·원격·감사 재현, [ADR 0015](ADR/0015-durable-adoption-boundaries.md) | 없음 |
| M1 | policy 2 text/rendering/location, production 격리, 명시 네트워크 정책, deadline/retry | 공개 웹 일반화는 주장하지 않음 |
| M2 | 공식 원본 우선 저장, 공유 자산, Case/review 전달·재열기·손상 격리, 최종 MSVC 저장/재열기/export | 미실행 외부 수용과 구분 |
| M3 | bounded visual/graph·공유 근거 동선, 후속 desktop 요약 rail/검토 목록·setup grouping·sticky inspector와 좁은 화면 실제 React 검증 | 후속 UI 네이티브 후보·실제 사람·AT 수용 별도 |
| M4 | typed 확장, 공통 policy/TS-native corpus, clean Windows MSVC build, 관리 배포/진단 | 조직 서명·offline provisioning·라이선스 결정 별도 |
| M5 | 분리 holdout, 식별 MSVC 후보, receiving build 증거와 한국어 인계, 후속 UI 화면 관찰·새 UI 후보 단회 빌드 | **완료 미판정**. 사용자 UI/UX 확인·새 후보 설치 과업·미실행 외부 수용을 남김. 전체 rollback은 중단 상태로 기록 |

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
외부 요청 0·errors 0. Save As만 replay이며 후속 UI native Windows 시험은 NOT_RUN이다.
별도 실제 BrowserHost preview는 Tauri IPC 없이 임시 preview로 표시하고 잘못된 영구
저장 장애를 만들지 않았으며 외부 요청이 없었다. 사용자 사용성/AT 수용을 대신하지 않는다.

전체 rollback은 사용자 방향 전환 시 **NOT_COMPLETED**로 중단됐다. 이후 최종 MSVC 0.2.1을
복원했으며 `preservation-restored-021.json`에 build ID
`0.2.1-x86_64-pc-windows-msvc-a56389284dba-20261009T163714286Z`, 실제 설치 EXE SHA-256
`3bceb64e5dcd64925cc3eca398b9145bfcf5c39ea869cfb1e88a34d941396a4f`, persistent 33파일과
GNU workbook hash 보존을 기록했다. 앱 실행 중의 `cases/.store.lock`은 제외했다.
이 안전 복원은 rollback/일반 제거의 전체 수용 완료가 아니다.

mock/replay, GNU 설치, MSVC source build, 최종 MSVC 설치를 구분한다. 현재 후보는
서명 없는 내부 평가용이며 [채택 인계](ADOPTION_HANDOFF_KO.md)의 미실행 행을 성공으로
읽어서는 안 된다. 공식 원본과 선택 기능 장애 격리·공개망·취소·deadline은 구현 회귀와
설치본 과업 증거를 함께 확인한다.

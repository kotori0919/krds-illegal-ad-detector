# 채택 후보와 수신팀 인계

`dev/bootstrap`, Draft PR #2의 구현·현재 후보와 실행 증거를 연결한다. 검토 기준은
`d14b8feadf60a174d3d74ad47e49ba13072c84c7`이다. 설치 경계 관측은509, 공개 두 대상의
실제 점검은3c, 새 보고서의 native 저장은359, 마지막 화면 재열기는565 소스다.
각 관측을 다른 후보의 설치 수용으로 전용하지 않는다. 반복 설치 대신 변경된 경계를
실제 Rust/Tauri 빌드·production web·직접 native 실행으로 검증했다.
현재 판정은 **서명 없는 내부 평가 후보, 운영 채택 조건부**다.
미실행 행이 남아 있으므로 M5 전체 운영 수용, NIA 인증, 법적 위반 확정 또는 공개
배포 가능 판정으로 읽어서는 안 된다. [역사 RC](RELEASE_CANDIDATE.md)와 모든 중간
GNU/MSVC 후보·기존 전달 ZIP은 보존한다.

## 현재 전달 후보 — 공개 범위·보고 제한·화면 간격 수정 포함

앱 `0.2.1`, 공식 tool `0.2.1-policy2`, 공식/Case/detail/config/policy는 `v0/1/2/1/2`다.
UI·보고서·빌드 경로 변경은 탐지 정책이나 보관 공식 원본을 바꾸지 않는다.

| 항목 | 식별자 |
| --- | --- |
| source commit | `565d9f6e49f857c6a0a9aaf2ab3b829452584e1e` |
| build ID | `0.2.1-x86_64-pc-windows-msvc-d33dc9f7c097-20261009T185838006Z` |
| source SHA-256 | `d33dc9f7c0976e065633234104c5ff39c7907e2d01f3802d43da41506ea5afa0` |
| installer | `불법광고 탐지 도구_0.2.1_x64-setup.exe` |
| installer 크기 / SHA-256 | `149813810` bytes / `cb4140382b0496763ac8c728ea400b5618ba2c3804b2f883e942395fb2d59456` |
| standalone EXE SHA-256 | `99b44dd44b4e4221c4778e8b2de9a489ed756a728cb987529eece5025136667d` |
| 설치 EXE 유도 SHA-256 | `7b6fc529fc679974aca2a603dd7de616ba89947fea64945e5c71fc9cc467fbba` — 실제 설치 확인값 아님 |
| manifest SHA-256 | `dc216c083f2e7d803f49357c86af1c811406cadfd75d42cf80a68859a00fa69d` |

폴더는 `artifacts/candidate-0.2.1-x86_64-pc-windows-msvc-d33dc9f7c097-20261009T185838006Z/`다.
OBSERVED: clean receiving checkout에서 canonical `package:windows` 한 번,
315.93초(같은 VM의 단일 관측), Windows·로컬 artifact verify exit0.
contracts→evidence→web→worker→Rust/Tauri→NSIS 순서이며 manual prebuild·도구 설치·
installer 실행·역사 native harness 반복은 없다. 보고서 dist가 없는 실제 root build도
통과했다. `ui-candidate-565d9f6-report.json`과 단계 로그가 근거다.

최종 직접 실행 EXE와 후보 standalone의 해시·인접 리소스가 일치했다. 실제565 native
화면에서3c 공개 케이스를 재열어 수집·보관 제한 안내와 카드·본문 간격을 확인했다.
새 공개 스캔이나 설치는 하지 않았다. 기존48 persistent 파일과 공개 케이스19파일의
해시가 그대로였다. Case 설정의 source는 원래3c이며 새 앱 source로 다시 쓰지 않았다.
보고서 변경은 앞선359 직접 빌드의 실제 native Save As(14,055bytes)와8열 확인으로
검증했고,565의 CSS 보정 때문에 저장을 반복하지 않았다.

[공개 두 대상 결과·제한·후속 수정](PUBLIC_BATCH_OBSERVED_KO.md)과
`public-batch-20261010/{native-observed,native-359-reopen-observed,native-reopen-observed}.json`이
실제 스캔·보고서 저장·최종 재열기의 독립 증거다. 원본 HTML 사본 일부 생략과
공식 탐지0건을 전체 내용 정상·적법 판정으로 해석하지 않는다.
최신 installer 실행·전체 rollback·사람/AT·기관 운영 수용은 미실행 또는 미완료다.

## 이전 UI 후보 — 683px 수정 포함, 보존

앱 `0.2.1`, 공식 tool `0.2.1-policy2`, 공식/Case/detail/config/policy는 `v0/1/2/1/2`다.
UI 수정으로 탐지 정책이나 저장된 공식 원본을 바꾸지 않았다.

| 항목 | 식별자 |
| --- | --- |
| source commit | `8b68248240c050df1b9257b6a3f9f939a029e46b` |
| build ID | `0.2.1-x86_64-pc-windows-msvc-7ae9f6144bf9-20261009T173735184Z` |
| source SHA-256 | `7ae9f6144bf9c939c5f58a71a3172857b6f58dd37b2bd07ddff9b89451473079` |
| installer | `불법광고 탐지 도구_0.2.1_x64-setup.exe` |
| installer 크기 / SHA-256 | `149714831` bytes / `e6c4ed74e696fd2d2ccae51f4c2310d68da15ccf4efa4795322df3ea498b58ba` |
| standalone EXE SHA-256 | `4ab1e45167cd1a18066192e0b9c26dc97c600df9b96ef3100431752e63705e5a` |
| 설치 EXE 유도 SHA-256 | `b271fedff7ff73913e84ac765258bd37eca6c9e1d2bb25c15f4d1ed515c8e842` — 실제 설치 확인값 아님 |
| manifest SHA-256 | `5bdb174330c5e95f037b771e0cce8d934dc97eee2ebf759c3db79f9fa0c7867f` |

폴더는 `artifacts/candidate-0.2.1-x86_64-pc-windows-msvc-7ae9f6144bf9-20261009T173735184Z/`다.
중간 2a 후보에서 추가 발견한 683px 제목 reflow를 수정한 뒤 receiving의 clean git
checkout을 fast-forward했다. 변경된 웹 bytes를 내장하기 위해 package를 한 번 실행했다.
OBSERVED: Rust/Tauri·웹·NSIS package exit 0, 332.41초(단일 VM 관측), Windows·로컬
artifact verify exit 0. 기존 receiving cache를 재사용했고 도구 설치·doctor·native harness·
앱 설치/제거를 반복하지 않았다. 이전 후보 manifest 해시는 모두 유지됐다.
`ui-candidate-8b68248-report.json`과 단계 로그가 근거다. 정확한 빌드 소스 archive와
후속 인계 문서의 유지보수 source archive를 전달 ZIP에서 별도로 식별한다.

## 중간 UI 빌드 — 2a, 보존

| 항목 | 식별자 |
| --- | --- |
| source commit | `2a8356d00bea1334b37c0684225843ba97f94db9` |
| build ID | `0.2.1-x86_64-pc-windows-msvc-4981e396550a-20261009T172224777Z` |
| source SHA-256 | `4981e396550aa59ddfea3c7d5cb526fa21073812ed10367e1098bdb5cab81e96` |
| installer | `불법광고 탐지 도구_0.2.1_x64-setup.exe` |
| installer 크기 / SHA-256 | `149819659` bytes / `224f918d09c1e54699febc36cad5fdcc700b1d9db8b28d6977c3c72f14d74fda` |
| standalone EXE SHA-256 | `ddb5baf411bbb1e3f4bdb0eef4682616b13ef53e2a6a8fbb5ada1a086820c197` |
| 설치 EXE 유도 SHA-256 | `b06775b4b448c5c48e8abdbc6d420b1c15f4fed5379aceb484977eb4833b4661` — 실제 설치 확인값 아님 |
| manifest SHA-256 | `0bbe43772f8f92e8993b008629f08ad04301e849ed403c022d2cd36635355499` |

폴더는 `artifacts/candidate-0.2.1-x86_64-pc-windows-msvc-4981e396550a-20261009T172224777Z/`다.
같은 receiving checkout을 clean fast-forward한 뒤 doctor와 `npm run package:windows`를
각각 한 번 실행했다. 새 dependency/toolchain 설치·앱 설치·제거·native harness 반복은
없었다. OBSERVED: doctor/package/Windows artifact verify/로컬 사본 verify 모두 exit 0,
package 326.13초(단일 VM 관측). Rust/Tauri·웹을 실제 컴파일하고 NSIS 후보를 생성했다.
이전 두 MSVC 후보 manifest의 동일 해시와 receiving git clean을 확인했다.
`ui-candidate-2a8356d-report.json`과 단계 로그가 근거다. 테스트·문서 후속 변경은 이
후보의 운영 입력을 바꾸지 않으며 source commit과 유지보수 문서 commit을 구분한다.

SBOM/notices/resource/build manifest는 각 후보 폴더 안에서 함께 제공한다.
source archive의 ZIP 해시는 위 source tree digest와 다른 값이며 서로 대체하지 않는다.

## 직전 네이티브 관측 후보 — 509

수신팀 주 경로는 Windows x64 MSVC다. GNU LLVM 0.2.0 중간 후보 실행 증거를
최종 MSVC 설치 증거로 전용하지 않는다.

| 항목 | 식별자 |
| --- | --- |
| 앱 / 공식 tool version | `0.2.1` / `0.2.1-policy2` |
| 공식 / Case / detail / config / policy | `v0` / `1` / `2` / `1` / `2` |
| build ID | `0.2.1-x86_64-pc-windows-msvc-a56389284dba-20261009T163714286Z` |
| source SHA-256 | `a56389284dba65bfa1d5f8bd4c373552fc8edb35e32d352905eb4381394da6f2` |
| installer | `불법광고 탐지 도구_0.2.1_x64-setup.exe` |
| installer 크기 | `149761106` bytes |
| installer SHA-256 | `4c9ad327028c338d92bb097d67f2647ea57db852685bb2cd42601834352bf9a9` |
| 설치 EXE 실제 SHA-256 | `3bceb64e5dcd64925cc3eca398b9145bfcf5c39ea869cfb1e88a34d941396a4f` |
| standalone EXE SHA-256 | `c6b3c8bbabfb8ea21c88f0b6b3f8e73e18e9e812fdad10e5053c39e620dda786` |

폴더는 `artifacts/candidate-0.2.1-x86_64-pc-windows-msvc-a56389284dba-20261009T163714286Z/`다.
`manifest.json`이 source·lockfiles·frontend·worker·SDK/compiler·NSIS·resource 해시의
기준이다. `build-manifest.json`, `resources-manifest.json`, npm CycloneDX SBOM,
Cargo license inventory, `THIRD_PARTY_NOTICES.md`, `license-review.json`을 함께 전달한다.
설치 EXE 해시는 Tauri CLI 2.12.1의 검증된 `UNK`→`NSS` marker 변환으로 유도한
manifest 값과 실제 설치 파일이 일치했다. standalone 해시를
설치 파일에 적용하지 않는다. SHA-256은 무결성 확인이며 발행자 인증이 아니다.

소스는 위 commit의 checkout·lockfiles·[빌드 매뉴얼](BUILD_MANUAL.md)로 재구성한다.
후보 바이너리 소스와 이후 UI·문서 변경을 구분한다. 위 해시의 바이너리에 후속 UI가
포함됐다고 주장하지 않는다. 문서만 달라졌다고 동일한 후보
bytes의 build ID를 바꾸지 않는다. 재현은 기능 재빌드이며 bit-identical은 확립하지 않았다.

## 실행 증거와 네 수신팀 시연

OBSERVED는 실제 경로 실행, MEASURED는 명시한 방법의 수치,
STATIC_REVIEW/INFERRED는 실행하지 않은 판단, NOT_RUN은 미실행이다.
확인된 출력·해시가 들어오기 전 진행 중인 수용 행을 성공으로 바꾸지 않는다.

| 시연 / 경계 | 현재 관찰 | 남은 확인과 소유자 |
| --- | --- | --- |
| 유지보수자: 별도 Windows source build | OBSERVED. 작성자 캐시를 복사하지 않은 receiving workspace에서 초기 준비 후 clean 50941bd로 갱신. npm/build/production worker/native/desktop/package/verify 15단계 exit 0, native 51 통과 | 자동 실행으로 확인한 범위이며 실제 다른 사람의 사용성 평가를 주장하지 않음 |
| 운영자: 실제 단일 검사·검토·재열기 | OBSERVED. 최종 MSVC 설치본 일반 사용자 실행의 실제 scan 2 finding·404·OCR durable, graph keyboard·17px 글자/공유 raw inspector, 판단/메모/reading 저장, 정상 종료·새 실행/재열기, 재크롤 없음·공식 JSON byte identity 확인. native harness 다섯 과업 모두 pass | controlled fixture와 자동 조작 범위이며 실제 사람 사용성/공개 batch와 구분 |
| 운영자: native XLSX와 Excel | OBSERVED. 최종 MSVC 실제 Save As에서 XLSX 14,072 bytes 저장 및 원본 JSON byte identity 확인. 이전 GNU의 `native-review.xlsx` 14,068 bytes는 실제 Excel 16.0.20430.20092에서 한국어 summary wrap/width·review 메모/상태 확인, 로그인/라이선스 prompt 없음, 재저장하지 않음. upgrade 뒤 이전 workbook hash 동일 | 최초 GNU 자동 harness timeout은 후속 실제 저장 성공과 구분한 실패 기록. Excel 렌더링 증거는 앞의 14,068-byte 파일이며 새 MSVC 파일에 전용하지 않음 |
| 운영자: 공개 두 대상 batch | OBSERVED_DIRECT_BUILT. 사용자 직접 선정 지시에 따라 공개 광고 게시물 두 페이지를 native3c 빌드에서 CSV 가져오기·각1/0/60 점검, HTTP200·각 확인1/실패0/탐지0, 실제 Excel/공식JSON 저장 창, 원본 해시·계약·기존48파일 보존 확인 | 설치본 수용과 구분. 두 페이지 모두 보관용 HTML 사본 제한; [대상·결과·후속 수정](PUBLIC_BATCH_OBSERVED_KO.md). 전체 사이트/적법/광고 없음 판정 아님 |
| 운영: 최종 MSVC upgrade | OBSERVED. 실제 대화형 NSIS 3.11 종료코드 0, 이전 GNU70 제거 단계의 data delete checkbox 해제 확인. 원래 data 34파일 SHA-256 전부 동일, workbook hash 동일. 설치 EXE 실제 hash가 manifest의 유도 값과 일치 | `preservation-after-021.json`이 파일 보존 근거. 최종 MSVC 새 실행의 운영 과업은 별도 |
| 운영: rollback·일반 제거 | **NOT_COMPLETED — 사용자 방향 전환에 따라 중단** | 일부 절차를 시작했지만 완전 rollback·일반 제거 수용은 확립하지 않았다. 추가 설치 matrix를 반복하지 않으며 upgrade 보존 결과로 대신하지 않음 |
| 운영: 중단 후 최종 프로그램 복원 | OBSERVED. 최종 MSVC 0.2.1 프로그램 복원, 위 build ID와 설치 EXE SHA-256 일치. 원래 persistent 33파일과 GNU workbook 해시 동일 | `preservation-restored-021.json`. 앱이 열릴 수 있는 동안 변하는 `cases/.store.lock`은 비교에서 제외. 이 복원을 rollback 전체 완료로 읽지 않음 |
| 운영: 실패·사전 조건 | OBSERVED 범위. 최종 MSVC는 실제 빈 `PLAYWRIGHT_BROWSERS_PATH` poison 환경에서도 bundled runtime으로 실행, host integrity RID 8192/renderer RID 0 및 no-sandbox 인자 없음 확인. 실행 중 앱 배포 거부와 격리 Windows 복구 fixture 11건 관찰 | 실제 runtime 파일 삭제/변조·권한·중단 upgrade, WebView2 부재/완전 offline 설치는 이 환경변수 poison 시험과 구분하여 NOT_RUN |
| 평가자: 공식/추가 결과·시간 경계 | OBSERVED. receiving Windows built/packaged worker와 최종 MSVC 설치본의 strict 결과·native 원본 저장/export. 실제 slow page를 잡은 상태에서 scan_start/progress/cancel, 완료 한 페이지의 partial 공식 결과 저장·cancelled 재열기/export 동일, CIM 관측 orphan worker/renderer 없음 | controlled fixture 범위이며 외부 평가 수용은 NOT_RUN |
| CI | OBSERVED: 50941bd의 [run 37959883958](https://github.com/snowman0919/krds-illegal-ad-detector/actions/runs/37959883958)에서 `verify`, `windows-native`, `required` 모두 SUCCESS. 해당 소스 로컬 check 타입/lint 및 491 pass/1 skip, 80 파일 | receiving 15단계와 CI는 별개. 이 결과를 이후 UI 변경의 검사 결과로 전용하지 않음 |
| 후속 검사 | OBSERVED: 웹 107 pass, b30 통합 491 pass/1 skip. b30 CI `37967025068`, 683px 수정 8b CI `37967491010`의 Linux verify SUCCESS | 최초 2a CI 취소 fixture timeout과 분리. 683px reflow 수정 후 실제 617건 UI smoke 재통과; 이후 Windows/전체 CI는 해당 실행 상태를 따름 |
| 실제 사람·AT | NOT_RUN | 수신팀의 실제 사용자/보조기기 평가. keyboard 자동화·관찰된 Excel 렌더링으로 대신하지 않음 |

후속 source `87efa87101420dd8c490e99f1eeee07991cc7739`의 CI 결과는 서로 다르다.
push [verify job 113980972017](https://github.com/snowman0919/krds-illegal-ad-detector/actions/runs/37977943926/job/113980972017)은
493 pass/1 skip과 build boundary·web build를 통과했지만,
PR [verify job 113980993130](https://github.com/snowman0919/krds-illegal-ad-detector/actions/runs/37977950671/job/113980993130)은
`cancelled-scan.test.ts`의 `Test timed out in 40000ms`로 실패했다(492 pass/1 fail/1 skip).
같은 소스의 로컬 전체 시험은 493 pass/1 skip이었다. 단계별 로컬 조사 30회와 CPU 1개
제한 조사 30회에서도 재현되지 않았다. 원인은 미확정이며 통과 기록으로 실패를 덮지 않는다.
후속 테스트 변경은 실패 시 최대 16개의 진행 단계·경과 시간을 오류에 덧붙인다.
20초 scan 예산, 40초 harness 제한, 취소 후 5초 이내 settlement 조건은 유지한다.
진단 자체를 timeout 수정 또는 후보 전체 CI 성공으로 읽지 않는다.

Linux 브라우저 fixture는 Vitest setup 전용 `KRDS_TEST_UNSANDBOXED=1`을 명시했다.
정상 UI/worker는 이 변수를 읽지 않는다. 이 결과로 production 격리를 주장하지 않는다.
Windows receiving worker는 우회 없이 실행했고 production `chromiumSandbox:true`
실패는 명시 실패이며 sandbox를 끄고 재시도하지 않는다.

증거 기준 폴더는 `artifacts/adoption-evidence-20261010/`다. holdout·collection JSON,
`graph-ui/observations.json`, native 로그가 있다. `case-ui-replay/`는 file-backed 시험
IPC로 실제 설치본 스캔/저장/chooser의 증거가 아니다. 초기 `nia-final-check.log`의
487 pass와 최종 `nia-final-check-509.log`의 491 pass를 구분한다. receiving 최종 보고는
`receiving-source/adoption-0.2.1-report.json`과 그 단계별 로그다. 보고서의 `finalCommit`,
빈 `gitStatus`, command/exitCode/log가 근거다. `preservation-after-021.json`은 실제
MSVC upgrade 전후 보존 근거다. 보존 workbook SHA-256은
`5b91b13c3e81eb25872de572c88451f9cdc43b9aa7dde0a67620cceea6ea4090`이다.
Excel 렌더링 원본 screenshot의 개인 경로는 공개/인계용 자료에서 제외하거나 가린다.
최종 MSVC 설치본의 다섯 실제 과업·runtime poison·취소 증거는
`native-MSVC021-poisoned/native-adoption.json`이다. 이전 GNU native 결과와
MSVC source build 로그에서 따로 식별한다.
중단 후 최종 프로그램 복원과 persistent 33파일 보존은
`preservation-restored-021.json`으로 구분한다. 원래 34파일에 포함된 volatile lock을
앱 실행 중의 영구 데이터 보존 비교에 섞지 않는다.
개인 경로를 제거한 사본은 `curated/evidence-index.json`에 원본·사본 해시,
실행 환경, 실패/중간 후보의 범위, 제외 자료를 기록했다.
실행 머신 절대 경로나 대화 기록은 재현 전제 조건이 아니다.

## 후속 UI 변경과 화면 검증

사용자의 UI/UX 개선 요청에 따라 작업 우선순위를 실제 화면과 Rust/web 검증으로
옮겼다. 설치 반복 matrix는 중단했고 installer는 배포 경계가 달라질 때 확인한다.
아래는 후속 UI의 실행 관찰이며 사용자 수용이나 위 네이티브 후보의 화면 검증을
소급해 주장하는 자료가 아니다.

데스크톱 결과 화면은 왼쪽 요약 rail과 오른쪽 검토 목록으로 나눴다. 점검 설정은
입력·범위 설정을 묶고, inspector 상단에 뒤로 가기와 검토 동작을 sticky로 유지한다.
결과 진입 시 초점을 한 번 옮기고 목록으로 바로 이동할 수 있다. BrowserHost는
임시 preview임을 알리며 영구 저장을 지원하지 않는다는 이유로 실패 안내를 띄우지 않는다.

| 경로 / 조건 | 관찰과 한계 |
| --- | --- |
| 변경 전 기준 | 실제 509 소스의 생성된 dist 화면. 로컬 `nia-ui-adoption-before/geometry.json`·`workspace-1366x768.png`; 감사 소스나 재현 mock 화면으로 대체하지 않음 |
| 실제 React + Tauri adapter | OBSERVED. 역사 617개 기록·211페이지·19반복항목을 **file-backed IPC replay**로 검토. 실제 네이티브 scanner/Save As 실행이 아님 |
| 1366×768 / 17px | MEASURED. 첫 세 검토 행의 마지막 bottom이 변경 전 830.25px에서 변경 후 748.25px로 이동해 초기 viewport 안에 들어옴. 단일 fixture의 화면 기하 측정이며 속도 지표가 아님 |
| 320px / 200% CSS zoom | OBSERVED. 좁은 화면 재배치와 zoom 동선. MEASURED: 320px에서 원문 폭 300px, 이전 관찰 132px 대비 확보. 원문을 요약문으로 대체하지 않음 |
| 683×384 CSS viewport | OBSERVED. 중간 너비에서 제목이 세로로 밀리는 회귀를 추가 발견·수정. 제목 159×48px, 가로 넘침 없음. 실제 viewport 회귀를 추가했으며 CSS zoom만으로 판단하지 않음 |
| 키보드·검토 | OBSERVED. 검색/기법 필터, 결과 초점·목록 jump, 원문 진입/초점 복귀, 메모·reading, 묶음 확인, 20/50 표시와 f372 원문 확인 |
| JSON / XLSX | OBSERVED. 공식 canonical JSON bytes 동일, 실제 workbook 617 official 행과 검토 메모 확인. 필터가 export 전체 범위를 줄이지 않음. native Save As만 replay이며 이 시험을 실제 chooser 수용으로 읽지 않음 |
| BrowserHost preview | OBSERVED. 실제 preview adapter 경로는 Tauri IPC 없이 별도로 실행. 임시 preview 안내, 잘못된 저장 장애 없음, 외부 요청 없음 |
| 한계 | 관찰 기록의 remote requests0/errors0은 웹 replay 범위다. 이후 실제 공개native3c·보고native359·화면재열기565를 위에서 별도 식별했다. 최신 설치 과업과 사람/AT는 NOT_RUN; M5 전체 운영 수용은 완료 판정하지 않음 |

인계 증거는 `ui-adoption/after/observed.json`과 같은 폴더의
`workspace-1366x768.png`, `workspace-320px.png`, `workspace-200-percent.png`,
`f372-320px.png`, `browser-preview-1366x768.png`다. 이전/이후 화면은 비교 자료이며
식별 후보 바이너리의 설치 수용 증거가 아니다. [화면 변경과 검사](UI_ADOPTION_KO.md)에
웹 107개 테스트, 타입/lint/build와 CI 취소 fixture의 실패·후속 검증 범위를 기록했다.

## A01–A14와 정책 변경

개별 상태·커밋은 [구현 원장](ADOPTION_LEDGER.md)에 있다. 주 구현은 `082b552`,
후속 경계 수정은 `5fb0adc`(실제 glyph clipping/disposal), `88ee282`(중첩 fixture 준비),
`9ed3af9`(설치 런타임/프로세스), `50941bd`(MSVC provenance/관리 복구)다.
감사 source를 덮어쓴 결과가 아니다.

policy 2는 복원 전 의미 거부, 공개/인용 문맥, 실제 문자 가시성, 고유 frame owner,
순서에 치우친 visual 선택을 수정했다. 새 검사의 finding 수·근거는 policy 1과 달라질
수 있다. 기본 concurrency는 2이며 유효 설정은 Case에 기록한다. 기존 공식 원본은
새 정책으로 덮어쓰지 않는다. 재검사는 새 case ID다. 역사 617-record/19-group 자료는
표시·탐색·보고 회귀 입력이며 실제 위반 정답이나 새 결과의 목표 finding 수가 아니다.

## 유지보수 경계와 확장

| 모듈 | 책임과 변경 경계 |
| --- | --- |
| `packages/contracts` | 공식/진행/detail/Case/review/config 계약. `policy.json`이 TS/native 공통 한계 원본, 공유 양성/음성 corpus로 두 검증기 conformance 확인 |
| `packages/scanner` | DNS pinning·redirect/resource·접근 상태·발견/수집·frame/문자 관측. Page/Frame은 crawl이 소유하며 live callback 이후 사용할 수 없음 |
| `packages/detection` | 원문 span·순수 정규화/의미/기법, scan orchestration, bounded accumulator/visual scheduler. 공식 결과 우선 확정, 선택 분석 장애는 별도 issue |
| `packages/evidence` | visual/OCR source, extra contribution, 공유 asset, bounded graph, review projection, report exporter, hash similarity의 좁은 공개 entrypoint |
| `src-tauri` | worker/Job/watchdog·IPC 검증·CaseStore·safe import/export. 의미 탐지 재구현 없음; UI의 임의 경로 접근 금지 |
| `apps/web` | typed HostBridge와 Case/selection/review. 원본·관계 목록·graph는 같은 finding inspector로 연결; native 내부 호출은 adapter에 한정 |
| `scripts` / CI | 고정 준비·오프라인 검증·MSVC/NSIS package·provenance/SBOM·관리 복구. 테스트 서버는 harness 소유이며 생산 import에 포함하지 않음 |

[탐지 확장](DETECTORS.md)의 실제 `ZERO_WIDTH_OBFUSCATION` contribution과 harmless
`demo-contribution.ts`가 컴파일/실행 예다. ID/version/required observations/reasons/limits,
matched/excluded/unavailable을 명시한다. visual source·workbook exporter·hash similarity도
현재 consumer가 typed adapter를 사용한다. 해당 구현/명시 구성/fixture를 바꾸며 공식
serializer나 process supervisor를 수정하지 않는다. 새 extra 유형은 공통 유형과
TS-native fixture도 갱신한다. [유지보수 가이드](MAINTAINER_GUIDE_KO.md),
[계약](CONTRACTS.md), [ADR 0015](ADR/0015-durable-adoption-boundaries.md)를 함께 읽는다.

학습 모델은 선택 사항이며 꺼져 있다. unavailable는 음성 판정이 아니다. 정상 검사 중
모델/원격 rule pack을 내려받거나 원문을 외부 서비스로 보내지 않는다. hash similarity는
관계 보조 근거이며 동일성·소유권·공식 위반을 확정하지 않는다.

## 빌드와 변경 후 검증

receiving 실제 입력은 Node build `24.19.0`, 내장 Node `22.19.0`, Rust `1.98.1`,
MSVC `14.44.35207`, Visual Studio Build Tools `17.14.37012.4`, SDK/UCRT `10.0.26100.0`,
x64→x64, Tauri CLI `2.12.1`, NSIS `3.11`, NSIS Tauri plugin `0.5.3`이다.
지원 Node 범위와 도구 설치/라이선스 전제는 [빌드 매뉴얼](BUILD_MANUAL.md), 정확한
입력별 hash는 후보 manifest를 따른다.

```powershell
npm ci
cargo fetch --locked --manifest-path src-tauri/Cargo.toml
npm run prepare:windows-runtime
npm run doctor
npm run check
npm run test:integration
npm run build:desktop
npm run package:windows
npm run verify:artifact -- <candidate-folder>/manifest.json
```

위 명령 묶음은 수신 환경 최초 준비와 배포 경계 검증용이다. 일반 UI 변경은
관련 web 타입/lint·행동 회귀와 실제 빌드 화면을 먼저 확인하고, Rust 변경은 해당 native
경계 테스트를 실행한다. UI 화면 확인을 대신해 같은 설치 matrix를 반복하지 않는다.

의존성/runtime/패키징 도구의 첫 온라인 준비와 cached build를 구분한다. receiving
workspace가 처음 준비한 캐시를 최종 재빌드에 재사용했으며 매 단계 빈 캐시라는 뜻은
아니다. 작성자 캐시는 복사하지 않았다. runtime/source 불일치는 명시 실패이며 자동
신뢰/보안 우회를 하지 않는다. source 변경은 해당 consumer 테스트와 실제 경로 smoke
후 통합 검사한다. binary input 변경 때 후보를 다시 식별하고 문서만으로 역사 전체
설치 matrix를 반복하지 않는다.

## 데이터·배포·복구

원본 기본 경로는 `%APPDATA%\kr.go.nia.illegal-ad-detector\cases\<case-id>\result.json`이다.
공식 원본, `result_extra.json`, `review.json`, 자산을 분리한다. 검토/보고/재열기가 원본
bytes를 바꾸지 않는다. 이전 v0 결과는 기존 검증 경계로 읽고 지원하지 않는 미래
Case/schema는 거부한다. 자동 destructive migration·빈 사례 복구는 없다. optional
손상은 분석 불가로 남기며 원본 접근을 막지 않는다.

single evaluator는 명시한 로컬 entry origin으로 좁게 허용하고 다른 private 목적지를
자동 허용하지 않는다. file batch는 public-only DNS-pinned transport다. challenge/denied/
auth/rate-limit/network-policy/timeout·collection cap은 finding 없음과 다르다.
Retry-After·취소·전체 deadline을 보존하고 못 한 범위를 표시한다. DOM/frame/원문/이미지/
graph 상한과 truncation 이유는 공통 policy·상세 근거에 남긴다. 모든 사이트의 완전한
검사를 보장하는 상한이 아니다.

[운영 가이드](OPERATIONS_GUIDE_KO.md)의 정확한 manifest+전체 installer, 사전 백업,
대화형 install/upgrade/rollback, 검증된 restore 흐름을 사용한다. 실행 중 스캔을 강제
종료하지 않는다. 백업은 설치/data 밖의 새 경로이며 hash를 검증하고 원복 전 데이터를
형제 recovery 폴더에 남긴다. 네트워크 자동 updater는 없다. WebView2는 사전 준비 또는
승인된 online bootstrapper이며 부재/완전 offline 설치는 미검증이다. offline OCR,
cached build, offline 설치, 인터넷 사이트 검사를 혼동하지 않는다.
이번 전체 rollback 수용은 사용자 방향 전환으로 중단됐다. 최종 MSVC 프로그램 복원과
영구 데이터 보존만 관찰했으며, 이후에는 사용자 요청 없이 설치/제거 시연을 반복하지 않는다.

보관/전달/로그 redaction과 실제 연락 경로는 [데이터 처리](DATA_HANDLING_KO.md)를 따른다.
개인 경로·원문·메모를 공개 issue에 첨부하지 않는다. 첫 당사자 라이선스는
`license-review.json`의 `OWNER_DECISION_REQUIRED`이며 이 작업에서 선택하지 않았다.
미해결 notice/advisory와 도달성 판단은 유지보수 가이드에 남긴다. inventory는 법률 검토나
무취약 보증이 아니다. 인증서 취득·서명·공개 배포·제출·merge는 이 인수 범위에 없다.

## 독립 holdout의 결과와 한계

`adoption-holdout-1`은 직접 작성한 합성 6 site/template/creative 단위로 개발 감사 회귀와
역사 617건에서 분리했다. `packages/synth-eval/test/holdout/`의 provenance/gold가 기준이다.
네 기법 각각 TP1/FP0/FN0, precision/recall 1.0이고 정상 두 template는 FP0이다.
C1/C3 locator 역해결 합계 8/8, finding set은 동등하다. 기법별 양성 한 건의 작은 분모다.

MEASURED: Linux Node 26.8.1, 명시 fixture sandbox 예외 환경에서 C1 여섯 실행의
canonical analysis/finalization wall은 0.099–0.193초, 표본 process-tree summed RSS는
221–686.3 MiB였다. 100ms 간격 `ps`로 harness/Chromium/OCR descendants를 합산하여
shared page 중복·표본 사이 peak 누락이 가능하다. locator는 별도 실행이고 native
persistence/UI/chooser 시간은 포함하지 않는다. 각 fixture는 한 페이지라 C1/C3 동등성을
병렬 처리량 개선으로 해석할 수 없다. warm/cold 일반화, p95, 보편 메모리 상한,
공개 웹 precision/recall, confidence calibration은 주장하지 않는다. 이 holdout으로
정책을 조정하면 regression으로 옮기고 새 holdout으로 평가한다.

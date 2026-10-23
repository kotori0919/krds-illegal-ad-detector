# 채택 후보와 수신팀 인계

> 현재 제품은 `dev/bootstrap@dd5ceb4`, source `8628ba4a4488…`다.
> 최신 검증·한계·파일 식별은 [제출 자료](SUBMISSION_20261023/README.md)와
> [채택 원장](ADOPTION_LEDGER.md)의 세션 인계 재개 이후 절을 따른다.
> 아래565·509 등은 역사 기록이며 현재 전달 후보가 아니다.

## 현재 인계 — 2026-10-23 재개 결과

목표는 NIA JS 문서 전환 누락과 D08 묶음 저장 실패를 수정하고 실제 Windows에서
두 대상 저장·정상 재시작·통합 XLSX를 확인하는 것이다. 시작 HEAD는 f481d73이며
stash는 없었다. 기존 dirty와 untracked 시험은 `resume-start*`에 보존했다.
자동 stash 적용·일괄 복원은 하지 않았다.

제품은 세 독립 커밋에 보존했다. serializer43c6ff5는 값 없는 선택 필드를 생략하고 실제
오류는 유지한다. scanner3598f48은 committed 문서·최종 응답을 추적하며 기존 시간 안에서
최대2회 준비 전환을 처리한다. live 분석은 한 번이며 뒤늦게 문서가 바뀌면 실패로 남긴다.
카운터 수정dd5ceb4는 `open_case`가 검증된 저장 evidence에서 확인·실패 수를 복원한다.
네트워크·host/port·sandbox·검증기는 완화하지 않았다.

- 제품 commit `dd5ceb414e941ea8deef448899d1042e8d49a010`.
- source SHA `8628ba4a4488d9b3c6bf9a3080151784b1376aa7ced929f6cce545eb7b64b97c`.
- JS/TS770 passed/1 skipped 후 native만 추가 수정해82 passed/0 failed/2 ignored.
  fmt·Windows gnullvm all-targets clippy/check 통과. JS/TS·worker는770 suite와 동일하다.
- 후보 `artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-8628ba4a4488-20261023T061726351Z/`.
  installer746,947,332B(712.34MiB), SHA
  `33ce86950fe11ef2dc2e210c60e6604797c2a2ffb4c8e222f4c28a0015b36d56`.
- build:desktop·package:windows·verify:artifact EXIT0,8파일·runtime1,177파일 검증.
  실제 설치 EXE `f1466e88aefe985075faa3c9fb2f6227c251011893ad543726369fc497d90e2c`,
  worker5a2e1c6f…9df11도 일치했다.

최종 설치본에서 NIA5페이지 확인·실패0·18.414초와 진입200 checked를 관측했다.
새 공개 두 대상 groupc92ac68e는 저장2/2, 정상 종료 PID14196 후 새 PID28640에서
복원2/2였다. caseId·complete/blocked·확인 시도1/1·실패0/1이 유지됐다.
두 공식 result SHA가 같고 전후 통합 XLSX7시트 모든 셀도 같았다. 실제 Excel에서
대상 요약을 확인했다. 정부24는 plus.gov.kr 외부 이동으로 미점검이다.

소유 단일 양성83af74d3의17탐지는 이전 Windows17튜플과 순서까지 같다.
최종 설치본에서 f13메모·suspected·reviewed·revision3을 복원했고 공식 JSON4,586B는
설치 전 원본과 byte-identical이었다. XLSX16,508B·6시트와 실제 Excel 검토 기록에도
메모·검토 완료가 포함됐다. 이 증거는 두 대상 양성 D08와 구분한다.

최초36사례286파일은 전부 불변이다. 설치 전40사례338파일 중337개 불변이며,
명시적으로 복원한 기존 그룹의 updatedAt만1건 갱신됐다. 삭제·예상치 못한 변경은0이다.
현재43사례를 보존했다. 앱·Excel·설치 경로의 worker와 정확한 명령/포트 소유를 확인한
시험 server20400도 종료했다. Cua·WARP·다른 앱과 권한은 유지했다.

정확한 증거는 `artifacts/dogfood-20261023/resumed-windows/`, 명령·실패·최종 로그는
`resumed-validation/`에 있다. 중간 후보036/70a와 과거 실패 그룹도 보존한다.
NAS `/mnt/nas/illegal-ad-submission-20261023-resumed/`, HDD0
`/mnt/HDD0/illegal-ad-delivery-20261023-resumed/`의 candidate9파일은 복사 해시를 확인했다.
문서·원시 증거·소스 bundle의 전체 사본은 각 루트의 DELIVERY_MANIFEST/VERIFICATION을 따른다.

남은 NOT_RUN은 판단·메모 포함 공개 두 대상 D08(탐지0건), Windows 실사이트 이미지
재현율, 최신 MSVC 제품/CI, WebView2 부재 offline, 사람·AT·목표8GB환경, 기기 간 그룹 이식이다.
다음 독립 수용은 허용된 양성 공개 대상의 두 대상 검토 흐름과 MSVC/조직 환경이다.
현재 관측을 그 증거로 전용하지 않는다. 실제 공모전 제출·push·PR·공개 배포는 실행하지
않았으며, 전체 E2E 수용이나 제출 완료로 표시하지 않는다.

## 역사 기록 — 이전565 및 그 이후 검증 이력

`dev/bootstrap`, Draft PR #2의 구현·현재 후보와 실행 증거를 연결한다. 검토 기준은
`d14b8feadf60a174d3d74ad47e49ba13072c84c7`이다. 현재 설치·운영 검증 후보는565다.
재개 후 식별된565→509→565 build 원복과 데이터 보존 제거·재설치를 한 차례 완료했다.
일반 사용자 권한의565에서 단일·공개 두 대상 점검, graph 검토, 저장·재열기와 실제
JSON/XLSX 내보내기를 확인했다. 이전509·3c·359 및 웹 replay 증거는 별도로 보존한다.
UI 변경은 Rust/Tauri 빌드·production web·native 화면으로 검증했고 바이너리를 다시 만들지 않았다.
현재 판정은 **서명 없는 내부 평가 후보, 운영 채택 조건부**다.
M0–M5의 구현·자동 실행 시연을 기관 운영 수용, NIA 인증, 법적 위반 확정 또는 공개
배포 가능 판정으로 읽어서는 안 된다. 사람·AT와 조직 외부 수용은 미실행이다. [역사 RC](RELEASE_CANDIDATE.md)와 모든 중간
GNU/MSVC 후보·기존 전달 ZIP은 보존한다.

## 역사 후보565 — 공개 범위·보고 제한·화면 간격 수정 포함

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
| 설치 EXE 실제 SHA-256 | `7b6fc529fc679974aca2a603dd7de616ba89947fea64945e5c71fc9cc467fbba` — 설치 후 실측, manifest 유도 값과 일치 |
| manifest SHA-256 | `dc216c083f2e7d803f49357c86af1c811406cadfd75d42cf80a68859a00fa69d` |

폴더는 `artifacts/candidate-0.2.1-x86_64-pc-windows-msvc-d33dc9f7c097-20261009T185838006Z/`다.
OBSERVED: clean receiving checkout에서 canonical `package:windows` 한 번,
315.93초(같은 VM의 단일 관측), Windows·로컬 artifact verify exit0.
contracts→evidence→web→worker→Rust/Tauri→NSIS 순서이며 manual prebuild·도구 설치·
빌드 당시 installer 실행·역사 native harness 반복은 없었다. 보고서 dist가 없는 실제 root build도
통과했다. `ui-candidate-565d9f6-report.json`과 단계 로그가 근거다.

빌드 직후 직접 실행 EXE와 후보 standalone의 해시·인접 리소스가 일치했다. 당시565 native
화면에서3c 공개 케이스를 재열어 수집·보관 제한 안내와 카드·본문 간격을 확인했다.
새 공개 스캔이나 설치는 하지 않았다. 기존48 persistent 파일과 공개 케이스19파일의
해시가 그대로였다. Case 설정의 source는 원래3c이며 새 앱 source로 다시 쓰지 않았다.
보고서 변경은 앞선359 직접 빌드의 실제 native Save As(14,055bytes)와8열 확인으로
검증했고,565의 CSS 보정 때문에 저장을 반복하지 않았다.

[공개 두 대상 결과·제한·후속 수정](PUBLIC_BATCH_OBSERVED_KO.md)과
`public-batch-20261010/{native-observed,native-359-reopen-observed,native-reopen-observed}.json`이
실제 스캔·보고서 저장·최종 재열기의 독립 증거다. 원본 HTML 사본 일부 생략과
공식 탐지0건을 전체 내용 정상·적법 판정으로 해석하지 않는다.
이후 재개한 설치·운영 시연은 다음 절에 기록한다. 사람/AT·기관 운영 수용은 NOT_RUN이다.

## 최종 후보의 설치·운영 시연 — 2026-10-10 UTC

OBSERVED: 위565 전체 NSIS와 이전509 전체 NSIS의 해시를 확인하고 canonical
`managed-deployment.ps1 -Action backup`으로 별도 새 백업을 만들었다. 다음 결과는
실제 Cua 대화형 설치 화면의 Completed와 설치 EXE/build manifest·파일 해시를 함께
확인한 것이다. 이 회차에서 `-Action upgrade/rollback` 명령 자체나 installer 종료코드0을
관측했다고 주장하지 않는다. 설치 자동화 프로세스는 elevated였고 아래 운영자 실행은
Explorer에서 시작한 일반 사용자 권한이다. 실제 사람이 설치한 수용 시험은 NOT_RUN이다.

| 경계 | 실제 관찰 |
| --- | --- |
| 509→565 upgrade | 기존 persistent 67파일/8케이스 해시 보존, 설치565 build ID와 실제 EXE 해시 일치 |
| 565→509 build rollback | 새 검토까지 포함한95파일/11케이스와 JSON/XLSX 해시 보존. 설치509 실제 EXE `3bceb64e5dcd64925cc3eca398b9145bfcf5c39ea869cfb1e88a34d941396a4f`. 서버를 끈 뒤565 생성 케이스를509에서 재열어 메모 확인 |
| 509→565 복귀 | 동일95파일과 exports 보존, 위565 설치 해시·build ID 일치 |
| 일반 제거 | Delete application data가 해제된 것을 화면으로 확인. 프로그램 EXE·해당 HKCU 등록 제거, AppData95파일/11케이스와 exports 보존 |
| 프로그램 fresh install | EXE·등록이 없는 상태에서 전체565 설치 완료, 동일95파일 보존. AppData·WebView2가 있는 환경이며 빈 프로필/완전 offline 설치가 아님 |
| 일반 사용자565 | host RID8192. 실제 단일 점검2 finding·확인1/404실패1, graph CONTAINS→f2 원본 inspector, 판단·메모·검토 완료 저장. CSV 두 대상 각1페이지/깊이0/60초·public-pinned, 각HTTP200·확인1/실패0/탐지0·HTML 사본 제한 |
| 정상 종료·새 실행 | 새 host RID8192, fixture 서버 중지 후 케이스 재열기. f2 메모·추가 근거 필요·검토 완료 복원, revision3. 재열기 전후123 persistent 파일/14케이스 해시 동일, 앱 정상 종료 |
| native Save As / 실제 Excel | 공식 JSON708bytes 계약 통과·보관 원본과 동일. XLSX14,125bytes,6시트·수식0·검토 메모/판단·점검 범위8열. 실제 Excel에서 한국어 요약 줄바꿈과 검토 메모 표시 확인, 재저장하지 않았고 해시 동일 |

일반 사용자 단일 케이스는 `0ee91697-c454-455f-bf56-7b67136513ab`다.
공식 JSON SHA-256은 `507d7ca44e68d3960cba3b933d4548381d12ad991087eb4be183f2f1b75b13f5`,
XLSX SHA-256은 `71e2e06ee98a94f1c5cf63602fea552fc9d482285f36d5135c6a400a90d71f65`다.
직접 Cua 시작 경로에서 RID12288가 관측됐으므로 그 경로의 운영 결과는 일반 사용자
증거에서 제외했다. 모든 persistent 비교는 변동 `cases/.store.lock`을 제외한다.
`operations-565-20261010/`에 단계별 보존 receipt, 권한·공식 검증·
workbook 검증·공개 케이스 요약과 SHA256SUMS가 있다. 원문 HTML·개인 경로가 있는
Excel 화면/파일은 전달 사본에서 제외했다. 새 operations supplement ZIP은 기존 후보
ZIP·RC를 덮어쓰지 않으며 정확한 전달 파일/해시는 그 README에 있다.

M5의 내부 자동 실행 시연은 위 관측과 아래 유지보수자·평가자 증거로 마친다.
실제 사람/AT, 새 빈 프로필의 WebView2 부재/완전 offline 설치, 조직 배포·서명·법률
검토·독립 외부 평가 수용은 NOT_RUN이다. 관측된 한 workbook을 보편 Excel 호환성으로
일반화하지 않는다. 같은0.2.1 후보 간 build rollback이며 버전 번호 downgrade 증거가 아니다.

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
| 역사509 운영자: 실제 단일 검사·검토·재열기 | OBSERVED. 509 MSVC 설치본 일반 사용자 실행의 실제 scan 2 finding·404·OCR durable, graph keyboard·17px 글자/공유 raw inspector, 판단/메모/reading 저장, 정상 종료·새 실행/재열기, 재크롤 없음·공식 JSON byte identity 확인. native harness 다섯 과업 모두 pass | controlled fixture와 자동 조작 범위. 현재565 실행은 위 절에 별도 식별 |
| 역사509/GNU 운영자: native XLSX와 Excel | OBSERVED. 509 MSVC 실제 Save As에서 XLSX 14,072 bytes 저장 및 원본 JSON byte identity 확인. 이전 GNU의 `native-review.xlsx` 14,068 bytes는 실제 Excel 16.0.20430.20092에서 한국어 summary wrap/width·review 메모/상태 확인, 로그인/라이선스 prompt 없음, 재저장하지 않음. upgrade 뒤 이전 workbook hash 동일 | 최초 GNU 자동 harness timeout은 후속 실제 저장 성공과 구분한 실패 기록. 이 역사 Excel 증거를 새 MSVC 파일에 전용하지 않음. 현재565의14,125-byte workbook은 별도 실제 Excel 관찰 |
| 운영자: 공개 두 대상 batch | OBSERVED_DIRECT_BUILT. 사용자 직접 선정 지시에 따라 공개 광고 게시물 두 페이지를 native3c 빌드에서 CSV 가져오기·각1/0/60 점검, HTTP200·각 확인1/실패0/탐지0, 실제 Excel/공식JSON 저장 창, 원본 해시·계약·기존48파일 보존 확인 | 설치본 수용과 구분. 두 페이지 모두 보관용 HTML 사본 제한; [대상·결과·후속 수정](PUBLIC_BATCH_OBSERVED_KO.md). 전체 사이트/적법/광고 없음 판정 아님 |
| 역사 GNU→509 upgrade | OBSERVED. 실제 대화형 NSIS 3.11 종료코드 0, 이전 GNU70 제거 단계의 data delete checkbox 해제 확인. 원래 data 34파일 SHA-256 전부 동일, workbook hash 동일. 설치 EXE 실제 hash가 manifest의 유도 값과 일치 | `preservation-after-021.json`이 파일 보존 근거. 현재509→565 upgrade와 구분 |
| 현재565 rollback·일반 제거 | OBSERVED. 위565→509 완전 build rollback·새 케이스 재열기·565 복귀·일반 제거·프로그램 fresh install 완료,95파일/11케이스·exports 보존 | 역사 GNU rollback은 사용자 방향 전환으로 NOT_COMPLETED였음. 새 결과로 당시 중단을 지우지 않음 |
| 역사 중단 후509 복원 | OBSERVED. 509 MSVC 0.2.1 복원, build ID와 실제 EXE 해시 일치. 원래 persistent 33파일과 GNU workbook 해시 동일 | `preservation-restored-021.json`. 변동 `cases/.store.lock` 제외. 당시 안전 복원을 전체 rollback으로 읽지 않음 |
| 역사509 실패·사전 조건 | OBSERVED 범위. 509 MSVC는 실제 빈 `PLAYWRIGHT_BROWSERS_PATH` poison 환경에서도 bundled runtime으로 실행, host integrity RID 8192/renderer RID 0 및 no-sandbox 인자 없음 확인. 실행 중 앱 배포 거부와 격리 Windows 복구 fixture 11건 관찰 | 실제 runtime 파일 삭제/변조·권한·중단 upgrade, WebView2 부재/완전 offline 설치는 환경변수 poison 시험과 구분하여 NOT_RUN |
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

OBSERVED: 후속 source `cb89f993c224ce4d16564462e2a1eac984cc79a5`의 PR
[run37979745618](https://github.com/snowman0919/krds-illegal-ad-detector/actions/runs/37979745618)은
`verify`, `windows-native`, `required` 모두 SUCCESS다. Linux493 pass/1 skip(80파일),
build-boundary5·web build, Windows native51·fmt/Clippy·production packaged worker의
loopback1finding/2requests·sandbox fail-closed·MSVC Tauri release를 관측했다.
CI merge checkout과canonical cb89의 git tree는 같았다. 이 통과는87 PR timeout의
원인 규명이나 해결 증거가 아니다. 이후 변경은 인계 문서이며565 후보 bytes를 바꾸지 않는다.

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
| 한계 | 관찰 기록의 remote requests0/errors0은 웹 replay 범위다. 공개native3c·보고native359·화면재열기565 및 현재 설치565의 별도 실제 과업을 구분한다. 실제 사람/AT·기관 수용은 NOT_RUN |

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
역사 GNU rollback은 사용자 방향 전환으로 중단됐다. 재개 후 식별565→509 build rollback,
565 복귀·일반 제거·프로그램 fresh install과 데이터 보존을 위 범위에서 완료했다.
이 한정 회차를 끝으로 설치/제거 matrix나 자동 모니터링을 계속 실행하지 않는다.

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

## 2026-10-21 탐지 개선 후 인계

현재 작업은 Windows 검증 전 배너 누락 개선이다. `dev/bootstrap`, HEAD
`56fd3563e031ef1850e88b4fdac0c39ead08eea5`, 단일 worktree의 미커밋 변경이다.
기존 간단/고급·선택 WARP·단일 사례 인프라 변경을 보존했으며 commit/push/제출은
없다. DOGFOOD_LEDGER의 기존 변경(+514/-4)과 `docs/superpowers/`는 이번에 수정하지 않았다.

현재 source path/결정은 ADR-0017, 실제 결과는 ADOPTION_LEDGER의 같은 날짜 개선
항목과 `artifacts/detection-improvement-20261021/receipt.json`을 따른다. 실제 블랙툰
화면 crop8개0→1, 남은7개 누락. 파생 GIF의 흰 첫 프레임0→다중 프레임1, 작은 정상
비교5개 오탐0이다. 뉴토끼 실제 미디어는 연결 재설정으로 전후 비교하지 못했다.
정부 차단으로 단정하지 않는다. 원본 이미지/애니메이션 확보와 별도 정상 광고
corpus 검증이 다음 제한된 작업이다. 현재 corpus는 정책 개발 회귀이며 holdout이 아니다.

이후 사용자 요청으로 EmbeddingGemma 2 고정 모델을 별도 Python 환경에 설치해
실험 중이다. 모델 revision은 `914f7f89142e33e77833254d9c9b90c3cef7303b`, CPU float32,
2스레드이며 제품 기본 경로에는 연결하지 않았다. `benchmarks/embeddinggemma2/`의
사전 고정 protocol과 `artifacts/embeddinggemma2-eval-20261021/`의 입력/모델 hash,
canonical baseline·실제 추론 벡터·로그가 기준이다. 입력25개는 블랙툰8, 기존 음성5,
실제 삼성/LG 광고6, 합성 혼동6이다. baseline은1/8·FP0/17, OCR25개 모두 완료했다.
3반복과 `validate.mjs`를 완료했다. 사전 고정 이미지+OCR 주 비교3/8·FP0/17,
완화 분류8/8·FP1/17이다. 기존 공공안내 제외를 결합한 사후 추가 대조는
문자7/8·FP0/17, 이미지+OCR8/8·FP0/17이다. 독립 검증과 혼동하지 않는다.
CPU25개 문자1.366초, 이미지+OCR148.514초(3회 중앙값), 자체peak RSS3155.2MiB였다.
누락 원인과 수동 문자 대조는 `miss-analysis.json`/`rule-counterfactual.json`에 있으며
임베딩 입력/OCR 원문은 바꾸지 않았다. 상세는 EMBEDDINGGEMMA2_EVAL_20261021.md를 따른다.
다음은 신규 광고주/템플릿·실제 정상 게임/금융 광고를 포함한 별도 자료에서 후보 선별을
검증하고 기준을 보정하는 일이다. 제품의 모델 취소/전역 마감/패키징은 미연결이다.
실험은 종료했으며 자동 재실행하지 않는다. 모델 캐시는
명시적인 `/dev/shm/illegal-ad-embeddinggemma2-20261021`이며 휘발성이다. 고정 snapshot의
해시/다운로드 재현 방법이 있으므로 캐시 자체를 제품 의존성으로 취급하지 않는다.
검증 후 이번에 생성한 Python 환경과 휘발성 모델 캐시는 정리했다. 원본 입력·모델
manifest·설치 버전·추론 벡터·로그는 보관했고 재실행 시 고정 환경을 다시 준비한다.
일반 점검 WARP 필수화, 여러 사례 통합, 외부 능동 탐색은 이 작업에 추가하지 않는다.
Windows 검증은 명시 보류 상태다. 새 ORT 의존성/모델을 포함한 Windows lock/패키지와
네이티브 실행은 재검증 전 수용할 수 없다. 공개 사이트 sandbox 예외/TLS 우회,
자동 WARP 등록이나 OS 라우팅 변경 권한은 없다. 재개 시 branch/dirty와 증거 hash를
다시 확인하고 원본 매체 확보 가능성 및 아직 틀리는 OCR부터 조사한다.

## 2026-10-21 후속: 문자 전용 보조 실제 경로 통합 완료

위 실험 전용 상태는 이번 사용자 승인에 따라 갱신됐다. 현재 branch/HEAD는
`dev/bootstrap` / `56fd3563e031ef1850e88b4fdac0c39ead08eea5`, 단일 worktree의 기존
간단·고급/WARP 선택/배너 OCR 변경 위에 미커밋으로 통합했다. 공식 결과·공공안내
제외·직접 연결·단일 사례 인프라 범위를 보존했다. OCR/이미지를 외부 AI로 송신하지 않았다.
DOGFOOD_LEDGER(+514/-4), `docs/superpowers/`의 기존 변경은 건드리지 않았다.

현재 canonical 경로는 `scanSite` 공식 commit→기존 OCR 전체→고정 text similarity
보조다. `LocalOcrBackend.analyzeText`/`ocr-worker`/`text-embedding.ts`는 기존 자식의
직렬 큐/kill deadline을 재사용한다. 문자768차원 FP32, ORT1.30.0, tokenizer0.2.0,
ONNX revisiondaa72c51243991dfcaf9f9137d2c573d8f7790c0, 고정16설명/margin0이다.
제품에 Python/vision/audio를 추가하지 않는다. `textEmbedding` evidence와 v4 검토
후보의 TS/Rust 검증·간단/고급·XLSX 표시를 연결했다. raw OCR/matchedTerms는 보존한다.
모델 약1.12GB는 SHA 고정 빌드 캐시 `packages/evidence/.model-cache`에서 dist로
hardlink하며, 점검 때 다운로드하지 않는다. tmpfs 실험 캐시에 의존하지 않는다.

MEASURED: 이전 Python25벡터 최대 성분 오차3.20e-7/판정 변화0. 새 실제 자료34개를
최종 모두 수집/OCR 완료했고,3쌍 반복에서 OCR·탐지 수가 같다. 별도 뉴스 실제 배너10개
0→5/10, 기존 미사용 블랙툰10개1→9/10. 최초 정상10개2FP를 공개 보존한 뒤 의미문자
없는 OCR/피싱 예방 공공안내 제외를 보완했다. 원래 새 자료는 이제 회귀 자료다.
별도 frozen 문자 많은 정상4개까지 포함해 최종 정상13개+안내1개 FP0/14이며 작은
표본/출처 상관/사후 보완을 갖는다. 실제 광고 클릭 목적지는 보관 화면에 없어 동일
가정 링크의 loopback replay다. 뉴스10개는 한 화면에 묶인147×40이다.
주10개 전체 점검 중앙값6.047→7.404초, 새 child/모델 초기화 포함이다.

`docs/TEXT_EMBEDDING_INTEGRATION_20261021.md`, ADR-0017, ADOPTION_LEDGER와
`artifacts/text-embedding-integration-20261021/{receipt,summary,remaining-misses}.json`
및 raw runs가 현재 근거다. `npm run build:scanner`, `npm run build`, typecheck/lint,
owned local fixture full tests633passed1skipped, Linux shared Rust evidence6passed,
diff whitespace 검증 통과. 일반 Linux sandbox 실행은 이 호스트에서 불가다. 기존
fixture용 명시 opt-in만 사용했고 production 격리를 낮추지 않았다.

다음 제한된 과제: 뉴스5/블랙툰1 누락의 원본 해상도·실제 GIF/OCR 정보 손실을 개선하고,
새로운 사이트/시점의 양성과 정상 금융·게임·쇼핑 광고를 추가 확보해 독립 평가한다.
뉴토끼24원본은 연결 초기화로 검증 불가이며 원인을 정부 차단으로 단정하지 않는다.
Windows 검증은 계속 명시 보류다. 새 Windows lock/installer/native inference·메모리/
load 비용은 아직 수용 근거가 없다. OS networking/WARP 변경, 공용 격리 해제, remote
push/PR/배포/제출·교차사례/능동 탐색 권한은 부여되지 않았다. 다음 재개 때 현재
branch/dirty/source/model hashes를 다시 확인하고 이 새 근거부터 읽는다.

## 2026-10-21 추가 OCR·GIF 개선 후 인계

사용자 승인 범위는 남은 MT5개 OCR 손실 개선, GIF 점검, 기존/새 실제 배너와 정상
광고의 전후 탐지·오탐·시간 비교다. Windows는 계속 보류한다. `dev/bootstrap`, HEAD
`56fd3563e031ef1850e88b4fdac0c39ead08eea5`, 단일 worktree의 기존 dirty 위 미커밋이다.
DOGFOOD_LEDGER(+514/-4)와 docs/superpowers의 기존 변경을 보존했다.

현재 canonical 경로는 기본 OCR 전체 완료 → 기존 규칙/문자 의미 검토 → 아직 미판정인
외부 연결 small PNG(높이<=96, 가로세로비>=3)의 별도4x OCR이다. 같은 모델 세션과
가중치를 재사용하고 기존 양성을 보존한다. 문장을 합치거나 수동 오타 복원하지 않는다.
각 원문에 같은 공공안내 제외와 고정16설명/margin0을 적용한다. 선택 원문 외에 미선택
결과를 `ocrAlternatives`(최대1개/4096자)에 남기고 TS/Rust/UI/XLSX를 연결했다.
요청8초/global deadline/child kill을 유지하며 대안 실패·초과 길이는 unavailable로
기록한다. 마지막 child close 후 취소도 최종 상태에 반영하고 공식 JSON은 보존한다.

GIF의8×8 dedup가 읽을 수 있는 회색20ms 문구를 흰 화면과 같게 취급하고, 전역 top4가
장식만 남기는 실패를 실행 재현했다.128×32 signature/edge와4개 인덱스 시간 구간으로
분산한다. 기존 creative hash,120 decode/약3초/4보관/250KB/4MP는 유지한다. 서로 다른
내용이 선택에서 빠지면 partial로 표시한다. 같은 구간 내 장식 경쟁은 여전히 실패한다.

MEASURED:3회 짝 비교 모두 같은 탐지 수다. MT5→7/10(우주선/WINNER/MACHUJA3누락),
블랙툰16→18/18, 새 소재6→9/9, 기존 정상FP0→0/14, 새 정상FP2→2/10이다.
새 양성4는 Civic2개 보도 화면이며 이미4/4였고, 기존 MT 미사용5는2→5/5였다.
독립 사이트 성능으로 일반화하지 않는다. 교육 무료교재/300%환급 FP2는 기존 helper의
미해결 오탐이며 새 정답에 기준을 맞춰 지우지 않았다. MT10개 전체 시간 중앙값은
10.570→11.257초, 새9개는9.547→9.951초다. 새 child/모델 초기화 포함이며 CPU 독점/
OS 강제 cold가 아니다. 이전 회차7.4초와 직접 비교하지 않고 이번 paired baseline을 쓴다.

실제 집행 animated illegal/normal GIF 원본 확보는0이다. 외부 portfolio는 진단으로
분리했다. 파생 양성 제어0→2/3(1실패 남음), 실제 정상6개의 파생20ms GIF는FP1→1/6이다.
이 motion 재현과3반복을 새 광고 표본으로 합산하지 않는다. 실제61입력을 모두 수집/
기본 OCR 완료한 동일 가정 external URL의 소유 loopback replay다. 뉴토끼 원본 연결
reset은 계속 미해결이며 원인을 정부 차단으로 단정하지 않는다.

주 근거는 `docs/OCR_GIF_IMPROVEMENT_20261021.md`, ADR-0017, ADOPTION_LEDGER와
`artifacts/ocr-gif-improvement-20261021/`의 receipt/summary/observed/remaining-misses/
false-positives다. fresh manifest99c95446...의 양성9/정상10은 점수 전에 동결했다.
baseline-runtime은 수정 전 실행 코드 복사와 동일 SHA 모델 링크다. 재개 때 모델
리비전·source identity를 다시 확인한다. 기각한 전처리·원문 trace·GIF 출처도 보관했다.

최종 build:scanner/build/typecheck/lint, 전체 owned fixture tests645passed1skipped,
Linux 공유 Rust evidence7passed, diff check가 통과했다. 길이/취소 리뷰 수정은 메인
timing 모듈 로드 뒤 적용됐고 새 build/경계 회귀/최종 소스의 정상 GIF3쌍으로 검증했다.
Windows lock/패키지/native 설치·추론·실제 GIF 현장 검증은 NOT_RUN이다. commit/push/PR/
배포/제출·자동 WARP 등록/OS 네트워크 변경·공개 사이트 격리 해제는 하지 않았다.
다음은 남은3개 원본 해상도/OCR와 교육 광고 오탐2개를 독립 자료로 검증하는 일이다.
사용자 지시 없이 Windows로 진행하지 않는다.

## 2026-10-21 후속: 교육 오탐 보정, 3누락은 미해결

사용자의 최신 지시는 남은 우주선/WINNER/MACHUJA3누락과 교육 광고2오탐의 원인을
확인하고 기존·새 실제 광고로 전후 탐지/오탐/시간을 비교하는 것이다. Windows는 계속
보류다. branch/HEAD는 `dev/bootstrap` / `56fd3563e031ef1850e88b4fdac0c39ead08eea5`,
기존 dirty 변경을 보존했다. commit/push/PR/배포/제출/WARP자동등록/OS변경은 하지 않았다.
DOGFOOD_LEDGER의기존+514/-4와docs/superpowers는수정하지않았다.

변경은 정상 교육 설명3개를 기존16개에 추가한 text-ad-embedding-v2와 TS/Rust의
v1/v2호환 검증이다. 모델/양성8/기존음성8/margin0/prefix/자원상한/OCR/scan/GIF는
그대로다. 교육 키워드/광고주 일괄 예외는 없다. 두 문제 광고의 실제 OCR 회귀는 수정
전 실패/후 통과했고 혼합 카지노 제안은 양성이다. 기존 공식/공공안내 제외를 유지한다.

원인: 정상 학원/무료 교재/수강료 환급 설명이 빠져 있었고, 원문에 남은 시험 문맥을
스포츠 토토 설명 쪽으로 잘못 비교했다. 선택한3개 설명으로 margin+.016555/+.002843가
-.006159/-.013640이 된다. 넓은 한글 환급 설명은 기존 양성6개를 잃어 기각했다.

남은 OCR3개도 실제 픽셀/검출영역/거부줄/CTC로 검사했다. 우주선 세로crop21→13px는
첫출전→실제첫충전 글자를 복구하지만 고정 의미 판정은 여전히 음수다. 이geometry를
17개에 전역 적용하면 기존 카지노/가입코드/페이백 문구가 손상돼 제품 적용하지 않았다.
첫충전 양성 설명 추가는 교육 FP를 재발시켜 기각했다. WINNER는 스타일 로고 미검출/
숫자만 복구, MACHUJA는 브랜드를 이미 읽지만4~6px 한글 제안이 깨진다. 불가능의 증명은
아니며3누락이 해결됐다고 주장하면 안 된다. 수동 교정/브랜드 정답 주입은 하지 않았다.

MEASURED: 최종66점검(11군×전후×3), 각 입력·선택frameOCR완료/계약검증/공식finding0.
MT7→7/10, 블랙툰18→18/18, 이전양성9→9/9, 기존정상13+안내1 FP0→0/14,
이전정상10 FP2→0/10, 새사칭광고6→6/6, 새정상정지9 FP2→1/9,
실제정상GIF1 FP1→0/1, 삼성/LG축소본6 FP1→1/6, 파생양성GIF2→2/3이다.
새6개는3뉴스기사/같은강원랜드사칭군의큰SNS형식으로작은배너독립성능이아니다.
4개는실제helperv4/2개는직접v3, 전후같다. 새정상은YBM9/시원1이며9정지+실제GIF1,
2frame을2광고로세지않는다. 최종남은FP는새YBM응시료할인/자료집과기존삼성폰축소본이다.
새정답을본뒤정책을다시맞추지않았다.

전체시간중앙값 MT8.584→7.969초, 새양성6은7.142→7.187초, 이전정상10은
4.354→4.433초다. 새정상10전체는1MB/page를유지해정지4/5개+GIF세점검합
10.158→10.426초(각모델초기화포함)다. 쌍별차이와범위는보고서참조, 속도향상주장없음.
초기20ms/크기미지정HTML에서수집실패한시험은성적에서빼고별도기록했다.
그실패를FP0으로세지않고, 모든img에실제width/height를동일명시해최종3쌍재시작했다.
현장크기미지정/늦은광고수집을검증한것은아니다. 제품기본settle1500ms는그대로다.

근거: `docs/OCR_SEMANTIC_REFINEMENT_20261021.md`, ADR-0017,
`artifacts/ocr-semantic-refinement-20261021/`의receipt/summary/observed/원인probe/기각실험/
기초snapshot/전체66run/두종류읽기전용리뷰/초기중단실행이다. freshmanifestSHA
`1af0e7ece8f66d853bc3d478f2d04f0dd8cedbb966e0200f2c2a4f218699fc39`는점수전동결했다.
`KRDS_TEST_UNSANDBOXED=1 node benchmarks/ocr-semantic-recall.mjs`는소유loopback전용이다.
canonicalcache/모델가중치는변경하지않았고snapshot은SHA와asset링크를확인해야한다.

검증: build:scanner/build/check(typecheck+lint+tests)통과,645passed1skipped,
Linux공유Rustevidence7passed, diffcheck통과. skip1은KRDS_RUN_HOLDOUT별도optin의
무거운authoredholdout으로이번새실제광고66점검과다르다. Windows빌드/설치/native추론은
NOT_RUN이다. 다음실제개선은3작은배너의원본/더적합한인식과새교육오탐의핵심문구누락을
구분검증하는일이다. 최신6+10은이제재사용하면개발자료이며새검증자료로다시부르면안된다.
사용자지시없이Windows나외부능동인프라탐색으로넘어가지않는다.


## 2026-10-21 후속: 다른 OCR 비교, 오탐 보정 검증 완료·3누락 미해결

현재 작업 목표는 남은 우주선/WINNER/MACHUJA3누락의 다른 인식기 비교와 응시료 할인·
삼성 축소본 오탐 보정, 기존/새 실제 광고의 전후 품질·시간 비교다. Windows는 계속
보류하며 교차사례/능동탐색·배포·commit/push/PR/제출은 승인/실행하지 않았다.
branch/HEAD는 dev/bootstrap /56fd3563e031ef1850e88b4fdac0c39ead08eea5이며 기존 dirty
변경을 보존했다. DOGFOOD_LEDGER(+514/-4), docs/superpowers는 수정하지 않았다.

canonical scan은 직접 규칙 양성을 보존하고 의미 비교만으로 통과한 Tesseract PNG를
같은 PP 기본 인식기로 검증한다. mean confidence가 높아도 누락한 토익 문맥을 복구한다.
완료된 informative PP와 그 원문의 모델/공공안내 판정을 선택하고, 실패/빈문구/비문자/
모델 unavailable이면 기존 양성을 보존한다. PP 기본↔4x에서 confidence와 Unicode
문자 수가 함께 줄어든 대안은 helper만으로 승격하지 않는다. 직접 규칙은 여전히 허용한다.
선택/미선택 실제 원문을 보존하고 threshold0/19설명/공식JSON/기존공공안내/GIF/예산은
유지한다. 제품 변경은 scan.ts/adapters.ts/ocr-worker.ts이며 native YBM fixture와
OCR·제어경계 회귀7개를 추가했다. build:scanner/build/check652passed1skipped,
Linux공유Rust7passed, focused20passed와 읽기전용코드리뷰(finding1개수정)를 완료했다.

다른 OCR은 EasyOCRG1/G2(CRAFT+서로 다른 CRNN)와 pinned KoreanTrOCR다. 앞의 둘은
세누락 핵심문구를 충분히 복구하지 못했고 TrOCR는 일부 글자를 더 읽지만 고정helper에서
무의미한 문구 양성과 기존 정상10중3FP가 생겨 기각했다. 새모델/의존성/ONNXexport/
Python제품runtime은 추가하지 않았다. 세누락은 여전히 미해결이다.

작업 근거는 docs/OCR_ENGINE_COMPARISON_20261021.md 및
artifacts/ocr-engine-comparison-20261021/이다. fresh manifest e703a370...에 실제 양성6/
정상10을 점수전 동결했다. 양성은 KCOPA2022의1화면, 정상은4운영사이며 독립 사이트
성적으로 해석하지 않는다. original frozen-protocol은3쌍이고 첫 fresh 점수전
measurement-amendment로5쌍/warmup제외로 늘렸다. canonical-runtime-identity가 실제
canonical dist의48개input+worker와 frozen afterbundle의 byteidentity를 확인한다.

OBSERVED: 최종130점검(13군×전후×5, warmup2별도)은 판정이 모두 동일했다.
기존 양성40/43유지·새실제6/6유지, 기존 MT7/10/블랙툰18/18/이전9/9/사칭6/6이다.
정상50(기존40+새10, 축소6·공공안내1포함, exactSHA중복0)은 FP3→0이다.
해결3사례는 응시료/삼성축소본/점수전새KT쿠폰이며 실제 누락 추가 회복은0이다.
실제정상GIF1=2frame FP0유지, 파생GIF2/3과 bin-competition누락은유지한다.
1090image-analysis/보관helper850/alternate245, 모든입력/선택frameOCR/optional검증완료,
unavailable0, 공식commitbyteidentity+finding0+TS계약검사·snapshot/canonical입력해시통과다.
요약의 normal44는 축소본제외이며 allNormalIncludingLegacy50과 분리해이름을명시했다.

시간(전체점검 N5중앙값)은 이번새양성6개4.659→5.438초, 새정상10개4.520→4.747초다.
기존양성43개4점검합38.765→40.253초, 쌍별차이중앙값+1.859초(−2.354–+7.424)다.
새양성쌍별+0.785초(+0.714–+1.078),새정상+0.251초(−0.154–+0.421)이며
분산/공유데스크톱조건을보고했다. 속도개선·독점CPU·P95·현장발견률 주장은없다.
벤치후lint/diff검사도완료하며 제품/정책은 첫새점수 이후수정하지 않았다.

다음제한과제는 실제세누락의더좋은원본해상도/자동안정영역검출/생성OCR의grounding을
검증하는일이다. 현재147×40에서세인식기비교도충분한근거를회복하지못했다.
모든OCR이불가능하다는증명은아니며 임계값완화·수동교정·광고주예외로숫자를올리지않았다.
Windows/배포/제출과교차사례/능동탐색은여전히후속이고본작업으로승인되지않았다.

독립검토의추가한계: positive-civic2022-onka는PP검증이기존Tesseract의카지노문맥을
잃었고 후margin+0.0000180으로5회양성이지만경계가매우작다. 양성수유지를안정적문구
복구로해석하지않는다. 검증OCR의정보보존/abstention은남은실제과제이며동결뒤해당
라벨에맞춘예외/임계값수정은하지않았다. 측정리뷰의130원시·99SHA·전후시간재계산은
차단결함없이완료했다. Windows는계속보류한다.

## 2026-10-21 재개 작업 결과: 이미지 검토 통합·정밀도 보정

사용자는남은누락해결/Windows복구를알렸으나정밀도먼저라고지시했다. 이후NAS사용을
명시했다. branch/HEAD dev/bootstrap/56fd3563e031ef1850e88b4fdac0c39ead08eea5,
extensive pre-existingdirty유지. DOGFOOD(+514/-4)/superpowers수정없음. Windows/배포/
제출/commit/push/PR/차단우회/광고주능동탐색/외부AI전송은NOT_RUN이다.

작업artifacts/ocr-grounding-20261021/,보고docs/OCR_GROUNDING_20261021.md.
원래baseline-runtime은작업전canonical묶음/worker이며after-runtime과최종canonical실행
입력189개를frozen-source-identity.json으로고정/최종재검증했다. frozen-protocol은v3,
소재수분모(metadata-only)정정은원본별도보존했다. 현재소스는실행경로에통합되어있지만
새2누락/파생GIF1누락이있으므로전체누락해결/현장정밀도100/Windows준비완료가아니다.

제품변경: image-preprocess.ts의검증된v2uint8fixedpointPNG전처리와같은checkpoint의
671MBvisionencoder를재사용한image+actualOCR검토다. scan.ts는공식JSON확정/기본OCR/
문자의미검증후미해결PNG(height<=96/aspect>=3/관찰외부링크)만추가비교한다.
실제선택/미선택OCR중하나에숫자문맥필수,그중공공/동일DOM제외가있으면veto다.
단어합성/수동전사/광고주예외없고원문/대안각1개를보존한다. realmargin>=0 AND
seed1701shuffledpixelsmargin<0. 별도v5image-review/UI배지/보고서/TS와RustSHA바인딩이다.
모델출력의전사/법적위반확정주장없음. textEmbeddingdisabled는이미지도끈다.

기존온카는PP검증이유일한카지노범주를잃으면기존원문을보존한다(공공/DOM우선).
문자v3는기존19설명+영문일반프로필/아이템교환코드normal1=20참조,임계값0/양성8유지.
이미지v2는추가Korean교육수강패키지/아이템normal2. 경품만있고실제범주/명확한
가입코드/입금등문맥없는문자유사도승격과의미없는이름한단어승격을막았다.
쿠폰OCR추가입연부론의가입부분문자열을semanticGate가입으로읽던구체오류를보존진단했다.
단어guard만으로MEXXN이이미지승격되던반례는실제숫자문맥guard로같이막았다.
API/자식queue/취소·시간초과격리유지,이미지pair16s/문자OCR8s/전체마감유지다.

기각/수치: Tesseract546/RapidAIKoreanv4동일ROI22/VL-OCRfull/auto-line은기존3의충분한
전사를회복못했다. 일부실제glyph회복도helper음성/blank환각·잘린출력기각.
초기영상실험BOI/EOI일반문자열·v1resize·alpha실수는CONTRACT_INVALID,판단에서제외.
실제255999/258880/258882token/patch/좌표/padding+whitealpha+Torchvisionv2AA를
맞춘45PNG RGB/patch오차0(허용1e-5),16nonPNG NOT_RUN. Torch2벡터오차
2.29e-7/1.12e-6와native5score<=1e-5. 영상만입력하면기존3의대조실패,
광범위normal설명/전역단서강화는기존양성손실,logo/admission3설명도MEXX못잡아기각.
새2누락의실제4x대안원문을독립image입력해도둘다음성(alternate-image-observed).
새OCR/Python제품runtime/재학습/새의존성은없다.

실패추적: rejected-v1은첫동결candidate의old49positive회복/oldnormal50FP0에도
처음수집18에서실제정상2FP+파생정상2FP라채택안함. 해당18은개발자료로전환.
rejected-v2는추가7실제정상FP0이나파생MEXX1FP가남아기각(7도개발자료전환).
실패assert뒤shellnewline으로시간측정이계속된실행오류를발견해즉시중단/제외했고
현재harness는정상FP/양성회귀를직접assert하여반복시간으로진행하지않는다.
첫ENOSPC중단로그와tmpfs복구개발결과recovered-evidence도보존,최종수치에서제외했다.

최종OBSERVED/MEASURED:22군N1전후44+4집중군N5추가32=76raw,MTwarmup2제외.
596입력관찰/문자485/이미지38/대안182,전부수집+모든선택frameOCR완료,
optionalunavailable0,확정JSON각점검byteidentity+finding0+TS상세검증,189소스불변.
집중반복판정/원문동일·점수1e-5내. ANIMATION_PARTIAL2는전후파생GIF이다.
old49positive46->49(MT7->10/10,블랙툰18/18,기타21/21),새6positive4->4/6.
원본/네이티브crop정상65(실제KB공공안내1포함)FP2->0,별도기존축소6FP0,
신규축소정상21FP1->0,제목/로고자원2FP0. sourceactual120=55positive65negative,
6legacy+6derivedpositive+21derivednormal+3derivedGIF+2heading=38controls,
총158소재다. 서로독립인120광고/새사이트라는주장없다.

최종미평가정상2(같은Eduwill/다른2캠페인)와그축소2도FP0,그러나vision을실행하지
않아이것만으로새image분류기의독립정밀도를입증못한다. 별도제목/로고2중1개vision실행.
초기새양성6은2023문헌1화면native136~137x41~42,이전110정확SHA중복없음,
외부href는fixture통제조건이지당시실제광고목적지가아니다. actual새GIF없음.
새6의SMILE/부띠끄2와축소6의대응2는미해결. 파생GIFbin-competition frame1보관누락
계속2/3. 기본/4x OCR과고정모델의현재회복미확인이지모든OCR불가능증명은아니다.

N5전체점검ms범위/pairedspread는summary. 중앙값 MT10 7.506->23.051s
(쌍별+15.604,15.395~16.020),새양성6 5.501->16.176s(+10.693,10.511~10.885),
새정상12 6.920->6.846s,추가정상7 3.283->3.231s. 후2군차이는분산내속도개선주장없음.
Ryzen9700X16논리/32GiB/Linux/Node26.8.1/npm11.19.0/ORT1.30.0CPUembeddingintra2/inter1/
tokenizers0.2.0/pngjs7/Playwright1.63,FP32/seed1701. 소유모델/테스트종료후측정,
공유데스크톱ambient부하는통제불가. N1다른군시간은성능근거아님. Windows미검증.

build:scanner/web/typecheck/lint/675passed1skipped/Linux공유Rust8passed/diff통과.
루트가소스·경계·실행결과·수치집계를직접검토했다. 독립agent재검토는usage-limit
오류로미완료이며합의/검토완료로포장하지않았다. summary/audit76개SHA와모든지표재계산.

사용자NAS지정후cache/stage16파일총3575838201B copy+SHA검증→symlink전환,
검증된로컬중복약1.8GB만회수했다. 실제NAS모델은
/mnt/nas/illegal-ad/model-assets/embeddinggemma2-daa72c512439-20261021/{cache,stage}.
최종raw /mnt/nas/illegal-ad/validation/ocr-grounding-20261021/{runs,warmup-runs}.
root코드canonical경로는그대로고제품소스에는NAS경로없음. 개발NAS링크에는mount필요,
HDD0도여유확인했으나NAS가충분해쓰지않았다. 소스/모델/과거증거임의삭제없음.

다음boundedaction은새136px두누락의더선명한실제원본또는독립검증한새인식방법과
GIF목표frame보관문제를분리해추가증거를확보하는일이다. 현재정밀도표본은목적표집/
사후보정이많고최종미평가정상2는작으므로현장일반화와Windows실행은후속검증대상이다.
Windows복구가품질검증대체나자동배포승인을뜻하지않는다.

## 2026-10-21 완료 기록: 저해상도2·GIF1 추가 개선

현재 사용자 범위는 SMILE/부띠끄 native136px2누락+bin-competition파생GIFframe1,
기존/새실제양성·정상/처리시간 비교다. Windows는 명시적으로 계속 보류한다.
HEAD dev/bootstrap/56fd3563e031ef1850e88b4fdac0c39ead08eea5, singleworktree,
광범위기존dirty보존. DOGFOOD(+514/-4)/superpowers미수정. commit/push/PR/배포/제출,
차단우회/광고주능동탐색/외부AI전송/Windows미실행. 모델기존NAS, 새최종raw는
/mnt/nas/illegal-ad/validation/ocr-lowres-gif-20261021/{runs,warmup-runs} symlink.

보고 docs/OCR_LOWRES_GIF_20261021.md, 증거 artifacts/ocr-lowres-gif-20261021/,
harness benchmarks/ocr-lowres-gif-recall.mjs. Baseline은직전최종after-runtime을새baseline-runtime에
고정했으며예전pre-grounding을쓰지않았다. after-runtime/과394소스·입력해시동결/최종검사완료.

구현: creative.ts는4temporalbins/edgewinner 대신 bounded streaming luma다양성선택으로
5후보중4보관, 최소쌍별거리→총거리→edge순으로선택한다. 4보관/120검사/3s/bytes/전체OCRcap,
실제index/time/partial표시유지. 새후보가선택될때만PNG인코딩, 실패시기존선택유지다.

text-embedding.ts imagev3는같은pinnedcheckpoint/PNG전처리의image-onlyquery를실제광고예시
벡터와비교한다. JSON52vectors=15positive(BT8+MT7)+11normal+26shuffle-negative.
정상11중9actualparents+2legacyretailreductions. 현재SMILE/Boutique와이전image-review3목표,
이번새수집을참조에서제외했다. 모델/CPUFP32/threshold0/score3/3/realpositive AND
seed1701pixelshufflenegative/SHA바인딩/serialkillablechild/공공·DOM제외유지.
원문은임베딩에넣지않고자격/문맥판정에쓰며실제원문·대안·matchedTerms를보존한다.
TS/Rust는저장v1/v2와v3호환, UI/workbook에policy·이미지검토·전사미복구명시.
Python/runtime dependency/모델다운로드/가중치재학습추가없음.

정밀도: 실제교육/휴대폰판매문맥이이미지style로뒤집히지않게공통helperadmission보완,
실제카지노/입금jargon우선. 숫자·실제표현/offer/jargon없는일반제목은text보류,
하나의실제OCR안에서percent/금액단위/복수숫자그룹없으면image보류. 대안끼리합성없음.
Fullsuite가찾은연동회귀는추론자격부족과공공/정상/DOM실제제외를분리하여고쳤다.
약한대안은기존카지노범주를지우지못하고실제제외는우선한다.

최종MEASURED: 29묶음전후N1+4집중묶음N5=90raw+discardedwarmup2,
190입력/540관찰/문자345/이미지50/대안176. primary/alternate/helper불가0,
공식JSON각점검확정byteidentity/finding0/TSdetail통과,394해시불변.
집중4군5회원문/판정동일·모델점수1e-5내. ANIMATION_PARTIAL12receipts는정상적인boundedGIFlimit.
실제출처134=60positive74negative(공공안내1포함), 별도대조·자원56분리.
기존55positive53→55(저해상도6은4→6),새실제5positive5→5,정상74FP0→0.
기존파생GIF3 2→3, 위치변형4 1→4(목표encodedindices0/1/3/4).
이전저해상도축소6 4→6, 새정상축소6 FP2→0.

중요한남은한계: 새양성전체2048px행을137x42로비균일변형한BUTTER대조본1개는
스포츠해당UP/HE만남아일반제목승격제한으로새미탐(5→4/5). 원본은전후탐지다.
새모든극단축소/모든실제GIF해결을선언하지않으며 이회귀를summary/audit/report에명시했다.
실제불법광고주원본GIF추가확보없음. 추가목표가이회귀라면프로토콜/현재코드를기준으로
실제왜곡소재·정보보존/인식방법을검증해야하며스포츠단어예외나임계값완화로숫자를올리지말것.

자료: CIDS2021one-screenshot새5positive(duplicate/이전온카·WESPORTS제외),
Hackers2/Aladin1/YES243normal. BUTTER/WINWINwholeJPEGrow는jpegtran3.2.0계수crop,
광고영역RGB오차0,첫새점수전amendment기록/이전부분PNG보존. 목적지미확인소재의외부href는
controlledfixture조건이지실제인프라증거아님. 초기사실11/축소11은정상derivedFP발견후개발자료.
추가정상3+축소3은점수로fit하지않았고FP0,같은operators의새campaigns다.
원본3은text/축소3은미진입이라독립vision일반화증거아님. 초기새normal축소Aladin1은vision음성.

N5전체점검초 중앙값(min–max),pairedmedian(range):
- 저해상도6 before24.164(21.433–28.067) after21.826(21.247–28.566), +0.042(−2.917–+0.499)
- 파생GIF3 before3.618(2.549–3.982) after2.999(2.073–3.615), −0.477(−0.883–−0.271)
- 새실제positive5 before9.494(7.197–10.295) after10.136(6.596–10.508), +0.139(−0.601–+1.014)
- 새실제normal6 before5.560(3.803–5.804) after5.325(3.648–5.434), −0.156(−0.479–+0.476)
GIF외pairedsign혼재로속도우열주장없음. 중앙값차이와차이중앙값은다름을보고했다.
같은Ryzen9700X16논리/Linux/Node26.8.1/ORT1.30CPUFP32/tokenizers0.2/pngjs7/
Playwright1.63/seed1701/NAS자산, MemTotal32702353408B(약30.46GiB).
소유tests/models종료후측정,ambientdesktop부하미통제,Windows/P95/coldinstall미추정.

최종build:scanner/build-web/typecheck/lint/688passed1skipped/Linux공유Rust8passed/diff통과.
Logs diagnosis/{build-final,build-web,typecheck-final-v2,lint-final-v2,test-final-v3,rust}.log.
처음srcworker테스트경로실수/옛fixture계약/DOM에비광고문구를넣던테스트설정오류및
기각candidate·초기실패는retained,최종metrics에서제외했다. 루트가직접소스/경계/원시/수치검토,
독립agent검토는미실행이다. frozen프로토콜은actual60과기존targetcontrol보존/정상FP0을요구하며
새파생positive완벽을가정하지않는다. auditor의초기미실행blanketassumption을실제동결계약에
맞추고위controlregression을별도필드로기록했다. 프로토콜/원시/labels를변경해회귀를감추지않았다.

재현은KRDS_TEST_UNSANDBOXED=1 node benchmarks/ocr-lowres-gif-recall.mjs 및
python3 artifacts/ocr-lowres-gif-20261021/summarize.py. 전체source/inputs와90receiptSHA는audit,
freeze.mjs/after-runtime/을보존. 작업대상3누락은회복됐으며추가작업은사용자지시를따른다.
Windows는계속보류. 이전장기기록/모델/증거를임의삭제하지말것.


## 2026-10-22 진행: FP32 고정 문자 벡터 사전 계산

사용자 승인 범위: 구간 계측, 고정20문구 벡터 사전 계산, 기존 실제 배너/정상광고의
전후 탐지·오탐·시간·메모리 비교. 양자화와 Windows는 계속 보류한다.
브랜치 dev/bootstrap / HEAD56fd3563e031ef1850e88b4fdac0c39ead08eea5, 기존 dirty 작업 보존.
모델/문구/정책/임계값/공공안내 제외/예산/FP32 CPU2/1은 유지한다.
직전 최종 실행본을 artifacts/embedding-precompute-20261022/before-runtime/에 동결했다.
기존190입력의 labels/pixels를 유지하고 SHA표기만 정규화했다. 첫 진단은 일부 inputSha256
없는 manifest 행 때문에 스캔 이전 중단됐으며 원시 실패 로그와 보정 근거를 protocol에 보존했다.
구간계측은 별도 profile bundle, 정식 N5 교차측정은 비계측 runtime으로 실행한다.
초기 N1 고정문구 계산0.50~0.70초, 저해상도6은 vision 초기화/추론이 더 크다.
현재 source에 text-reference-data validator와 생성기/사전계산본을 연결하고 build시에도 검증한다.
같은4개batch 원시기준20벡터15360성분 재생성 차이0, 규정허용오차1e-5.
초점13tests/전체690passed1skipped(93파일)/typecheck/full lint 통과. 정식 품질/성능/메모리 비교는 아직 완료 전이다.
최초비교서버가 Content-Length를 누락해 원본 대신 screenshot fallback을 실행했고 knownNormal의
콜론쿠폰1건이 byte-limit으로 수집 제외됐다. 크기헤더 유무 진단으로13/14 vs14/14를 재현했고
제품코드/예산은 그대로 두고 기존fixture와 헤더를 맞췄다. 최초4정상완료receipt와실패/워밍업은
attempt1-runs/warmups에 전부보존, source-identity-attempt1/protocol보정도보존했다.
benchmark-final.log로 새90+2 전체재실행 중이며 도구session14707이다. 초기profiles도
initial-profiles-without-content-length/로 보존했고 정식종료 후 올바른헤더로4profile을 다시
실행해야 한다. 새정식32receipt시점 양성/정상/점수동일성을 관측했다. 별도ML작업과Chrome
부하가 있어 전력/온도/ambient는통제불가이며 N5쌍별산포를보고한다.
원시 runs/warmups는 /mnt/nas/illegal-ad/validation/embedding-precompute-20261022/이고 repo symlink다.
기존 NAS 모델을 그대로 사용한다. 루트 여유1.3GB였으며 임의 삭제하지 않았다.
다음: 전체tests/lint 완료 확인 → 반복비교90receipts+2warmups → summarize.py 수치/판정/공식원본/
sourceidentity 감사 → 보고서/이 인계 최종 갱신. 기존 BUTTER 극단축소 미탐은 유지/명시한다.
commit/push/PR/설치/배포/외부능동탐색은 하지 않는다.


### 2026-10-22 FP32 사전계산 최종 검증 및 UI/UX 우선 전환

고정20문구/4개batch를 canonical createEncoder로 사전계산했다. src/text-reference-data.ts는
정확한문구·순서·정책SHA·모델manifestSHA·내용SHA·768차원/정규화를검증한다.
scripts/prepare-embedding-references.mjs 및 npm run prepare:embedding-references로 명시생성,
build-ocr-worker가 같은validator로검사하고 text-embedding-data/text-references.json을배치한다.
런타임은파일검증후모델을초기화하며고정문구추론5회를제거했다. OCR·정책·FP32·CPU2/1·기존예산불변.
마지막비교90+2warmups와올바른헤더의4profile완료, summarize.py 감사통과.
190입력 모든판정동일; 실제60양성60→60, 실제정상74오탐0→0, 별도18양성17→17/38정상0→0.
기존BUTTER극단축소1누락유지. 반복540관측, text302/image44보조사용 모두available,
1044점수성분의전후/반복최대차이0. 참조20벡터15360성분도차이0. sourceidentity214파일통과.
대표4묶음 N5 전후전체초중앙값: 저해상도6 20.210→20.168, 파생GIF3 1.759→1.994,
기존새양성5 5.914→5.274, 기존새정상6 3.012→2.741. 쌍별차이중앙값 각각−0.248,+0.081,
−0.571,−0.307초지만모든묶음에양음혼재라명확한속도우위주장없음. 별도ML/Chrome부하미통제.
OCR peak VmHWM 중앙MiB 2204.7→2173.6/497.6→491.9/1413.6→1388.7/1125.3→1090.7,
메모리쌍별차이도부호혼재. 전체RSS합은공유페이지중복이며25ms관측peak다.
정식profile 고정문구378.69/490.66ms→로드검증2.04/5.20ms, 저해상도imageforward합11.7~11.9초.
최종 build:scanner/typecheck/full lint/690passed1skipped/초점13passed/diffcheck 통과.
보고서 docs/EMBEDDING_PRECOMPUTE_20261022.md, 원시/summary/audit/protocol/env은
artifacts/embedding-precompute-20261022/. 최초실패시리즈·진단도보존했다.

사용자 최신지시: UI/UX 다듬기 및 최적화가1순위, Windows는내일 진행. 활성goal에이를등록했다.
이제실제화면을확인해 간단·고급 시작/진행/결과·키보드·가독성/반응성을 개선한다.
특히기본탐지0+추가이미지양성일때간단모드에서후보가가려지지않는지 실제replay로확인할예정.
현재 UI 소스는 아직 이성능작업에서수정하지않았다. 다음은기존web빌드/현재화면스크린샷을
신규UI증거디렉터리에보존→근거기반수정→웹행동/반응형/메모·원본보존검증이다.
양자화·Windows·설치·배포·제출·commit/push/PR은미실행이며승인범위에추가하지않는다.


### 2026-10-22 UI/UX와 성능을 같은 최적화 목표로 통합한 후속 수정

사용자 정정: 진행 중인 성능비교도 최적화의일부이며 UI만으로범위를축소하지말것.
FP32사전계산의190입력/90N5receipt감사는완료했고 UI/UX와함께목표를진행했다.
이단계에서 backend/가중치/임계값을추가수정하지않았다.

수정: 간단모드 문구0+추가6에서첫화면빈목록을보이던문제→추가후보자동표시,
문구/배너·추가건수분리, 느린조회시사용자선택우선. 후보가있는간단모드의중복전체OCR
목록/조회1→0제거, 고급전체기록유지. 저장된기본elapsed만보여00:00이던화면은
세션progress와max로추가분석포함시간표시(원본불변). finalizing에추가단서분석중명시,
숫자는문구탐지로표시. 최초모드선택가독성/선택상태, 간단연결설명, h1초점너비개선.
320px배너근거가로값폭88→256px(구조 .evidence >div세로배치)로한글잘게끊김해결.

UI증거 artifacts/ui-polish-20261022/{before-build,before,after,before-banner,after-banner}/.
현재모델검증의실제6배너rawanalysis/PNG투영을UIfixture로사용했고, 그래프/creative색인은
생략했다. 계약검증/외부차단/원시PNG SHA확인. native아닌Tauriadapterreplay다.
617건/211페이지/1366×768 첫3행759.875px유지,360px회귀및320/768/1024/1440넘침0.
키보드Enter로근거열기, 메모모드전환/필터·관계복귀, XLSX618행+메모/JSON바이트보존,
mode재실행기억, WARP0/외부요청0/pageerror0관측. 웹152passed22파일/typecheck/lint/build통과.
완료로그 *final-complete.log 및test-web-final-complete.log, source-identity/audit는아래생성.
UI부분의새assert일부실패는시각적으로숨긴목록을DOM부재로오인/aria공지2초합치기를
너무일찍검사한테스트가원인이었고기존정책을유지해상태/시점을검사했다. 중간구문/selector
실패도보존했으며최종결과에포함하지않는다. 보호DOGFOOD/문서superpowers는수정안함.

상세 docs/UI_ADOPTION_KO.md 마지막절, 성능 docs/EMBEDDING_PRECOMPUTE_20261022.md.
Windows는사용자요청대로내일, 양자화는이후검토다. 설치/배포/제출/commit/push/PR미실행.
다음사용자지시에서이검증을기준으로추가UI/성능작업또는Windows를진행한다.


최종 UI감사: artifacts/ui-polish-20261022/audit.py 실행완료. 현재 UI소스/전후빌드30파일과
80증거파일SHA를보존했고, FP32검증의backend214소스SHA도그대로일치했다.
고급시작상세설정1366/320px도스크린샷확인/가로넘침없음/기본연결확인했다.
마지막제품UI변경뒤 웹152tests/22파일/typecheck/full lint/build 및6배너/617건replay통과.
로그 test-web-final-complete.log/typecheck-final-complete.log/lint-delivery.log/
build-final-complete.log/after-banner-advanced.log/after-modes-final-complete.log.
전후URL/모델/정책/원문/PNG/JSON/메모보존, 190입력점수·판정유지근거와 UI최적화근거를
함께전달한다. 이번범위의수정·통합·검증은완료했으며남은기존극단축소1누락/공유부하에따른
성능불확실성은보고서에명시했다. Windows는내일사용자지시에따라별도진행한다.

### 2026-10-22 Gemma INT8 양자화 비교 진행

사용자가 양자화를 새로 승인했다. 기존 FP32 최적화와 UI 개선 상태를 기준으로
동일190입력/29묶음을 고정하고, actual60/60 및 actual정상74오탐0, 파생양성17/18와
파생정상38오탐0, 원문/프레임/판정 보존을 요구한다. Windows는내일, commit/push/PR/배포 미승인.
새 evidence artifacts/embedding-quantization-20261022/, 원시receipt·모델은 승인NAS다.
FP32를 먼저전체재실행했고 before-runtime/source를 동결했다. 오래된 모델 참조 symlink는
기존FP32 NAS stage에고정해 새dist 변경과 분리했다. 초기 setup의 python명령오류로
이전precompute before-runtime이덮였으나 retained lowres after-runtime에서 원본SHA
08f5af5a/3e8fb728를검사해 즉시바이트동일복구했다. 과거receipt/입력/가중치변경없음.

후보: 같은daa72c... checkpoint의 upstream quantized text/vision, SHA/크기확인.
실제그래프 MatMulNBits 8bit/block32와GatherBlockQuantized, float입출력/일부float연산;
정적activation calibration·학습없음. CPU2/1, OCR/임계값/공공안내제외/예산불변.
동일20문구와52이미지(26고정원본/파생pixel+shuffle)참조만다시계산했고 source/inputSHA확인.
참조코사인최저 text0.9999157/image0.9950089, 사전한계0.95이내.
새text/image int8모델ID는v3정책에서만TS/Rust허용하고 f32저장기록은기존대로읽는다.
현재 canonical 소스/후보build는INT8이며 최종 채택은 진행중인90receipt 감사뒤확정한다.

기존6저해상도초점후보는6/6유지. 초점16tests/Rust8tests통과.
UI는근거버튼번호/aria-controls, 긴원문만접기(짧은원문기존즉시표시), 원문바이트보존.
웹152tests통과/320~1440px넘침없음/지연조회0/실제6배너fixture확인.
artifacts/.../ui는FP32동일receipt로UI전후를비교했다. 후보성능동시부하를피하려고
formal paired N5 중에는owned다른테스트/브라우저/모델을돌리지않는다.
현재 benchmarks/embedding-precompute.mjs에명시적EMBEDDING_BENCH_DIR/--measure와
동결덮어쓰기거부/realpath고정을추가했다. 양자화신규경로에서90+2warmups실행중이다.
다음: 190입력엄격판정/OCR/프레임/점수 drift<=0.08, 반복<=1e-5감사→N5시간/메모리판단→
전체회귀/새INT8receipt UI replay/기존617행흐름→보고서·최종handoff. 점수한계는실행전고정했고
임계값이나참조사례를평가결과에맞춰조정하지않았다. 보호DOGFOOD514/4 그대로.

양자화후보변경: 전체INT8에서BC.GAME의거의0인문자margin이부호를바꿔4xOCR선택/판정경로가
바뀌었다. 탐지는유지됐으나약5.49초의이미지fallback이추가되어사전보존gate실패로기각했다.
원시부분시리즈28receipt+warmups는int8-both-runs/int8-both-warmups에보존했고
int8-both-source snapshot/runtime/protocol/sourceidentity도보존했다. ownedbenchmark트리만중지.
이후같은품질·수치한계/입력·참조원본·임계값을유지하고text FP32+vision INT8 혼합후보로변경했다.
새manifest/cache명 embeddinggemma-2-text-f32-vision-int8, 새NAS embeddinggemma2-f32-text-int8-vision-...,
이미지근거ID embeddinggemma-2-image-text-f32-vision-int8. 문자경계판정은FP32로보존한다.
현재동일52이미지참조재계산중이며그후후보build/knownBlacktoon근거보존비교/전체190+pairedN5재시작예정.

혼합참조완료: text20벡터15360성분maxdelta0, image52최저cos0.9951480(고정한계0.95),
manifest9d209df.../image벡터hash2284eaf... . knownBlacktoon18 원문/대체원문/판정/프레임동일.
같은BC.GAME4x원문직접probe: FP32+0.0006152613→전체INT8−0.0000765616, 0경계부호반전확인.
순수text±imageINT8실험의최종양성유지만으로채택하지않고경로/시간회귀까지걸렀다.
현재혼합25비성능묶음170입력quality를앞서완료한FP32baseline과검사중이다. 불필요한FP32전체반복은
재사용하고, 성능대표4묶음20입력은새로운FP32/혼합pairedN5(40receipt)+2discardedwarmups로비교한다.
즉90논리receipt(비성능25×2+시간4×5×2), 메모리25ms샘플링은새40시간receipt에만있다.
이측정계획수정은혼합후보평가전protocol에기록했고품질/수치gate는완화안했다.
혼합집중image실행1test와참조3test통과. 계약test추가시V1에새V3전용model을붙이는테스트구성
실수가1건있었고잘못된assert위치를교정해12계약test재통과; Rust8통과. 제품validator는유지했다.

### 2026-10-22 양자화·UI 최종 완료

현재 canonical은 문자FP32 + vision8bit weight-only. 전체INT8은기각했고
캐시/자료/실행본/int8-both-*를보존했다. 새manifest fingerprint9d209df...,
text참조20성분차이0/image52최저cos0.9951480, 이미지ID embeddinggemma-2-image-text-f32-vision-int8.
동일190입력/29묶음 최종90논리receipt(25품질×2+4시간×5×2)/별도2warmups감사통과.
실제60/60탐지·정상오탐0/74, 파생17/18·오탐0/38; 기존BUTTER극단축소1누락유지.
모든OCR/대체OCR/프레임·시각/판정경로동일. 540관측/1044점수비교最大0.006846605,
문자0/반복0, text302/image44보조모두available. 모든고정입력SHA와공식JSONwithin-scan불변.

N5전후전체초중앙: 저해상도6 15.900687→15.933385, 파생GIF3 1.590997→1.579425,
기존추가배너5 4.827040→4.825346, 실제정상6 2.392286→2.358987. 모든時間쌍별차이부호혼재:
속도개선주장없음. 저해상도childHWM중앙2181.1→1778.5MiB(−18.46%), 쌍별−408.3~−323.5MiB.
전체트리RSS중앙2383.8→2000.1MiB(공유중복). 다른3묶음memory는부호혼재이므로개선주장없음.
고정6모델/토크나이저자산1.788→1.312GB(−26.6%), 설치파일/실점유량측정아님.

마지막감사에서FP32저해상도rep3 SMILE만PNG컨테이너SHA35cf.../원본4a50...가달랐다.
소유loopback locator screenshot으로정확한35cf...파일을재현해원본과RGBA/actual·shuffle텐서가
바이트동일함을확인했다. capture-parity.json/두PNG/검증스크립트보존. rawreceipt/자산SHA수정없음,
감사에서이입증된쌍만픽셀동등으로비교한다. 수집경로변동은전체시간에포함했다.

전체회귀 KRDS_TEST_UNSANDBOXED=1 npm test:696passed1기존skipped(93파일), Rust공유근거8passed,
scanner/webbuild/typecheck/lint/diffcheck통과. 첫fulltest는기존시험용샌드박스설정누락으로102실패;
제품격리유지하고소유fixture설정으로재실행했다. 실패로그보존, 회귀숫자에섞지않았다.
UI반복접기확인은버튼이름변경후옛이름locator를찾던시험실수를고유aria-controls로교정했다.
현재sameFP32 receipt UI전후와선택양자화실제receipt UI연동모두통과:
후보6/문구0즉시표시, text-f32/image-text-f32-vision-int8실제ID확인, 근거조회열기전0,
키보드개별열기·닫기,긴원문전체/원시PNG보존,4너비넘침0,320값너비256px.
617건모드/메모/관계복귀/JSON바이트/XLSX618행보존,3행759.875px/360넘침0/WARP0/pageerror0.

보고서 docs/EMBEDDING_QUANTIZATION_20261022.md. 모든원시/기각/감사/환경/이미지/로그는
artifacts/embedding-quantization-20261022/ (큰파일승인NAS). 실제공개사이트재수집·새독립원본GIF·
cold설치·Windows는미검증이다. 현재사용자가요청한양자화비교와UI정리는완료했다.
Windows는내일사용자지시에서진행; 배포/제출/commit/push/PR미실행. branch dev/bootstrap /
HEAD56fd3563e031ef1850e88b4fdac0c39ead08eea5, 사용자기존dirty변경보존. 보호DOGFOOD514/4불변.

최종delivery-audit.json: 측정소스77SHA/원시receipt90SHA/전후고정자산12SHA/추가UI·전달파일251SHA확인.
실제선택된모델ID2종/UI6건/617행흐름/696passed1skipped/Rust8을재확인했다.
최종lint/diffcheck통과, tracked dirty92로기존범위보존. 이후코드·모델·자료변경없이전달한다.


### 2026-10-22 이미지 처리 지연 최적화 진행

최신 요청은 정확도/원문/프레임/판정 경로를 유지한 이미지 처리 시간 단축과 UI/UX다.
Windows는 내일, commit/push/PR/배포/제출 미승인. branch dev/bootstrap /
HEAD56fd3563e031ef1850e88b4fdac0c39ead08eea5, 기존 dirty92파일 보존.
현재 양자화 기준은 FP32문자+8bit vision이며 자산/참조20+52/임계값/예산/공공안내 제외 불변.
새 증거 artifacts/image-latency-20261022/, 원시실행은 승인NAS 동명 validation 경로다.
수정 전 source/runtime/실측 baseline과 별도 진단 profile을 먼저 동결했다.
저해상도6개 profile16.058초 중 vision4회9.754초/workerCPU19.515초, 전처리0.090초였다.
두 비교시리즈의 유효N5에서 vision2/4/6/8 thread 중앙16.002/12.038/10.937/10.419초;
별도8/12/16은10.504/11.233/11.343초. 원문/경로 동일, 전자 점수차0/후자最大5.53e-8.
현재 canonical runtime vision만 Math.min(8, availableParallelism())로 변경했다.
문자/참조생성2/1 유지. 모든 original/shuffle forward 유지; 전체190 및 대표4묶음N5는 진행 중.
2/4/6/8시리즈 round4는 extension build 준비0.2초 미만이 t2와 겹쳐 전부 제외하고
새 round6을 추가했다. raw는 보존했다. setup bundle CWD의 주석 차이는 canonical CWD로 고쳐
t2 worker가 수정 전 SHA와 정확히 같음을 확인했다. 잘못된 profile CLI 인수 순서 실패도
로그로 보존하고 --profile after로 교정했다. 과거 실행/원시 결과/자산 덮어쓰기 없음.

UI는 간단 모드의 동일 안내/진입URL 중복을 제거하고, 서로 다른 하위 페이지 주소는 유지한다.
이미지 근거에서 관측 연결 주소를 평문으로 표시한다(자동 방문 없음). 같은6배너 replay에서
첫3카드 하단1575.64→1273.14px/문서2988→2339px, 320~1440넘침0/320값너비256px.
지연조회0/원문·PNG/키보드/모드·617건JSON/XLSX 흐름 통과. 작은 UI test5개와 실제 이미지
판정·deadline 후 정상광고 회복·native image 연산 중 취소 통합1 test 통과.
다음: 진행 중 canonical 전체190/N5를 엄격 감사→새 profile 병목 비교→전체 회귀/실제 결과 UI→
상세 보고서·최종 source/asset/receipt 감사. 보호 DOGFOOD514/4 불변.


### 2026-10-22 이미지 지연 최적화 최종 완료

현재 canonical vision만 최대8intra/1inter(availableParallelism cap), 문자/참조생성2/1 유지.
190입력 전체 전후90formal receipt 및 대표4묶음각5회 완료. source/runtime/model/input/ref/
원문·대체OCR/프레임·시각/출처·연결주소/판정경로 strict비교통과,1044점수비교最大0.
실제60/60·정상오탐0/74, 파생17/18·오탐0/38. 기존BUTTER극단축소1누락은유지했다.
PNG컨테이너차이이번0, 실제획득assetSHA/RGBA를타이머밖에서receipt에기록했다.
저해상도6전체초중앙15.934698→10.388044(−34.8%), 모든쌍−5.670~−5.496초.
다른3묶음 초중앙: GIF1.566402→1.567049/추가배너4.847444→4.828046/정상2.356493→2.362692.
해당경로의작은차이는이미지pool변경효과로주장안한다. childHWM1778.4→1776.8MiB,
쌍별−20.97~+5.73MiB로메모리우위주장없음. 별도진단vision4회9.754→4.168초,
workerCPU19.515→33.303초증가를명시했다. 6개스레드설정중이기기최선이며범용최적해아님.

전체실행중상위exec37994가SIGTERM/143으로종료,원인미확인. 메모리미완료
freshPositive-after1건은interrupted/보존후제외했고,완료기록은변경하지않고
resume.py로원래순서남은작업만완료했다. 첫lint의새receipt코드Buffer전역2곳은
명시적node:buffer import로교정했다. measured-harness/sourceidentity를보존하고
이import1줄외코드동일·globalBuffer와생성자동일검사했다. 타이머/제품코드/수치불변.
UI 집중은5tests(진행기록6오기는교정), 실제image모델1test통과.
전체 KRDS_TEST_UNSANDBOXED=1 npm test 696passed/1기존skipped/93파일,
typecheck/lint/scanner·webbuild/diffcheck통과. 이번Rust/Windows/설치미실행.
최종canonical결과 ui-selected replay/6후보/실제modelID/관측주소평문/원시PNG/원문/
617건모드·메모·관계·JSON·엑셀보존통과. UI3카드하단302.5px단축/문서649px감소.

보고서 docs/IMAGE_LATENCY_OPTIMIZATION_20261022.md, raw/환경/후보별실행/중단/감사/캡처
artifacts/image-latency-20261022/; 큰원시자료 /mnt/nas/illegal-ad/validation/image-latency-20261022/.
source82·측정harness/identity·frozen26파일·model6자산·formal90receipt 해시감사를 완료했다.
raw 실행/중단/profile/warmup도 delivery-audit.json에서 해시로 연결한다.
branch dev/bootstrap / HEAD56fd3563e031ef1850e88b4fdac0c39ead08eea5, 기존 dirty92범위보존,
보호 DOGFOOD514/4 유지. Windows는내일사용자지시에서진행한다.
최적화완료를Windows호환/기관수용/모집단정확도/배포가능으로읽지않는다.
새원본GIF/저코어속도/Windows·설치/외부능동탐색/배포/제출/commit/push/PR미실행.


### 2026-10-22 OCR/CPU 최적화 진행

최신 요구: OCR 병목/중복 연산 제거, 정확도/원문/판정/GIF 프레임 보존.
Windows는내일, commit/push/PR/배포/제출/외부능동탐색미승인. branch/HEAD/dirty92보존.
artifacts/ocr-cpu-20261022/에 cap8 기준 source/runtime/실측 baseline을 먼저 동결했다.
동일190입력 고정,1e-5점수한계/원문·대체원문·confidence·frames/times/경로는strict일치요구.
새 benchmark EMBEDDING_CPU_TIME=1은 GNUtime user+system(브라우저/네이티브/OCR/재수거된자식합)
측정이다. scanSite벽시계와 별도이며 startup/receipt작성도CPU에포함한다. 메모리25ms샘플동일.
프로파일에서213.9ms확률검증+17.4ms CTC중복순회와352ms보간을확인했다.
확률 검증을mask/CTC소비순회에합치고 NaN/Inf/비선택확률도전부검증한다.
x축보간좌표를행마다다시계산하지않고재사용,입출력tensor를finally에서dispose한다.
308보간텐서바이트동일(154bounded PNG×2ROI)/CTC invalid·tie·repeat2test/UI집중5test통과.
최신6배너 recognizer입력73개는중복0이므로추측성캐시는추가안했다.
초기20formal N5 latest6/newPositive6에서원문/점수동일. latest전체10.359→10.099초,
CPU42.60→42.24초(5쌍모두감소); newPositive는작은차이/부호혼재로개선주장없음.
전체native arena ON은별도N5 12요청OCR CPU3.518→3.125초이나RSS+214MiB로기각했다.
recognizer-only도속도/CPU우위없고+52MiB로기각. 최종arenas OFF/vision cap8/text2/1유지.
첫 profile 후보는외부startup부하와긴main session준비관측으로전체14.46초였고
제품성능결론에사용하지않았다. CPU/모델init 원인 전체는 미확정; raw diagnostic1 보존.

간단모드에저장된대체OCR원문접기를추가해고급모드전환없이비교가능하게했다.
실제web build 키보드원문보존/조회0/320~1440넘침0 및617건모드·메모·JSON/XLSX통과.
목록밀도는유지목표로별도UI_POLISH_LAYOUT_GOAL=preserve; 과거200px축소기준기본값유지.
현재최종 after-profile 별도진단→98formal(29묶음중24품질전후+5묶음각N5) 나머지실행중.
초기20개는동일최종실행본에서재사용, 남은78은resume.py로원래순서실행한다.
다음: 전체190+N5 CPU/시간/메모리감사→전체회귀/최종문서/해시감사.
보호 DOGFOOD514/4·superpowers문서는수정하지않았다.


### 2026-10-22 OCR/CPU 최적화 최종 완료

최종 canonical은 PP-OCR 확률 검증을mask/CTC순회에합치고 x보간좌표재사용·입출력tensor
finally해제를 적용한 구성이다. cap8 vision/FP32text2/1/neural1/1/arenas OFF, 모든모델·참조·
스케일/CTC경계/confidence/정책/예산/GIF프레임·시각/공공·일반광고제외를 보존했다.
190입력/98formal receipt(24품질묶음전후+5시간묶음각N5)/1200점수성분비교maxdelta0.
실제60/60·정상오탐0/74, 파생17/18·오탐0/38. 기존BUTTER극단축소1누락 유지.
모든OCR/대체원문·confidence/프레임·시각/출처/연결주소/판정경로 같음.
보간308tensor byte동일,73canonical recognizer입력 hash·순서동일.

동일8스레드 기준 pairedN5 저해상도6 중앙전체10.358801→10.099240초(−2.51%),
CPU42.60→42.24초(−0.85%,5쌍모두−0.74~−0.11초), workerVmHWM1774.4→1728.1MiB
(5쌍−64.91~−35.61MiB). 추가5배너 CPU5.95→5.82초/전체4.823737→4.763506초.
추가6배너/GIF/정상광고의부호혼재작은변동은개선주장없음. CPU는GNUtime user+system
Node+reaped children/native threads로startup/receipt작업도포함(벽시계타이머와범위다름).
CPU절감은작으며vision추론이여전히주요CPU비용이다. 두arena후보는+214MiB/+52MiB비용으로기각.
별도profile PP-OCR3.929→3.702초,보간352→273ms,값검증+영역+CTC308→157ms.

UI간단모드에서대체인식원문details접기/원시문구보존/키보드/추가조회없음을검증했다.
목록3카드하단1273.14px/문서2339px유지,320~1440넘침0/320값256px,
617건모드·메모·관계·JSON/XLSX618행보존/외부0/WARP0/pageerror0통과.
최종전체699passed1기존skipped(95파일), typecheck/lint/scanner·webbuild/diffcheck통과.
추가CTC2test와native-invalid-output후tensor-disposed/queue회복1test를포함한다.

첫full회귀2실패중UI는대체원문이DOM에없어야한다는옛기대값을새접기계약에맞게바꿨다.
선택원문은접히지않고대체원문만닫힌details에있으며backend정보는고급에유지한다.
다른1건은수집기존9페이지시험관측15→14 변동(고유OCR7유지). 수집/GIF코드는수정안했다.
단독27tests통과,동결before/after각3회모두관측15/OCR7. 최초변동원인미재현·미확정,
영구수집수정으로해결했다고주장하지않는다. 기존기준유지한최종full회귀는통과했다.
원래실패·격리재현·재실행로그보존. 일부sourceidentity에없던기존UI시험을추가해최종85소스,
측정당시84목록은별도보존하며모두현재와hash일치. 제품runtime동결후변경없음.

보고서 docs/OCR_CPU_OPTIMIZATION_20261022.md; evidence artifacts/ocr-cpu-20261022/,
원시 /mnt/nas/illegal-ad/validation/ocr-cpu-20261022/. source85/runtime/모델9/98formal/
CPUsidecar·profile·기각후보·tensor·UI·문서해시를최종delivery-audit.json으로검증해전달한다.
branch dev/bootstrap / HEAD56fd3563e031ef1850e88b4fdac0c39ead08eea5, 기존dirty92보존,
보호 DOGFOOD514/4·superpowers불변. Windows는내일사용자지시에서진행한다.
Rust/설치/Windows/기관·사람·AT/배포/제출/commit/push/PR/외부능동탐색미실행.

### 2026-10-22 Gemma 비전 CPU 최적화 진행

사용자 요청: 이전 전체 CPU 절감0.8%를 넘어 비전 인코더 병목을 먼저 측정하고,
같은190입력에서 정확도/선택·대체 OCR/판정/GIF 프레임을 유지하며 wall/CPU/메모리를 비교.
Windows는 내일, commit/push/PR/설치/제출/외부 능동 탐색은 범위 밖이다.
branch dev/bootstrap, HEAD56fd3563e031ef1850e88b4fdac0c39ead08eea5 그대로.
92 tracked dirty/52 untracked의 기존 상태는 artifacts/vision-cpu-20261022/initial-state.txt에 보존.
현재 cap8+최종OCR 최적화 worker를 before-runtime에 동결, 수정 전 warmup과 latestPositive baseline 실행 완료.
입력190/29묶음, SHA eb1572b6162e76790ae477d921ae5ee1b96789bb7370add137c78a9f3a3e8ad3,
절대 점수 허용1e-5, 모델/정밀도/참조20+52/임계값/전처리 리사이즈/셔플1701/예산 고정.
원시결과는 승인 NAS /mnt/nas/illegal-ad/validation/vision-cpu-20261022/와 연결했다.

Native ORT 연산 프로파일에서4 forwards 약4.35s/34.77CPU-s, 연산 wall 합계의
MatMulNBits 약2.133s, MultiHeadAttention 약1.164s를 관측했다(프로파일 별도, 정식성능 수치 아님).
로컬 타입 주석의 extra 설명과 달리 **ORT1.30.0 Node native binding은 extra를 지원**한다.
해당 버전 공식 session_options_helper.cc 및 설치 바이너리의 native validation을 확인했다.
스핀 OFF는 N5 CPU34.785→31.273s, wall4.352→4.690s여서 대기시간 증가, 채택 안 함.
짧은 스핀/동적블록 조합·자동 스레드 후보도 별도 보존; 자동은 이 호스트에서 cap8보다 CPU 증가.
preprocessPng는 그대로 두고 valid patch prefix만 전달하는 후보에서 두 실제 배너×원본/셔플의
특징값이 N5 바이트 동일; 2520→2430패치로 해당 native 구간 CPU33.852→32.449s,
wall4.234→4.062s. 유효 픽셀/포지션/해상도를 줄이는 변경 아님.
trim N0의 일부는 UI baseline replay와 겹쳐 버림; 정식 N1 시작은 UI 종료 뒤(파일 시각 증거).
현재 실제 전체점검 latestPositive N5에서 before/t8-trim/t6-trim/t5-trim 교대 비교 중.
아직 최종 선택/190회귀/최종 수치/Windows 준비 완료로 판단하지 않는다.

UI는 결과의 관측 연결 주소를 외부 방문 없이 복사, 실패 시 직접 선택 안내를 추가 중이다.
복사 boundary mock을 사용하는 UI 시험과 실제 browser replay를 추가/갱신했으나 아직 실행 전.
다음: N5 후보 종료→수치/판정 비교→CPU/지연 tradeoff 명시해 최소 변경 채택→canonical rebuild,
190입력 회귀+5묶음 N5/프로파일, UI 브라우저, typecheck/lint/전체테스트, 최종 보고/인계.

### 2026-10-22 Gemma 비전 CPU 최적화 최종 완료

현재 dev/bootstrap/HEAD56fd3563e031ef1850e88b4fdac0c39ead08eea5 유지, 기존 dirty 변경 보존.
최종 canonical runtime: FP32 text2/1 + 기존8bit weight-only vision min(6,availableParallelism())/inter1.
image-preprocess의 resize/픽셀/정규화/셔플은 그대로이며 vision 입력의 trailing padding만 제외한다.
runtime만 softTokens*9 valid patch prefix를 전달한다. offline 참조 생성2520 계약은 유지한다.
유효2520상한/실제2430패치 사례의270soft token, 원본/셔플2 forwards와 GIF frame budget 모두 유지.
모델/정밀도/revision/참조20+52/임계값/예산/공공안내·일반광고·DOM 제외 규칙 변경 없음.

같은190입력/29묶음, 별도 후보선택N5 후 final98scan을 새로 교대 실행했다.
실제60/60·정상0/74, 파생17/18·정상0/38. 기존 derived-new-positive-butter 극단 축소1누락 유지.
원문/대체 OCR/신뢰도/판정 경로/출처/관측 주소/GIF index·시각·순서 동일,1200점수 성분 maxdelta0.
대표5묶음 pairedN5; 비전 부하 실제6배너 CPU41.99→35.00s(−16.65%),
wall10.024→10.342s(+0.318s,+3.18%), worker VmHWM1718.0→1704.2MiB(관측값).
CPU모든쌍−7.13~−6.24s,wall모든쌍+0.237~+0.387s. 속도·CPU 동시 개선으로 주장하지 않는다.
다른 비전 없는 경로의 미세 시간/CPU/메모리 변화는 개선으로 해석하지 않는다.

선택N5: 기존/cap8compact/cap6compact/cap5compact의 wall10.197/9.955/10.480/10.962s,
CPU42.43/40.40/35.48/32.92s. CPU 우선과 지연 증가를 함께 고려해cap6 채택.
Native operator profile에서 MatMulNBits/MultiHeadAttention이 주요 구간이며, padding-only 후보는
두 실제 배너×원본/셔플 특징4개가N5 byte identical. 별도 final profile의 유효 픽셀/위치SHA·
recognizer73입력SHA/모양/순서 동일. HW perf counters는권한4로미실행; cache원인단정없음.
스핀OFF/100us+backoff/동적블록/auto/force-stop 후보 raw와 산포 보존, product엔 추가안함.
이전Node extra미지원판단은정정: ORT1.30.0 native binding은지원하며 공식해당버전소스+binary확인.

UI: 펼친 이미지 근거에서 관측한 연결 주소를 복사하고 실패/미지원은 직접 선택 안내.
실제 주소·원문/대체원문·PNG/공식JSON/간단·고급 모드 보존, 주소자동방문없음.
320~1440px overflow0/320px 근거값256px/열기전조회0/WARP0/pageerror0/외부요청0.
목록 첫3카드하단1273.14px/문서2339px 유지. clipboard API만 테스트 stub, native clipboard미검증.
617건 모드/필터/메모/관계복귀/JSON바이트/엑셀618행 보존.

최종scanner/webbuild/typecheck/lint/diffcheck 통과,703passed/1기존skipped/95files.
초기 전체테스트 UI1건은 추가span 전의 parentElement 가정이라 closest(dd)로 수정,
관련33개/전체재검증 통과. 초기 lint 전역표기 실패도 수정했고 초기 로그 모두 보존했다.
최종worker5d4faf1bafc210186b026fe555a59e8c5ded10daf64789683bbf9c707d5ddff6 = frozen t6/after.
미사용offline compact 후보 코드를 제외해도 재빌드worker가같아 성능재측정은 불필요했다.

상세 docs/VISION_CPU_OPTIMIZATION_20261022.md; artifacts/vision-cpu-20261022/,
raw /mnt/nas/illegal-ad/validation/vision-cpu-20261022/. freeze/runtime/모델/입력/소스 해시는
delivery-audit.json/receipt-audit.json로 연결한다. 모집단 정확도/다른CPU 최적해/새원본불법GIF 증거는 아님.
Windows는 내일(2026-10-23), 설치/배포/제출/commit/push/PR/외부능동탐색은 미실행.
다음 사용자 조종 단계에서 Windows/다른CPU의 cap6 대기비용·nativeclipboard·메모리를 확인한다.

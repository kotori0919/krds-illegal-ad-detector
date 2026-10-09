# 수신팀이 유지할 계약

공식 결과, 내부 Case, 탐지 정책, 설치 산출물은 서로 다른 버전을 가진다. 앱 후보는 `0.2.0`, 탐지 결과의 `meta.tool_version`은 `0.2.0-policy2`, Case schema는 `1`, 설정 계약은 `configVersion: 1`이다. 탐지 규칙이나 중복 제거가 의도적으로 바뀌면 정책 버전을 올리고 기존 결과를 다시 해석해 덮어쓰지 않는다. 공식 JSON에 내부 버전 필드를 추가하지 않는다.

## 소유 경계와 데이터 흐름

`apps/web`은 `HostBridge`를 통해 스캔, 결과 읽기, Case 검토를 요청한다. Tauri API는 `apps/web/src/host/tauri.ts`에서만 사용한다. 브라우저 호스트는 재생/데모를 제공하며 로컬 스캔이나 파일 권한을 흉내 내지 않는다. ESLint는 브라우저의 Node/스캐너/탐지 런타임 및 패키지 내부 경로 의존을 차단한다. UI가 쓰는 evidence의 report/graph/similarity 경로는 명시된 순수 경계다.

네이티브 호스트는 URL/설정/경로/IPC를 검증하고 프로세스를 감독한다. worker가 `scanSite`의 실제 수집과 판정을 수행한다. detector는 프로세스 실행, 설치, 원격 설정, 임의 파일 권한을 받지 않는다. 새 extra 탐지는 [DETECTORS.md](DETECTORS.md)의 기존 zero-width contribution 경계를 사용한다. 모델은 기본 비활성이며 필수 설치 또는 공식 결과 생성의 조건이 아니다.

## 공식 JSON과 내부 증거

공식 UTF-8 JSON은 BOM 없이 `meta`와 `findings`를 가진다. meta는 `topic`(문자열 `TOPIC`), `entry_url`, `started_at`, `finished_at`, 유한한 비음수 `elapsed_sec`, 비어 있지 않은 `tool_version`이다. finding은 `id`, `url`, `is_violation`(boolean), `location`, `evidence_text`, `technique`이다. 공식 technique은 `OFFSCREEN`, `TRANSPARENT`, `JAMO`, `HOMOGLYPH` 네 개다. `ETC`와 extra 종류는 별도 `result_extra.json`에만 둔다. 현재 extra 이름은 contracts의 `EXTRA_FINDING_TYPES`에 선언한다.

같은 `(url, location, technique)`은 하나의 finding이며 `id`는 결과 안에서 고유하다. 공식 evidence는 관찰한 원문이다. 정규화 결과, OCR의 텍스트, 유사도, 운영자 메모로 원문을 바꾸지 않는다. location의 frame 경로와 leaf selector는 실제 관찰 프레임에서 재해석할 수 있어야 한다. 찾기 실패를 임의의 첫 DOM 요소로 대체하지 않는다.

공식 결과가 먼저 검증/저장된다. detail, OCR, extra, 그래프의 실패는 범위와 이유를 가진 issue로 남기며 이미 유효한 공식 결과를 무효화하지 않는다. `result.json`과 detail/extra/review를 합친 하나의 비공식 제출 파일을 만들지 않는다. 탐지 없음, 분석 불가, 제한 도달, 실패, 취소는 구분한다. 내부 evidence/detail 버전과 bytes 제한은 contracts의 타입과 `policy.json`이 기준이다.

TS `validateOfficialResult`와 native 검증은 `packages/contracts/test/fixtures/official-conformance.json`을 공유한다. 외부 입력은 타입 단언으로 신뢰하지 말고 해당 검증기를 통과시킨다. fixture는 계약의 양성/음성 경계이며 탐지 성능 표본이 아니다.

## 설정과 제한

`packages/contracts/src/policy.json`이 TS import와 native `include_str!`의 단일 빌드 입력이다. 실행 중 원격 URL에서 교체하지 않는다. `validateScanLimits`와 `validateScanConfiguration`은 알 수 없는 키, 소수/비유한 값, 범위 밖 값을 거부한다. IPC `scan_start`/`scan_start_batch`에는 `configVersion: 1`이 필수이며 TauriHost가 채운다.

| 운영자 제한 | 기본값 | 허용 범위 |
| --- | ---: | ---: |
| maxPages | 200 | 1–2000 |
| maxDepth | 4 | 0–10 |
| timeoutSec | 1500 | 60–1500 |
| maxFrameDepth | 4 | 0–4 |

worker의 개발/fixture 명령만 `timeoutSec` 1초 이상을 허용한다. 이것은 운영자의 1500초 상한을 늘리는 우회가 아니다. 동시성 기본 2/범위 1–4와 settle 기본 1500ms/범위 0–5000ms도 설정 검증에 속한다. 메모리, DOM/frame/resource/visual/evidence/graph 제한, network 경계, 저장 정책과 모델 활성 여부는 내부 정책이며 원격 호출자가 바꿀 수 없다. 각 작업의 유효 설정과 정책 버전은 Case manifest에 기록한다. `config-conformance.json`의 동일 fixture를 TS/native에서 검증한다.

worker CLI는 알려진 flag만 한 번씩 받고 숫자, URL, session ID를 검증한다. 잘못된 인자는 exit 2이며 스캔을 시작하지 않는다. 테스트의 Chromium sandbox 예외는 `tests/browser-fixture.ts`에서 Vitest에만 적용한다. 제품 worker에는 그 예외를 전달하지 않는다.

## 진행과 종료

worker stdout은 공식 JSON 전용이다. stderr의 `KRDSPROGRESS ` 다음 한 줄 JSON은 `kind`, nullable `message`/`pageUrl`, `progress`이다. `KRDSISSUE `는 `code`, `scope`, `retryable`을 담은 선택 산출물 실패 신호다. native는 worker 세션에 속하는 이벤트를 `ScanEvent`로 전달하며 진단 문자열을 결과 JSON에 섞지 않는다.

`ScanProgress`는 sequence, 방문/실패/대기 페이지 수, 현재 페이지, 최근 활동, frame/element/candidate/finding 수, 경과 초, stage를 가진다. sequence는 세션 내 정렬 기준이다. 상태는 `queued → running → finalizing → succeeded`이며 취소/실패는 각각 `cancelled`/`failed`로 끝난다. 실행 단계는 discovery와 analysis가 동시 진행될 수 있으므로 UI가 방문 완료를 탐지 완료로 추정하지 않는다. 종단 상태 뒤 오래된 이벤트로 실행 상태를 되살리지 않는다. 결과는 `hasResult`와 실제 검증된 파일로 판단하며 프로세스 종료 코드만으로 저장 성공을 추정하지 않는다. 취소됐어도 유효하게 확정된 부분 공식 결과가 있으면 경고와 함께 보존한다.

## Case와 검토

Case manifest schema 1의 필수 값은 UUID `caseId`, entry URL, 시작/종료/`exportableAt` 시각, `succeeded|cancelled` 상태, tool/policy 버전, 공식 SHA-256, finding 수, issues, settings이다. evidence SHA-256는 있을 때 검증한다. 시각은 RFC3339다. 공식 결과에서 유도한 시각/tool/finding 수는 그 결과와 일치해야 한다. 원본/선택 증거/검토는 별도 파일로 보관한다. future schema, 무결성 실패, 잘못된 Case는 빈 결과로 취급하지 않고 명시적으로 거부/격리한다.

review schema 1은 `revision`, `updatedAt`, `records`를 가진다. 각 record는 기존 finding ID, `needed|reviewed`, `unjudged|suspected|judged-normal|needs-more-evidence`, 최대 2000 Unicode 문자 note, RFC3339 `at`이다. wire/disk에는 judgment가 필수다. UI 입력이 생략하면 TauriHost가 `unjudged`로 정규화한다. finding ID 중복 또는 알 수 없는 ID는 거부한다. 메모와 운영자 판단은 공식 `is_violation`을 변경하지 않는다.

저장은 expectedRevision 비교 후 다음 revision을 원자적으로 교체한다. revision은 JS 안전 정수 범위이며 최대값에서 추가 저장은 거부한다. revision 0/빈 records/빈 updatedAt은 아직 저장하지 않은 초기 상태다. 충돌 시 새 내용을 자동 덮어쓰지 않고 다시 연다. TauriHost는 IPC 응답을 unknown에서 검증하며 요청 Case ID와 응답 ID, 저장 후 revision 증가도 확인한다. `case-conformance.json`은 공식/manifest/review 양성과 변조 음성을 TS/native 양쪽에서 실행한다.

Case import/export/delete와 관리 백업/복원은 네이티브 경로 검증, bytes 상한, symlink/reparse 방지와 사용자 선택 경계 안에서 수행한다. 설치 경로와 사용자 데이터는 분리한다. [운영 안내](OPERATIONS_GUIDE_KO.md)의 진단 경로가 실제 저장 위치의 기준이다. 업그레이드/롤백은 [설치 레이아웃](INSTALL_LAYOUT.md)의 백업과 검증을 따른다.

## 계약 변경 확인

공식/설정/Case fixture와 native harness를 함께 실행하고, 실제 worker와 제품 저장/재열기 경로를 별도로 관찰한다. fixture 통과는 Windows 설치, UI 접근성, 외부 기관 인수 또는 공급망 승인까지 관찰했다는 뜻이 아니다. 결과에는 `OBSERVED`, `MEASURED`, `INFERRED`, `NOT_RUN`을 구분한다. clean-checkout 및 후보 manifest/해시 검증 명령은 [BUILD_MANUAL.md](BUILD_MANUAL.md)에 둔다. 앱과 런타임/worker의 서로 다른 build ID를 혼합한 설치는 허용하지 않는다.

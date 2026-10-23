# UX flow V2

## 2026-10-20 설계 초안: 모드별 업무 흐름

상태: 승인한 최초 범위의 소스 구현. 최신 Windows 패키지 수용과 다중 사례 통합·능동 탐색은 미완료다. 이전 설계 기준은 이후 절에 보존한다.
화면별 내용과 현재 구현/추가 개발 경계는 `SCREEN_SPEC.md`의 같은 날짜 절을 따른다.

### 첫 실행과 재실행

```text
첫 실행 → 모드 선택(간단 기본) → 시작하기 → 새 점검
재실행 → 저장한 모드의 새 점검
                               └→ 저장된 결과 → Case 재열기
```

첫 설정에 외부 서비스 등록을 끼우지 않는다. 저장된 Case를 열 때 재검사하지
않고 공식 원본·검토·근거를 읽는다. WARP가 없어도 저장 근거 조회는 가능하다.

### 간단 모드: 주소부터 보고서까지

1. **새 점검:** 주소 입력, 기본 범위·기본 연결 확인, `점검 시작`.
2. **진행:** 실제 확인 페이지·탐지·실패와 경과 시간 확인. 필요한 경우 중지.
3. **결과:** 기본 탐지 목록과 부분 점검 여부 확인. 추가 단서는 별도 수로 노출.
4. **검토:** 항목 선택→근거 읽기→판단·메모 입력→검토 완료·다음. 저장 상태 확인.
5. **보고:** 저장 완료된 검토를 기준으로 XLSX 생성→native Save As→실제 저장 경로.
6. **후속:** 앱 정상 종료→다시 실행→저장된 결과→같은 Case와 메모 재열기.

평가용 JSON은 결과 파일 보조 메뉴로 접근한다. 사용자가 고급 모드로 바꾸지
않아도 필수 출력에 접근할 수 있다. 저장된 검토는 공식 JSON의 is_violation이나
탐지 수를 바꾸지 않는다. 추가 단서는 현재 저장 계약상 판단·메모 편집 대상이 아니다.

### 고급 모드: 단일·일괄 점검

1. `새 점검 → 한 사이트/여러 사이트` 선택.
2. 주소 또는 대상 파일 입력→오류·중복과 사이트별 범위 확인.
3. 필요할 때만 상세 수집 설정·연결 방식을 변경. 기본값은 기본 연결.
4. 점검 시작→사이트별 상태 확인→완료된 Case의 결과 검토.
5. 기술 근거 확인 또는 인프라 분석으로 이동. 출발 Case를 유지.
6. 단일 보고서 또는 완료 대상의 통합 XLSX와 사이트별 공식 파일 생성.

일괄 진행 그룹은 대상·순서·caseId·진행 상태를 그룹 파일로 저장한다. 재시작 후
같은 묶음을 다시 열어 남은 대상을 이어서 점검하고, 완료된 대상의 저장된 판단·메모로
통합 XLSX를 다시 만들 수 있다. 저장된 결과가 없는 대상은 미완료로 표시하고 통합
보고서에서 완료로 계산하지 않는다. 복원은 네트워크에 접속하지 않는다.

### 고급 모드: 저장된 인프라 근거 분석

```text
현재 결과의 인프라 탭 또는 저장 Case 선택
  → 광고 연관 도메인 목록
  → 도메인 선택
  → 근거가 된 페이지·요소·자원·목적지 확인
  → 원래 탐지 근거 또는 관계도
  → 같은 도메인 행·검색 조건으로 복귀
```

이 흐름은 저장 기록만 읽고 새 네트워크 요청을 하지 않는다. 원본 페이지 열기와
주소 복사는 다른 동작이다. 광고 목적지 자동 방문은 없다.
역할·관계가 없는 경우 `기록 없음`, 읽기에 실패한 경우 `조회 실패`, 성공적으로
읽었으나 항목이 없는 경우 `관측된 연결 없음`을 구분한다.

추가 개발 후의 다중 분석은 `저장된 결과 → 사례 선택(초기 최대20개 제안) →
통합 인프라 분석`이다. Case별 출처·시점·분석 가능 여부를 보존하고 원본을 복제하지
않는다. 한 기관의 반복 점검을 여러 기관으로 세지 않는다. 관측되지 않은 다른
사이트 발견이나 광고 인프라 전체 수집을 약속하지 않는다.

### 선택형 WARP

```text
기본 연결 점검 → 완료/부분 결과/실패 → 기존 Case 보관
                                      └→ 사용자가 새 점검을 선택
고급 연결 설정 → 약관 확인·명시적 동의 → 등록 요청 → 등록됨
고급 새 점검 → 앱 전용 WARP 선택 → 점검 시작 → 터널 준비 → 사이트 점검
```

등록은 검사를 시작하지 않고, 등록됨은 터널 연결 중이 아니다. 설정을 여는 것과
동의 체크만으로 등록하지 않는다. WARP 미등록·구성 손상은 기본 연결 검사의
진입을 막지 않는다. 연결 방식 변경은 새 Case로 실행하며 자동 대체·재시도하지 않는다.
재점검은 최초 제공에서 같은 시작 주소·범위의 새 검사다. 실패 페이지들만 골라
복구하는 기능이 구현됐다고 설명하지 않는다.

### 상태·복구와 모드 변경

| 상황 | 화면과 다음 동작 |
| --- | --- |
| 주소 오류 | 해당 입력 옆 이유, 입력 유지, 첫 오류에 포커스 |
| 접근 실패 | 미점검 페이지·이유 표시. 기본 네트워크/주소 확인과 명시적 새 검사 |
| 일부 실패·시간 만료 | 보관된 유효 결과 검토, 범위 제한을 보고서에도 표시 |
| 사용자 중지 | 종료 정리 대기. 유효 결과가 있으면 부분 검토, 없으면 이유와 설정 복귀 |
| 기본0·추가0 | 확인 범위와 함께 관측0건 표시. 안전·적법 보증 금지 |
| 기본0·추가 있음 | 추가 단서 수·열기 제공. 빈 공식 결과만 보여주지 않음 |
| 근거 없음·분석 상한 | 원문·존재하는 근거 유지, 없는 이유·한도 표시 |
| 검토 저장 실패 | 편집 유지·재시도. 종료/최신 검토 보고서 생성 전 해결 |
| XLSX/JSON 취소·저장 실패 | 같은 결과와 검토에 머무름, 다시 저장 가능 |
| 고급→간단 | 같은 Case 결과, 공통 검색·검토 상태 유지. 고급 전용 필터 해제 안내 |
| 점검·중지·파일 저장 중 모드 변경 | 처리 완료까지 비활성화하고 이유 표시 |

모드 전환과 상세 복귀는 검토 writer를 새로 만들지 않는다. 새 점검만 새 세션을
만든다. 목록 복귀 시 호출한 행의 선택·스크롤·포커스를 복원하고, 행이 없으면
검색으로 보낸다. 인프라 분석과 Case 재열기는 같은 저장 원본을 사용한다.

## Earlier V2 flow baseline (2026-10-05)

Status: design freeze, 2026-10-05. `SCREEN_SPEC.md` defines content and responsive behavior.

## Canonical path

1. **점검 설정**: Focus URL. Operator enters a public-site address, reads the scope summary, optionally opens 상세 설정, then selects 점검 시작. Inline URL/limit errors keep entered values and move focus to the first error.
2. **사이트 점검**: The shell identifies the site and shows preparation → live page discovery/analysis → finalization with text state. Page collection and analysis overlap in bounded workers. A running clock and confirmed counters make progress verifiable. Recent activity shows meaningful findings and page failures, capped to a short list. 점검 중지 requires confirmation that the active scan will stop; UI waits for host settlement and returns to setup; cancelled sessions do not offer result export.
3. **결과 검토**: Once a result is persisted, the operator sees official findings, affected/checked pages, duration, partial failures, and separate extra-analysis count. They can filter by technique, search content or page, group by page, inspect many findings, view coverage failures, then generate `result.json`.

## Review loop

`공식 탐지 → 필터/검색 → 항목 선택 → 근거 확인 → 다음 항목` remains on one desktop workspace. Choosing another row replaces the inspector content. The selected row has a text/shape cue and accessible current indication. If a search/filter excludes the selection, the inspector closes and announces the reason beside the result count. Focus stays on the search/filter control. Changing to extra analysis or coverage also closes the inspector. It never presents an excluded finding as selected. No automatic list reset after closing the inspector.

The result header states the total and visible count. A single search field remains populated while the operator changes category, filter, and finding selection. Filter changes update the visible count immediately; a zero match says why and offers 조건 초기화. Search does not reappear in the header or inspector. This follows KRDS search-result and filtering behavior, with loading, empty, and recovery states distinct.

On narrow screens, 항목 선택 opens a full-screen detail view. Back returns to the exact official list mode, filter, search, selected row, and scroll position where the platform permits; focus returns to the invoking row. If the invoking row is unavailable, focus goes to the result search control. Keyboard users can tab through rows and open details with Enter/Space. The labelled return action closes the inspector; Escape closes the save dialog.

`페이지별` groups official findings by canonical `OfficialFinding.url`, shows count and technique breakdown, then expands to the same finding inspector. Filtering and search operate on findings first; group counts reflect the visible subset and also state when a group is filtered. A full absolute URL is available for copy, while the path is the scan-friendly label. iframe location stays in technical detail; its containing public page remains the primary page label.

## Other result paths

- **추가 분석**: Separate from official counts/export. Summaries say what was observed (repeated creative, shared technical indicator, destination/redirect) without asserting common ownership. A graph is optional secondary detail.
- **점검 범위**: Checked pages and failures with page address, Korean reason, and next action (retry in a new scan or inspect access). No false claim that a failed page was checked.
- **결과 파일 생성**: Opens a concise confirmation with official finding count and partial-coverage warning if needed. Validation gates saving internally; successful validation checklists are omitted. 파일 저장 calls the existing validated native export. Cancel, save-dialog cancel, and save error all leave the workspace intact. Raw JSON is not displayed in this dialog.
- **새 점검**: Returns to setup with the previous URL optionally retained, but clears session-scoped review/filter state.

## Terminal and empty paths

No findings after a successful scan means “탐지된 항목 없음” plus coverage facts, not a promise that the site is safe. Partial completion keeps findings visible with failed-page count. A scan with no usable page gives a failure explanation and a route back to setup. Cancellation returns to setup after terminal settlement and does not offer partial export; deadline expiry preserves a partial successful result. A result-loading delay shows an explicit loading state; it must not be mistaken for zero findings.

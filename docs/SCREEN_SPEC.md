# Screen spec V2

## 2026-10-20 설계 초안: 간단 모드와 고급 모드

상태: 사용자가 승인한 최초 범위(기본 연결·간단/고급 모드·단일 사례 인프라)를
작업 트리 소스에 구현했다. 최신 Windows 패키지 수용은 미실행이다. 도메인 역할
자동 분류·여러 사례 통합·배치 복원·능동 탐색은 아래 설계의 후속 범위다. 이후의 2026-10-05 명세는 이전 설계 기준으로 보존한다.
흐름·복구 규칙은 `UX_FLOW.md`, 구조적 이유는 ADR-0016에 기록한다.

### 목적과 공통 원칙

- 간단 모드: 담당 공공 웹사이트에서 의심 광고를 찾아 근거 확인·검토·보고까지 완료한다.
- 고급 모드: 상세 수집 설정, 일괄 점검, 기술 근거, 광고 연관 인프라 분석을 제공한다.
- 두 모드는 같은 탐지 엔진·Case·검토 기록을 사용한다. 같은 조건의 모드 차이가 탐지 결과를 바꾸지 않는다.
- 모드 선택과 수집 범위·연결 방식은 별개다. 고급 모드 진입만으로 WARP나 추가 외부 탐색을 시작하지 않는다.
- 기본 연결은 현재 PC 네트워크를 사용한다. 앱 전용 WARP를 사용하지 않는다는 의미이며, PC의 VPN·프록시 상태까지 보증하지 않는다.
- 기본 탐지 네 유형과 추가 단서의 개수·판단·공식 출력을 구분한다. 사용자의 판단은 공식 원본을 수정하지 않는다.
- 색 외에 상태 문구를 제공한다. 한 작업 영역의 강조된 기본 동작은 하나로 둔다.

### 공통 틀과 첫 설정

첫 실행 화면 제목은 `어떤 방식으로 사용하시겠습니까?`다. 라디오 선택 두 개와
`시작하기` 버튼 하나를 제공한다. 기본 선택은 `간단 모드`다.

| 선택 | 설명 |
| --- | --- |
| 간단 모드 | 사이트 점검, 광고 근거 확인, 보고서 저장에 집중합니다. |
| 고급 모드 | 여러 사이트 점검, 상세 설정, 광고 연결 구조 분석을 사용합니다. |

첫 설정에서는 URL, 약관, WARP 등록을 요구하지 않는다. 선택은 기기 내 사용자
환경설정에 저장한다. 저장 실패 시 현재 실행에는 적용하고 다음 실행 때 다시
선택할 수 있음을 안내한다. 모드 변경으로 Case를 복제하거나 재검사하지 않는다.

상단에는 제품명, 현재 모드 선택 메뉴, 설정·도움말을 둔다. 업무 이동은
`새 점검 | 저장된 결과` 두 개이며, 고급 모드에서만 `인프라 분석`을 추가한다.
상시 좌측 메뉴와 전체 통계 대시보드는 만들지 않는다. 점검 안에서는 기존
`점검 설정 → 사이트 점검 → 결과 검토` 단계를 유지한다.

설정은 화면 모드와 연결 설정을 분리한다. 간단 모드의 연결 안내는
`기본 연결 사용 중 · 앱 전용 WARP 사용 안 함`으로 충분하다. WARP 설정·등록은
고급 모드의 `설정 → 연결 설정`에서만 제공한다.

### S1. 간단 모드: 새 점검

```text
공공 웹사이트 점검                         간단 모드 / 설정·도움말
새 점검 | 저장된 결과

점검할 웹사이트
[ https://기관주소/                                  ]
하위 페이지·게시글·댓글·삽입 프레임에서 광고를 확인합니다.
최대 200페이지 · 하위 4단계 · 최대 25분
기본 연결 사용 중

[점검 시작]
```

첫 설정 이후에는 이 화면으로 시작하고 URL에 포커스를 둔다. 화면 모드는
계속 기억하되 새 점검의 연결 기본값은 기본 연결이다. 기존 Case를 열면 해당
Case의 실제 연결 기록을 표시하고 현재 기본값으로 바꾸지 않는다.
빠른 점검·깊이·초 단위 입력·OCR 설정·그래프·일괄 가져오기·JSON 버튼은 두지 않는다.
200페이지·깊이4·1500초·프레임 깊이4의 현재 기본 범위를 재사용한다.
페이지 제한은 설정 상한이며 사이트 전체를 확인한다는 약속이 아니다.
최근 주소 재사용은 기존 저장 결과에서 `같은 주소로 새 점검`으로 제공한다.
별도 기관 주소록·정기 예약은 이번 설계의 필수 범위가 아니다.

### S2. 간단 모드: 사이트 점검

제목은 `{기관 주소}를 점검하고 있습니다`다. 현재 단계 문장, 경과 시간,
확인한 페이지·기본 탐지·확인하지 못한 페이지 수만 주요 지표로 둔다.
의미 있는 최근 상태는 한두 줄로 제한한다. 총 탐색량을 모르면 백분율을 만들지 않는다.
실제 처리 중인 페이지·큐·요소 수·로그는 고급 진행 화면에서 제공한다.

유일한 실행 동작은 `점검 중지`다. 확인 후 정리 중임을 표시하고 호스트의
종료 상태를 기다린다. 보관된 유효 결과가 있으면 부분 결과로 이동하고,
없으면 이유와 함께 새 점검으로 돌아간다. 수집 중지와 유효 결과 삭제를 연결하지 않는다.

### S3. 간단 모드: 결과 검토

```text
{기관 주소} 점검 결과                      [보고서 저장]
일부 페이지 확인 못 함 · 확인 98페이지 / 실패 2페이지 · 4분 12초
기본 탐지 6건 · 검토 완료 2/6건

의심 항목 | 점검 범위
[문구 또는 페이지 검색]  [전체 / 미검토 / 검토 완료]

유형 / 발견 문구 / 페이지 / 검토 상태 / 근거 보기
...

이미지 등 추가 단서 2건                    [단서 확인]
기본 탐지와 별도로 분석한 결과입니다.
```

위 숫자는 배치 예시이며 실제 화면에는 저장된 관측값만 사용한다.
첫 목록은 기본 탐지의 개별 항목이다. 반복 묶음·페이지별 전환·정렬·페이지당
건수·다중 선택은 고급 모드에 둔다. 기존 기본 탐지가 같은 요소를 여러 기법으로
잡았을 경우 기법별 기록 수임을 설명하며 광고 개수나 고유 페이지 수로 부르지 않는다.
추가 단서는 별도 수와 목록으로 항상 발견 가능하게 한다. 기본 탐지0·추가 단서2도
`탐지 결과 없음` 한 문장으로 덮지 않는다. 인프라 관계 수는 탐지 건수에 더하지 않는다.

기본 탐지 근거는 데스크톱에서 목록 옆 패널, 좁은 화면에서는 별도 전체 폭
상세로 연다. 내용 순서는 발견 문구/이미지, 발견 페이지, 이유, 담당자 검토다.
원문을 복사할 수 있고 페이지를 여는 것은 명시적 선택이어야 한다.
광고 목적지로 이동하는 버튼은 간단 모드에 두지 않는다.

담당자 판단은 `판단 전 / 광고 의심 / 정상으로 판단 / 추가 확인 필요`로 표시한다.
기존 `unjudged / suspected / judged-normal / needs-more-evidence` 의미를 유지한다.
메모와 판단은 자동 저장하고 `저장 중 / 저장됨 / 저장 실패`를 해당 영역에 표시한다.
`검토 완료·다음`은 읽음 상태를 저장한 뒤 다음 항목으로 이동한다. 읽음 완료가
위반 확정을 뜻하지 않는다. 저장 실패 시 편집을 유지하고 `저장 다시 시도`를 제공한다.

추가 단서 상세는 이미지·추출 문구·관련 페이지·이유·제한을 읽는 화면으로 둔다.
현재 ReviewRecord는 공식 findingId만 허용하므로 추가 단서에 같은 판단·메모
컨트롤을 붙이지 않는다. 추가 단서용 지속 검토가 필요하면 별도 개발로 취급한다.

`점검 범위`는 확인한 페이지, 실패한 페이지와 이유, 기록된 수집·이미지 분석
상한을 보여준다. 전체 미방문 페이지 수를 모르면 `사이트 전체 미점검 수는 알 수 없음`
으로 표시한다. 파일을 못 읽은 상태와 관측0건을 구분한다.

### S4. 간단 모드: 보고서와 저장된 결과

`보고서 저장`은 XLSX 업무 보고서를 기본으로 한다. 짧은 확인 화면에 기본 탐지,
추가 단서, 검토 상태, 부분 점검 여부를 표시하고 native Save As를 연다.
진행 중인 검토 저장을 먼저 완료하고 확인된 저장 revision으로 보고서를 만든다.
저장 실패라면 낡은 검토를 최신이라고 내보내지 않고 재시도·취소를 제공한다.
취소하거나 파일 저장에 실패해도 결과와 편집 내용은 유지한다.

평가용 JSON은 두 모드 공통의 `결과 파일` 보조 메뉴에서 찾을 수 있게 한다.
간단 모드의 첫 결과 화면에 별도 강조 버튼을 늘리지 않는다. 네 유형은
`result.json`, 추가 탐지는 존재하면 `result_extra.json`에 각각 저장한다.
파일 생성 위치와 수동 생성 절차는 사용설명서 첫 장에 명시해야 한다.
이 설계는 종료 즉시 실행 파일 폴더에 자동 파일 생성이 구현돼 있다는 뜻이 아니다.

`저장된 결과`는 새 점검 양식과 분리된 최상위 업무 화면이다. 주소·날짜·사례
번호 검색, 점검 상태·기본 탐지 수·저장된 검토 상태, `결과 열기`를 제공한다.
재열기는 네트워크나 WARP 등록 없이 동작한다. Case 전달·가져오기·삭제는
고급 보조 메뉴에 둔다. 손상된 선택 정보는 표시하고 원본 읽기가 가능하면 계속 연다.

### A1. 고급 모드: 새 점검과 진행

점검 설정에 `한 사이트 / 여러 사이트`를 둔다. 한 사이트의 URL과 기본 동작은
간단 모드와 같고 상세 설정에서 기존 자동·빠른·직접 설정 범위를 제공한다.
여러 사이트는 기존 CSV/XLSX/JSONL/XML 가져오기·오류/중복 미리보기·양식 저장을
재사용한다. 기존 2MiB·100개 대상 한도를 유지하고 사이트별로 순차 실행한다.
기본 연결이 초기값이며 고급 모드 선택 자체가 더 많은 외부 사이트를 수집하지 않는다.

상세 설정의 연결 항목은 `기본 연결(권장)`과 `앱 전용 WARP`다. WARP를 선택했을
때만 등록 상태와 `연결 설정 열기`를 보여준다. 등록과 점검 시작은 다른 동작이다.
여러 사이트 작업은 시작 때 선택한 연결 방식을 각 사이트의 독립 세션에 적용한다.
진행 중 변경은 허용하지 않는다. 사이트별 제한 시간이라는 점을 시작 전에 표시한다.

고급 진행 화면은 작업 페이지·대기열·분석 요소·실제 최근 활동을 접어서 제공한다.
일괄 점검은 현재 대상/전체 대상, 사이트별 상태, 현재 대상 완료 후 일시정지,
중지, 완료 결과 보기를 제공한다. 실패 사이트 때문에 완료 사례를 버리지 않는다.

### A2. 고급 모드: 결과 검토

최상위 영역은 `탐지 항목 | 점검 범위 | 인프라 분석` 세 개다. 탐지 항목 안에서
기본 탐지와 추가 단서를 분리하고, 기존 페이지별 보기·반복 묶음·유형/검토 상태
필터·정렬·기술 정보·OCR 기록·선택자·관계를 제공한다.
검토 영역은 간단 모드와 같은 기록을 편집하며 저장 주체를 추가하지 않는다.
업무 보고서가 기본 저장 동작이고 평가용 파일·Case 전달은 `결과 파일` 메뉴에 둔다.
사이트별 공식 JSON을 합쳐 하나의 공식 결과로 만들지 않는다.

### A3. 고급 모드: 인프라 분석

첫 제공 범위는 현재 또는 선택한 저장 Case 하나다. 결과 탭에서 열면 현재
Case를 사용하고, 상단 업무 이동에서 열면 저장 Case를 먼저 선택한다.
`저장 근거 분석 · 외부 사이트에 새로 접속하지 않음`과 대상·점검 일시·연결 방식·
분석 제한을 상단에 표시한다. 원래 기록이 없는 연결 방식은 `기록 없음`으로 둔다.

```text
광고 연관 인프라                 분석 대상: {주소 / 점검 일시}
저장 근거 분석 · 외부 접속 없음 · 일부 분석 제한 있음

[도메인 검색] [근거 종류] [반복 관측만]
도메인 / 관측 역할 / 관련 페이지 수 / 근거 종류 / 근거 확인
...

선택한 도메인: {도메인}
연결된 발견 페이지 → 광고 요소·이미지 → 관측된 자원·목적지
[원래 근거 보기] [관계도 펼치기]
```

기본 목록은 광고 근거와 직접 연결된 도메인이다. 일반 CDN·폰트·분석 도구를
단순 포함만으로 이 목록에 넣지 않는다. 관측 역할은 `이미지 자료 / 링크 목적지 /
관측된 중간 연결 / 삽입 프레임 / 확인 불가`이며 저장 graph의 노드·간선으로
뒷받침될 때만 표시한다. 한 도메인은 여러 역할을 가질 수 있다. 근거 종류는
공식 문구, OCR와 보조 근거, 반복 광고 이미지, 자료 요청 리디렉션 등 기록된 이유다.
역할과 이유를 같은 필드로 취급하지 않는다.

정렬 기본값은 관련 페이지 수 내림차순, 동률이면 도메인명이다. 단일 페이지
관계도 볼 수 있고 `반복 관측만`은 두 페이지 이상으로 제한한다. `관련 페이지 수`는
정확한 저장 페이지 URL의 수다. 한 Case에 여러 호스트가 있어도 기관 수로 바꾸지 않는다.
도메인/IP 공유만으로 공통 운영자·불법 운영 주체·차단 대상을 확정하지 않는다.

행 선택 시 원본 Case·페이지·finding·연결 경로로 역추적한다. graph가 잘렸거나
노드 정보가 없으면 `일부 근거만 표시 / 역할 확인 불가`를 표시한다. 기존 bounded
관계도는 보조 동작이며 목록을 대체하지 않는다. 단순 요약값만으로 완전한
리디렉션 체인·이동 후 최종 사이트를 만들어 표시하지 않는다.

### 인프라 기능의 현재 경계와 개발 범위

아래 `재사용`은 현재 코드 경로의 존재를 뜻하며 새 화면의 Windows 수용을 뜻하지 않는다.

| 기능 | 현재 가능한 범위 | 새로 필요한 일 |
| --- | --- | --- |
| 단일 Case 광고 연관 도메인 | EvidenceSummary의 도메인·관련 페이지·근거 종류 조회, 현 화면 목록도 존재 | 독립 업무 화면, 검색·필터·목록 우선 배치 |
| 관계 근거 역추적 | finding/page/creative/domain 초점의 bounded graph와 원본 inspector | 도메인 행→근거 선택→원래 목록 복귀 동선 통합 |
| 도메인 역할 | 저장 graph에 자원·목적지·리디렉션·프레임 등 노드·간선 존재 | 근거가 있는 역할 분류, 누락·잘림 표시; 실제 광고 관계가 없으면 분류하지 않음 |
| 반복 이미지 | 한 점검 안의 hash/pHash와 추가 탐지, 확보된 이미지·OCR 기록 | 목록/미리보기 재배치. 다른 Case 간 유사 이미지 검색은 별도 구현 |
| 업무 보고서 | XLSX 추가 분석 시트에 세션별 인프라 요약을 기록 | 분석 화면의 선택 범위·제한·역할·출처를 담는 전용 표 확장 |
| 여러 저장 Case 통합 | 각 Case를 열고 요약 읽기 가능. 통합 인프라 질의는 없음 | 명시적 다중 선택, URL/도메인 중복 처리, 출처 유지, bounded 통합 읽기 |
| 재시작 후 일괄 작업 | 각 Case와 검토 저장 존재. 일괄 그룹 복원은 미해결 | 작업의 대상·순서·caseId·진행 상태 보관과 그룹 재열기 |
| 시점 비교·새 도메인 | Case 점검 시각은 존재. 도메인별 최초/최종 관측 시각은 없음 | 비교 대상 선택, 점검 시점 기준 등장/재관측 표시. 상시 모니터링 이력과 구분 |
| 추가 단서 검토 기록 | 공식 findingId만 지속 검토 가능 | 추가 단서 판단·메모가 필요하면 별도 식별·저장 계약 |
| 외부 연결 능동 탐색 | 페이지 수집 중 관측한 외부 요청·링크만 분석 | 별도 사용자 시작, 범위·요청 상한·시간·redirect·취소·보관 설계 필요. 최초 제공에서 제외 |

여러 Case 통합을 추가할 때는 초기 선택 상한을 20개로 제안한다. 이는 제품 범위
제안이며 성능 보장은 아니다. 읽기·메모리 실측을 통해 확정하고 전체 자산을
미리 읽지 않는다. 사례 수, 고유 시작 주소 수, 고유 관측 페이지 수를 별도로 센다.
같은 주소의 여러 점검을 여러 기관으로 세거나 최신 결과로 역사 기록을 덮지 않는다.
출처에서 읽지 못한 사례는 제외 수·이유를 표시한다. 비교와 작업 그룹은 Case
참조로 구성하고 원본 JSON·자산·검토 기록을 복제하지 않는다.

최초 제공 화면에는 미구현 다중 통합·능동 탐색·최초 발견 시각 버튼이나 가짜
값을 두지 않는다. 단계별로 실제 구현한 기능만 노출한다.

### WARP 선택과 연결 상태

| 상황 | 제안 동작 |
| --- | --- |
| 첫 실행·간단 점검·고급 기본 점검 | 기본 연결. WARP 미등록/파일 누락/설정 손상과 무관하게 이 경로를 시작할 수 있음 |
| 기본 연결에서 접근 실패 | 성공한 결과와 실패 이유 보존. 주소·현재 네트워크 확인과 같은 조건의 새 점검 제공. 자동 WARP 전환 없음 |
| 고급 연결 설정 | 약관 링크, 외부 연결 사용 설명, 사용자 동의 후 장치 등록. 화면 진입·동의 체크만으로 등록하지 않음 |
| WARP 등록됨 | `등록됨 · 점검 시작 시 연결` 표시. 연결 중/연결 성공으로 부르지 않음 |
| WARP 선택 후 점검 시작 | 등록·리소스 검증 후 해당 세션의 터널 준비. 준비 시간도 전체 점검 제한 시간에 포함 |
| WARP 준비/실행 실패 | 해당 점검 실패 또는 유효 부분 결과 표시. 기본 연결로 자동 재시작하지 않음 |
| 연결 방식을 바꿔 다시 점검 | 사용자가 시작 주소·수집 범위·방식을 확인하고 새 Case 실행. 이전 Case 보존, 비교 가능 |
| 저장 결과 열기·인프라 분석 | 로컬 기록 조회. 등록·터널·새 사이트 접속 불필요 |

WARP 선택은 해당 실행 또는 일괄 작업에만 적용하고 다음 새 점검에는 기본 연결로
돌린다. 사용자 등록 정보는 재사용하되 PC 전체 DNS·라우팅·공식 WARP 클라이언트를
변경하지 않는다. 두 연결 모두 공개 IP 검증·IP 고정 연결·TLS 검증·프로세스 정리를
유지한다. 실패를 특정 기관의 차단 판정으로 단정하지 않는다.

현재 소스의 native 시작 경로는 `--require-warp`를 항상 전달한다. 따라서 위 정책은
화면 숨김만으로 구현할 수 없다. ScanRequest/일괄 요청→native 호스트→worker의
명시적 연결 선택, 기본 연결 provenance·실패 계약, 저장/가져오기 검증까지 함께
수정해야 한다. 기존 direct 출처 값은 owned-origin/source-cli뿐이므로 일반 UI
점검을 CLI 실행으로 오기록하지 않아야 한다. 기존 Case도 계속 읽을 수 있어야 한다.

### 모드 전환·배치·접근성

검토 중 모드 전환은 현재 Case·검색·선택·스크롤·판단·메모를 보존한다. 고급
인프라 화면에서 간단 모드로 바꾸면 같은 Case의 결과로 돌아가며, 고급 필터를
조용히 적용해 항목을 감추지 않는다. 공통 검색·검토 상태는 유지하고 고급 전용
조건은 전환 안내와 함께 해제한다. 보류 중 검토 저장은 기존 writer 한 곳이 맡는다.
활성 점검·중지 처리·내보내기 중에는 모드 변경을 잠시 비활성화하고 이유를 표시한다.
연결 방식 변경은 진행 중인 검사에 적용하지 않는다.

본문 17px 이상, 버튼 목표 높이44px 이상, 키보드로 모든 주요 동작 도달, 200%
확대와 좁은 화면에서 내용 재배치를 설계 기준으로 한다. 1366x768에서는 기본
목록 첫3개 항목의 핵심 정보와 근거 동작을 볼 수 있도록 요약부 높이를 제한한다.
긴 문구는 목록에서 요약하고 상세에서 원문 전체를 읽게 한다. 기술 필드 때문에
페이지 전체 가로 스크롤을 만들지 않는다. 상세를 닫으면 호출한 행으로 포커스를
돌리고 행이 사라졌으면 검색으로 보낸다. 진행 알림은 상태 전환 중심으로 읽는다.

### 구현 순서와 수용 조건

1. 기본 연결 복원과 명시적 선택 계약: WARP 미등록·손상 상태에서 일반 점검,
   공식 결과·public-IP 경계, WARP 선택 실패와 취소·종료·다음 점검을 검증한다.
2. 공통 모드 설정·간단 점검/검토/저장·저장 결과 분리: 같은 Case의 모드 전환,
   검토 저장 오류·빠른 종료·재열기·정확한 report revision을 검증한다.
3. 고급 설정·일괄 점검과 단일 Case 인프라 화면: 기존 목록·graph·원본으로
   연결, 일반 CDN 제외·없는 역할·누락 기록·잘림·이미지 분석 미실행과 관측0건을 구분한다.
4. 여러 Case 인프라 통합·일괄 그룹 복원·통합 XLSX: restart 후 두 대상·메모·판단,
   읽지 못한 사례, 중복 URL, 반복 점검, 보고서 출처와 공식 원본 불변을 검증한다.
5. 능동 외부 탐색·상시 감시·추가 단서 검토는 별도 후속 범위로 둔다.

위 순서 중 승인한 최초 범위의 소스와 실행 근거는 ADOPTION_LEDGER.md의 2026-10-20 절을 따른다. 후속 범위와 Windows 패키지 수용을 완료로 간주하지 않는다.
최종 native 후보에서 1366x768·200% 확대·키보드 복귀·두 연결 방식·실제 Excel을
확인해야 한다. 사람 사용성 평가는 처음 쓰는 담당자가 기본 연결로 주소 입력,
실패 범위 이해, 연속 근거 검토, 보고서 저장을 도움 없이 수행하는지 관찰한다.

## Earlier V2 screen baseline (2026-10-05)

Status: design freeze, 2026-10-05. Content is Korean by default; this is a target spec, not a statement of current rendering.

Implementation note (2026-10-06): the result list now stays mounted during
inspection; a desktop grid shows list and inspector together, and mobile shows
the inspector with a return control. A 20-finding synthetic browser replay
exercised review and retained search/filter context. The remaining requirements
in this document still need verification against the packaged Windows app.

## Shared shell

Header: “공공 웹사이트 불법광고 탐지”, 도움말, and the current site after start. A three-item ordered step indicator labels 점검 설정, 사이트 점검, 결과 검토. The current stage has `aria-current="step"` and a visible non-color cue. At narrow widths it may show “2/3 사이트 점검”; the full step names remain accessible. No permanent left navigation. Main heading receives focus on stage transition, never on every progress event. Minimum 44px interactive targets are the design target; text reflows at 360px and 200% zoom without horizontal page overflow.

## A. 점검 설정

Main heading “공공 웹사이트 점검”. Label “점검할 웹사이트”, URL input with an `https://` example and initial focus, one scope/time hint and inline error. Primary button “점검 시작”. `상세 설정` discloses automatic/quick/custom mode and the three numeric limits only for custom. The quick mode describes reduced coverage before selection. No primary “주제” field. Repeated purpose/scope paragraphs and internal timeout explanations are omitted. Browser replay is labelled as a demonstration; it never implies that replay data came from the entered URL.

## B. 사이트 점검

Heading “{host}을 점검하고 있습니다”. Current action is a Korean sentence such as “페이지를 찾고 콘텐츠를 분석하고 있습니다”; discovery and analysis overlap across live workers, so no false sequential completion indicator. Show elapsed mm:ss, checked pages, queue, in-flight pages, analyzed elements only when actually counted, confirmed findings, current pages (up to four), and up to five meaningful recent events with times. A count that cannot yet be measured is hidden or marked “집계 중”, never shown as a misleading zero. Recent activity is throttled to transitions, findings, and failures, not each element. Status has a polite live region without announcing every counter update. “점검 중지” opens a clear confirmation and remains disabled only while cancellation settles. Failure explains what failed and how to retry. If live event transport fails, poll persisted session state and say that real-time updates are delayed.

## C. 결과 검토 — summary and navigation

Heading “{host} 점검 결과”, status text (완료 / 일부 페이지 확인 실패 / 중지됨), duration, checked pages. Summary cards give official finding count, affected pages, failed pages, extra count. Tabs/segmented navigation: 공식 탐지, 추가 분석, 점검 범위. Official area defaults to 탐지 항목별 with a paired 페이지별 choice. Technique filter uses Korean labels for all four official enums plus 전체. Search covers raw displayed content and page URL; applied filter and result count remain visible. Empty filter state offers 필터 초기화. Results and details are data driven; no raw session ID or CSS column in the primary list.

This workspace follows KRDS search-result behavior: visible total and per-category counts, category navigation, one retained search field, filter controls, stable result list, loading state, zero-result and zero-filter-match messages, and a clear alternative action. Filter changes immediately update the visible count. One search field serves both finding and page views; do not duplicate it in the inspector or header. Search/filter and scroll state persist during inspection.

## C1. Finding list and inspector

Each row/card shows 유형, short 원문 excerpt, page path/host, and “근거 보기”. Long URL wraps; full address can be copied. A desktop two-column layout keeps list and inspector visible; inspector has a stable heading and independent scrolling. “탐지 내용” shows the Korean type, original text and page. “판단 근거” shows actual matched terms, destination when recorded, and the stored normalized text as “변환된 문구” for HOMOGLYPH/JAMO. OFFSCREEN coordinates name the page or frame viewport they belong to; they do not claim to be absolute parent-page coordinates. Repeated definitions of the already labelled technique are omitted. “실제 화면” shows a capture or its unavailable reason. `기술 정보` expands selector/frame/CSS/geometry/OCR/model or graph details with observed/derived/inferred labels. The inspector does not assert more than the stored evidence. On narrow screens it occupies the screen with a visible “목록으로” control and restored list context.

## C2. Page view, coverage, extra analysis

Page groups show page path, count, and a breakdown by the four Korean technique labels. Selecting a group exposes its findings using the same inspector. 점검 범위 lists checked and failed page totals, with failures grouped by reason: 시간 초과, 접근 불가, 연결 실패, or 기타 with a safe sanitized detail. It also states pages skipped by configured limits, when known. 추가 분석 lists evidence-backed summaries separate from official results and official export; raw graph links and pHash live in technical detail. Never label shared infrastructure “same operator/owner”.

## C3. Result file dialog

“결과 저장” stays in the results action area, available even for a valid zero-finding result. The dialog shows the official finding count and, only when present, failed-page/time-limit status. The official serializer and validator still gate “저장” internally; an invalid result shows one actionable error and disables save. Validation checklists and raw JSON do not occupy the operator dialog. “취소” closes it and restores focus. Native save-dialog cancellation is a no-op. Success names the saved file; failure states a recovery step.

## States to design explicitly

Initial/loading, no findings, no filter matches, detail loading/unavailable, evidence unavailable, partial completion, scan failure, cancel settlement, export validation failure, export save failure, and browser replay are distinct states. Focus, status text, and next action must be specified in the implementation for each. The app does not claim that a successful scan proves the entire site safe.

For each relevant component, verify initial, loading, running, partial, success, empty, no-filter-match, error, unavailable evidence, disabled, cancellation settlement, confirmation, save success, and save failure. A state must have text as well as any color/icon cue. `KRDS_COMPLIANCE.md` maps each interaction to an official pattern and records the release gate.

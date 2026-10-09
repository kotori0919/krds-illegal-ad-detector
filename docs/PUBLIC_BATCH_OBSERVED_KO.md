# 공개 게시물 두 대상 점검

2026-10-10 KST, 사용자가 직접 공개 대상을 찾도록 지시한 뒤 실행했다.
광고성 게시물이 공개된 호스팅 페이지를 선택한 것이며 운영자의 불법성이나 법적
위반 확정 판정이 아니다. 로그인·결제·접근 제한 우회는 하지 않았다.

| 입력 주소 | 실제 결과 |
| --- | --- |
| https://seogurc.or.kr/bbs/board.php?bo_table=sub4_7 | HTTP 200, 확인 1페이지, 실패 0, 공식 탐지 0 |
| https://h-in-c.com/article/review/4/194442/ | HTTP 200, 확인 1페이지, 실패 0, 공식 탐지 0 |

OBSERVED: Windows MSVC source `3c8295ede6dc6661ca861518e6b56b7382a67ef5`,
build ID `0.2.1-x86_64-pc-windows-msvc-13e5e7d51837-20261009T182804648Z`의
직접 빌드 EXE를 실제 Tauri 화면에서 실행했다. 설치 파일은 실행하지 않았다.
CSV 두 행을 실제 파일 선택 창으로 불러오고 **입력한 페이지만**을 선택했다.
두 독립 케이스의 실제 저장 설정은 `maxPages=1`, `maxDepth=0`, `timeoutSec=60`,
`network=public-pinned`이며 선택 모델은 꺼져 있다. 하위 링크를 방문하지 않았다.

두 케이스 모두 `html-snapshot-truncated`를 기록했다. 이는 실시간 분석 뒤 보관용
HTML 사본을 최대 64KiB로 제한한 기록이다. 실시간 분석 실패로 전용하지 않으며,
사본 전체가 보관됐다고도 주장하지 않는다. 탐지 0건은 네 공식 기법의 제한된 관찰이다.
광고 없음, 적법, 전체 사이트의 안전 또는 탐지 재현율을 입증하지 않는다.

실제 native Save As로 통합 XLSX를, 폴더 선택 창으로 사이트별 공식 JSON을 저장했다.
공식 JSON 두 파일의 계약 검증이 통과했고 각각 보관 원본 SHA-256과 같았다.
XLSX에는 대상 요약 두 행, 점검 범위 두 행이 있으며 수식 셀은 0개다.
사전 persistent 파일 48개(변동 lock 제외)의 해시도 그대로였다. 실제 Excel 프로그램에서
이번 workbook을 연 것은 NOT_RUN이다. 이전 GNU workbook의 Excel 관찰과 구분한다.

## 실행 중 발견한 화면·보고 누락

이 실행에서 저장된 `collectionIssues`가 점검 범위 화면과 Excel에 나타나지 않는 것을
관측했다. 후속 수정은 저장된 제한을 **수집·보관 제한**으로 표시하고 Excel의 별도
열과 요약 건수로 보존한다. 접근 실패·공식 탐지·원본 JSON·정책 버전은 바꾸지 않는다.
320px 화면에서는 긴 주소가 넘치는 문제도 발견해 점검 범위의 줄바꿈을 수정했다.

OBSERVED: 관련 UI/report/batch 회귀 23개, 타입 검사와 scoped lint 통과.
evidence package와 production web 빌드 성공(기존 큰 chunk 경고 있음).
실제 저장된 공개 케이스의 범위를 사용한 production React/Tauri adapter replay에서
1366/320px 제한 안내, 가로 넘침 없음, 실제 생성 XLSX의 제한 열을 확인했다.
외부 요청·pageerror는 0이다. 이 replay의 저장 창은 파일 writer로 대체했으며
앞의 실제 Windows 스캔·native chooser 관찰과 구분한다. 공개 사이트 재검사는 하지 않았다.

보고서 모듈의 이전 dist를 웹 번들이 읽을 수 있는 빌드 의존성도 수정했다.
root build와 desktop resources는 contracts → evidence → web 순서로 실행한다.
OBSERVED: evidence dist를 별도 보존한 뒤 없는 상태에서 root build가 새로 생성했고,
그 production UI와 실제 XLSX에서 제한 안내를 확인했다. build-boundary 5개도 통과했다.
이는 전체 도구 캐시가 빈 Windows 설치 시험이라는 뜻은 아니다.

후속359 Windows 직접 빌드에서도 기존 케이스를 재열어 제한 안내를 확인하고 native
Save As로 새 XLSX(14,055bytes)를 저장했다. 실제 파일의 점검 범위8열에
`html-snapshot-truncated`, 페이지 상태에 확인 완료, 공식 상세0행을 확인했다.
새 공개 스캔이나 설치는 실행하지 않았다. 실제 화면에서 요약 카드와 본문 간격이0인
문제도 관측했다. 정의되지 않은gap6 토큰을 기존gap7(24px)로 수정했다.
이 후속 화면 보정의 후보 식별과 native 관찰은 채택 인계에 따로 기록한다.
OBSERVED: 같은 저장 범위의 production UI에서1366px 간격24px,320px 가로 넘침 없음.
617건 workflow도 다시 실행해17px/1366×768의 첫3행 하단748.25px, 키보드/원문/메모/
공식JSON/XLSX 회귀를 통과했다. 실제 카드·목록의 분리 여부를 화면 smoke에 추가했다.

원본 케이스와 native workbook은 로컬 Windows 데이터 및 별도 원본 증거로 보존한다.
공개 인계에는 연락처·게시자 이름·개인 저장 경로를 복사하지 않고 계약 결과·범위·해시와
화면 검증을 제공한다. 증거 폴더는 `artifacts/public-batch-20261010/`다.
후속 후보의 식별과 실행 범위는 [채택 인계](ADOPTION_HANDOFF_KO.md)를 기준으로 한다.

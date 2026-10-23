# 점검 대상 파일 미리보기

`packages/evidence/src/target-import.ts`의 `previewTargets(filename, bytes)`는
로컬 파일 바이트를 `TargetPreview`로 변환한다. 대상 사이트, sitemap 링크,
외부 XLSX 관계를 방문하지 않으며 DNS 조회도 수행하지 않는다. 미리보기 승인과
실제 점검 시작은 호출자의 업무다. 실제 점검에는 별도의 DNS 결과 검증과 매
redirect 검증이 계속 필요하다. 공개 도메인 형태만으로 실제 목적지의 안전을
보장할 수 없다.

## 지원 형식과 열

확장자는 대소문자를 구분하지 않으며 CSV, JSONL, XML, XLSX만 지원한다.
파일은 최대 2 MiB, 비어 있지 않은 데이터 대상은 최대 100개다. 잘못된 대상과
중복 대상도 이 100개 제한에 포함한다. URL은 최대 2048자, 사이트명은 최대
200자다. 텍스트와 XLSX XML은 유효한 UTF-8이어야 한다. UTF-8 BOM은 허용한다.

CSV와 XLSX 첫 번째 비어 있지 않은 행은 열 제목이다. 열 제목 양끝의 공백과
영문 대소문자를 무시한다.

| 항목 | 허용하는 열 제목 / JSONL 필드 | 규칙 |
| --- | --- | --- |
| 사이트명 | `사이트명`, `label`, `siteName`, `name` | 생략하거나 빈 문자열이면 주소의 도메인 이름 사용 |
| 시작 주소 | `시작 주소`, `entryUrl`, `url` | 하나가 반드시 필요함 |
| 대상 종류 | `kind` | 생략하면 `site`; 명시하면 `site` 또는 `sitemap` |

같은 항목에 해당하는 열 제목이 두 개면 파일 전체를 거부한다. 시작 주소 열을
임의로 추측하지 않는다. 추가 열은 무시하지만 제목보다 값이 많은 CSV 행은
유효하지 않은 행으로 표시한다. CSV는 쉼표, 큰따옴표 이스케이프(`""`), 따옴표
안 줄바꿈, LF/CRLF/CR 줄바꿈을 지원한다. CSV `row`는 레코드가 시작한 원본
줄 번호이고, XLSX `row`는 시트 행 번호다. 빈 행은 점검 대상에 포함하지 않는다.

```csv
사이트명,시작 주소
공공기관,https://example.org/
"공공기관, 자료실",https://example.org/archive
```

JSONL은 각 비어 있지 않은 줄에 JSON 객체 하나를 사용한다. 위 필드명을
동일하게 지원한다. 잘못된 JSON, 중복 필드, 모호한 별칭, 문자열이 아닌 주소는
그 행을 유효하지 않은 대상으로 표시한다. `row`는 원본 줄 번호다.

```jsonl
{"label":"공공기관","entryUrl":"https://example.org/"}
{"name":"사이트맵","url":"https://example.org/sitemap.xml","kind":"sitemap"}
```

## XML sitemap

문법이 유효한 `urlset` 또는 `sitemapindex`만 허용한다. 기본 namespace를
명시하면 `http://www.sitemaps.org/schemas/sitemap/0.9`이어야 한다. 각 `url`
또는 `sitemap` 항목에 단 하나의 텍스트 `loc`가 필요하다. 표준 `lastmod`,
`changefreq`, `priority`는 점검 대상 변환에 사용하지 않는다. DTD, 사용자
정의 entity 선언과 알 수 없는 entity 참조는 거부한다. XML 구조 깊이는 32,
요소 수는 50,000 이내여야 한다.

`urlset`의 대상 종류는 `site`, `sitemapindex`의 대상 종류는 `sitemap`이다.
중첩 sitemap은 값으로만 표시한다. 재귀 다운로드, 순환 확인을 위한 방문은
수행하지 않는다. XML `row`는 대상의 1부터 시작하는 순번이다.

## XLSX 보안과 자원 제한

실제 XLSX 해석은 ExcelJS 4.4.0을 사용한다. ExcelJS에 원본을 넘기기 전에 ZIP
중앙 목록/로컬 헤더를 검사하고 fflate 0.8.3 스트리밍으로 실제 내용을 해제한다.
목록에 적힌 크기가 작더라도 실제 해제 바이트를 세며 제한을 넘으면 즉시
다음 압축 입력 공급을 멈춘다. 압축 입력은 128바이트씩 공급하므로 큰 압축
폭탄의 전체 내용을 한 번에 해제하지 않는다.

| 제한 | 값 |
| --- | --- |
| ZIP 항목 수 | 128 |
| 항목별 실제 해제 크기 | 4 MiB |
| 전체 실제 해제 크기 | 8 MiB |
| 분석 경과 시간 | 2초; 입력 공급/해제 콜백/XML 전후/ExcelJS 로드 후 검사 |
| 시트 수 | 1 |
| 시트 행 / 열 범위 | 1000 / 64 |

시트 범위는 빈 행/서식이 있는 양식을 허용하기 위한 상한이다. 데이터 대상
상한은 별도로 100개다. ExcelJS 로드는 동기 작업을 강제로 중단하는 기능이
없으므로 로드 중 시간 제한은 실행 후 검사한다. 그 전에 실제 해제 크기,
XML 깊이/요소 수, 셀/행/열/시트 번호를 제한하며 대규모 셀 생성이 가능한
병합 셀을 거부한다.

암호화 ZIP, ZIP64, 분할 ZIP, 중복 ZIP 경로, 경로 순회, 지원하지 않는 압축,
잘린 항목, 실제 해제 크기 불일치는 거부한다. VBA/매크로, OLE 임베딩,
ActiveX, `.bin` 항목, 외부 연결, 외부 관계, 수식 셀과 병합 셀도 거부한다.
XLSX는 수식/하이퍼링크 대신 일반 텍스트 셀로 작성한다. 사이트명/주소 열의
객체 셀 값은 문자열로 임의 변환하지 않는다. 리치 텍스트는 텍스트로만 읽는다.

## 주소 검증과 결과

`http`/`https` 주소만 허용한다. 사용자 정보, URL 내부 공백/제어문자/역슬래시,
단일 레이블 또는 올바르지 않은 도메인 이름을 거부한다. 모든 IPv4/IPv6 리터럴
주소도 거부하므로 축약/16진수 IPv4, loopback, private, link-local, reserved
주소가 미리보기 대상이 될 수 없다. `.localhost`, `.local`, `.internal`,
`.lan`, `.home`, `.home.arpa` 및 `metadata` 도메인 레이블도 거부한다.
이 검증은 네트워크 조회 없이 URL 정규화 결과에 적용한다.

중복 판정 전 도메인 대소문자/끝의 점/기본 포트는 정규화하고 fragment는
제거하며 query 키는 안정 정렬한다. query 값과 같은 키의 값 순서는 유지한다.
같은 정규화 주소는 사이트명/종류가 달라도 첫 행 이후 `duplicate`로 표시한다.
정규화된 주소는 반환 대상과 실제 점검 시작에 사용한다.

파일/구조 오류는 예외이며 개별 대상 오류는 `status: "invalid"`와 `reason`이다.
유효한 행은 `target`, 중복 행은 `target`과 `reason`을 포함한다. 결과의
`valid`, `invalid`, `duplicate`는 각각 행 상태의 개수다. 미리보기 결과 자체는
공식 `result.json`에 들어가지 않는 운영 메타데이터다.

검증 명령:

```sh
npx vitest run packages/evidence/test/target-import.test.ts --project packages
```

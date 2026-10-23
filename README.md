# 공공 웹사이트 불법광고 탐지 도구

공공 웹사이트의 게시물·댓글·iframe과 광고 이미지에서 불법광고 의심 내용을 찾고, 담당자가 위치와 근거를 확인해 검토 결과를 보관하는 Windows 데스크톱 프로그램입니다.

2026 행정안전부·한국지능정보사회진흥원 「공공 웹사이트 불법광고 탐지 도구 개발 공모전」 제출 프로젝트입니다.

## 주요 기능

- **웹사이트 점검**: 시작 URL에서 하위 페이지와 중첩 iframe을 탐색하고, 확인한 페이지와 접근 실패를 구분합니다.
- **공식 은닉 기법 탐지**: 유사 문자, 자모 분리, 투명 텍스트, 화면 밖 배치를 분류하고 URL·요소 위치·관측 원문을 기록합니다.
- **이미지 광고 분석**: 한국어·영어 OCR과 로컬 의미 비교로 이미지 광고 검토 후보를 제공합니다. 공식 결과와 추가 분석은 별도로 내보냅니다.
- **근거 검토**: 탐지 위치, 당시 수집한 이미지, 관련 도메인과 반복 항목을 확인합니다. 공식 탐지 항목에는 판단·메모·검토 완료 표시를 저장할 수 있습니다.
- **사례 보관**: 공식 원본과 검토 기록을 분리해 저장하고, 프로그램을 다시 시작한 뒤 저장 사례를 열 수 있습니다.
- **일괄 점검·보고서**: CSV·XLSX·JSONL·XML Sitemap의 대상 목록을 점검하고, 사이트별 JSON과 통합 XLSX 보고서를 생성합니다.

## 사용 순서

1. Windows 설치 파일을 실행해 프로그램을 설치합니다.
2. 점검할 웹사이트 주소와 점검 범위를 지정합니다.
3. 점검 결과에서 의심 항목의 원문·위치·이미지 근거를 확인합니다.
4. 공식 탐지 항목에 담당자의 판단과 메모를 기록합니다.
5. 공식 JSON 또는 엑셀 보고서를 저장합니다.

여러 사이트는 **여러 사이트 일괄 점검**에서 대상 파일을 가져와 실행합니다. 각 사이트는 독립된 사례로 저장됩니다.

## 문서

| 문서 | 내용 |
| --- | --- |
| [기획서](docs/PLANNING_DOC.md) | 개발 배경, 목표, 기술, 구성과 기대 효과 |
| [사용 설명서](docs/USER_MANUAL.md) | 설치, 점검, 근거 검토와 결과 저장 |
| [빌드 설명서](docs/BUILD_MANUAL.md) | 개발 환경, 소스 빌드와 Windows 패키징 |
| [검증 결과](docs/SUBMISSION_20261023/VERIFICATION_SUMMARY.md) | 실행한 시험의 환경과 관측 결과 |
| [제출 자료](docs/SUBMISSION_20261023/README.md) | 실행 파일, 소스, 기획서와 문서 구성 |
| [아키텍처](docs/ARCHITECTURE.md) | 모듈 구조와 실행 경로 |

## 기술 구성

React·TypeScript로 구성한 KRDS 기반 화면과 Tauri 2·Rust 네이티브 호스트를 사용합니다. Playwright 스캐너가 실제 페이지를 분석하고, ONNX Runtime 기반 CPU OCR·의미 분석이 이미지 후보를 검사합니다. 모델과 실행 런타임은 Windows 설치 파일에 포함됩니다.

화면은 `HostBridge`를 통해 스캐너·사례 저장소·내보내기를 호출합니다. 공식 `result.json`은 검토 판단과 분리해 보존하며, 추가 분석은 `result_extra.json`으로 제공합니다.

```text
apps/web              화면과 플랫폼 어댑터
packages/contracts    입력·출력·호스트 계약
packages/scanner      페이지 탐색·수집·네트워크 경계
packages/detection    공식 기법과 이미지 광고 판정
packages/evidence     OCR·근거·검토·보고서
packages/synth-eval   합성 평가 서버와 기준선
src-tauri             Windows 호스트와 사례 저장소
fixtures/synthetic    정답이 있는 합성 평가 사이트
```

## 소스 실행

기준 Node.js 버전은 22.19.0입니다. 네이티브 도구 체인과 모델·런타임 준비 절차는 [빌드 설명서](docs/BUILD_MANUAL.md)를 따릅니다.

```sh
npm ci
npx playwright-core install chromium --only-shell
npm run check
npm run build
npm run dev
```

Windows 실행 파일은 `npm run build:desktop`, 설치 패키지는 `npm run package:windows`로 생성합니다.

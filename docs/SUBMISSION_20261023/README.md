# 공공 웹사이트 불법광고 탐지 도구

2026 행정안전부·한국지능정보사회진흥원 공공 웹사이트 불법광고 탐지 도구 개발 공모전 제출 자료.
Windows 11에서 웹사이트의 광고 의심 문구와 은폐 기법을 점검하고, 원문·위치·화면 근거와 담당자 검토를 보고서로 남긴다.

## 제출물 구성

접수 첨부 파일: [문서 ZIP — 491,570B](https://github.com/kotori0919/krds-illegal-ad-detector/releases/download/submission-2026-10-23/KRDS_ILLEGAL_AD_SUBMISSION_10MB_20261023.zip)

실행 파일과 전체 소스: [GitHub 전체 패키지](https://github.com/kotori0919/krds-illegal-ad-detector/releases/download/submission-2026-10-23/KRDS_ILLEGAL_AD_SUBMISSION_20261023.zip)

| 자료 | 내용 |
| --- | --- |
| `불법광고 탐지 도구_0.2.1_x64-setup.exe` | Windows x64 설치 파일, 버전0.2.1 |
| 소스코드 | 제품 소스와 의존성 lock, 빌드 스크립트 |
| [기획서 PDF](PLANNING_8P.pdf) | A4 8쪽: 목적·기술·구현·검증 |
| [빌드·실행 설명](BUILD_AND_RUN.md) | 설치, 실행, 소스 빌드 |
| [사용자 설명서](../USER_MANUAL.md) | 점검 설정, 검토, 결과 저장 |
| [제품 설명](APPLICATION_SUMMARY.md) | 기능, 입출력, 기술 구성 |
| [검증 결과](VERIFICATION_SUMMARY.md) | 실행 환경과 시험 결과 |
| [기능 범위](LIMITATIONS_AND_RISKS.md) | 지원 범위와 알고리즘 특성 |
| [파일 식별](EVIDENCE_INDEX.md) | 버전, 해시, 대표 검증 자료 |

소스 저장소: [GitHub](https://github.com/kotori0919/krds-illegal-ad-detector/tree/dev/bootstrap)

## 실행 순서

1. 설치 파일을 실행하고 앱을 시작한다.
2. 간단 모드에서 점검할 사이트 주소를 입력한다.
3. 점검 결과에서 원문·위치·화면 근거와 확인 범위를 검토한다.
4. 판단·메모를 기록하고 공식 JSON 또는 Excel 보고서를 저장한다.

고급 모드에서는 여러 대상의 목록을 가져와 순차 점검하고 통합 Excel 보고서를 만든다.
설치 파일에는 Node·Chromium·OCR·모델이 포함되며 점검 시 외부 AI 서비스로 데이터를 보내지 않는다.

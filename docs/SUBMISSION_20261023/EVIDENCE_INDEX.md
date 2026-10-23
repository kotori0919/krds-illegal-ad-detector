# 제출 파일 식별과 검증 자료

## 버전

| 항목 | 값 |
| --- | --- |
| 제품 | 0.2.1 / 정책2 |
| 소스 commit | `2e43ec97f426e9406e585b21b92e659a92f4c5ac` |
| source SHA-256 | `98fd01026e36a56313984a0630486aa1930140befda608aa8583fa1588e1cae3` |
| 빌드 target | `x86_64-pc-windows-gnullvm` |
| 소스 저장소 | [GitHub](https://github.com/kotori0919/krds-illegal-ad-detector/tree/dev/bootstrap) |

## 설치 파일

파일명: `불법광고 탐지 도구_0.2.1_x64-setup.exe`

크기: 746,959,183B(712.36MiB)

SHA-256: `fbaa7b6f8e957a6ecd46e4549e54863ebc23fb68ff8fb8b7d7a0296772808d23`

```powershell
Get-FileHash '.\불법광고 탐지 도구_0.2.1_x64-setup.exe' -Algorithm SHA256
```

## 대표 자료

| 자료 | 내용 |
| --- | --- |
| [기획서 PDF](../../artifacts/dogfood-20261023/submission-planning/KRDS_ILLEGAL_AD_PLANNING_20261023.pdf) | A4 8쪽, 제품 설계·기술·화면·검증 |
| [실행한 검증 결과](VERIFICATION_SUMMARY.md) | 합성17쌍·지자체형5건·공공 안내 음성 회귀·Windows 실행 |
| [빌드·실행 설명](BUILD_AND_RUN.md) | 의존성, Windows 빌드, 교차 빌드, 산출물 검증 |
| [사용자 설명서](../USER_MANUAL.md) | 실제 화면의 점검·검토·저장 절차 |

소스에는 공식 결과 계약·검증기·시험 코드와 합성·지자체형 시험의 정답 자료가 포함된다.
설치 산출물의 manifest는 파일별 크기·SHA-256을 제공하며 라이선스 고지·SBOM을 함께 생성한다.

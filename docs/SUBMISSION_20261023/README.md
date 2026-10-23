# 2026-10-23 제출 자료와 전달 후보

> 제품 `dd5ceb4`, source `8628ba4a4488…`, 서명 없는 gnullvm 내부 평가 후보.
> Windows에서 NIA 5페이지·실패 0, 공개 두 대상 저장·재시작 복원·통합 XLSX·Excel 열람을 확인했다.
> JS/TS 770 passed / 1 skipped, 최종 native 82 passed / 0 failed / 2 ignored. 전체 E2E·제출 완료 표시는 아니다.

이 디렉터리는 제출 준비 자료다. 공모전 실제 제출·공개 배포·remote push는 실행하지 않았다.
최종 E2E 전체 수용이나 조직 운영 채택을 뜻하지 않는다. 검증 범위와 남은 항목을 함께 전달한다.

## 1. 기준 소스와 산출물

| 항목 | 값 |
| --- | --- |
| 저장소 / 브랜치 | `https://github.com/snowman0919/krds-illegal-ad-detector.git` / `dev/bootstrap` |
| 제품 commit | `dd5ceb414e941ea8deef448899d1042e8d49a010` |
| source SHA-256 | `8628ba4a4488d9b3c6bf9a3080151784b1376aa7ced929f6cce545eb7b64b97c` |
| buildId | `0.2.1-x86_64-pc-windows-gnullvm-8628ba4a4488-20261023T061726351Z` |
| 버전 / target | `0.2.1` / `x86_64-pc-windows-gnullvm` |
| 공식 / Case / detail / config / policy | `v0 / 1 / 2 / 1 / 2` |
| 후보 폴더 | `artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-8628ba4a4488-20261023T061726351Z/` |
| installer | `불법광고 탐지 도구_0.2.1_x64-setup.exe` |
| installer 크기 / SHA-256 | `746,947,332` B (712.34 MiB) / `33ce86950fe11ef2dc2e210c60e6604797c2a2ffb4c8e222f4c28a0015b36d56` |
| 예상 설치 EXE SHA-256 | `f1466e88aefe985075faa3c9fb2f6227c251011893ad543726369fc497d90e2c` |
| signing / releaseStatus | `unsigned-internal-candidate` / `candidate` |

빌드 시 `source.dirty=true`는 제출·인계 문서 편집 때문이다. 제품 소스는 위 커밋에
보존됐고 source hash가 고정됐으며 manifest를 clean으로 고쳐 쓰지 않았다.
JS/TS 전체 검사는70a599fb 소스에서 완료했고 이후 네이티브 복원만 수정·추가 검증했다.

## 2. 문서와 사용 순서

| 자료 | 내용 |
| --- | --- |
| [APPLICATION_SUMMARY.md](APPLICATION_SUMMARY.md) | 목적·입력·판정·화면·내보내기 |
| [BUILD_AND_RUN.md](BUILD_AND_RUN.md) | 수신팀 빌드·패키지·설치·데이터 절차 |
| [VERIFICATION_SUMMARY.md](VERIFICATION_SUMMARY.md) | 후보별 관측·검사 수치·미실행 경계 |
| [LIMITATIONS_AND_RISKS.md](LIMITATIONS_AND_RISKS.md) | 이미지 재현율·D08 잔여 범위·배포 제약 |
| [EVIDENCE_INDEX.md](EVIDENCE_INDEX.md) | 원시 로그·파일·해시 대응 |
| `docs/ADOPTION_LEDGER.md` | 변경 보존부터 재개 실행까지의 원장 |
| `docs/ADOPTION_HANDOFF_KO.md` | 현재 인계와 역사 후보 기록 |
| `docs/USER_MANUAL.md`, `docs/OPERATIONS_GUIDE_KO.md` | 사용자·운영 설명 |
| `docs/DATA_HANDLING_KO.md`, 후보SBOM·license inventory·notices | 자료·자격 보관과 라이선스 |

## 3. 현재 확인된 범위

- 스캐너 회귀13건 포함 JS/TS770passed/1skipped, build-boundaries/runtime-closure13passed.
- 최종 native82passed/0failed/2ignored, fmt·Windows gnullvm all-targets clippy/check 통과.
- 새 후보 build:desktop·package:windows·verify:artifact EXIT0,8파일 검증, runtime1177파일.
- 중간70a599fb 설치본: NIA5checked/0failed, 공개2대상 저장·실제 새 프로세스 복원2/2,
  통합 XLSX7시트 모든 셀 동일, 실제 Excel 열람. 복원 카드 카운터 결함은 dd5ceb4로 수정했다.
- 최종8628ba4a 설치본: NIA5페이지 실패0, 새 공개 두 대상 저장·실제 재시작 복원2/2,
  전후 통합 XLSX7시트 모든 셀 동일·공식 원본 해시 동일, 실제 Excel 대상 요약 확인.
- 소유 양성 사례의 판단·메모·검토 완료가 새 설치본에서 복원됐고 JSON은 원본과 byte-identical,
  XLSX와 실제 Excel 검토 기록에서도 확인했다. 두 대상 양성 D08 수용을 대신하지 않는다.
- 최초286파일 불변. 설치 전338파일 중 그룹의 updatedAt 갱신1건 외 변경·삭제0.
  앱·Excel·소유 worker와 시험 listener는 종료했다.

## 4. 전달 판단에 남는 범위

| 항목 | 상태 |
| --- | --- |
| 판단·메모 포함 공개2대상 D08 | NOT_RUN: 공개 두 대상 탐지0건. 소유 단일 양성은 별도 증거 |
| 정부24 | plus.gov.kr 외부 이동으로 미점검·접근 제한, 점검 성공으로 간주하지 않음 |
| MSVC 제품 경로·Windows MSVC CI | 미실행/계정 결제 차단 이력. 새 원격 실행 없음 |
| Windows 이미지 실사이트 재현율·저사양 목표환경 | 미실행. Linux 역사 측정과 구분 |
| WebView2 부재 완전 offline 설치·무인 관리·제거·기기 간 그룹 이식 | NOT_RUN |
| 코드 서명·사람 사용성·AT·조직 수용 | NOT_RUN |

0361562d는 NIA 진입 누락과 D08 저장 실패가 재현된 이전 후보이고,
70a599fb는 복원 카드 카운터 결함이 있는 중간 후보다. 둘 다 보존하며 현재 전달 후보로 혼동하지 않는다.

## 5. 증거 보존과 인계

새 실행은 `artifacts/dogfood-20261023/resumed-validation/`와 `resumed-windows/`에 있다.
초기 dirty diff·status·stash 목록을 보존했고 자동 stash 적용·일괄 복원은 하지 않았다.
후보9파일(manifest 포함)은 아래 두 위치에 각각 복사해 크기·SHA-256을 대조했다.
문서·원시 증거·소스 bundle도 같은 전달 루트에 보관한다. 전체 사본의 최종 읽기 대조는
각 루트의 `DELIVERY_MANIFEST.json`, `DELIVERY_VERIFICATION.json`을 따른다.

- NAS: `/mnt/nas/illegal-ad-submission-20261023-resumed/`
- HDD0: `/mnt/HDD0/illegal-ad-delivery-20261023-resumed/`

`source-dd5ceb4.tar.gz`는 제품 커밋의 소스이고, `repository.bundle`은 문서 커밋까지
포함한 브랜치다. 모델·런타임은 installer에 포함된다. 실제 제출·push·공개 배포는 하지 않았다.

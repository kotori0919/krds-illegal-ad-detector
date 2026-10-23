# 증거 색인

> 제품 `dd5ceb4`, source `8628ba4a4488…`, 서명 없는 gnullvm 내부 평가 후보.
> Windows에서 NIA 5페이지·실패 0, 공개 두 대상 저장·재시작 복원·통합 XLSX·Excel 열람을 확인했다.
> JS/TS 770 passed / 1 skipped, 최종 native 82 passed / 0 failed / 2 ignored. 전체 E2E·제출 완료 표시는 아니다.

## 1. 현재 후보

후보 `artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-8628ba4a4488-20261023T061726351Z/`, 제품 commit `dd5ceb414e941ea8deef448899d1042e8d49a010`, source SHA-256
`8628ba4a4488d9b3c6bf9a3080151784b1376aa7ced929f6cce545eb7b64b97c`이다. `source.dirty=true`는 제출·인계 문서 편집이다.
`verify-artifact-restored-progress.log` EXIT0,8파일 검증. manifest 자체 해시는 별도 계산했다.

| 파일 | 크기(B) | SHA-256 |
| --- | ---: | --- |
| `build-manifest.json` | 53,602 | `94d9e091c9fd2e11140b94b8dafefc6f3e29b30a2ae48228baf0410138d7c6c9` |
| `cargo-license-inventory.json` | 43,581 | `114b4b2ccb9f84a53ccf7257e7d2cf2c30d2e6e1d94ac2ce3f1355820bb42450` |
| `krds-detector.exe` | 20,358,144 | `ada6d48d1d271a7e119f3292454b3f92c57bca617aca41833d69496d916b7c7b` |
| `license-review.json` | 2,530 | `223295cea406455243d377a9d96935ccdfc4ba15d5be5833cda681a67538b716` |
| `resources-manifest.json` | 229,297 | `e04abc4675b777d74da2d923315b8cbd2bbac1a580172863a2c89c9caa043fc8` |
| `sbom-npm.cdx.json` | 188,844 | `c5ef4a10c0508cea952a0a229fb2dfde6d10b816031138e0c2facd42ef3da5ce` |
| `THIRD_PARTY_NOTICES.md` | 2,521,635 | `cdade21f50b0fc902328d5d1df95a14e1d696b0644ecad2faa528c2fd04f104b` |
| `불법광고 탐지 도구_0.2.1_x64-setup.exe` | 746,947,332 | `33ce86950fe11ef2dc2e210c60e6604797c2a2ffb4c8e222f4c28a0015b36d56` |
| `manifest.json` | 55,660 | `7e5fec0e230136a13a9c26f79ea28ab830a6b1f1e956c5aaf61f86bebe6d1274` |

설치 EXE는 NSIS marker 변환 후 예상 `f1466e88aefe985075faa3c9fb2f6227c251011893ad543726369fc497d90e2c`, offset13535570.
standalone hash와 구분한다. 파일 해시는 발행자 인증이나 코드 서명을 뜻하지 않는다.

## 2. 현재 실행 증거

검사 파일은 `artifacts/dogfood-20261023/resumed-validation/`(아래 V),
Windows 파일은 `artifacts/dogfood-20261023/resumed-windows/`(아래 W)에 있다.

| 주장 | 실제 파일 | 범위 |
| --- | --- | --- |
| 시작 변경 보존 | V/resume-start.diff, resume-start-status.txt, resume-start-stashes.txt, redirect-domready.start.ts | 초기 미커밋·untracked 보존, stash 없음 |
| JS/TS 전체 검사 | V/check.log, source-identity-final.json |770 passed/1 skipped, 이후 JS/TS·worker 불변 |
| 최종 native 검사 | V/restored-progress-native-verified.log |82 passed/0 failed/2 ignored, host 실행 |
| fmt·Windows clippy/check | V/restored-progress-windows-checks.log | gnullvm all-targets |
| Node 빌드·런타임 경계 | V/build-boundaries.log |13 passed |
| 최종 제품 identity | V/source-identity-restored-progress.json | dd5ceb4 / 8628ba4a,290파일 |
| 빌드·후보 무결성 | V/build-desktop-restored-progress.log, package-windows-restored-progress.log, verify-artifact-restored-progress.log | EXIT0,8파일·runtime1177파일 |
| Windows source-worker | W/source-worker/nia-final/receipt.json, gov-final/receipt.json | 설치본 증거와 구분, sandbox 유지 |
| 중간70a 후보 설치·NIA | W/postinstall-receipt.json, nia-installed-receipt.json |286파일 보존·5 checked/0 failed |
| 중간70a 묶음·보고서 | W/postrestart-receipt.json, exports/restart-workbook-comparison.json |2/2 복원·7시트 셀 동일, 카운터 표시 결함 별도 |
| 소유 양성 탐지 대조 | W/positive-findings-comparison.json | 이전 Windows와17튜플 순서 동일 |
| 설치 전 백업 | W/prefinal-appdata-node.json, prefinal-backup.log |40사례338파일,6,991,568B, 복사 해시 대조 |
| 최종 전송·설치 | W/transfer-final-receipt.json, installed-final-receipt.json,0164-get_window_state-1.png | 설치 EXE·worker hash 일치, 설치 직후338파일 불변 |
| 최종 두 대상 저장·재시작 | W/batch-final-complete-verified-receipt.json, restart-final-receipt.json,0212-get_window_state-1.png | groupc92ac68e,2/2·정확한 카운터 |
| 두 공식 원본·case 연결 | W/batch-final-restart-comparison.json | caseId·상태·result SHA 동일 |
| 통합 XLSX·실제 Excel | W/exports/restart-final-workbook-comparison.json,0230-get_window_state-1.png |7시트 모든 셀 동일·수식0·실제 대상 요약 |
| 최종 NIA5페이지 | W/nia-final-receipt.json,0252-get_window_state-1.png | case324adbc4,5 checked/0 failed,18.414s,entry200checked |
| 양성 검토 복원 | W/positive-final-receipt.json,0263-get_window_state-1.png | f13메모·suspected·reviewed·revision3 |
| 양성 JSON·XLSX | W/exports/positive-final-official.json, positive-final-workbook-inspection.json | JSON4,586B byte-identical, XLSX16,508B·메모·판단 |
| 양성 실제 Excel | W/0289-get_window_state-1.png | 검토 기록 시트 f13·검토 완료·메모 |
| 최종 보존·종료 | W/final-closed-receipt.json, owned-cleanup.log | 최초286파일 불변,338기준 timestamp갱신1건 외 변경·삭제0, 시험 프로세스0 |

W/exports의 `d08-final-before-restart.xlsx`, `d08-final-after-restart.xlsx`가
통합 보고서이고, `positive-final-after-restart.xlsx`는 단일 양성 보충 보고서다.
최종43사례 중 새 공개3사례는 W/cases-final/에 복사해 result SHA와 source hash를 확인했다.
초기 검사 실패·중간 후보·원본 그룹은 삭제하지 않았다.

NAS/HDD0의 candidate 사본9파일은 크기·SHA 대조를 통과했다. 문서·원시 증거·소스 bundle과
전체 전달 사본의 최종 manifest/읽기 대조 결과는 README §5의 두 전달 루트를 따른다.

## 3. 역사 증거와 미실행 경계

- `artifacts/dogfood-20261023/README.md`와 `artifacts/nia-entry-diagnostic-20261023/`:
  이전0361562d의 NIA 문서전환 누락·D08 저장 실패와 Correction D 실험. 현재 구현은3598f48이다.
- `artifacts/win-verify-20261023/README.md`, `RECEIPT-v3.json`, `exports-v3/`:
  이전0361562d의17탐지·검토·JSON/XLSX·재시작 이력. 최신 설치 수용으로 전용하지 않는다.
- `/mnt/nas/illegal-ad-artifacts-archive-20261023/vision-cpu-current-head/`:
  f481d73 Linux190입력, inputSHA `eb1572b6162e76790ae477d921ae5ee1b96789bb7370add137c78a9f3a3e8ad3`,
  실제60/60·정상오탐0/74·파생17/18·파생정상0/38. Windows 현재 재현율이 아니다.
- 이전 이동 manifest `/mnt/nas/illegal-ad-build/moved-artifacts-20261023.txt`와
  `/mnt/nas/illegal-ad-artifacts-archive-20261023/`의 선행 후보·OCR·이미지 자료는 그대로 보존한다.
- `docs/DOGFOOD_LEDGER_20261014.md`, `docs/ADOPTION_LEDGER.md`:
  이전 Windows565·UI replay·CI결제차단 이력. 사람·AT·MSVC 최신 제품·기기이식은 별도 미실행이다.

## 4. 무결성 재검사

```sh
npm run verify:artifact -- artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-8628ba4a4488-20261023T061726351Z/manifest.json
```

정확한 실행 명령은 `resumed-validation/COMMANDS.md`, 최종 범위는
[VERIFICATION_SUMMARY.md](VERIFICATION_SUMMARY.md), 제한은
[LIMITATIONS_AND_RISKS.md](LIMITATIONS_AND_RISKS.md)를 따른다.

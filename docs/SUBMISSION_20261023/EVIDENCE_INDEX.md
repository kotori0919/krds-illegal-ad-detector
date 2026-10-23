# 증거 색인

이 문서는 제출 묶음의 모든 주장을 실제 파일과 해시에 대응시킨다. 수치를 인용할 때는
여기 있는 경로를 함께 적는다. 파일이 저장소 밖에 있으면 절대 경로로 적었다. 검증
수치의 실행 조건은 [`VERIFICATION_SUMMARY.md`](VERIFICATION_SUMMARY.md), 한계는
[`LIMITATIONS_AND_RISKS.md`](LIMITATIONS_AND_RISKS.md)를 따른다.

## 1. 기준 식별자

| 항목 | 값 | 근거 |
| --- | --- | --- |
| 코드 commit | `1c0e8a34c407776ea6fb16943a1e8c73961c6d77` | 후보 `manifest.json` `source.commit` |
| sourceSha256 | `307f6b6ff09b9ce04e0b157c6a9b9e1d87cf8c25148605e7731a4892addab731` | 같은 파일 |
| 앱 / 정책 / Case schema | `0.2.1` / `2` / `1` | 같은 파일 `appVersion`·`detectorPolicyVersion`·`caseSchemaVersion` |
| buildId | `0.2.1-x86_64-pc-windows-gnullvm-307f6b6ff09b-20261023T013033441Z` | 같은 파일 |
| 후보 경로 | `artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-307f6b6ff09b-20261023T013033441Z/` | 저장소 |
| Windows v2 증거 | `artifacts/win-verify-20261023/`(`RECEIPT-v2.json`, `README.md` v2 절, `screenshots/v2-*`, `exports-v2/`) | 저장소 |
| moved artifacts manifest | `/mnt/nas/illegal-ad-build/moved-artifacts-20261023.txt` | 이동 기록 |

## 2. 현재 후보 폴더 파일

출처: 후보 `manifest.json`의 `files` 절 8종과 `manifest.json` 자체. `verify-artifact`가
8/8 일치를 확인했다(`docs/ADOPTION_LEDGER.md` §「2026-10-23 통합 검증과 최종 후보」).

| 파일 | 크기(B) | SHA-256 |
| --- | ---: | --- |
| `불법광고 탐지 도구_0.2.1_x64-setup.exe` | 747,381,035 | `753b873c2b1454eae27fb5524cafaf4f70e682ae6ad660be2412a877a44f5ebc` |
| `krds-detector.exe` | 20,356,608 | `112e1099daf303eacadee12339fa31083f96b55c6f61e8452aa33059b4cb8f9c` |
| `manifest.json` | 55,492 | `c512448d854bcec46478a5fe22596ff9611b906ec873aac513e253bd242c52e0` |
| `build-manifest.json` | 53,434 | `69fe44ba849d1de31175fba8c1f64dc290391314f4363015ff3a3a2006118b3e` |
| `resources-manifest.json` | 229,297 | `e04abc4675b777d74da2d923315b8cbd2bbac1a580172863a2c89c9caa043fc8` |
| `sbom-npm.cdx.json` | 188,844 | `85b811a0d63ac3a52ef0669baa9e1efb70a39da0ca16d52c091c9c0bd2db95c5` |
| `cargo-license-inventory.json` | 43,581 | `114b4b2ccb9f84a53ccf7257e7d2cf2c30d2e6e1d94ac2ce3f1355820bb42450` |
| `THIRD_PARTY_NOTICES.md` | 2,521,635 | `cdade21f50b0fc902328d5d1df95a14e1d696b0644ecad2faa528c2fd04f104b` |
| `license-review.json` | 2,530 | `223295cea406455243d377a9d96935ccdfc4ba15d5be5833cda681a67538b716` |

`installedExecutable`: path `krds-detector.exe`, `markerOffset` `13534994`,
`standaloneSha256` `112e1099…`, 설치 후 `sha256`
`b6cc4411d2feecb9048dbb8f7dc3ecd568a4a944c368bedb7cb3877270211699`, profile
`unsigned-nsis`(같은 `manifest.json`). 이 값은 Windows v2 설치 후 실제 파일 해시와
정확히 일치했다(`artifacts/win-verify-20261023/RECEIPT-v2.json`).

## 3. 주장 → 증거 대응표

| 주장(수치) | 증거 파일 | 절 / 비고 |
| --- | --- | --- |
| suite `754 passed / 1 skipped (755)`, 파일 `98 passed / 1 skipped (99)`, `216.7`초 | `docs/ADOPTION_LEDGER.md` | §「2026-10-23 통합 검증과 최종 후보」. 실행 시점 HEAD `1c0e8a3` |
| `npm run build` EXIT 0 | 같은 파일, 같은 절 | — |
| 런타임 closure `1177` files, `nodeVersion 22.19.0`, closure 시험 8/8 | 같은 파일 §통합 검증과 최종 후보, `scripts/windows-runtime.lock.json` | `1c0e8a3` pruning 이전 1197 |
| `cargo check --target x86_64-pc-windows-gnullvm --all-targets` EXIT 0 | 같은 파일 §통합 검증과 최종 후보 | 호스트 교차 검사 |
| Windows target clippy EXIT 0, `cargo fmt --check` EXIT 0 | 같은 파일, 같은 절 | CI와 같은 명령 |
| `cargo test --bins` `80 passed / 0 failed / 2 ignored` | 같은 파일, 같은 절 | 호스트 실행(Windows 아님) |
| 후보 identity·installer·standalone·설치본 hash | `artifacts/candidate-…307f6b6f…/manifest.json` | `source`, `installedExecutable`, `files` |
| verify `8 files, 8/8` | `docs/ADOPTION_LEDGER.md` §통합 검증과 최종 후보, `scripts/verify-artifact.mjs` | EXIT 0 |
| Windows 11 설치·대화형 UI(v2): 17 findings/15페이지/15초, 판단·메모·JSON·XLSX·재시작 | `artifacts/win-verify-20261023/README.md` v2 절, `RECEIPT-v2.json`, `screenshots/v2-*`, `exports-v2/` | OBSERVED, 범위 제한 |
| 공식 JSON `4,586` B, 17 findings, sha256 `701ed484…0a3d`(저장 결과와 byte-identical) | `artifacts/win-verify-20261023/exports-v2/official-8991fad4.json`, `case-8991fad4-hashes.json` | v2 |
| 닫힌 포트 `502 access-navigation`, 19개 앱 요청 로그 | 같은 디렉터리 `server-v2.log`, `phase-v2-final.json` | v2 |
| AppData `194 → 218` files(추가 24·삭제 0·기존 수정 0) | 같은 디렉터리 `phase-v2-preinstall.json`, `phase-v2-final.json` | v2 |
| Windows 성능 표(347.131 / 174.271 / 112.477 / 87.849초, 425.4 / 433.1 / 537.5 / 781.9 MiB) | `docs/PERF.md`, `docs/PLANNING_DOC.md` §8.3 | 2026-10-07 통합 후보, 단일 실행 |
| cold-start text `3.65`초(상한 8), image `11.4`초(상한 16); 3배 과부하 text `5.5~6.0`, image `18.5~46.7`초 | `docs/ADOPTION_LEDGER.md` §「실측 잔여 위험」 | MEASURED, 선행 관측 |
| warm-up 후 cold init `0.83–0.9`초(idle) / `2.0–2.7`초(과부하), `elapsedMs` 제외 | `953ce2c` commit message, `docs/ADOPTION_LEDGER.md` §통합 검증과 최종 후보 | MEASURED |
| 설치 565 identity(installer 149,813,810 B, `cb414038…`)와 설치 EXE `7b6fc529…` | `docs/ADOPTION_HANDOFF_KO.md` §현재 전달 후보, `docs/OPERATIONS_GUIDE_KO.md` §후보별 실측 | 역사 후보, 현재 후보 아님 |
| D01~D10 결과 | `docs/DOGFOOD_LEDGER_20261014.md` §Task outcomes, `artifacts/dogfood-20261014/` | D08은 구현·자동 시험 완료(`bdcc0e8`), 실제 앱 재시작 수용은 NOT_RUN |
| 첫 3행 하단 `748.25px`, 320px 원문 폭 `300px`, 본문 `17px`, 버튼 `44px` | `docs/ADOPTION_LEDGER.md` §후속 UI 화면 관찰, `docs/SCREEN_SPEC.md` §모드 전환·배치·접근성, `docs/DOGFOOD_LEDGER_20261014.md` D03 | browser/IPC replay |
| UI smoke `617`기록, XLSX `618`행, WARP `0`, page error `0` | `docs/ADOPTION_LEDGER.md` §「2026-10-20 일반 연결·화면 모드·단일 사례 인프라 초기 구현」 검증 표, `artifacts/ui-modes-20261020/` | replay, Windows native 아님 |
| CI job 미시작 원문 | `docs/ADOPTION_LEDGER.md` §「CI 시도와 차단 원인」 | 원문 인용 |
| 과거 CI SUCCESS(run `37959883958`, `37967025068`, `37967491010`) | `docs/ADOPTION_LEDGER.md` §마일스톤과 검증 범위 | 당시 commit 한정 |
| WARP 자격 평문 저장·ACL | `docs/DATA_HANDLING_KO.md` | — |
| WebView2 bootstrapper·offline 미검증 | `docs/BUILD_MANUAL.md` §산출물과 한계, `docs/PLANNING_DOC.md` §8.1 | — |
| 서명 없음 | 후보 `manifest.json` `signing`, `docs/OPERATIONS_GUIDE_KO.md` §배포 전 확인 | — |
| 관리 스크립트 동작과 한계 | `docs/OPERATIONS_GUIDE_KO.md`, `scripts/managed-deployment.ps1` | 새 upgrade/rollback 실행 NOT_RUN |

## 4. 저장소 밖 증거 보관 위치

원본 파일시스템 여유가 약 1.3 GB여서 gitignore 대상 증거를 삭제하지 않고 이동했다.
이동 manifest: `/mnt/nas/illegal-ad-build/moved-artifacts-20261023.txt`.

| 자산 | 경로 | 크기 / 해시 |
| --- | --- | --- |
| 선행 후보(대체됨, **현재 후보 아님**) | `/mnt/nas/illegal-ad-artifacts-archive-20261023/candidate-0.2.1-x86_64-pc-windows-gnullvm-3fb23ff998ea-20261022T160030222Z/` | `819,612,236` B, 9개 파일 |
| └ installer(선행) | 같은 디렉터리 `불법광고 탐지 도구_0.2.1_x64-setup.exe` | sha256 `c76c133f…b439d8`(선행, 대체됨) |
| └ manifest(선행) | 같은 디렉터리 `manifest.json` | sha256 `d4b901d03416a1e93dd7cc9002f6241024a2bb048fdf92e3b1ca5b9edb3c0f52` |
| └ standalone(선행) | 같은 디렉터리 `krds-detector.exe` | sha256 `896ce98c9a0bfb2cb20e2a117ce412bcd143f8a377db4094da486e77c5ac10a1` |
| 탐지 개선 원시 자료 | `/mnt/nas/illegal-ad-artifacts-archive-20261023/detection-improvement-20261021/` | 5,914개 파일, `723,302,376` B |
| 공개 batch 후보 zip | `/mnt/nas/illegal-ad-artifacts-archive-20261023/NIA_ADOPTION_PUBLIC_BATCH_CANDIDATE_20261010.zip` | `203,171,583` B, sha256 `30f42c38496202556ee1788ce4dd50a4d8abc906b284372854aac196c85961f9` |
| └ 대응 checksum | 같은 경로 `.sha256` | `115` B, sha256 `5f3082b3b138d0f2763fcb389b0d504c9b2c9da5aa92bf1fd2601288c01f1bf8` |
| UI 후보 zip | `/mnt/nas/illegal-ad-artifacts-archive-20261023/NIA_ADOPTION_UI_CANDIDATE_20261010.zip` | `186,912,961` B, sha256 `b97845a55f98f5b44e7358548594aadf20f4dc64d2d6a4bab9eb213defa2250c` |
| UI 후보 2a8356d zip | `/mnt/nas/illegal-ad-artifacts-archive-20261023/NIA_ADOPTION_UI_CANDIDATE_2a8356d_20261010.zip` | `185,416,830` B, sha256 `19fc93faee2e89b6e5331aa44e19b8a7706a1c4fbe7f08e16e98e8c9a4cbf7a0` |
| 빌드 toolchain(재획득분) | 이동 manifest `/mnt/nas/illegal-ad-build/moved-artifacts-20261023.txt` §Toolchain | LLVM-MinGW `20260908`, NSIS `3.09-4`, 해시 검증 기록 |

선행 후보는 `16d4b56` 소스에서 만들어졌고 `85a286f` 재빌드로 **대체(superseded)**되었다.
위 표의 `c76c133f…`·`16d4b56`과 `54c8f1cd…df406`·`76e7d5ec…`·`85a286f`는 모두
이력 식별자이며 **현재 값이 아니다**(각각 대체된 후보). 현재 값은 §1·§2의
`1c0e8a3`·`753b873c…f5ebc` 하나뿐이다. `76e7d5ec…` 후보는 삭제하지 않고
`artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-76e7d5ec6ce4-20261022T163747830Z/`에
보존했다(superseded).

## 5. 저장소 안 증거 디렉터리

| 경로 | 내용 |
| --- | --- |
| `artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-307f6b6ff09b-20261023T013033441Z/` | 현재 Windows 후보 8파일 |
| `artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-76e7d5ec6ce4-20261022T163747830Z/` | superseded 후보(보존) |
| `artifacts/win-verify-20261023/` | Windows v1·v2 수용 증거(`RECEIPT.json`/`RECEIPT-v2.json`, 스크린샷, 내보내기) |
| `artifacts/dogfood-20261014/` | D01–D10 receipt(JSON) |
| `artifacts/ui-modes-20261020/` | 모드 UI 검증·스크린샷·`source-manifest.json`·`SHA256SUMS` |
| `artifacts/ui-polish-20261022/` | 후속 화면 검증 |
| `artifacts/public-batch-20261010/` | 공개 두 대상 native 관측 |
| `artifacts/detection-audit-20261021/` | 블랙툰·뉴토끼 누락 점검 |
| `artifacts/embedding-quantization-20261022/`, `artifacts/vision-cpu-20261022/`, `artifacts/ocr-*` | OCR·임베딩 회귀 측정 |
| `docs/ADOPTION_LEDGER.md`, `docs/DOGFOOD_LEDGER_20261014.md`, `docs/ADOPTION_HANDOFF_KO.md` | 실행 원장과 인계 |

## 6. 해시 재현 명령

```sh
# 후보 파일 해시(8종)
cd artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-307f6b6ff09b-20261023T013033441Z
sha256sum *

# manifest 대조 검증
node scripts/verify-artifact.mjs <candidate-folder>/manifest.json

# Windows v2 내보내기·해시
sha256sum artifacts/win-verify-20261023/exports-v2/* artifacts/win-verify-20261023/case-8991fad4-hashes.json

# 이동한 아카이브 파일 확인
sha256sum /mnt/nas/illegal-ad-artifacts-archive-20261023/*.zip
```

# 증거 색인

이 문서는 제출 묶음의 모든 주장을 실제 파일과 해시에 대응시킨다. 수치를 인용할 때는
여기 있는 경로를 함께 적는다. 파일이 저장소 밖에 있으면 절대 경로로 적었다. 검증
수치의 실행 조건은 [`VERIFICATION_SUMMARY.md`](VERIFICATION_SUMMARY.md), 한계는
[`LIMITATIONS_AND_RISKS.md`](LIMITATIONS_AND_RISKS.md)를 따른다.

## 1. 기준 식별자

| 항목 | 값 | 근거 |
| --- | --- | --- |
| 코드 commit | `85a286f5fcaf125fcadec155eac729bfe019db92` | 후보 `manifest.json` `source.commit` |
| sourceSha256 | `76e7d5ec6ce4f9d2b7b5446b2ae29f934a2c85f98dc76821b4225a106af90b19` | 같은 파일 |
| 앱 / 정책 / Case schema | `0.2.1` / `2` / `1` | 같은 파일 `appVersion`·`detectorPolicyVersion`·`caseSchemaVersion` |
| buildId | `0.2.1-x86_64-pc-windows-gnullvm-76e7d5ec6ce4-20261022T163747830Z` | 같은 파일 |
| 후보 경로 | `artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-76e7d5ec6ce4-20261022T163747830Z/` | 저장소 |
| moved artifacts manifest | `/mnt/nas/illegal-ad-build/moved-artifacts-20261023.txt` | 이동 기록 |

## 2. 현재 후보 폴더 파일

출처: 후보 `manifest.json`의 `files` 절 8종과 `manifest.json` 자체. `verify-artifact`가
8/8 일치를 확인했다(`docs/ADOPTION_LEDGER.md` §「재빌드 (85a286f)」).

| 파일 | 크기(B) | SHA-256 |
| --- | ---: | --- |
| `불법광고 탐지 도구_0.2.1_x64-setup.exe` | 796,348,611 | `54c8f1cdff25e9077a2432b8e75af14cef7597fe1fb21eb8325fbb6b6dfdf406` |
| `krds-detector.exe` | 20,220,928 | `bd57296b8823ff79d0aa9da6c7e9dc578cb3ac853a086be1f1b690cc69bac121` |
| `manifest.json` | 54,158 | `b4155ed128b6baa309c26b1896193c4971f24eba84d8b594eae50bdc5ab77763` |
| `build-manifest.json` | 52,100 | `f6443363ba78edc5eb2467a26d029be6ec711e0a6f46b7ad6ac650362077b8b5` |
| `resources-manifest.json` | 233,298 | `1098c94730efdee4da90930216a574c984d585ced6c604739384f52573f9104f` |
| `sbom-npm.cdx.json` | 188,844 | `3e5447205777c78d3cbb8fb44a72fc23d2c4ffd83cbab39d3158dcfe094c72f0` |
| `cargo-license-inventory.json` | 43,581 | `114b4b2ccb9f84a53ccf7257e7d2cf2c30d2e6e1d94ac2ce3f1355820bb42450` |
| `THIRD_PARTY_NOTICES.md` | 2,521,635 | `cdade21f50b0fc902328d5d1df95a14e1d696b0644ecad2faa528c2fd04f104b` |
| `license-review.json` | 2,530 | `223295cea406455243d377a9d96935ccdfc4ba15d5be5833cda681a67538b716` |

`installedExecutable`: path `krds-detector.exe`, `markerOffset` `13455874`,
`standaloneSha256` `bd57296b…`, 설치 후 `sha256`
`8059cb5d93fecccf013b3645d046bc9d8f8ae26bbe498896492b4dee8f61413e`, profile
`unsigned-nsis`(같은 `manifest.json`).

## 3. 주장 → 증거 대응표

| 주장(수치) | 증거 파일 | 절 / 비고 |
| --- | --- | --- |
| suite `704 passed / 1 skipped (705)`, 파일 `94 passed / 1 skipped (95)`, `204.4`초, Node `v22.23.3` | `docs/ADOPTION_LEDGER.md` | §「소스·시험 상태 (OBSERVED_LOCAL)」. 실행 시점 HEAD `16d4b56`, 원시 로그 `/tmp/final-check-node22.log`(저장소 밖) |
| 같은 suite가 Node `v26.8.1`에서도 green | 같은 파일, 같은 절 | — |
| `npm run build` EXIT 0 | 같은 파일, 같은 절 | — |
| 런타임 closure `1197` files, `nodeVersion 22.19.0` | 같은 파일 §재빌드, `scripts/windows-runtime.lock.json` | — |
| `cargo check --target x86_64-pc-windows-gnullvm --all-targets` EXIT 0 | 같은 파일 §재빌드 | 호스트 교차 검사 |
| Windows target clippy EXIT 0, `cargo fmt --check` EXIT 0 | 같은 파일 §재빌드 | CI와 같은 명령 |
| `cargo test --bins` `78 passed / 0 failed / 2 ignored` | 같은 파일 §재빌드 | 호스트 실행(Windows 아님) |
| 후보 identity·installer·standalone·설치본 hash | `artifacts/candidate-…76e7d5ec…/manifest.json` | `source`, `installedExecutable`, `files` |
| verify `8 files, 8/8` | `docs/ADOPTION_LEDGER.md` §재빌드, `scripts/verify-artifact.mjs` | EXIT 0 |
| 네 공식 기법과 축 정의 | `docs/DETECTION.md`, `packages/contracts/src/result.ts` | `PLANNING_DOC.md` §3.2 |
| `text-policy-2` 부정 조건(보장·당일·고액·보너스·쿠폰·무료체험) | `docs/PLANNING_DOC.md` | §3.2 |
| 텍스트 수집 상한(10,000 / 1,000 / 1,048,576 / 32,768 / 32 / depth 4 / 15) | `docs/PLANNING_DOC.md` §3.5, `docs/DETECTION.md` | — |
| 이미지 상한(32후보 / 1,000,000B / 250,000B / 40 OCR / 40자산·2,000,000B) | `docs/PLANNING_DOC.md` §3.4, `packages/contracts/src/policy.json` `visual` | — |
| 합성 평가 `22` 케이스(양성 13·음성 7·구조 2), 판정 쌍 `17` | `docs/PLANNING_DOC.md` §3.1, `docs/SYNTHETIC_EVAL.md`, `fixtures/synthetic/` | — |
| 적대적 `8` 공격 유형 모두 발화 | `docs/ADVERSARIAL.md`, `docs/PLANNING_DOC.md` §3.1 | — |
| 실제 소재 `190`개 입력 / `29`묶음 | `docs/EMBEDDING_QUANTIZATION_20261022.md`, `artifacts/embedding-quantization-20261022/` | 회귀 자료 |
| 실제 불법 배너 60/60, 정상 광고 오탐 0/74, 파생 양성 17/18, 파생 정상 오탐 0/38 | `docs/EMBEDDING_QUANTIZATION_20261022.md`, `docs/VISION_CPU_OPTIMIZATION_20261022.md`, `artifacts/vision-cpu-20261022/` | 모집단 정확도 아님 |
| TrOCR 정상 입력 3/10 오탐으로 기각 | `docs/OCR_ENGINE_COMPARISON_20261021.md` | — |
| IPC 명령 `26`개 | `docs/PLANNING_DOC.md` §4, `src-tauri/src/main.rs` `generate_handler` | — |
| 모델 자산 `6`개 `1,312,154,937` B, OCR `18,308,324` B | `docs/BUILD_MANUAL.md` §첫 빌드의 네트워크 요구, `packages/evidence/src/{ocr-models,text-embedding-model}/manifest.json` | 합계 약 1.33 GB |
| installer `796,348,611` B(759.46 MiB) | 후보 `manifest.json` `files`, `docs/ADOPTION_LEDGER.md` §재빌드 | — |
| 스테이징 `node_modules` 약 376 MB, `onnxruntime-node` 전 플랫폼 약 288 MB | `docs/BUILD_MANUAL.md` §`npm run package:windows` 준비 3항 | — |
| Windows 성능 표(347.131 / 174.271 / 112.477 / 87.849초, 425.4 / 433.1 / 537.5 / 781.9 MiB) | `docs/PERF.md`, `docs/PLANNING_DOC.md` §8.3 | 2026-10-07 통합 후보, 단일 실행 |
| cold-start text `3.65`초(상한 8), image `11.4`초(상한 16); 3배 과부하 text `5.5~6.0`, image `18.5~46.7`초 | `docs/ADOPTION_LEDGER.md` §「실측 잔여 위험」 | MEASURED |
| 설치 565 identity(installer 149,813,810 B, `cb414038…`)와 설치 EXE `7b6fc529…` | `docs/ADOPTION_HANDOFF_KO.md` §현재 전달 후보, `docs/OPERATIONS_GUIDE_KO.md` §후보별 실측 | 역사 후보, 현재 후보 아님 |
| D01~D10 결과 | `docs/DOGFOOD_LEDGER_20261014.md` §Task outcomes, `artifacts/dogfood-20261014/` | D08 두 대상 통합은 NOT_RUN |
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
위 표의 `c76c133f…`와 `16d4b56`은 이력 식별자이며 현재 값이 아니다. 현재 값은 §1·§2의
`85a286f`·`54c8f1cd…df406` 하나뿐이다.

## 5. 저장소 안 증거 디렉터리

| 경로 | 내용 |
| --- | --- |
| `artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-76e7d5ec6ce4-20261022T163747830Z/` | 현재 Windows 후보 8파일 |
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
cd artifacts/candidate-0.2.1-x86_64-pc-windows-gnullvm-76e7d5ec6ce4-20261022T163747830Z
sha256sum *

# manifest 대조 검증
node scripts/verify-artifact.mjs <candidate-folder>/manifest.json

# 이동한 아카이브 파일 확인
sha256sum /mnt/nas/illegal-ad-artifacts-archive-20261023/*.zip
```

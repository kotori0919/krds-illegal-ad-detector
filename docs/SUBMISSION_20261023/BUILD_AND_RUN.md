# 빌드와 실행 — 수신팀 최소 절차

> 제품 `dd5ceb4`, source `8628ba4a4488…`, 서명 없는 gnullvm 내부 평가 후보.
> Windows에서 NIA 5페이지·실패 0, 공개 두 대상 저장·재시작 복원·통합 XLSX·Excel 열람을 확인했다.
> JS/TS 770 passed / 1 skipped, 최종 native 82 passed / 0 failed / 2 ignored. 전체 E2E·제출 완료 표시는 아니다.

이 문서는 수신팀이 최소한으로 재현해야 하는 절차만 적는다. 전체 설명·근거·예외는
[`docs/BUILD_MANUAL.md`](../BUILD_MANUAL.md)에 있으므로 중복하지 않고 링크한다.
검증 결과 수치는 [`VERIFICATION_SUMMARY.md`](VERIFICATION_SUMMARY.md), 알려진 위험은
[`LIMITATIONS_AND_RISKS.md`](LIMITATIONS_AND_RISKS.md)를 따른다.

## 1. 준비물

| 구분 | 요구 | 근거 |
| --- | --- | --- |
| Node | 기준 `22.19.0`. 지원 major `22.19+` / `24` / `26`(`package.json` `engines`), `.nvmrc`는 `22` | `docs/BUILD_MANUAL.md` §준비와 다운로드 |
| 패키지 관리 | `npm ci`(lock 수정 없음). npm registry 접근 또는 사전에 채운 npm cache 필요 | 같은 절 |
| Rust | `1.98.1` + `rustfmt`, `clippy`(`rust-toolchain.toml` 고정), `cargo fetch --locked` | 같은 절 |
| 브라우저 시험 | `npx playwright-core install chromium --only-shell` | `.github/workflows/ci.yml` `verify` job |
| Windows MSVC 경로 | C++ Build Tools, Windows SDK, `x86_64-pc-windows-msvc` | `BUILD_MANUAL.md` §수신팀 주 경로: Windows MSVC |
| Linux GNU 경로 | `KRDS_LLVM_MINGW`, `KRDS_NSIS_ROOT` | `BUILD_MANUAL.md` §보존하는 별도 경로: GNU LLVM 교차 빌드 |
| 디스크 | 모델 자산 약 1.33 GB + 스테이징 `node_modules` 약 376 MB + Cargo target | `BUILD_MANUAL.md` §`npm run package:windows` 준비 |

도구 설치는 조직 승인을 받은 관리자가 수행한다. 네트워크가 없는 clean clone은 빌드할
수 없다(`BUILD_MANUAL.md` §산출물과 한계).

## 2. 의존성 설치

```sh
npm ci
cargo fetch --locked --manifest-path src-tauri/Cargo.toml
npx playwright-core install chromium --only-shell
```

`npm ci`와 `cargo fetch --locked`는 lock을 수정하지 않는다. 소스만으로 의존성을
복원할 수 없다(`BUILD_MANUAL.md` §준비와 다운로드).

## 3. 모델 자산 준비(네트워크 요구)

`npm run build`는 `packages/evidence` 빌드 중 고정 모델 자산을 내려받는다. 다운로드는
**빌드 시점에만** 일어나며 검사·탐지 실행은 이 목적의 네트워크를 쓰지 않는다
(`BUILD_MANUAL.md` §첫 빌드의 네트워크 요구).

| 자산 | 호스트 | 크기 | 고정 위치 |
| --- | --- | --- | --- |
| OCR 검출/인식 ONNX 2개 | `www.modelscope.cn`(RapidAI/RapidOCR v3.10.0) | `18,308,324` B | `packages/evidence/src/ocr-models/manifest.json` |
| 임베딩 backbone/tokenizer 6개 | `huggingface.co`(onnx-community/embeddinggemma-2-ONNX) | `1,312,154,937` B | `packages/evidence/src/text-embedding-model/manifest.json` |

합계 약 1.33 GB(1.24 GiB). 모든 항목은 manifest의 `bytes`·`sha256`으로 고정되어 있고,
다운로드 스트림은 선언 크기를 넘으면 중단하고 SHA-256 불일치 시 빌드를 실패시킨다.
`kor`/`eng` Tesseract traineddata는 `npm ci`가 공급한다(`BUILD_MANUAL.md` 같은 절).

**오프라인 빌드**: 자산을 아래 경로·파일명 그대로 미리 배치하면 다운로드 없이 빌드한다.

```text
packages/evidence/.model-cache/
├── ch_PP-OCRv5_det_mobile.onnx
├── korean_PP-OCRv5_rec_mobile.onnx
└── embeddinggemma-2-text-f32-vision-int8/
    ├── onnx/model.onnx
    ├── onnx/model.onnx_data
    ├── onnx/vision_encoder_quantized.onnx
    ├── onnx/vision_encoder_quantized.onnx_data
    ├── tokenizer.json
    └── tokenizer_config.json
```

캐시는 크기·SHA-256을 먼저 검사하고, 불일치 시 다운로드로 대체하지 않고 실패한다.
이 디렉터리는 gitignore 대상이며 패키징 산출물에 포함되지 않는다
(`BUILD_MANUAL.md` §오프라인 빌드: `.model-cache`).

## 4. 검사

```sh
KRDS_TEST_UNSANDBOXED=1 npm run check
```

Windows PowerShell(Chromium sandbox 유지):

```powershell
npm run check
```

`check`는 `typecheck` + `lint` + `vitest run`이다(`package.json`). `KRDS_TEST_UNSANDBOXED=1`은
**소유 loopback fixture의 Chromium sandbox만** 해제하는 Linux 개발기 예외이며, 외부
사이트 탐지·배포본 sandbox를 우회하지 않는다. 외부 사이트 대상 검사는 sandbox를
유지하고, sandbox를 만들 수 없으면 실패해야 한다(`BUILD_MANUAL.md` §공통 명령).
기록된 결과는 [`VERIFICATION_SUMMARY.md`](VERIFICATION_SUMMARY.md) §2를 따른다.

## 5. 빌드

```sh
npm run build           # contracts → evidence(보고서 포함) → web
npm run build:scanner   # worker용 패키지 빌드 (통합 검사에 필요)
npm run build:desktop   # Tauri native 실행 파일까지
```

`build:desktop`의 Tauri beforeBuild는 프런트엔드/worker를 다시 만들고 런타임을
**오프라인 검증**한다. 이전 workspace의 `packages/evidence/dist`를 수동으로 준비하거나
재사용하지 않는다(`BUILD_MANUAL.md` §공통 명령).

## 6. Windows 패키지

### 6.1 수신팀 주 경로 — MSVC (Windows 호스트)

```powershell
npm run prepare:windows-runtime
npm run doctor
npm run build:desktop
npm run package:windows
```

`prepare:windows-runtime`은 최초 1회 네트워크가 필요하고, 이후 beforeBuild가
`scripts/windows-runtime.lock.json`의 **1177개 항목**과 크기·SHA-256을 대조한다. lock은
`node.exe`, `node-LICENSE`, `ms-playwright/`, 스테이징된 `node_modules/`, `usque.exe`,
`usque-LICENSE.md`를 포함한다. 불일치는 실패이며 자동으로 새 해시를 신뢰하지 않는다
(`BUILD_MANUAL.md` §`npm run package:windows` 준비).

첫 `package:windows`는 Tauri 고정 NSIS/플러그인을 내려받으므로 그 회차에는 네트워크가
필요하다. `bundle.useLocalToolsDir=true`로 패키징 도구는 프로젝트 target 아래에
준비하며 작성자의 전역 도구 캐시를 요구하지 않는다
(`BUILD_MANUAL.md` §수신팀 주 경로: Windows MSVC).

### 6.2 Linux 교차 빌드 — gnullvm (보조 경로)

이 경로는 Linux에서 후보를 만드는 경로이며, 수신팀의 주 배포 경로는 MSVC다. Tauri는
교차 컴파일을 "실험적"으로 표시하고 비Windows 호스트에서는 서명을 건너뛴다.

```sh
export KRDS_WINDOWS_TARGET=x86_64-pc-windows-gnullvm
export KRDS_LLVM_MINGW="/approved tools/llvm-mingw-20260908-ucrt-ubuntu-22.04-x86_64"
export KRDS_NSIS_ROOT="/approved tools/nsis/usr"
npm run build:desktop
npm run package:windows
```

LLVM-MinGW는 clang `23.1.1`/UCRT 배포의 `bin`, `LICENSE.TXT`,
`x86_64-w64-mingw32/bin/libunwind.dll`을 포함해야 하고, NSIS `3.09` 루트는
`bin/makensis`와 `share/nsis`를 포함해야 한다. WebView2Loader.dll은 locked Cargo의
`webview2-com-sys`에서 얻으며 배포 루트 파일을 임의 DLL로 교체하지 않는다
(`BUILD_MANUAL.md` §보존하는 별도 경로, `VERIFICATION_SUMMARY.md` §1).

디스크 부족으로 `src-tauri/target`을 다른 볼륨으로 symlink하면 `sourceIdentity()`가
`git ls-files --others`에서 EISDIR로 실패한다. 이때 로컬 `.git/info/exclude`에
`src-tauri/target`을 추가하고(commit하지 않음) `git check-ignore -v src-tauri/target`로
확인한다(`BUILD_MANUAL.md` 같은 절).

## 7. 산출물 검증

```sh
npm run verify:artifact -- <candidate-folder>/manifest.json
```

후보 폴더는 `artifacts/candidate-<version>-<target>-<sourceHash>-<buildTime>/`이며
installer, native exe, manifest, build/resource manifest, npm CycloneDX SBOM, Cargo
license inventory, third-party notices가 들어간다(`BUILD_MANUAL.md` §산출물과 한계).

기록된 현재 후보 검증 결과는 EXIT `0`, 8 files, 8/8 hash 일치다
(`VERIFICATION_SUMMARY.md` §5).

## 8. 설치 파일 검증

1. `manifest.json`의 `source.commit`이 배포하려는 commit과 같은지 확인한다.
2. installer의 SHA-256을 manifest의 값과 비교한다. 현재 후보는
   `33ce86950fe11ef2dc2e210c60e6604797c2a2ffb4c8e222f4c28a0015b36d56`
   (`746,947,332` B, 712.34 MiB)이다.
3. standalone `krds-detector.exe` hash와 **설치된** exe hash를 구분한다. Tauri는 NSIS
   생성 시 bundle 식별자를 `UNK`→`NSS`로 바꾸므로 두 hash는 다를 수 있고, manifest의
   `installedExecutable` 절이 별도 hash를 기록한다. standalone hash를 설치본에
   대입하지 않는다(`BUILD_MANUAL.md` §산출물과 한계).
4. SHA-256은 무결성 검사이며 발행자 인증이 아니다. 현재 후보는 서명되지 않았다.

## 9. 실행과 데이터 위치

- 실행: 설치 후 앱을 일반 사용자 권한으로 시작한다. Node·개발 저장소·별도
  Playwright/OCR 설치가 필요 없다(`docs/USER_MANUAL.md` §설치와 제거).
- 케이스: `%APPDATA%\kr.go.nia.illegal-ad-detector\cases\<케이스 번호>\`에
  `result.json`, `result_extra.json`, `review.json`, 근거 자산이 분리 저장된다
  (`docs/OPERATIONS_GUIDE_KO.md`, `docs/DATA_HANDLING_KO.md`).
- WARP 설정(선택): 같은 앱 데이터의 `warp/config.json`. 평문이며 폴더·파일 ACL은 현재
  사용자와 SYSTEM으로 제한된다. 앱 자체 암호화는 없다(`DATA_HANDLING_KO.md`).
- 브라우저 미리보기: 예시 데이터만 표시하며 영구 보관을 지원하지 않는다
  (`USER_MANUAL.md` §현재 사용 순서).
- 진단: `powershell -NoProfile -File scripts/managed-deployment.ps1 -Action diagnose`.
  사이트를 방문하지 않고 원문·자격 정보를 담지 않는다(`OPERATIONS_GUIDE_KO.md`).

## 10. 제거와 정리

- 앱을 정상 종료한 뒤 Windows 설치된 앱 목록에서 제거한다. 제거 시 **Delete
  application data를 해제**하고, 기존 Save As 내보내기와 AppData 사례가 남는지 해당
  후보에서 확인한다(`OPERATIONS_GUIDE_KO.md` §제거, 보관, 공유).
- 케이스 삭제는 앱의 명시 삭제 기능이다. 앱에서 되돌릴 수 없고 별도로 저장한 전달·
  백업 폴더는 유지된다(`USER_MANUAL.md` §전달·백업·삭제·진단).
- 백업·원복·복원은 앱을 닫고 관리 스크립트를 쓴다.

```powershell
powershell -NoProfile -File scripts/managed-deployment.ps1 -Action backup -BackupPath '<protected-backups>\daily'
powershell -NoProfile -File scripts/managed-deployment.ps1 -Action rollback -Manifest '<previous>\manifest.json' -Installer '<previous>\setup.exe' -BackupPath '<protected-backups>\before-rollback'
powershell -NoProfile -File scripts/managed-deployment.ps1 -Action restore -BackupPath '<protected-backups>\before-upgrade' -ConfirmRestore
```

`upgrade`/`rollback`은 설치 전에 AppData를 새 백업 폴더로 복사하고 모든 파일 hash를
기록하며 기존 백업을 덮어쓰지 않는다. 성공 exit만으로 업무 검증을 인정하지 말고 앱
build ID, 기존 사례 재열기, 메모, 원본 hash를 확인한다. 이 스크립트의 새 실행은 현재
후보에서 NOT_RUN이다(`OPERATIONS_GUIDE_KO.md` §후보별 실측과 외부 수용).

모델 캐시 `packages/evidence/.model-cache/`는 패키징 산출물이 아니므로 정리 대상에
포함해도 설치본 동작에 영향이 없다(`BUILD_MANUAL.md` §오프라인 빌드: `.model-cache`).

## 11. 더 읽을 문서

| 목적 | 문서 |
| --- | --- |
| 전체 빌드·도구·예외 | [`docs/BUILD_MANUAL.md`](../BUILD_MANUAL.md) |
| 운영·배포·백업·제거 | [`docs/OPERATIONS_GUIDE_KO.md`](../OPERATIONS_GUIDE_KO.md) |
| 데이터 처리·보관 | [`docs/DATA_HANDLING_KO.md`](../DATA_HANDLING_KO.md) |
| 사용 방법 | [`docs/USER_MANUAL.md`](../USER_MANUAL.md) |
| 유지보수 경계 | [`docs/MAINTAINER_GUIDE_KO.md`](../MAINTAINER_GUIDE_KO.md) |
| CI 정의 | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |

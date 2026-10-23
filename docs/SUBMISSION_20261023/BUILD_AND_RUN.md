# 설치·실행 및 소스 빌드

## Windows 설치와 실행

1. `불법광고 탐지 도구_0.2.1_x64-setup.exe`를 실행한다.
2. 앱을 시작하고 점검할 웹사이트 주소를 입력한다.
3. 점검이 끝나면 탐지 항목과 확인 범위를 검토한다.
4. 공식 탐지의 판단·메모를 저장하고 JSON 또는 Excel 보고서를 내보낸다.

Windows 11 x64와 WebView2가 필요하다. WebView2가 없으면 설치 관리자가 내려받는다.
Node·Chromium·OCR·모델은 설치 파일에 포함된다. 설치 파일 크기는746,959,183B(712.36MiB)다.
해시는 [파일 식별](EVIDENCE_INDEX.md)을 따른다.

사례 저장 위치는 `%APPDATA%\kr.go.nia.illegal-ad-detector\cases\`다.
화면 사용법과 여러 대상 점검은 [사용자 설명서](../USER_MANUAL.md)를 따른다.

## 빌드 환경

| 항목 | 요구 |
| --- | --- |
| Node.js | 22.19+ / 24 / 26, npm |
| Rust | 1.98.1, rustfmt, clippy |
| Windows 도구 | C++ Build Tools, Windows SDK, MSVC target |
| 모델 자산 | OCR·임베딩 약1.33GB, manifest의 크기·SHA-256으로 검증 |

저장소는 [GitHub](https://github.com/kotori0919/krds-illegal-ad-detector/tree/dev/bootstrap)이며 제품 버전은0.2.1이다.
제출 소스를 풀거나 저장소의 `dev/bootstrap` 브랜치를 받은 뒤 루트에서 실행한다.
최초 의존성·모델·Windows 런타임 준비에는 네트워크가 필요하다.

## Windows에서 빌드

```powershell
npm ci
cargo fetch --locked --manifest-path src-tauri/Cargo.toml
npx playwright-core install chromium --only-shell
npm run prepare:windows-runtime
npm run build:desktop
npm run package:windows
```

`build:desktop`은 프런트엔드·스캐너·native 실행 파일을 만들고 준비된 런타임을 검증한다.
`package:windows`는 설치 파일과 manifest·라이선스 고지를 후보 폴더에 모은다.

```powershell
npm run verify:artifact -- artifacts/<candidate-folder>/manifest.json
```

`<candidate-folder>`에는 생성된 후보 폴더명을 넣는다. 산출물은
`artifacts/candidate-<version>-<target>-<sourceHash>-<buildTime>/`에 생성된다.

## 검사

```powershell
npm run check
cargo test --manifest-path src-tauri/Cargo.toml --bins --locked
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

`npm run check`는 TypeScript 검사·lint·Vitest를 실행한다.

## 제출 설치 파일의 Linux 교차 빌드 환경

제출 설치 파일은 `x86_64-pc-windows-gnullvm`, LLVM-MinGW20260908/clang23.1.1,
NSIS3.09-4, Rust1.98.1, Node26.8.1로 생성했다. 내장 worker Node는22.19.0이다.

```sh
export KRDS_WINDOWS_TARGET=x86_64-pc-windows-gnullvm
export KRDS_LLVM_MINGW="/tools/llvm-mingw-20260908-ucrt-ubuntu-22.04-x86_64"
export KRDS_NSIS_ROOT="/tools/nsis/usr"
npm run build:desktop
npm run package:windows
```

모델 manifest와 런타임 lock은 소스에 포함된다. 미리 준비한 모델 캐시를 사용하면 모델을
다시 내려받지 않으며 모든 파일의 크기·해시를 확인한다.
상세 도구·자산 경로는 [전체 빌드 설명](../BUILD_MANUAL.md)에 있다.

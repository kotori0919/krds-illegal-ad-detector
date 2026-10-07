# 실행·빌드 매뉴얼 (제출용)

대상: Windows 11 (GPU 불필요). 소스에서 빌드 가능해야 함.

## 1. 준비물

- Node.js 22 이상 (`node --version` 확인)
- Rust와 대상 플랫폼 도구 체인 (현재 RC의 실제 버전은 아래 참조)
- Windows 실행: WebView2 Runtime. 설치본에 없으면 NSIS가 bootstrapper를 내려받습니다.
- 설치 관리자 빌드: NSIS

## 2. 웹 미리보기 (개발 확인용)

```bat
npm ci
npm run build:scanner
npm run typecheck
npm run lint
npm run test
npm run build
npm run dev
```

브라우저에서 `http://127.0.0.1:5173/` 접속. 미리보기는 데모 데이터이며
실제 스캔은 데스크톱 앱에서 실행됨.

## 3. 스캐너 워커 직접 실행 (Node)

```bat
npm run build:scanner
node packages/detection/dist/worker.js --session <id> --entry-url <URL> --max-pages 200 --max-depth 4 --timeout-sec 1500 --settle-ms 1500 --out-file result.json
```

전제: `dist/`는 커밋되지 않으므로(`.gitignore`), 클린 체크아웃에서는
먼저 루트에서 `npm run build:scanner`로 의존 패키지를 순서대로 빌드해야 합니다.
`npm run typecheck`만으로는 스캐너의 실행 파일이 생성되지 않습니다.

`--out-file`에 UTF-8 `result.json` 직접 기록 (BOM 없음). stdout 폴백도
바이트 기록. PowerShell `>` 리다이렉션은 UTF-16으로 강제 변환하므로
사용하지 마세요. 진단은 stderr. 한국어 원문은 엄격 UTF-8로 디코딩 검증.

## 4. 데스크톱 앱 빌드 (Tauri)

```bat
npm ci
npx tauri build --config src-tauri/tauri.conf.json -- --locked
```

산출물: NSIS 설치 관리자 (`src-tauri/target/release/bundle/nsis/`).
`src-tauri/target/`는 제출물에 포함하지 않음 (`.gitignore`).

### Linux GNU LLVM 교차 빌드

`x86_64-pc-windows-gnullvm` 실행 파일은 `libunwind.dll`과 `WebView2Loader.dll`에
의존합니다. 이 빌드에는 `src-tauri/tauri.gnullvm.conf.json`을 함께 적용하여
두 DLL을 설치 폴더의 실행 파일 옆에 배치합니다. `libunwind.dll`은 링크에 사용한
동일한 LLVM MinGW 배포판의 x64 파일을 `src-tauri/binaries/`에 준비하고,
배포판의 `LICENSE.TXT`도 `src-tauri/binaries/llvm-LICENSE`로 복사합니다.
`WebView2Loader.dll`은 Cargo.lock의 `webview2-com-sys 0.39.1` 배포에 포함된
`x64/WebView2Loader.dll`을 같은 위치로 복사합니다. 이는 WebView2 Runtime 자체가 아닙니다.
MSVC 빌드는 기본 설정을 사용하지만 현재 RC에서는 실행하지 않았습니다.

현재 GNU LLVM 경로의 리소스 컴파일러는 `RC=llvm-rc`로 지정합니다.
`embed-resource 3.0.11`은 LLVM MinGW의 `x86_64-w64-mingw32-windres`를
`Unknown RC compiler variant`로 거부했습니다. LLVM MinGW의 `bin`을 PATH에
추가하고 저장소 루트에서 아래 전체 빌드를 실행합니다. `tauri bundle`만 실행한
portable overlay는 전체 설치본 빌드 증거를 대신하지 않습니다.

```sh
npm ci --ignore-scripts
export CARGO_TARGET_X86_64_PC_WINDOWS_GNULLVM_LINKER=x86_64-w64-mingw32-clang
export CC_x86_64_pc_windows_gnullvm=x86_64-w64-mingw32-clang
export AR_x86_64_pc_windows_gnullvm=x86_64-w64-mingw32-ar
export RC=llvm-rc
npx tauri build --target x86_64-pc-windows-gnullvm \
  --config src-tauri/tauri.gnullvm.conf.json --ci -- --locked --offline
```

OBSERVED — 현재 RC는 Rust 1.98.1, `x86_64-pc-windows-gnullvm`,
`llvm-mingw-20260908-ucrt-ubuntu-22.04-x86_64`의 clang 23.1.1,
Tauri CLI 2.12.0, NSIS 3.09로 위 경로를 실행했습니다. 빌드 Node는 26.8.1이며
설치본의 Node는 별도로 고정한 22.19.0입니다. Cargo의 `--offline`은 미리 준비한
crate 캐시를 사용합니다. npm·Node·브라우저 리소스 준비 전체가 오프라인이라는 뜻은 아닙니다.
사용자 위치에 풀어 놓은 NSIS는 실행 wrapper에서 해당 배포의 `NSISDIR`를 설정해야 합니다.
실제 PATH, wrapper, lockfile 해시와 로그는 RC manifest에 기록합니다.

현재 KODEX·GOAL·제품 요구사항은 Windows 11 실행과 배포를 요구하며 특정
컴파일러를 지정하지 않습니다. 과거 `DRY_RUN.md`의 SDK-gated MSVC 항목은
그 당시 빌드 경로의 미검증 기록입니다. 현재 GNU LLVM 설치본의 Windows 관측은
MSVC 링크 승인 증거가 아닙니다. MSVC 별도 빌드는 NOT_RUN이며 도구 체인을 변경하지 않았습니다.

교차 빌드 결과는 Windows에서 설치 후 실행해 확인해야 합니다. 설치 완료 메시지만으로
실행 파일과 스캐너 런타임의 누락 여부를 확인할 수 없습니다.
현재 후보의 설치·검사·제거, 제한 시간·저장, 강제 정리 결과는
[RELEASE_CANDIDATE.md](RELEASE_CANDIDATE.md)의 동일 후보 Gate A/B/C를 참조합니다.

OCR 런타임도 설치 리소스에 포함됩니다. `build:sidecar`가 별도 OCR worker와
고정된 한국어·영어 학습 데이터를 만들고, `prepare:windows-runtime`이 Tesseract의
Node 의존성과 WASM을 준비합니다. 기존 Node·Playwright만 복사한 구형 리소스로는
새 OCR 기능을 검증할 수 없습니다. 좁은 실제 worker 검증 명령은
`src-tauri/binaries/README.md`의 `windows-v2-integration.mjs`를 사용합니다.

WebView2의 `downloadBootstrapper` 방식은 런타임이 없는 기기에서 네트워크를
필요로 합니다. OCR의 WASM·한국어·영어 데이터가 설치본에 있어도 오프라인 설치를
보장하지 않습니다. 현재 RC의 VM에는 WebView2가 이미 있었으므로 부재 시 설치와
완전 오프라인 설치는 NOT_RUN입니다.

## 5. 검증

- `result.json`: UTF-8/BOM 없음, `meta`+`findings`, 기법 4종만, ID 고유,
  `url+location+technique` 중복 없음. 앱은 저장 전에 내부 검증을 수행하며,
  오류가 있으면 저장을 차단함. 실제 저장 파일도 공식 검증기로 확인해야 함.
- 종료 후 브라우저 좀비 프로세스가 남지 않아야 함 (Job Object 정리).

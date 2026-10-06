# 실행·빌드 매뉴얼 (제출용)

대상: Windows 11 (GPU 불필요). 소스에서 빌드 가능해야 함.

## 1. 준비물

- Node.js 22 이상 (`node --version` 확인)
- Rust stable (Tauri 빌드용, 최신 rustup)
- Windows: WebView2 (Windows 11 기본 포함), NSIS (설치 관리자 빌드용)

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
npm run build
npx tauri build --config src-tauri/tauri.conf.json
```

산출물: NSIS 설치 관리자 (`src-tauri/target/release/bundle/nsis/`).
`src-tauri/target/`는 제출물에 포함하지 않음 (`.gitignore`).

### Linux GNU LLVM 교차 빌드

`x86_64-pc-windows-gnullvm` 실행 파일은 `libunwind.dll`과 `WebView2Loader.dll`에
의존합니다. 이 빌드에는 `src-tauri/tauri.gnullvm.conf.json`을 함께 적용하여
두 DLL을 설치 폴더의 실행 파일 옆에 배치합니다. `libunwind.dll`은 링크에 사용한
동일한 LLVM MinGW 배포판의 x64 파일을 `src-tauri/binaries/`에 준비하고,
배포판의 `LICENSE.TXT`도 `src-tauri/binaries/llvm-LICENSE`로 복사합니다.
`WebView2Loader.dll`은 해당 빌드의 release 폴더에서 같은 위치로 복사합니다.
MSVC 빌드는 기본 설정을 사용합니다.

```sh
npx tauri bundle --target x86_64-pc-windows-gnullvm --bundles nsis --config src-tauri/tauri.gnullvm.conf.json --ci
```

교차 빌드 결과는 Windows에서 설치 후 실행해 확인해야 합니다. 설치 완료 메시지만으로
실행 파일과 스캐너 런타임의 누락 여부를 확인할 수 없습니다.

## 5. 검증

- `result.json`: UTF-8/BOM 없음, `meta`+`findings`, 기법 4종만, ID 고유,
  `url+location+technique` 중복 없음. 앱은 저장 전에 내부 검증을 수행하며,
  오류가 있으면 저장을 차단함. 실제 저장 파일도 공식 검증기로 확인해야 함.
- 종료 후 브라우저 좀비 프로세스가 남지 않아야 함 (Job Object 정리).

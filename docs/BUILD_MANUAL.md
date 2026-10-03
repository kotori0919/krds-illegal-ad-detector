# 실행·빌드 매뉴얼 (제출용)

대상: Windows 11 (GPU 불필요). 소스에서 빌드 가능해야 함.

## 1. 준비물

- Node.js 22 이상 (`node --version` 확인)
- Rust stable (Tauri 빌드용, 최신 rustup)
- Windows: WebView2 (Windows 11 기본 포함), NSIS (설치 관리자 빌드용)

## 2. 웹 미리보기 (개발 확인용)

```bat
npm ci
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
npm run build -w @krds-detector/contracts
npm run build -w @krds-detector/synth-eval
npm run build -w @krds-detector/scanner
npm run build -w @krds-detector/detection
node packages/detection/dist/worker.js --session <id> --entry-url <URL> --max-pages 200 --max-depth 4 --timeout-sec 1500 --settle-ms 1500 --out-file result.json
```

전제: `dist/`는 커밋되지 않으므로(`.gitignore`), 클린 체크아웃에서는
먼저 루트에서 `tsc -b`(또는 `npm run typecheck`)를 실행해 패키지 참조를
빌드해야 합니다. `tsc -b`는 `tsconfig.json`의 references를 순서대로 처리합니다.

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

## 5. 검증

- `result.json`: UTF-8/BOM 없음, `meta`+`findings`, 기법 4종만, ID 고유,
  `url+location+technique` 중복 없음 — 앱의 검증 화면 6개 항목이 전부 통과해야 함.
- 종료 후 브라우저 좀비 프로세스가 남지 않아야 함 (Job Object 정리).

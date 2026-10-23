# 설치 및 데이터 배치

앱 식별자는 `kr.go.nia.illegal-ad-detector`이며 관리 업데이트에서도 유지한다. 설치 리소스와 운영 사례를 분리한다.

```text
<current-user installation>/
  krds-detector.exe
  libunwind.dll, WebView2Loader.dll        GNU LLVM profile only
  uninstall.exe
  binaries/
    scanner-worker-x86_64-pc-windows-gnu.mjs
    ocr-worker.mjs, ocr-data/{kor,eng}.traineddata.gz
    node.exe, node-LICENSE
    node_modules/                         locked runtime dependency closure/WASM
    ms-playwright/                        pinned Windows Chromium/FFmpeg/DLL inspector
    build-manifest.json, resources-manifest.json
%APPDATA%/kr.go.nia.illegal-ad-detector/
  cases/<opaque UUID>/
    manifest.json
    result.json                           immutable official original
    result_extra.json                     optional
    evidence.json                         optional typed evidence; asset references
    review.json                           mutable operator review with revision
    assets/                               case-owned content hashes
```

Windows 데이터 기본 폴더는 Tauri `app_data_dir()`의 Roaming AppData다. 실제 사례/공식 출력 경로는 앱에서 확인한다. Linux 개발 환경은 XDG data directory 하위 동일 식별자를 사용한다. `result.json`의 schema는 공식 계약이고 사례/검토/빌드 manifest 버전과 별개다. optional evidence 오류는 유효한 공식 결과를 지우지 않는다. 임시 `.pending-*`는 불완전 트랜잭션이며 성공 사례로 표시하지 않는다.

worker의 기존 GNU suffix 파일명은 resource lookup 호환을 위해 유지하며 MSVC 실행 파일을 의미하지 않는다. 프로그램은 내장 Node/브라우저/OCR를 사용하며 운영자 PC의 npm, Rust, 사용자 Playwright cache가 필요하지 않다. 두 manifest는 설치 파일이 어떤 소스/런타임에서 나왔는지 확인하는 자료다. Playwright `.links`의 준비 기계 절대 경로는 배포하지 않는다.

일반 제거는 사례/사용자 내보내기를 삭제하지 않는다. 데이터 삭제는 별도 명시 작업이며 보존 기간은 조직이 정한다. 사례를 신뢰할 수 없는 웹뷰에 렌더링하지 않고 가져온 HTML을 실행하지 않는다. 백업/원복은 [운영 인계](OPERATIONS_GUIDE_KO.md), 빌드 준비는 [빌드 매뉴얼](BUILD_MANUAL.md)을 따른다. 과거 설치본의 경로/해시는 [역사 RC 기록](RELEASE_CANDIDATE.md)에 남아 있다.

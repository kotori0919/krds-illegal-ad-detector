# 수신팀 빌드 매뉴얼

현재 소스 후보는 `0.2.1`, 탐지 정책은 `2`, Case 형식은 `1`이다. 후보의 정확한 식별은 버전 문자열 대신 `artifacts/candidate-*/manifest.json`의 commit/sourceSha256와 설치 파일 SHA-256으로 한다. 과거 0.1.0 설치본과 검증은 [RELEASE_CANDIDATE.md](RELEASE_CANDIDATE.md)의 역사 기록이다. 현재 후보의 실제 판정은 별도 채택 인계 기록을 따른다.

## 준비와 다운로드

기준 Node 빌드/내장 런타임은 22.19.0, 빌드 호환 범위는 Node 22/24/26, Node 타입은 22.19.0이다. Rust 1.98.1와 fmt/Clippy는 `rust-toolchain.toml`로 고정한다. npm/Cargo lock을 수정하지 않는 `npm ci`, `cargo fetch --locked`를 사용한다. 도구 설치는 조직 승인을 받은 관리자가 수행한다.

```powershell
npm ci
cargo fetch --locked --manifest-path src-tauri/Cargo.toml
npm run prepare:windows-runtime
npm run doctor
```

`prepare:windows-runtime`은 Node의 공식 고정 SHA-256, Playwright 1.63.0의 Windows Chromium 1243/FFmpeg 1011/Windows DLL inspector 1007, Tesseract 7 및 한국어/영어 데이터를 준비한다. `scripts/windows-runtime.lock.json`은 출처와 전체 런타임 파일 해시를 기록한다. 검증 불일치는 실패이며 자동으로 새 해시를 신뢰하지 않는다. 실제 Windows 브라우저 실행이 만드는 세 개의 알려진 빈 `DEPENDENCIES_VALIDATED` 캐시 파일만 준비/검증 전에 제거한다. 링크, 비어 있지 않은 marker, 알 수 없는 DLL/추가 파일은 허용하지 않는다. 관리자가 출처와 의도한 의존성 변경을 검토한 뒤에만 `node scripts/prepare-windows-runtime.mjs --update-lock`로 갱신한다. 다운로드와 npm/Cargo 캐시 준비 없이 오프라인 빌드가 된다는 뜻은 아니다.

## 공통 명령

```powershell
npm run doctor
npm run check
npm run test:integration
npm run dev
npm run build:desktop
npm run package:windows
npm run verify:artifact -- <candidate-folder>/manifest.json
```

`doctor`는 도구 버전, 쓰기 가능한 데이터 폴더, 전체 고정 런타임 파일을 확인하고 복구 방법을 출력한다. 도구를 설치하거나 보안 설정을 변경하지 않는다. `check`는 타입/lint/unit 경계를 한 번 검사한다. `test:integration`은 실제 worker를 임시 한글/공백 경로에서 실행하고 루프백 서버의 숨긴 광고와 정상 도서관 문장을 검사한다. 브라우저 sandbox가 불가능하면 실패하며 정상 실행 경로에서 우회하지 않는다. `dev` 웹 미리보기는 네이티브 스캔 증거가 아니다. `clean`은 선언한 생성 dist만 지우며 symlink를 거부한다. 사례, 런타임 준비물, 역사 RC는 지우지 않는다.

`build:desktop`은 실제 네이티브 실행 파일까지, `package:windows`는 NSIS 설치본까지 빌드한다. Tauri beforeBuild는 프런트엔드/worker를 새로 만들고 런타임을 **오프라인 검증**한다. root `npm run build`는 contracts → evidence(보고서 포함) → web 순서로 컴파일하며 desktop도 같은 경로를 사용한다. 이전 workspace의 `packages/evidence/dist`를 수동으로 준비하거나 재사용하지 않는다. 첫 `package:windows`는 별도로 NSIS/플러그인을 다운로드할 수 있으므로 npm/Cargo/runtime 준비만으로 완전한 cached 오프라인 패키징이 성립하지 않는다. 패키징 도구까지 한 번 준비한 후의 재빌드와 첫 온라인 준비를 구분한다. 소스/lock/frontend/worker/native 설정 혼합은 sourceSha256와 파일 해시로 검출한다. 빌드 중 소스가 변하면 설치 후보 생성을 거부한다.

## 보존하는 별도 경로: GNU LLVM 교차 빌드

이 경로는 Linux에서 기존 검증 도구 체인을 사용하며 0.2.0 중간 후보의 설치·원복 식별을 보존한다. 수신팀의 주 배포 경로는 아래 Windows MSVC다. 다음은 수신팀이 직접 준비한 배포 루트를 지정하는 예이며 사용자 홈/별칭/wrapper에 의존하지 않는다.

```sh
export KRDS_WINDOWS_TARGET=x86_64-pc-windows-gnullvm
export KRDS_LLVM_MINGW="/approved tools/llvm-mingw-20260908-ucrt-ubuntu-22.04-x86_64"
export KRDS_NSIS_ROOT="/approved tools/nsis/usr"
npm run build:desktop
npm run package:windows
```

LLVM MinGW는 clang 23.1.1/UCRT 배포의 `bin`, `LICENSE.TXT`, `x86_64-w64-mingw32/bin/libunwind.dll`을 포함해야 한다. NSIS 3.09 루트는 `bin/makensis`와 `share/nsis`를 포함해야 한다. Tauri가 NSIS 환경 변수를 제거하므로 저장소 스크립트가 선택한 루트의 `NSISDIR`을 복원하는 임시 launcher를 만들고 종료 후 제거한다. 사용자 홈의 wrapper를 요구하지 않는다. linker와 `RC=llvm-rc`도 자식 프로세스에만 설정한다. WebView2Loader.dll은 **locked Cargo**의 webview2-com-sys에서 얻는다. 배포 루트 파일을 임의 DLL로 교체하지 않는다. 설치본 manifest에 compiler/NSIS 버전과 실행 파일/loader/license 해시를 남긴다. LLVM/NSIS를 저장소가 자동 설치하지 않는다.

## 수신팀 주 경로: Windows MSVC

Windows는 C++ Build Tools와 Windows SDK, Rust `x86_64-pc-windows-msvc`가 필요하다. 기본 `package:windows` 대상은 MSVC다. `bundle.useLocalToolsDir=true`로 Tauri 패키징 도구는 프로젝트 target 아래에 준비하며 작성자의 전역 도구 캐시를 요구하지 않는다. 첫 준비에는 Tauri가 고정한 도구 다운로드 연결이 필요하다. Windows CI는 실제 fmt/Clippy/test/link와 패키지 worker smoke를 검사한다. workflow_dispatch의 선택 항목은 서명 없는 내부 MSVC 후보를 만들며 공개 release는 하지 않는다. 새 Windows clone과 task 전용 빈 npm/Cargo 캐시에서 실제 MSVC 네이티브 빌드·NSIS 패키징·공급망 생성·artifact 검증을 실행했다. 최초 도구 준비도 Tauri가 고정한 NSIS 3.11과 플러그인을 프로젝트 target 아래로 다운로드했다. 정확한 후보·도구 해시와 실행 범위는 adoption handoff를 따른다. GNU 증거와 MSVC 증거는 독립적이다.

## 산출물과 한계

`artifacts/candidate-<version>-<target>-<sourceHash>-<buildTime>/`에는 installer, native exe, manifest, build/resource manifest, npm CycloneDX SBOM, Cargo license inventory, third-party notices가 들어간다. 첫 당사자 라이선스는 소유자 결정이 필요하며 이 작업은 라이선스를 선택하지 않는다. dependency inventory는 법률 검토나 취약점 부재 증명서가 아니다.

Tauri는 NSIS를 만들 때 실행 파일 내부 bundle 식별자를 `UNK`에서 `NSS`로 바꾼 뒤 standalone 파일을 복원한다. 따라서 standalone exe 해시와 설치된 exe 해시는 다를 수 있다. 설치본 해시·build ID와 manifest의 별도 `installedExecutable` 해시를 확인하며 standalone 해시를 설치 파일에 대입하지 않는다. [Tauri CLI 2.12.1 구현](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.1/crates/tauri-bundler/src/bundle.rs)과 일치하는 marker 변환만 허용한다.

후보는 내부 서명 없는 파일이다. SHA-256은 무결성 검사이며 발행자 인증이 아니다. Authenticode는 조직 인증서와 별도 승인 후 Tauri의 서명 설정으로 연결한다. updater 서명과 Authenticode를 혼동하지 않는다. 네트워크 자동 업데이트는 없다. 재빌드는 기능/계약 재현을 뜻하며 단일 빌드로 bit-identical을 주장하지 않는다. 서명/시간/installer metadata는 달라질 수 있다.

WebView2는 사전 설치 또는 승인된 온라인 bootstrapper 방식이다. 현재 offline 설치 profile은 없으며 런타임 부재/완전 오프라인 설치 검증은 별도다. bundled OCR의 오프라인 실행, cached 오프라인 빌드, 오프라인 설치, 인터넷 사이트 탐지는 서로 다르다. 실제 Windows 설치/업그레이드/원복 판정은 [운영 인계](OPERATIONS_GUIDE_KO.md)와 후보별 검증 기록을 함께 확인한다.

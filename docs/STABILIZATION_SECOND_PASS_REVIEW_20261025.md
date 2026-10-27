# KRDS 두 번째 패스 독립 검수

대상 `<stabilization-worktree>`
직전 검수 `e33b88d983c698175af76c139d1e6a5ca67eff85`
검증 코드 `7395be2452a3a6a9b2da0f18361378682596923c`
최종 제출 `bc1e92a925cf31ab79f29e3400e84bdbad5c71d0`

## 판단

현재까지 새 Critical/High/Medium 제품 결함은 발견하지 못했다. cache 제한·삭제 후 구 요청 격리·이벤트 전달 회귀의 국소 코드 변경은 타당하다. 문서 Low 1건을 제외하고 코드 리뷰 관점에서 PR 검토에 올릴 수 있다. 실제 PR 생성·push 승인이나 보호 CI 통과를 뜻하지 않는다. Windows-ready/전체 안정화 승인은 여전히 보류한다.

## 발견 사항

**Low, 높은 확신 — Retry-After 안내의 적용 응답 범위가 코드보다 넓다.**
위치 `docs/ACCESS_LIMITATIONS.md:9` ↔ `packages/scanner/src/access.ts:24-27`, `packages/scanner/src/sitemap.ts:142-146`, `packages/scanner/src/crawl.ts:427`, `:468`.

새 문구는 “서버의 Retry-After가 유효하면” 후속 페이지 시작을 늦춘다고 쓴다. 실제 페이지 분류와 sitemap은 HTTP429일 때만 이 값을 반영한다. 예를 들어503 + Retry-After는 navigation 오류로 분류되며 이 값으로 다음 페이지를 늦추지 않는다. 재현 근거는 위 조건 분기의 직접 확인이며 503 HTTP runtime 주입 시험은 추가하지 않았다.

영향은 운영자가 대기 정책을 과대 해석할 수 있다는 문서 정확성 문제다. 이번 코드 변경으로 생긴 Retry-After 제품 동작 회귀는 아니다. 최소 후속 조치는 안내를 “HTTP429 응답의 유효한 Retry-After”로 한정하는 것이다. 정책을 확대하는 구현 변경을 이 검수에서 요구하거나 수행하지 않는다.

나머지 관측은 결함 판정이 아닌 검증 범위 한계다: 16MiB는 실제 heap hard cap이 아니며, synthetic probe는 native Windows 메모리 성능이 아니고, authored holdout은 외부 독립 benchmark가 아니다.

## 코드 검토와 근거

`apps/web/src/host/tauri.ts:47-55`, `:114-163`:

- Map entry는 promise와 성공 응답의 직렬화 가중치를 저장한다. 같은 key는 Map 끝으로 이동시키며 같은 Promise를 반환하므로 진행 중 요청 병합을 유지한다.
- 가중치는 `2*(key.length + JSON.stringify(value).length)`. 완료 시 16MiB/128항목 제한을 적용하고 오래된 완료 응답을 제거한다. pending entry는 퇴출하지 않는다. 따라서 전체 진행 중 요청 수의 hard cap은 없다. 객체 오버헤드/배열 구조/열린 UI/이미지 decode/native process를 계상하는 실제 메모리 한도도 아니다.
- 단일 oversized 응답은 호출자에게 반환하고 cache에서만 제거하므로 유용한 기존 항목을 모두 밀어내지 않는다. JSON 직렬화 실패도 원래 성공 응답을 오류로 바꾸지 않는다.
- `deleteCase()` 성공 후 Map과 누적 바이트를 초기화한다. 완료/실패 callback과 forget 함수의 `Map.get(key) === entry` 확인으로 옛 응답이 새 replacement의 삭제·계상에 영향을 주지 않는다.
- eviction은 반환 객체를 수정하지 않는다. `AssetImage.tsx` → `useEvidenceRead()`는 반환 응답을 React state에 보관하므로 cache에서 제외돼도 열린 이미지가 참조한 값은 유지된다. 재열람은 IPC 비용과 실패 가능성이 다시 생기며 기존 retry UI를 거친다.
- 이벤트 시험은 실제 ScanEvent 모양, invoke 중 즉시 전달, 실패 후 재시도 전달을 확인하도록 개선됐다. native callback cleanup은 여전히 검증하지 않으며 보고서도 이를 명시한다.

회귀 시험은 baseline e33b88d + 제출 시험에서 실제4FAIL/2PASS(8 filter skip)가 나왔다. 실패 항목은 oversized 비보관, 이미지 eviction, metadata eviction, 구 요청 실패가 replacement를 지우는 경합이다. 최종 adapter에서는 파일14개 전부 PASS했다. 따라서 구현을 복제하는 무의미한 녹색 시험은 아니다.

상한 경계값의 정확한 16MiB/128 직전·직후와 pending 대량 중첩 전 조합을 직접 assertion하는 시험은 없다. 일반적인 순차 부하/oversize/coalescing와 race를 시험하고 상한 분기를 코드로 확인했다. 이를 전체 앱 OOM 방지 보장으로 확대하지 않는다.

## 소스·증거 provenance

- `7395be2 → bc1e92a` 변경은 `docs/ACCESS_LIMITATIONS.md`, `docs/STABILIZATION_FIRST_PASS_REVIEW_20261025.md`, `docs/STABILIZATION_SECOND_PASS_20261025.md` 3개뿐. docs-only 주장 확인.
- 직전 e33b88d 대비 총6파일 +499/-15: adapter, test, 새 memory probe, 문서3개. 탐지/임계치/모델/Rust/패키징 소스 변경 없음.
- `7395be2^{tree}` = `c36704776800112d5edd728f2944483ea5d1a1c8`.
- `EVIDENCE_INDEX.json`의132파일 bytes/SHA 전부 일치. 각 receipt와 logSHA도 전부 일치.
- 코드·fixture manifest403파일을 최종 제출 archive와 대조해 전부 일치. canonical manifest hash = `77a9fe529b5ab770c9db848ea9587ba5fb9ced94a6dd5d25c27293a543ea0893`.
- 별도 제품 sourceIdentity290파일의 경로+NUL+파일SHA 알고리즘을 재계산해 `774dbb973b4a1453065bf9c8a8f3c24428fa73a5544e993ca62c5ea3d9f57dfd` 일치. benchmark/test 전체의 해시와 다른 범위임을 구분했다.
- check-holdout receipt는7395be2/clean/실행전후 동일/명령·환경 플래그·UTC·exit·logSHA를 담는다. 첫 패스의 단순 로그 귀속 부족은 이번 evidence packaging에서 보완됐다. receipt 자체의 실행 주장은 독립 재실행으로 다시 확인한다.
- 검수 시작 시 제출 clean/HEADbc1e92a, 원본은 baseline7bf3e683 유지. 종료 상태는 final-status.log 참조. 과거 ignored 데이터의 모든 변경 이력까지 현재 clean으로 증명하지는 않는다.

## 독립 실행 명령과 결과

본 검수 실행은 `/tmp`의 git archive 복사본에만 출력·캐시·빌드를 생성했다. 기존 의존성과 고정 모델 캐시를 별도 복사했고 신규 설치는 하지 않았다. Node26.8.1/npm11.19.0/Vitest3.2.7/Linux. clean npm ci는 미검증.

| 명령 | 결과 | 로그 |
|---|---|---|
| `node node_modules/vitest/vitest.mjs run apps/web/test/tauri-host.test.tsx` | exit0, 14PASS | focused.log |
| baseline archive + 제출 시험, 위 명령에 `-t 'TauriHost evidence read retention'` | 기대 exit1, 4FAIL/2PASS/8 filter skip | baseline-retention.log |
| `npm run build:scanner` | exit0, pinned model 검증 포함 | build-scanner.log |
| `npm run typecheck` | exit0 | typecheck.log |
| `npm run lint` | exit0 | lint.log |
| `npm run build` | exit0, 기존 report chunk>500KB warning | build.log |
| `KRDS_TEST_UNSANDBOXED=1 KRDS_RUN_HOLDOUT=1 KRDS_HOLDOUT_REPORT=<tmp>/holdout-report.json npm run test` | exit0, 798PASS/0SKIP, 100files, 220.47s | full-holdout.log |
| `npm run test:integration` (위 플래그 제거) | exit0, production sandbox actual worker, official1/request2/한글경로 JSON검증 | integration.log |
| `KRDS_TEST_UNSANDBOXED=1 node benchmarks/banner-recall.mjs` | exit0, 보관pixels8/8, controls5 FP0, 첫frame0→합성animation1 | archived-banners.log |
| `node --expose-gc benchmarks/evidence-cache.mjs [baseline adapter]` 5쌍 교대 | 모두 exit0, 열린/재열람 바이트SHA 일치 | memory-{before,after}-{1..5}.log |
| `git diff --check e33b88d bc1e92a` | exit0 | 도구 출력 |

## 성능 수치의 해석

동일 production adapter를 번들하고 Tauri 경계만 synthetic으로 대체한 Node/V8 probe를5쌍 교대 실행했다. 96개 × 256KiB raw를 base64로 만들며 GC 뒤 heapUsed를 비교한다.

| 독립5회 중앙값 | e33b88d | 최종 코드 |
|---|---:|---:|
| retainedHeapDelta | 33,608,048 B | 8,432,312 B |
| 최초 채우기 | 10.415523ms | 21.404812ms |
| 첫 이미지 재열람 | 0.001673ms | 0.127797ms |
| 재열람 뒤 누적IPC 수 | 96 | 97 |

구현자33.61→8.43MB, 10.46→22.48ms 주장과 방향/크기가 일치한다. 메모리 보관량 감소와 직렬화 CPU 비용 증가가 함께 재현됐다. 생성 payload는 실제 JPEG가 아니며 저엔트로피 문자열이다. fill 구간에는 payload 생성/base64와 첫 이미지 hash도 포함된다. 따라서 해당 mock 전체 작업 비용이며 순수 cache CPU 시간은 아니다. 같은 workload를 양쪽에 적용했으므로 전후 비교에는 유용하다.

이 probe는 실제 native IPC 지연, 이미지 decode/texture, WebView2 GC·working set, UI 렌더, 디스크/네트워크를 측정하지 않는다. eviction 뒤 real IPC 재조회가 얼마나 느려질지는 미측정이다. 초기 cache 채우기 비용 증가는 실제 Windows에서 측정할 항목이며 이번 synthetic 수치만으로 사용자 체감 악화 결함이라고 판단하지 않았다.

## 승인 범위와 최소 후속 작업

**코드/PR 검토 준비:** 국소 코드 타당성은 승인 가능. Low 문구 범위만 정리하면 코드 검수상 차단 결함은 없다. PR-ready는 원격 목적지 승인·push 허용·보호 CI·최신 main과의 비교를 별도로 필요로 한다. 이 검수는 PR을 생성하거나 승인하지 않는다.

**Windows-ready:** 보류. 기존Windows SSH timeout/clean11 shut off 로그와 과거 candidate source5993358의 무결성은 현재 코드의 설치본 acceptance가 아니다. 이번 검수도 VM 시작·연결 복구·설치·Excel을 실행하지 않았다.

최소 다음 순서:
1. 부모가 검수 결과를 사용자에게 보고. HTTP429 문구 범위를 최소 정정 대상으로 전달.
2. 접근 가능한 Windows에서 현재 sourceSHA로 새 식별 후보 생성·설치. 즉시완료/실패retry/cancel/restart/close와 이미지 재열람 지연·working set 확인.
3. 서로 다른 공식 양성2건 D08 판단/메모 → 정상 종료/재시작 → case/묶음복원 → 통합XLSX → 실제Excel 확인.
4. 같은 후보의 upgrade/rollback/uninstall/reinstall 데이터 보존 및 Node/Chromium 잔류process 검증.
5. 소규모 authored/보관픽셀 회귀와 분리된 독립 공개 양성·음성/원본미디어 holdout 평가. Windows keyboard/200%zoom/AT 확인.

authored holdout4TP/0FP/0FN은6개 작성 템플릿·기법당 양성1개 수준의 회귀 관측이다. 보관배너8/8과5controls FP0도 외부 공개 모집단 정확도 추정이 아니다. 파생 animation은 보관픽셀에 합성 시간축을 붙인 시험이며 원본 live GIF 검증이 아니다. 대회 경쟁력 확보·출시·전체 안정화 완료를 선언하지 않는다.

소스/시험 수정, commit, push, PR, 배포, Tasks 변경은 하지 않았다. 검수 산출물만 본 /tmp 경로에 보존했다.

추가 PR 범위 확인: 부모가 제공했던 main `3e20d583`을 기준으로 로컬 객체 비교 시 `git rev-list --left-right --count main...bc1e92a`는 `0 4`다. main 대비 전체 변경은9파일 +729/-15다. 이번 두 번째 패스6파일만을 최종 main 대상 PR 전체 범위로 표시하면 안 된다. 최신 원격 main 자체를 새로 조회/fetch하지는 않았다.

## 검수 종료 증거와 사용자 전달용 요약

2026-10-25T12:45:45Z 최종 제출/원본 상태를 다시 읽었다. 제출HEADbc1e92a clean, 원본HEAD7bf3e683 clean. 독립 복사본의 추적497파일을 제출Git blob과 대조해 불일치0이다. `source-verification.json`, `final-status.log` 참조. 소스와 기존 evidence를 덮어쓰지 않았다. 실행 중 거부/미완료/결과불명 tool action은 없다. Windows 미검증 게이트는 남아 있다.

사용자 전달용: “두 번째 안정화 코드의 독립 검수에서 전체798개 시험과 실제 worker 통합이 통과했습니다. 근거 cache 누적과 삭제 후 경합 수정은 타당하며, 합성 메모리 시험에서도 보관량 감소를 재현했습니다. Retry-After 안내에 HTTP429 범위를 명시할 작은 문서 보완1건이 있습니다. PR 검토에는 올릴 수 있지만 실제Windows 설치본·D08 재시작·Excel·업데이트/제거 검증이 남아 전체 안정화 완료 판정은 보류합니다. 소규모 authored/배너 회귀 성적을 실제 공개 사이트 정확도나 대회 경쟁력 확보로 해석하지 않았습니다.”

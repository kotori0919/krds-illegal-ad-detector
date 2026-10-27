# 첫 안정화 패스 — 2026-10-25

## 범위와 기준

mathcat에서 실제 canonical checkout `<repository>`을 확인했다.
기준 HEAD는 `7bf3e6837c9d98d8a38b634091487bdf29195eb0`, branch는
`codex/post-submission-d08`, 시작 시 `git status --short`는 비어 있었다.
remote는 `https://github.com/snowman0919/krds-illegal-ad-detector.git`이며
사용자가 제공한 현재 GitHub 사용자는 kotori0919다. remote/계정 설정은 변경하지 않았다.

전용 branch는 `codex/stabilize-first-pass-20261025`, worktree는
`<stabilization-worktree>`이다.
`<workspace-instructions>/AGENTS.md`의 해당 루트 아래 worktree 금지와 기존 변경 보존을 지켰다.
원본 checkout, 기존 grampus worktree, 모델 원본, 사례 데이터에는 쓰지 않았다.

[행정안전부 공식 공고](https://mois.go.kr/frt/bbs/type013/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000006&nttId=129458)를
이번에 조회하여 공모기간 2026-09-14~10-23을 확인했다. 첨부 모집요강 PDF의 웹 조회는
HTTP 502로 실패했다. 저장소 GOAL의 탐지45/추출35/시간20, 30분 한도와 Windows 실행,
정확한 위치·공식 JSON 요건을 내부 우선순위로 사용했으며 세부 배점의 최신 첨부 원문을
다시 검증했다고 주장하지 않는다. 기존 제출일·과거 PASS를 새 마감·현재 acceptance로
승격하지 않았다. 첫 패스는 실행 수명주기 결함 하나를 명확히 고치고 회귀를 검증하는
범위로 제한했다. 탐지 정책/임계치/공식 출력 형식은 변경하지 않았다.

## 수정과 전후 근거

`TauriHost.ensureSubscribed()`는 완료된 boolean만 검사했다. UI의 `onScanEvent()`가
비동기 등록을 시작한 직후 단일/일괄 스캔이 시작되면 등록이 끝나기 전이므로 각각
다시 리스너를 등록했다. 동일 이벤트가 여러 번 전달되어 진행/완료 처리를 중복할 수 있다.
첫 등록이 실패하는 동안 다른 시작 요청은 별도로 등록에 성공하여 진행하기도 했다.

수정은 대기 중인 등록 Promise 하나를 공유한다. 모든 스캔은 같은 등록의 성공을 기다리고,
실패는 호출자 모두에게 전달하며, 실패 후 새 시도는 다시 등록할 수 있다. 완료 후 기존
단일 구독 재사용과 프런트 handler 해제 동작은 유지한다.

실제 Tauri 경계만 mock한 결정적 동시성 시험 두 개를 추가했다. 같은 새 시험을 기준
소스에 실행하면 **FAIL**: 등록 3회(기대 1회), 등록 실패 중 시작 2건이 fulfilled
(기대 rejected). 수정 후 해당 파일은 **10/10 PASS**. 시간 sleep에 의존하지 않고
등록 Promise를 보류/해제/거부하여 경합을 제어한다. 이 시험은 실제 Windows IPC가 아니다.

원시 로그는 worktree의 `artifacts/stabilization-20261025/`에 보존했다. 첫 환경 준비
실패와 수정 전/후 로그도 구분한다. 신규 worktree에는 기존 root와 web의 의존성을
복사했고, 끊어진 NAS 모델 캐시 링크 대신 canonical checkout의 패키징 모델을 작업
복사본으로 가져왔다. 빌드가 manifest 크기/SHA를 검증했다. 다운로드나 lock 갱신 없이
현재 소스로 다시 컴파일했다. 캐시 복원은 제품 성능 개선이 아니다.

## 다음 검수의 우선순위

1. 부모의 diff·회귀 시험 독립 검수 후 이 HEAD로 Windows 후보를 별도 식별하여 빌드한다.
   설치 앱의 시작 직후 스캔/실패 후 재시도/취소/재실행/종료를 시험한다. 새 패키지는 아직 없다.
2. 두 공개 공식 양성 대상의 D08: 서로 다른 판단·메모 → 종료·재시작 → 두 사례와 묶음 복원
   → 통합 XLSX를 실제 Excel에서 확인한다. 기존 양성 없는 배치나 단일 양성 결과를 합산하지 않는다.
3. Windows 업그레이드·rollback·제거/재설치의 기존 사례/공식 JSON 바이트 보존,
   취소·타임아웃·앱 종료 후 Node/Chromium 잔류 프로세스 검사. 기존 Job Object 구현의 소스
   존재나 과거 관측을 새 설치본 통과로 간주하지 않는다.
4. OCR/멀티모달은 이미지 원본·OCR 원문·대체문·모델 경로·보조 근거를 함께 검수한다.
   현재 fixture 결과와 공개 양성/음성 holdout을 분리하고 임계치 개선은 별도 전후 비교로 수행한다.
5. 대규모 관계 그래프/이미지 반복 열람의 Windows 메모리와 키보드·200% zoom·AT 검증.
   TauriHost의 evidenceReads는 현재 성공 응답을 계속 유지하므로 다수 사례의 이미지 열람 시
   프런트 메모리 증가 후보가 있다. 이 패스에서는 측정 없이 eviction 정책을 바꾸지 않았다.

원격 push/PR, release, 배포, 대회 제출, 유료 자원, credential/권한 변경,
Google Tasks 상태 변경을 수행하지 않았다. 부모 1차 검수 전 후속 구현은 중지한다.

## 이번 실행 결과

환경: Linux mathcat, Node v26.8.1, npm 11.19.0, Vitest 3.2.7. 새 npm 설치 대신
기존 locked 의존성을 복사했다. clean `npm ci`의 재현성 검증은 이번에 하지 않았다.

| 명령 / 범위 | 상태 | 관측 결과 |
| --- | --- | --- |
| 기준 소스 + 신규 경합 시험 `npx vitest run apps/web/test/tauri-host.test.tsx -t shares` | FAIL (의도한 결함 재현) | 두 시험 실패: 등록3회, 실패 중 스캔 시작 허용 |
| 수정 후 `npx vitest run apps/web/test/tauri-host.test.tsx` | PASS | 10 tests, exit0 |
| `npx vitest run --project web` | PASS | 172 tests / 23 files, exit0 |
| `npm run typecheck && npm run lint && git diff --check` | PASS | exit0 |
| `npm run build:scanner` | PASS | contracts/synth-eval/scanner/evidence/detection, 고정 모델 검증 |
| `npm run build` | PASS | contracts/evidence/web, exit0; 기존 report chunk >500kB 경고 유지 |
| 샌드박스 내 `KRDS_TEST_UNSANDBOXED=1 npm run test` | FAIL (환경) | 소켓 생성 EPERM, fixture setup 불가; 중단 exit130. 성공 시험으로 합산하지 않음 |
| 호스트 `KRDS_TEST_UNSANDBOXED=1 npm run test` | PASS | 793 passed / 1 skipped, 99 passed files / 1 skipped file, 225.31s, exit0 |
| 호스트 `npm run test:integration` | PASS | 실제 worker·production sandbox, 공식1건·정상문구 제외·한글경로 파일 검증, exit0 |
| Windows native build / NSIS / 설치·업데이트·제거 | NOT_RUN | 이번 HEAD의 후보 생성 및 Windows 실행 없음 |
| Windows 실제 D08 / Excel / AT / 잔류 프로세스 | NOT_RUN | 이전 관측을 현재 통과로 전용하지 않음 |

전체 suite의 실제 OCR/ONNX·DOM/iframe/숨김 탐지·오탐 방지·취소/deadline·그래프 범위·
근거 지연/재시도·검토 저장·묶음 복원·엑셀 생성 경계를 포함한다. Linux synthetic/fixture,
mock host와 jsdom UI, production worker 통합 각각의 범위는 다르다. 전체 suite 통과가
Windows 설치본 수용이나 실제 공개 사이트 모집단의 정확도를 입증하지 않는다.

시청형 fixture의 이번 C1/C2/C3/C4 wall은 9.253/5.937/4.753/4.713s이고 기대 탐지·실패
페이지 동등성 시험을 통과했다. 이는 단일 실행의 회귀 관측이며 이번 수정의 속도 향상이나
Windows 최대200페이지 성능으로 해석하지 않는다.

초기 환경 실패: 새 worktree의 contracts/evidence 빌드 전 package export 누락,
web 하위 의존성 복사 전 plugin-react 누락, NAS 캐시 링크 ENOTDIR. 현재 소스 build/check
성공 전에 각각 원인을 해결했다. 원본 파일을 수정하거나 실패한 해시를 신뢰하도록 바꾸지 않았다.

## 재현과 인계

이 worktree에서 다음 명령으로 재검수한다. 모델과 브라우저 캐시는 BUILD_MANUAL의
고정 manifest에 맞아야 하며 loopback 소켓 권한이 필요하다. `KRDS_TEST_UNSANDBOXED`
변수는 소유 fixture 시험에만 사용하고 production worker 통합에는 설정하지 않는다.

```sh
cd "$STABILIZATION_WORKTREE" # 검수 대상 독립 checkout 경로를 지정
npm run build:scanner
npm run check # Linux fixture sandbox 지원이 없으면 아래의 명시적 시험 방식 사용
# npm run typecheck && npm run lint && KRDS_TEST_UNSANDBOXED=1 npm run test
npm run build
npm run test:integration
git show --stat HEAD
git rev-parse HEAD
git status --short
```

등록 경합의 단독 재현은 신규 두 시험을 유지한 채 별도 임시 checkout에서
`apps/web/src/host/tauri.ts`만 기준 HEAD 버전으로 두고 `-t shares`를 실행하면 된다.
현재 제출/원본 checkout을 바꾸지 않는다. 로컬 커밋에 코드·시험·본 인계를 보존하고
raw 로그는 `artifacts/stabilization-20261025/`에 둔다. 최종 exact HEAD는 부모에게
별도 반환한다. 부모의 독립 1차 검수 후 후속 범위를 결정한다.

기존 skip은 `packages/synth-eval/test/adoption-holdout.test.ts`의 opt-in
`KRDS_RUN_HOLDOUT=1` 시험이다. 이번 패스에서 활성화하지 않았으며 **NOT_RUN**이다.

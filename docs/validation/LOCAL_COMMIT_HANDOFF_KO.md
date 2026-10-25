# r2 검증 귀속과 local commit 준비 — 제품 소스 동결

상태 갱신: 부모가 r2 108PASS와 최종 noEmit6프로젝트/ESLint265파일을 검수하고 분리된 local commit을 지시했다. 아래는 승인된 커밋 분리 목록이다. 최종 commit SHA와 상태는 FINAL_LOCAL_DELIVERY_KO.md에서 확인한다. 제품 소스·시험·기존 r1/r2 manifest·이전 결과 파일은 변경하지 않았다. 현재 HEAD는 `ae12f7c766d8f1c7f882afb71cd93499b260729f`, branch `fix/adult-semantic-20261026`, worktree `/home/monad/Documents/Codex/2026-10-26/task/krds-adult-semantic`이다. 원본/main/다른 worktree/remote/Tasks/VM을 변경하지 않았다.

## 이번에 대조한 r2 증거

소스 identity manifest SHA256: `4125496324d80b8da50a5407510a67595e16cb25004b42490ec342a9981b7993`.

부모가 검수한 guard-owner 실행 기록을 읽고, manifest의23개 SHA와 batch의source_before/source_after 및 현재 파일 SHA를 대조해 모두 일치함을 확인했다. 이 확인은 파일/기록 대조이며 제품시험을 재실행한 것이 아니다. 원본 evidence와 바이트가 같은 작은 사본을 `r2-evidence/`에 두고 source path와 SHA를 `PROVENANCE.json`에 기록했다.

| 고정 profile | collected / passed | exit |
| --- | --- | --- |
| r2-semantic-27 | 27 / 27 | 0 |
| r2-ocr-11 | 11 / 11 | 0 |
| r2-result-19 | 19 / 19 | 0 |
| r2-config-13 | 13 / 13 | 0 |
| r2-case-38 | 38 / 38 | 0 |
| 합계 | 108 / 108 | 각0 |

기록상 실행은 2026-10-26 08:09:34–08:10:08 KST에 파일별 순차1회였다. scope당192/256MiB·swap0·CPU25%·Tasks32·30초한도, aggregate2GiB였다. 보고된 peak는80.641–93.684MiB이며 timeout/resource failure/retry/OOM event는0이다. 각 종료 뒤 aggregate pids.current0/reservation없음이다. 이 작은 mock/pure 시험의 메모리를 모델 추론 메모리로 해석하지 않는다.

`R2_REVIEW_KO.md`는 정적 승인이며 실행 완료 전 작성됐다. 이후 완료된108PASS는 별도의 실행 보고서/batch에 귀속한다. 예전 OCR8/r1의89/초기 관련56/초기819PASS1FAIL1SKIP을 합산하거나 r2의 실행으로 대체하지 않는다. r2 manifest의 EDITED_NOT_RUN/expected 문구는 작성 당시 snapshot이며, 이를 고쳐 identity를 깨지 않는다. 실제 완료 상태는 이 문서와 실행 evidence가 보완한다.

## 예정 commit A — 성인 category/CTA와 policy3/Case 계약 (19파일)

제안 제목: `fix: detect adult solicitations with policy3 identity`

성인 category/행동·문장/부정 grammar, 기존 도박·금융·공공/도서관 예외, 근거span과 Case 정책 추적은 하나의 동작 변경으로 묶는다. semantic만 먼저 commit하면 새 판정 결과를 policy2로 표시하는 중간 상태가 되므로 policy3/Case 호환도 같은 단위로 묶는 편이 낫다.

- docs/CONTRACTS.md
- packages/contracts/src/config.ts
- packages/contracts/src/policy.json
- packages/contracts/src/result.ts
- packages/contracts/src/case.ts
- packages/contracts/test/config.test.ts
- packages/contracts/test/result.test.ts
- packages/contracts/test/case.test.ts
- packages/detection/src/semantic.ts
- packages/detection/src/adult-solicitation.ts
- packages/detection/test/adult-context.test.ts
- packages/detection/test/adult-semantics.test.ts
- packages/detection/test/adult-evaluation.test.ts
- packages/detection/test/fixtures/adult-evaluation/README.md
- packages/detection/test/fixtures/adult-evaluation/cases.json
- packages/detection/test/fixtures/adult-evaluation/holdout.json
- src-tauri/src/config.rs
- src-tauri/src/case_store.rs
- src-tauri/src/main.rs

r2 고정 실행 중 이 commit에 직접 관련된 pure/contract 검사는27+19+13+38=97PASS다. 포함된 browser/evaluation 시험과 native Rust는 r2에서 실행하지 않았으므로 전체19파일의 runtime 수용을 뜻하지 않는다. 기존 authored corpus의6TP/0FP/0FN은 초기 소스의 국소 관측이며 최신 r2/외부 성능 수치로 쓰지 않는다.

## 예정 commit B — OCR host 진단 (3파일)

제안 제목: `fix: retain bounded OCR failure diagnostics`

- packages/evidence/src/ocr.ts
- packages/evidence/src/ocr-diagnostics.ts
- packages/evidence/test/ocr-diagnostics.test.ts

원래 cause의 in-process 연결과 고정어휘 stage/errno 로그, error.name1회snapshot 및 getter/민감정보 경계를 묶는다. 공개 오류 메시지와 worker 프로토콜은 유지한다. r2의mock11PASS에만 귀속하며 실제 OCR/EmbeddingGemma/native 모델 실패 해결 commit으로 설명하지 않는다. A와 소스 파일이 겹치지 않는다.

## 예정 commit C — 검증·이력 문서

제안 제목: `docs: record r2 verification scope and evidence`

`docs/validation/` 아래 인계 문서·실패 이력·원본 r1/r2 identity·이번 evidence 사본과 provenance를 별도 문서 단위로 묶는다. 두 제품 commit 뒤 정확한 commit SHA/patchstat를 최종 인계에 연결할 수 있다. 승인 전에는 stage하지 않는다. 작업용 node_modules/dist/모델/guard/다른 작업 디렉터리의 원본 파일은 commit 대상으로 넣지 않는다.

## 미완료와 승인 대기

- type/lint: source noEmit6프로젝트 exit0 및 ESLint265파일0errors/0warnings를 최종 보고서와 대조했다. 384/512MiB·swap0·CPU50%·Tasks48·120초scope에서 순차 실행했고 peak는 각각319.504/302.492MiB, memory.events증가/timeout0이었다. literal npm typecheck(tsc-b)/build를 실행한 것은 아니다.
- 최신 build/전체 suite/실제 Chromium DOM·공식 출력 재현: NOT_RUN. 초기 소스에서 한 실행은 역사 증거로만 남긴다.
- native Rust mapping/누락-null회귀, Case 저장·재시작/export-import 왕복: NOT_RUN. TS 계약 PASS를 native 수용으로 확대하지 않는다.
- 실제 OCR/native 모델/image-embedding: 새 r2 검증으로 실행하지 않았다. 이전 전체 suite의 `OCR recognition failed` 원인은 미해결이다. 진단 mock PASS는 모델 복구의 증거가 아니다.
- Windows 설치/CPU 수용/D08/Excel/실제 심사 실행물 갱신: 이 작업에서 NOT_RUN. VM 조작 없음.
- 국제 성인 category/영문 CTA, 복잡한 부정·반어·혼합문맥: 미지원/유한 grammar 한계 유지.

추가 제품 실행이나 소스 변경 없이 승인된 local commit만 진행한다. main/다른worktree/remote 통합은 금지 상태다. 후속 실행은 canonical guard의 새 승인된 identity/profile을 통해서만 한다. 기존 한 번 실행한 marker/예약을 재사용하지 않는다.

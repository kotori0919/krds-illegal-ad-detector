# 성인광고 semantic 보완 — 로컬 인도 상태

검증된 제품 소스는 r2 manifest `4125496324d80b8da50a5407510a67595e16cb25004b42490ec342a9981b7993`와 동일하다. 동결 뒤 제품 코드/시험을 수정하지 않고 승인된 local commit으로 기록했다. 기준은 `ae12f7c766d8f1c7f882afb71cd93499b260729f`, branch는 `fix/adult-semantic-20261026`, worktree는 `<candidate-worktree>`이다.

## 변경과 로컬 커밋

1. `4f82b6af3e78fbbb3bbfba54f6ca0779f8fca834` — 성인 서비스 category+CTA/문장·부정·인용/교육 문맥 보완, policy3/Case 역사호환. 19파일, +489/-22.
2. `549d2e262a4c2ac597114b7dde75345b3d202d8a` — OCR host 원래cause 및 고정어휘 실패단계 진단. 3파일, +217/-15. 실제 모델 실패를 고쳤다는 의미가 아니다.
3. 이 문서를 포함하는 문서 커밋 — 실패/검수/실행 증거와 파일 identity 이력. 정확한 SHA는 최종 인도 응답과 `git log`로 식별한다.

파일 목록은 `LOCAL_COMMIT_RECORD.json`과 각 커밋의 `git show --name-only`에 있다. A/B의 파일 집합은 서로 겹치지 않는다. 사용자와 부모가 지정한 작업/검증 경로는 증거 식별용으로 유지했다. 인증키/개인 연락처/모델/설치본/큰 생성물은 포함하지 않는다. fixture의 secret/private 문구는 허용목록 누출 방지를 시험하는 synthetic 값이다.

core.hooksPath/commit.gpgsign 등 별도 실행 설정이 없고 기본 hooks에는 sample만 있었다. 유효 commit hook이 없어 우회하지 않았다. git commit의 자동 maintenance/gc만 명령별로 비활성화해 무거운 부수작업을 막았고 repo/global 설정은 바꾸지 않았다. 별도 제품시험·build·모델·VM 실행은 추가하지 않았다. 제품 커밋의 diff whitespace 검사는 통과했다. 문서 커밋에는 원문과 SHA가 같은 역사 로그3개의 EOF 빈줄 경고가 있으며, 증거 바이트를 보존하기 위해 삭제하지 않았다.

## exact r2에 귀속되는 PASS

- 고정5파일: 27 semantic +11 OCR mock +19 result +13 config +38 Case = **108/108 PASS**, 각 child exit0.
- TypeScript: 현재 소스를 별칭으로 해석하는 noEmit projection 6프로젝트(contracts/synth-eval/scanner/detection/evidence/web), 모두 exit0. 원본 npm typecheck의 `tsc -b`/emit lifecycle/build를 실행한 것은 아니다.
- ESLint: 기존 rules, 고정 standard source265파일, 0errors/0warnings, no-fix/no-cache.
- 제품/문서23개 해시는 위 실행 전·후 및 로컬 커밋 준비 시 모두 manifest와 일치했다. 원본/보존 r1/r2 manifest는 수정하지 않았다.

실행·검수 보고서는 `r2-evidence/`의 원본 바이트 사본과 provenance를 참조한다. 첫 typecheck의 relocated node/vite type lookup 설정 실패는 별도 보존된 환경준비 실패이며, task-local 경로만 수정한 새profile에서6개가 통과했다. 컴파일러 strictness를 낮추거나 product를 수정해 통과시킨 것이 아니다.

## 자원 한도와 해석

108회귀는 파일별 순차1회, scope high192/max256MiB·swap0·CPU25%·Tasks32·30초deadline에서 수행됐다. 관측 peak80.641–93.684MiB, timeout/resource/OOM retry0이다. noEmit/lint는 별도 순차 scope high384/max512MiB·swap0·CPU50%·Tasks48·120초deadline, peak319.504/302.492MiB, 이벤트 증가/timeout0이었다. 공통 aggregate2GiB/shared lock·예약은 유지됐고 최종 TasksCurrent0/예약없음이 보고됐다.

이 수치는 mock/pure/정적 검사 프로세스의 자원 관측이며 EmbeddingGemma·실모델·Windows 작업의 메모리나 처리시간 수치가 아니다. 후속 실행은 새로 승인된 canonical guard profile/identity를 통해서만 한다. 기존 one-shot marker를 재사용하지 않는다.

## 역사 증거와 미완료

초기 실제 Chromium에서는 성인 양성5개의 누락을 재현하고 초기 국소 수정 뒤 양성을 찾았다. 첫 별도 평가의 도서관 오탐1개를 수정에 썼으므로 해당 corpus는 회귀셋으로 승격했다. 당시 별도 same-author authored holdout6TP/0FP/0FN과 위치·원문6/6은 국소 synthetic 관측이며 최신 r2/외부 성능이나 심사 점수로 전용하지 않는다. 원래 로그는 `historical-evidence/`에 별도 보존한다.

**최신 r2의 build/fullsuite/Chromium DOM·공식출력 재현/native Rust/Case 저장·재시작 및 export-import/실모델 OCR·image-embedding/Windows 설치·D08·Excel은 NOT_RUN**이다. 초기 전체 suite819PASS1FAIL1SKIP의 `OCR recognition failed` 원인은 미해결이며 mock11PASS로 덮지 않는다. TS계약 통과는 native 역직렬화·저장 수용의 대체가 아니다.

지원은 유한한 한국어 범주·CTA grammar다. 복잡한 반어/부정/여러 서비스 혼합·영문 adult category/CTA는 미지원 한계가 있다. 기존 casino 영어 지원을 성인 국제 coverage로 확대해 설명하지 않는다.

이 인도는 국소 소스·증거의 로컬 커밋까지다. main/공유 stabilization worktree 통합, push/PR/배포/제출/Tasks 변경은 하지 않았다. 대회 실행물 갱신 또는 Windows 수용을 완료했다고 주장하지 않는다.
